from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    whatsapp_number = Column(String)
    payment_handle = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    orders_paid = relationship("Order", back_populates="payer")
    splits = relationship("Split", back_populates="user")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    restaurant = Column(String, nullable=False)
    total = Column(Float, nullable=False)
    subtotal = Column(Float)
    tax = Column(Float)
    delivery_fee = Column(Float)
    tip = Column(Float)
    discount = Column(Float, default=0)
    date = Column(DateTime, default=datetime.utcnow)
    paid_by_user_id = Column(Integer, ForeignKey("users.id"))
    image_url = Column(String)
    ocr_raw_text = Column(String)
    parsed_data = Column(String)  # JSON string
    
    # Relationships
    payer = relationship("User", back_populates="orders_paid")
    items = relationship("Item", back_populates="order", cascade="all, delete-orphan")
    splits = relationship("Split", back_populates="order", cascade="all, delete-orphan")

class Item(Base):
    __tablename__ = "items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, default=1)
    
    # Relationships
    order = relationship("Order", back_populates="items")

class Split(Base):
    __tablename__ = "splits"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_ids = Column(ARRAY(Integer))
    amount_owed = Column(Float, nullable=False)
    paid_status = Column(Boolean, default=False)
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(DateTime, nullable=True)
    message_sid = Column(String, nullable=True)
    
    # Relationships
    order = relationship("Order", back_populates="splits")
    user = relationship("User", back_populates="splits")
