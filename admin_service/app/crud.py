from sqlalchemy.orm import Session
from typing import Optional
from . import models, schemas, auth


def get_user_by_username(db: Session, username: str) -> Optional[models.AdminUser]:
    return db.query(models.AdminUser).filter(models.AdminUser.username == username).first()


def create_admin_user(db: Session, user_in: schemas.UserCreate) -> models.AdminUser:
    if get_user_by_username(db, username=user_in.username):
        raise ValueError(f"User with username '{user_in.username}' already exists.")

    hashed_password = auth.get_password_hash(user_in.password)
    db_user = models.AdminUser(
        username=user_in.username,
        hash_password=hashed_password,
        role=user_in.role,  # По умолчанию ADMIN из схемы
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
