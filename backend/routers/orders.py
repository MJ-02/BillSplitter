from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
from database import get_db
from services.ocr_service import process_receipt_image
from services.llm_service import parse_receipt_text
from services.storage_service import upload_image

router = APIRouter()

@router.post("/upload-receipt")
async def upload_receipt(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload receipt image, perform OCR, and parse with LLM"""
    try:
        # Upload image to S3
        print("📤 Uploading image to S3...")
        image_url = await upload_image(file)
        print(f"✅ Image uploaded: {image_url}")
        
        # Perform OCR
        print("🔍 Running OCR on image...")
        file.file.seek(0)  # Reset file pointer
        ocr_result = await process_receipt_image(file)
        print(f"✅ OCR completed. Extracted {len(ocr_result['raw_text'])} characters")
        
        # Parse with LLM
        print("🤖 Sending OCR text to LLM for parsing...")
        parsed_data = await parse_receipt_text(ocr_result["raw_text"])
        print(f"✅ LLM parsing completed. Restaurant: {parsed_data.get('restaurant', 'N/A')}")
        
        return {
            "image_url": image_url,
            "ocr_raw_text": ocr_result["raw_text"],
            "ocr_confidence": ocr_result.get("confidence", 0),
            "ocr_engine": ocr_result.get("engine", "unknown"),
            "parsed_data": parsed_data
        }
    except Exception as e:
        print(f"❌ Error processing receipt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing receipt: {str(e)}")

@router.post("/", response_model=schemas.Order)
def create_order(order_data: schemas.OrderCreateWithItems, db: Session = Depends(get_db)):
    """Create a new order with items"""
    payer = db.query(models.User).filter(models.User.id == order_data.paid_by_user_id).first()
    if not payer:
        raise HTTPException(status_code=404, detail="Payer user not found")

    db_order = models.Order(
        restaurant=order_data.restaurant,
        total=order_data.total,
        subtotal=order_data.subtotal,
        tax=order_data.tax,
        delivery_fee=order_data.delivery_fee,
        tip=order_data.tip,
        discount=order_data.discount,
        paid_by_user_id=order_data.paid_by_user_id,
        image_url=order_data.image_url,
        ocr_raw_text=order_data.ocr_raw_text,
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    for item_data in order_data.items:
        db_item = models.Item(order_id=db_order.id, **item_data.model_dump())
        db.add(db_item)

    db.commit()
    db.refresh(db_order)
    return db_order

@router.get("/", response_model=List[schemas.Order])
def list_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = db.query(models.Order).offset(skip).limit(limit).all()
    return orders

@router.get("/{order_id}", response_model=schemas.Order)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    
    db.delete(order)
    db.commit()
    return {"message": "Order deleted successfully"}
