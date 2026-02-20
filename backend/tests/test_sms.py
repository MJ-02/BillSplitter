import asyncio
from dotenv import load_dotenv
import os

load_dotenv()

from services.sms_service import send_payment_reminder

async def test_sms():
    print("Testing Twilio SMS integration...")
    
    # Test Msg
    result = await send_payment_reminder(
        recipient_name="JOHN DOE",
        recipient_phone="<TEST_NUMBER_HERE>",
        payer_name="Jane Smith",
        restaurant="Pizza Palace",
        amount=7.5,
        items=["Pepperoni Pizza", "Garlic Bread"],
        payment_method="Cliq @janesmith"
    )
    
    if result["status"] == "sent":
        print(" SMS sent successfully!")
        print(f"Message SID: {result['message_sid']}")
    elif result["status"] == "error":
        print("Attention needed:")
        print(f"   {result['message']}")
    else:
        print("Failed to send SMS:")
        print(f"   {result['error']}")

if __name__ == "__main__":
    asyncio.run(test_sms())
