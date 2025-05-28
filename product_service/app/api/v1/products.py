from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app import crud, models, schemas  # Импортируем из корневой папки app
from app.db import get_db  # Импортируем зависимость для сессии БД

router = APIRouter(
    prefix="/products",  # Префикс для всех эндпоинтов в этом роутере
    tags=["Products"],  # Тег для группировки в документации Swagger
)


# --- Эндпоинты для Товаров ---

@router.post("/", response_model=schemas.Product, status_code=status.HTTP_201_CREATED)
def create_product_endpoint(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    """
    Создать новый товар.

    - **name**: Название товара (уникальное)
    - **article**: Артикул товара (уникальный)
    - **price**: Цена
    - **images_urls**: Опциональный список URL изображений для товара.
    """
    try:
        db_product = crud.create_product(db=db, product=product)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return db_product


@router.get("/", response_model=List[schemas.ProductInList])  # Используем упрощенную схему для списка
def read_products_endpoint(
        skip: int = Query(0, ge=0, description="Количество пропускаемых записей (для пагинации)"),
        limit: int = Query(20, ge=1, le=100, description="Максимальное количество записей для возврата"),
        db: Session = Depends(get_db)
):
    """
    Получить список товаров с пагинацией.
    """
    products = crud.get_products(db, skip=skip, limit=limit)
    # Можно добавить логику для формирования main_image_url, если она есть
    # return [schemas.ProductInList(**prod.__dict__, main_image_url=prod.images[0].image_url if prod.images else None) for prod in products]
    return products


@router.get("/{product_id}", response_model=schemas.Product)
def read_product_endpoint(product_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Получить детальную информацию о товаре по его ID.
    """
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return db_product


@router.put("/{product_id}", response_model=schemas.Product)
def update_product_endpoint(product_id: uuid.UUID, product: schemas.ProductUpdate, db: Session = Depends(get_db)):
    """
    Полностью обновить информацию о товаре.
    Все поля из схемы ProductUpdate должны быть переданы (или будут установлены в None/дефолтные значения, если они опциональны в схеме ProductBase).
    Для частичного обновления используйте PATCH.
    """
    # Для PUT, обычно ProductUpdate должен быть почти как ProductCreate (все поля обязательны)
    # Если ProductUpdate содержит Optional поля, это больше похоже на PATCH.
    # Мы будем использовать ProductUpdate как есть, но для строгого PUT можно создать ProductPut схему.
    try:
        updated_product = crud.update_product(db=db, product_id=product_id, product_update=product)
    except ValueError as e:  # Ловим ошибки уникальности из CRUD
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if updated_product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return updated_product


@router.patch("/{product_id}", response_model=schemas.Product)
def partial_update_product_endpoint(product_id: uuid.UUID, product: schemas.ProductUpdate,
                                    db: Session = Depends(get_db)):
    """
    Частично обновить информацию о товаре.
    Передавайте только те поля, которые хотите изменить.
    """
    try:
        updated_product = crud.update_product(db=db, product_id=product_id, product_update=product)
    except ValueError as e:  # Ловим ошибки уникальности из CRUD
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if updated_product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return updated_product


@router.delete("/{product_id}", response_model=schemas.Product)  # Или можно возвращать status_code=204 NO CONTENT
def delete_product_endpoint(product_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Удалить товар по ID.
    """
    deleted_product = crud.delete_product(db=db, product_id=product_id)
    if deleted_product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return deleted_product  # Возвращаем удаленный объект для подтверждения


# --- Эндпоинты для Изображений Товара (пример) ---
# Их можно вынести в отдельный роутер, если их будет много

@router.post("/{product_id}/images/", response_model=schemas.ProductImage, status_code=status.HTTP_201_CREATED)
def create_image_for_product_endpoint(
        product_id: uuid.UUID,
        image: schemas.ProductImageCreate,
        db: Session = Depends(get_db)
):
    """
    Добавить новое изображение к существующему товару.
    """
    db_product = crud.get_product(db, product_id=product_id)
    if not db_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return crud.create_product_image(db=db, image=image, product_id=product_id)


@router.delete("/images/{image_id}", response_model=schemas.ProductImage)
def delete_image_endpoint(image_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Удалить изображение товара по ID изображения.
    """
    deleted_image = crud.delete_product_image(db=db, product_image_id=image_id)
    if not deleted_image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return deleted_image