from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from decimal import Decimal
from datetime import datetime

from .models import OrderStatusPythonEnum # Импортируем наш Python Enum для статусов


# --- Promocode Schemas ---
class PromocodeBase(BaseModel):
    promocode_name: str = Field(min_length=3, max_length=32)
    percent: Optional[int] = Field(None, gt=0, le=100)
    value: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    min_order_cost: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    is_active: bool = True


class PromocodeCreate(PromocodeBase):
    pass


class Promocode(PromocodeBase):
    promocode_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

# --- OrderItem Schemas ---
class OrderItemBase(BaseModel):
    product_id: uuid.UUID # ID товара из Product Service
    quantity: int = Field(gt=0)

    name: str = Field(min_length=1, max_length=128)
    price_per_one: Decimal = Field(gt=0, decimal_places=2)


class OrderItemCreate(OrderItemBase):
    pass


class OrderItem(OrderItemBase):
    order_item_id: uuid.UUID
    order_id: uuid.UUID

    class Config:
        from_attributes = True


# --- Order Schemas ---
class OrderBase(BaseModel):
    customer_surname: str = Field(min_length=1, max_length=128)
    customer_first_name: str = Field(min_length=1, max_length=128)
    customer_email: EmailStr
    customer_phone_number: str = Field(min_length=5, max_length=32) # Простая проверка длины
    promocode_name_applied: Optional[str] = None # Клиент может передать имя промокода


class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = Field(..., min_length=1)


class OrderUpdateStatus(BaseModel):
    status: OrderStatusPythonEnum # Новый статус для заказа


class Order(OrderBase):
    order_id: uuid.UUID
    number: str
    status: OrderStatusPythonEnum
    promocode_uuid: Optional[uuid.UUID] = None
    total_cost: Decimal
    total_cost_with_promo: Decimal
    created_at: datetime
    updated_at: datetime
    items: List[OrderItem] = []
    promocode_applied_details: Optional[Promocode] = None

    class Config:
        from_attributes = True


class OrderInList(BaseModel):
    order_id: uuid.UUID
    number: str
    status: OrderStatusPythonEnum
    customer_first_name: str
    customer_surname: str
    total_cost_with_promo: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    items: List[OrderInList]
    total_count: int
    page: Optional[int] = None
    limit: Optional[int] = None
    pages: Optional[int] = None
