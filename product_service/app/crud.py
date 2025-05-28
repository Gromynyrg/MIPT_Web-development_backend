from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError  # Для отлова ошибок уникальности
from typing import List, Optional
import uuid  # Для работы с UUID, если понадобится
from decimal import Decimal  # Для работы с ценами и мощностью

from . import models, schemas  # Импортируем наши модели и схемы


# --- CRUD для ProductImage ---

def get_product_image(db: Session, product_image_id: uuid.UUID) -> Optional[models.ProductImage]:
    return db.query(models.ProductImage).filter(models.ProductImage.product_image_id == product_image_id).first()


def get_product_images_by_product_id(db: Session, product_id: uuid.UUID) -> List[models.ProductImage]:
    return db.query(models.ProductImage).filter(models.ProductImage.product_id == product_id).all()


def create_product_image(db: Session, image: schemas.ProductImageCreate, product_id: uuid.UUID) -> models.ProductImage:
    db_image = models.ProductImage(
        product_id=product_id,
        image_url=str(image.image_url)  # Pydantic HttpUrl нужно преобразовать в строку для SQLAlchemy
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image


def delete_product_image(db: Session, product_image_id: uuid.UUID) -> Optional[models.ProductImage]:
    db_image = get_product_image(db, product_image_id)
    if db_image:
        db.delete(db_image)
        db.commit()
    return db_image


# --- CRUD для Product ---

def get_product(db: Session, product_id: uuid.UUID) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.product_id == product_id).first()


def get_product_by_article(db: Session, article: str) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.article == article).first()


def get_product_by_name(db: Session, name: str) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.name == name).first()


def get_products(db: Session, skip: int = 0, limit: int = 20) -> List[models.Product]:
    return db.query(models.Product).offset(skip).limit(limit).all()


def create_product(db: Session, product: schemas.ProductCreate) -> models.Product:
    # Проверка на уникальность артикула и имени (хотя БД тоже проверит)
    if get_product_by_article(db, article=product.article):
        raise ValueError(f"Product with article '{product.article}' already exists.")
    if get_product_by_name(db, name=product.name):
        raise ValueError(f"Product with name '{product.name}' already exists.")

    # Создаем объект модели Product, исключая поле images_urls, т.к. оно не для модели
    product_data = product.model_dump(exclude={"images_urls"})
    db_product = models.Product(**product_data)

    db.add(db_product)
    try:
        db.commit()
        db.refresh(db_product)
    except IntegrityError as e:
        db.rollback()
        # Можно добавить более специфичную обработку ошибки, например, для UNIQUE constraint violation
        # print(f"IntegrityError: {e.orig}") # e.orig содержит оригинальную ошибку БД
        if "products_article_key" in str(e.orig):
            raise ValueError(f"Product with article '{product.article}' already exists (DB check).")
        if "products_name_key" in str(e.orig):
            raise ValueError(f"Product with name '{product.name}' already exists (DB check).")
        raise ValueError("Could not create product due to a database integrity error.") from e

    # Если были переданы URL изображений, создаем их
    if product.images_urls:
        for img_url in product.images_urls:
            create_product_image(db, image=schemas.ProductImageCreate(image_url=img_url),
                                 product_id=db_product.product_id)
        db.refresh(db_product)  # Обновляем объект, чтобы подтянулись связанные изображения

    return db_product


def update_product(db: Session, product_id: uuid.UUID, product_update: schemas.ProductUpdate) -> Optional[
    models.Product]:
    db_product = get_product(db, product_id=product_id)
    if not db_product:
        return None

    update_data = product_update.model_dump(
        exclude_unset=True)  # exclude_unset=True чтобы не обновлять поля, которые не переданы

    # Проверка на уникальность, если article или name меняются и переданы
    if "article" in update_data and update_data["article"] != db_product.article:
        existing_article = get_product_by_article(db, article=update_data["article"])
        if existing_article and existing_article.product_id != product_id:
            raise ValueError(f"Another product with article '{update_data['article']}' already exists.")

    if "name" in update_data and update_data["name"] != db_product.name:
        existing_name = get_product_by_name(db, name=update_data["name"])
        if existing_name and existing_name.product_id != product_id:
            raise ValueError(f"Another product with name '{update_data['name']}' already exists.")

    for key, value in update_data.items():
        setattr(db_product, key, value)

    try:
        db.commit()
        db.refresh(db_product)
    except IntegrityError as e:
        db.rollback()
        if "products_article_key" in str(e.orig):
            raise ValueError(f"Product with article '{update_data.get('article')}' already exists (DB check).")
        if "products_name_key" in str(e.orig):
            raise ValueError(f"Product with name '{update_data.get('name')}' already exists (DB check).")
        raise ValueError("Could not update product due to a database integrity error.") from e

    return db_product


def delete_product(db: Session, product_id: uuid.UUID) -> Optional[models.Product]:
    db_product = get_product(db, product_id)
    if db_product:
        db.delete(db_product)  # SQLAlchemy благодаря cascade="all, delete-orphan" удалит и связанные картинки
        db.commit()
    return db_product