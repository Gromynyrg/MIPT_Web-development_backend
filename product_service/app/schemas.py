from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from decimal import Decimal
from datetime import datetime
from fastapi import Form # Для принятия данных формы вместе с файлами

from .models import LampTechnologyEnum, EnergyEfficiencyClassEnum # Импортируем Python Enum


# --- Product Image Schemas ---
class ProductImageBase(BaseModel):
    image_url: str # URL будет строкой (относительный путь)


class ProductImageCreate(ProductImageBase): # Используется для создания записи в БД
    pass


class ProductImage(ProductImageBase): # Схема для ответа API
    product_image_id: uuid.UUID
    product_id: uuid.UUID
    upload_at: datetime

    class Config:
        from_attributes = True


# --- Product Schemas ---
class ProductBase(BaseModel): # Общие поля для товара
    name: str = Field(min_length=3, max_length=128)
    article: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_/-]+$") # Разрешил / и -
    description: Optional[str] = None
    price: Decimal = Field(gt=0, decimal_places=2)
    stock_quantity: int = Field(ge=0)
    is_active: bool = True
    manufacturer: str = Field(min_length=2, max_length=128)
    product_technology: LampTechnologyEnum
    socket: str = Field(min_length=1, max_length=32)
    power: Decimal = Field(gt=0, decimal_places=1)
    lumens: Optional[int] = Field(None, ge=0)
    color_temperature: Optional[int] = Field(None, ge=1000)
    voltage: Optional[str] = Field(None, max_length=32)
    class_energy_efficiency: Optional[EnergyEfficiencyClassEnum] = None


class ProductCreateForm(ProductBase):
    @classmethod
    def as_form(
        cls,
        name: str = Form(...),
        article: str = Form(...),
        description: Optional[str] = Form(None),
        price: Decimal = Form(...),
        stock_quantity: int = Form(...),
        is_active: bool = Form(True),
        manufacturer: str = Form(...),
        product_technology: LampTechnologyEnum = Form(...),
        socket: str = Form(...),
        power: Decimal = Form(...),
        lumens: Optional[int] = Form(None),
        color_temperature: Optional[int] = Form(None),
        voltage: Optional[str] = Form(None),
        class_energy_efficiency: Optional[EnergyEfficiencyClassEnum] = Form(None)
    ):
        return cls(
            name=name, article=article, description=description, price=price,
            stock_quantity=stock_quantity, is_active=is_active, manufacturer=manufacturer,
            product_technology=product_technology, socket=socket, power=power, lumens=lumens,
            color_temperature=color_temperature, voltage=voltage,
            class_energy_efficiency=class_energy_efficiency
        )


class ProductCreate(ProductBase): # Используется для CRUD операции создания товара (без файлов)
    pass


class ProductUpdate(BaseModel): # Для PATCH - все поля опциональны
    name: Optional[str] = Field(None, min_length=3, max_length=128)
    article: Optional[str] = Field(None, min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_/-]+$")
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    stock_quantity: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    manufacturer: Optional[str] = Field(None, min_length=2, max_length=128)
    product_technology: Optional[LampTechnologyEnum] = None
    socket: Optional[str] = Field(None, min_length=1, max_length=32)
    power: Optional[Decimal] = Field(None, gt=0, decimal_places=1)
    lumens: Optional[int] = Field(None, ge=0)
    color_temperature: Optional[int] = Field(None, ge=1000)
    voltage: Optional[str] = Field(None, max_length=32)
    class_energy_efficiency: Optional[EnergyEfficiencyClassEnum] = None


class Product(ProductBase): # Схема для ответа API (полная информация о товаре)
    product_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    images: List[ProductImage] = []

    class Config:
        from_attributes = True


class ProductInList(BaseModel): # Упрощенная схема для списка товаров
    product_id: uuid.UUID
    name: str
    article: str
    price: Decimal
    main_image_url: Optional[str] = None # URL главного изображения

    class Config:
        from_attributes = True
