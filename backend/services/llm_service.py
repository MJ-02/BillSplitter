import httpx
import json
import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

load_dotenv()

LLM_API_URL = os.getenv("LLM_API_URL", "http://localhost:1234/v1/chat/completions")


class ReceiptItem(BaseModel):
    name: str
    quantity: int = Field(ge=1)
    price: float = Field(ge=0)


class ParsedReceipt(BaseModel):
    restaurant: str
    items: list[ReceiptItem]
    subtotal: float = Field(ge=0)
    tax: float = Field(default=0.0, ge=0)
    delivery_fee: float = Field(default=0.0, ge=0)
    tip: float = Field(default=0.0, ge=0)
    discount: float = Field(default=0.0, ge=0)
    total: float = Field(ge=0)

    @field_validator("items")
    @classmethod
    def items_must_not_be_empty(cls, v: list[ReceiptItem]) -> list[ReceiptItem]:
        if not v:
            raise ValueError("Receipt must contain at least one item")
        return v


FILL_INVOICE_TOOL = {
    "type": "function",
    "function": {
        "name": "fill_invoice",
        "description": "Fill in the structured invoice data extracted from a receipt.",
        "parameters": {
            "type": "object",
            "properties": {
                "restaurant": {
                    "type": "string",
                    "description": "Name of the restaurant or food establishment"
                },
                "items": {
                    "type": "array",
                    "description": "List of ordered items",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Item name"},
                            "quantity": {"type": "integer", "minimum": 1, "description": "Quantity ordered"},
                            "price": {"type": "number", "minimum": 0, "description": "Price per unit"}
                        },
                        "required": ["name", "quantity", "price"]
                    }
                },
                "subtotal": {"type": "number", "minimum": 0, "description": "Sum of all item prices before fees"},
                "tax": {"type": "number", "minimum": 0, "description": "Tax amount (0 if not present)"},
                "delivery_fee": {"type": "number", "minimum": 0, "description": "Delivery fee (0 if not present)"},
                "tip": {"type": "number", "minimum": 0, "description": "Tip amount (0 if not present)"},
                "discount": {"type": "number", "minimum": 0, "description": "Discount amount (0 if not present)"},
                "total": {"type": "number", "minimum": 0, "description": "Final total after all fees and discounts"}
            },
            "required": ["restaurant", "items", "subtotal", "total"]
        }
    }
}


async def parse_receipt_text(ocr_text: str) -> dict:
    """Parse OCR text using local LLM tool calling to extract structured receipt data."""

    print(f"📨 Sending {len(ocr_text)} characters to LLM at {LLM_API_URL}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            print("⏳ Waiting for LLM response...")
            response = await client.post(
                LLM_API_URL,
                json={
                    "model": "liquid/lfm2.5-1.2b",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a receipt parsing assistant. "
                                "Extract all information from the receipt and call the fill_invoice tool "
                                "with the structured data. Always call the tool — never reply with plain text."
                            )
                        },
                        {
                            "role": "user",
                            "content": f"Parse this receipt:\n\n{ocr_text}"
                        }
                    ],
                    "tools": [FILL_INVOICE_TOOL],
                    "tool_choice": "required", # force tool choice
                    "temperature": 0.1,
                    "max_tokens": 2000
                }
            )

            if response.status_code != 200:
                print(f"❌ LLM API returned status {response.status_code}")
                raise Exception(f"LLM API error: {response.status_code} - {response.text}")

            result = response.json()
            message = result["choices"][0]["message"]
            print("📬 Received LLM response")

            tool_calls = message.get("tool_calls")
            if not tool_calls:
                raise Exception(
                    "LLM did not call the fill_invoice tool. "
                    f"Response content: {message.get('content', '')[:200]}"
                )

            tool_call = tool_calls[0]
            if tool_call["function"]["name"] != "fill_invoice":
                raise Exception(f"Unexpected tool called: {tool_call['function']['name']}")

            raw_args = tool_call["function"]["arguments"]
            args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args

            parsed = ParsedReceipt(**args)
            print("✅ Receipt validated successfully via fill_invoice tool")
            return parsed.model_dump()

    except httpx.TimeoutException:
        error_msg = "LLM API timeout - is LM Studio running on localhost:1234?"
        print(f"⏱️  {error_msg}")
        raise Exception(error_msg)
    except httpx.ConnectError:
        error_msg = "Cannot connect to LLM API - please start LM Studio on localhost:1234 and load a model"
        print(f"🔌 {error_msg}")
        raise Exception(error_msg)
    except Exception as e:
        error_msg = f"LLM parsing failed: {str(e)}"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)
