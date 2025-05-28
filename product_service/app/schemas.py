from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional
import uuid
from decimal import Decimal
from datetime import datetime

# Импортируем наши Python Enum для использования в схемах
from .models import LampTechnologyEnum, EnergyEfficiencyClassEnum

# --- Product Image Schemas ---

class ProductImageBase(BaseModel):
    image_url: HttpUrl # Pydantic автоматически валидирует URL

class ProductImageCreate(ProductImageBase):
    pass # Пока для создания достаточно только URL

class ProductImage(ProductImageBase): # Схема для ответа
    product_image_id: uuid.UUID
    product_id: uuid.UUID
    upload_at: datetime

    class Config:
        from_attributes = True # orm_mode = True в Pydantic v1

# --- Product Schemas ---

class ProductBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=128)
    article: str = Field(..., min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$") # Пример паттерна для артикула
    description: Optional[str] = None
    price: Decimal = Field(..., gt=0, decimal_places=2) # gt=0 означает "больше нуля"
    stock_quantity: int = Field(..., ge=0) # ge=0 означает "больше или равно нулю"
    is_active: bool = True
    manufacturer: str = Field(..., min_length=2, max_length=128)
    product_technology: LampTechnologyEnum # Используем наш Enum
    socket: str = Field(..., min_length=1, max_length=32)
    power: Decimal = Field(..., gt=0, decimal_places=1)
    lumens: Optional[int] = Field(None, ge=0)
    color_temperature: Optional[int] = Field(None, ge=1000) # Пример: мин. цветовая температура
    voltage: Optional[str] = Field(None, max_length=32)
    class_energy_efficiency: Optional[EnergyEfficiencyClassEnum] = None


class ProductCreate(ProductBase):
    # При создании товара мы можем также опционально принимать список URL изображений
    images_urls: Optional[List[HttpUrl]] = None


class ProductUpdate(ProductBase):
    # При обновлении все поля опциональны, если используется PATCH
    # Если PUT (полное обновление), то все поля из ProductBase должны быть обязательными
    # Здесь сделаем все поля опциональными для гибкости (можно использовать для PATCH)
    name: Optional[str] = Field(None, min_length=3, max_length=128)
    article: Optional[str] = Field(None, min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")
    price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    stock_quantity: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    manufacturer: Optional[str] = Field(None, min_length=2, max_length=128)
    product_technology: Optional[LampTechnologyEnum] = None
    socket: Optional[str] = Field(None, min_length=1, max_length=32)
    power: Optional[Decimal] = Field(None, gt=0, decimal_places=1)
    # images_urls: Optional[List[HttpUrl]] = None # Можно добавить, если нужно обновлять картинки через основной эндпоинт


# Схема для ответа API (включая ID и даты, и связанные изображения)
class Product(ProductBase):
    product_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    images: List[ProductImage] = [] # Список связанных изображений

    class Config:
        from_attributes = True # orm_mode = True в Pydantic v1

# Схема для ответа со списком товаров (может быть упрощенной)
class ProductInList(BaseModel):
    product_id: uuid.UUID
    name: str
    article: str
    price: Decimal
    # Можно добавить основное изображение, если есть такая логика
    main_image_url: Optional[HttpUrl] = None # Пример, если будем вычислять

    class Config:
        from_attributes = True