import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

LLM_API_URL = os.getenv("LLM_API_URL", "http://localhost:1234/v1/chat/completions")

async def parse_receipt_text(ocr_text: str) -> dict:
    """Parse OCR text using local LLM to extract structured data"""
    
    print(f"📨 Sending {len(ocr_text)} characters to LLM at {LLM_API_URL}")
    
    system_prompt = """You are a receipt parsing expert. Extract structured information from receipt text.
Return a JSON object with this exact structure:
{
  "restaurant": "Restaurant Name",
  "items": [
    {"name": "Item Name", "quantity": 1, "price": 10.99}
  ],
  "subtotal": 10.99,
  "tax": 0.99,
  "delivery_fee": 2.99,
  "tip": 2.00,
  "discount": 0.00,
  "total": 16.97
}

Rules:
- Extract all items with their quantities and prices
- Include all fees, taxes, tips, and discounts
- Set missing values to 0 or null
- Return ONLY valid JSON, no additional text"""

    user_prompt = f"Parse this receipt:\n\n{ocr_text}"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            print("⏳ Waiting for LLM response...")
            response = await client.post(
                LLM_API_URL,
                json={
                    "model": "liquid/lfm2.5-1.2b",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 2000
                }
            )
            
            if response.status_code != 200:
                print(f"❌ LLM API returned status {response.status_code}")
                raise Exception(f"LLM API error: {response.status_code} - {response.text}")
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            print(f"📬 Received LLM response ({len(content)} chars)")
            
            # Try to extract JSON from response
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            parsed_data = json.loads(content)
            print(f"✅ Successfully parsed LLM JSON response")
            return parsed_data
            
    except httpx.TimeoutException:
        error_msg = "LLM API timeout - is LM Studio running on localhost:1234?"
        print(f"⏱️  {error_msg}")
        raise Exception(error_msg)
    except httpx.ConnectError:
        error_msg = "Cannot connect to LLM API - please start LM Studio on localhost:1234 and load a model"
        print(f"🔌 {error_msg}")
        raise Exception(error_msg)
    except json.JSONDecodeError as e:
        error_msg = f"Failed to parse LLM response as JSON: {str(e)}\nResponse: {content[:200]}..."
        print(f"⚠️  {error_msg}")
        raise Exception(error_msg)
    except KeyError as e:
        error_msg = f"Unexpected LLM response format: missing key {str(e)}"
        print(f"⚠️  {error_msg}")
        raise Exception(error_msg)
    except Exception as e:
        error_msg = f"LLM parsing failed: {str(e)}"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)
