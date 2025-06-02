from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uuid
from datetime import datetime
from .models import UserRolePythonEnum


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    role: UserRolePythonEnum = UserRolePythonEnum.ADMIN


class UserCreate(UserBase):
    password: str = Field(min_length=6)


class UserUpdate(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRolePythonEnum] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)


class User(UserBase):
    user_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Схемы для аутентификации
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str
