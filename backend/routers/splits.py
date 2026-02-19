from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import models
import schemas
from database import get_db
from services.sms_service import send_payment_reminder, send_bulk_reminders

router = APIRouter()


@router.post("/", response_model=schemas.Split)
def create_split(split: schemas.SplitCreate, db: Session = Depends(get_db)):
    """Create a new split for an order"""
    # Verify order exists
    order = db.query(models.Order).filter(models.Order.id == split.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify user exists
    user = db.query(models.User).filter(models.User.id == split.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create split
    db_split = models.Split(**split.model_dump())
    db.add(db_split)
    db.commit()
    db.refresh(db_split)
    return db_split


@router.get("/order/{order_id}", response_model=List[schemas.Split])
def get_order_splits(order_id: int, db: Session = Depends(get_db)):
    """Get all splits for a specific order"""
    splits = db.query(models.Split).filter(models.Split.order_id == order_id).all()
    return splits


@router.put("/{split_id}/paid", response_model=schemas.Split)
def mark_split_paid(split_id: int, paid: bool, db: Session = Depends(get_db)):
    """Mark a split as paid or unpaid"""
    split = db.query(models.Split).filter(models.Split.id == split_id).first()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")
    
    split.paid_status = paid
    db.commit()
    db.refresh(split)
    return split


@router.post("/{split_id}/send-reminder")
async def send_reminder_for_split(split_id: int, db: Session = Depends(get_db)):
    """Send a payment reminder SMS for a specific split"""
    # Get split with related data
    split = db.query(models.Split).filter(models.Split.id == split_id).first()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")
    
    # Get user
    user = db.query(models.User).filter(models.User.id == split.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get order
    order = db.query(models.Order).filter(models.Order.id == split.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get payer
    payer = db.query(models.User).filter(models.User.id == order.paid_by_user_id).first()
    if not payer:
        raise HTTPException(status_code=404, detail="Payer not found")
    
    # Get items for this split
    items = db.query(models.Item).filter(
        models.Item.id.in_(split.item_ids if split.item_ids else [])
    ).all()
    item_names = [item.name for item in items]
    
    # Determine phone number (prefer whatsapp_number, fallback to phone)
    recipient_phone = user.whatsapp_number if user.whatsapp_number else user.phone
    
    # Determine payment method
    payment_method = payer.payment_handle if payer.payment_handle else "Venmo/Zelle/Cash"
    
    # Send reminder
    result = await send_payment_reminder(
        recipient_name=user.name,
        recipient_phone=recipient_phone,
        payer_name=payer.name,
        restaurant=order.restaurant,
        amount=split.amount_owed,
        items=item_names,
        payment_method=payment_method
    )
    
    # Update split with reminder status
    if result["status"] == "sent":
        split.reminder_sent = True
        split.reminder_sent_at = datetime.utcnow()
        split.message_sid = result.get("message_sid")
        db.commit()
        db.refresh(split)
    
    return {
        "split_id": split_id,
        "sms_result": result,
        "split": split
    }


@router.post("/order/{order_id}/send-all-reminders")
async def send_all_reminders_for_order(order_id: int, db: Session = Depends(get_db)):
    """Send payment reminders to all users in an order"""
    # Get order
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get payer
    payer = db.query(models.User).filter(models.User.id == order.paid_by_user_id).first()
    if not payer:
        raise HTTPException(status_code=404, detail="Payer not found")
    
    # Get all splits for this order
    splits = db.query(models.Split).filter(models.Split.order_id == order_id).all()
    if not splits:
        raise HTTPException(status_code=404, detail="No splits found for this order")
    
    # Prepare reminders
    reminders = []
    split_map = {}
    
    for split in splits:
        # Skip if already paid
        if split.paid_status:
            continue
        
        # Get user
        user = db.query(models.User).filter(models.User.id == split.user_id).first()
        if not user:
            continue
        
        # Get items for this split
        items = db.query(models.Item).filter(
            models.Item.id.in_(split.item_ids if split.item_ids else [])
        ).all()
        item_names = [item.name for item in items]
        
        # Determine phone number
        recipient_phone = user.whatsapp_number if user.whatsapp_number else user.phone
        
        # Determine payment method
        payment_method = payer.payment_handle if payer.payment_handle else "Venmo/Zelle/Cash"
        
        reminder = {
            "recipient_name": user.name,
            "recipient_phone": recipient_phone,
            "payer_name": payer.name,
            "restaurant": order.restaurant,
            "amount": split.amount_owed,
            "items": item_names,
            "payment_method": payment_method
        }
        reminders.append(reminder)
        split_map[recipient_phone] = split
    
    if not reminders:
        return {
            "message": "No unpaid splits to send reminders for",
            "results": []
        }
    
    # Send all reminders
    results = await send_bulk_reminders(reminders)
    
    # Update splits with reminder status
    for result in results:
        if result["status"] == "sent":
            split = split_map.get(result["recipient"])
            if split:
                split.reminder_sent = True
                split.reminder_sent_at = datetime.utcnow()
                split.message_sid = result.get("message_sid")
    
    db.commit()
    
    return {
        "message": f"Sent {len(results)} reminders",
        "results": results
    }


@router.post("/bulk", response_model=List[schemas.Split])
def create_bulk_splits(data: schemas.BulkSplitCreate, db: Session = Depends(get_db)):
    """Create splits for all users based on item assignments. Replaces any existing splits for the order."""
    order = db.query(models.Order).filter(models.Order.id == data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Clear existing splits so this is idempotent (e.g. user goes back and re-assigns)
    db.query(models.Split).filter(models.Split.order_id == data.order_id).delete()
    db.commit()

    items = db.query(models.Item).filter(models.Item.order_id == data.order_id).all()
    item_map = {item.id: item for item in items}

    # Accumulate each user's item subtotal and which item ids they're assigned
    user_subtotals: dict[int, float] = {}
    user_item_ids: dict[int, list[int]] = {}

    for assignment in data.assignments:
        item = item_map.get(assignment.item_id)
        if not item or not assignment.user_ids:
            continue
        per_user_cost = (item.price * item.quantity) / len(assignment.user_ids)
        for uid in assignment.user_ids:
            user_subtotals.setdefault(uid, 0.0)
            user_item_ids.setdefault(uid, [])
            user_subtotals[uid] += per_user_cost
            if assignment.item_id not in user_item_ids[uid]:
                user_item_ids[uid].append(assignment.item_id)

    if not user_subtotals:
        raise HTTPException(status_code=400, detail="No valid assignments provided")

    total_subtotal = sum(user_subtotals.values())
    fees = (order.tax or 0) + (order.delivery_fee or 0) + (order.tip or 0) - (order.discount or 0)

    created: list[models.Split] = []
    for uid, subtotal in user_subtotals.items():
        user = db.query(models.User).filter(models.User.id == uid).first()
        if not user:
            continue
        proportional_fees = fees * (subtotal / total_subtotal) if total_subtotal > 0 else 0
        db_split = models.Split(
            order_id=data.order_id,
            user_id=uid,
            item_ids=user_item_ids[uid],
            amount_owed=round(subtotal + proportional_fees, 2),
            paid_status=False,
        )
        db.add(db_split)
        created.append(db_split)

    db.commit()
    for s in created:
        db.refresh(s)
    return created


@router.delete("/{split_id}")
def delete_split(split_id: int, db: Session = Depends(get_db)):
    """Delete a split"""
    split = db.query(models.Split).filter(models.Split.id == split_id).first()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")
    
    db.delete(split)
    db.commit()
    return {"message": "Split deleted successfully"}
