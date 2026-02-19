from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# User schemas
class UserBase(BaseModel):
    name: str
    phone: str
    whatsapp_number: Optional[str] = None
    payment_handle: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    payment_handle: Optional[str] = None

class User(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Item schemas
class ItemBase(BaseModel):
    name: str
    price: float
    quantity: int = 1

class ItemCreate(ItemBase):
    pass

class Item(ItemBase):
    id: int
    order_id: int
    
    class Config:
        from_attributes = True

# Order schemas
class OrderBase(BaseModel):
    restaurant: str
    total: float
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    delivery_fee: Optional[float] = None
    tip: Optional[float] = None
    discount: Optional[float] = 0
    paid_by_user_id: int

class OrderCreate(OrderBase):
    pass

class Order(OrderBase):
    id: int
    date: datetime
    image_url: Optional[str] = None
    ocr_raw_text: Optional[str] = None
    parsed_data: Optional[str] = None
    items: List[Item] = []
    
    class Config:
        from_attributes = True

# Split schemas
class SplitBase(BaseModel):
    user_id: int
    item_ids: List[int]
    amount_owed: float

class SplitCreate(SplitBase):
    order_id: int

class Split(SplitBase):
    id: int
    order_id: int
    paid_status: bool
    reminder_sent: bool = False
    reminder_sent_at: Optional[datetime] = None
    message_sid: Optional[str] = None
    
    class Config:
        from_attributes = True

# OCR and Parsing schemas
class OCRResult(BaseModel):
    raw_text: str
    confidence: Optional[float] = None

class ParsedReceipt(BaseModel):
    restaurant: str
    items: List[ItemBase]
    subtotal: float
    tax: Optional[float] = None
    delivery_fee: Optional[float] = None
    tip: Optional[float] = None
    discount: Optional[float] = 0
    total: float

# Order creation with items in one payload
class OrderCreateWithItems(BaseModel):
    restaurant: str
    total: float
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    delivery_fee: Optional[float] = None
    tip: Optional[float] = None
    discount: Optional[float] = 0
    paid_by_user_id: int
    image_url: Optional[str] = None
    ocr_raw_text: Optional[str] = None
    items: List[ItemCreate]

# Item-to-user assignment for bulk split creation
class ItemAssignment(BaseModel):
    item_id: int
    user_ids: List[int]

class BulkSplitCreate(BaseModel):
    order_id: int
    assignments: List[ItemAssignment]

class SplitWithUser(Split):
    user: Optional[User] = None

    class Config:
        from_attributes = True
