import os
from twilio.rest import Client
from typing import List, Dict, Optional
from datetime import datetime

# Initialize Twilio client
TWILIO_SID = os.getenv("TWILIO_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")  # Optional: for direct phone number
TWILIO_MESSAGING_SERVICE_SID = os.getenv("TWILIO_MESSAGING_SERVICE_SID")  # Optional: alternative to phone number

if not TWILIO_SID or not TWILIO_AUTH_TOKEN:
    print("Warning: Twilio credentials not found in environment variables")
    twilio_client = None
else:
    twilio_client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)


async def send_payment_reminder(
    recipient_name: str,
    recipient_phone: str,
    payer_name: str,
    restaurant: str,
    amount: float,
    items: List[str],
    payment_method: str = "Cliq"
) -> Dict:
    """
    Send a payment reminder SMS to a user
    
    Args:
        recipient_name: Name of person who owes money
        recipient_phone: Phone number to send SMS to
        payer_name: Name of person who paid
        restaurant: Restaurant name
        amount: Amount owed
        items: List of item names
        payment_method: Payment method (default: Cliq)
    
    Returns:
        Dict with status and message_sid
    """
    if not twilio_client:
        return {
            "status": "error",
            "message": "Twilio client not initialized",
            "recipient": recipient_phone
        }
    
    # Format items list
    items_text = ", ".join(items) if items else "your order"
    
    # Create message
    message_body = (
        f"Hey {recipient_name}! 👋\n\n"
        f"You owe {payer_name} ${amount:.2f} for {restaurant}.\n\n"
        f"Items: {items_text}\n\n"
        f"Please pay via {payment_method}."
    )
    
    try:
        # Build message parameters
        message_params = {
            "body": message_body,
            "to": recipient_phone
        }
        
        # Use messaging service SID if available, otherwise use phone number
        if TWILIO_MESSAGING_SERVICE_SID:
            message_params["messaging_service_sid"] = TWILIO_MESSAGING_SERVICE_SID
        elif TWILIO_PHONE_NUMBER:
            message_params["from_"] = TWILIO_PHONE_NUMBER
        else:
            return {
                "status": "error",
                "message": "Neither TWILIO_PHONE_NUMBER nor TWILIO_MESSAGING_SERVICE_SID set in environment",
                "recipient": recipient_phone
            }
        
        message = twilio_client.messages.create(**message_params)
        
        return {
            "status": "sent",
            "message_sid": message.sid,
            "recipient": recipient_phone,
            "sent_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e),
            "recipient": recipient_phone
        }


async def send_bulk_reminders(reminders: List[Dict]) -> List[Dict]:
    """
    Send multiple payment reminders at once
    
    Args:
        reminders: List of reminder dicts with recipient info
    
    Returns:
        List of results for each reminder
    """
    results = []
    
    for reminder in reminders:
        result = await send_payment_reminder(
            recipient_name=reminder["recipient_name"],
            recipient_phone=reminder["recipient_phone"],
            payer_name=reminder["payer_name"],
            restaurant=reminder["restaurant"],
            amount=reminder["amount"],
            items=reminder.get("items", []),
            payment_method=reminder.get("payment_method", "Venmo/Zelle/Cash")
        )
        results.append(result)
    
    return results
