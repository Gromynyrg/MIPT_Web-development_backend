from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from math import ceil
import uuid

from app import crud, models, schemas  # Импортируем из корневой папки app Order Service
from app.db import get_db

router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)


@router.post("/", response_model=schemas.Order, status_code=status.HTTP_201_CREATED)
def create_order_endpoint(order_in: schemas.OrderCreate, db: Session = Depends(get_db)):
    """
    Создать новый заказ.

    Включает:
    - Данные клиента (`customer_surname`, `customer_first_name`, `customer_email`, `customer_phone_number`)
    - Опциональное имя промокода (`promocode_name_applied`)
    - Список позиций заказа (`items`), каждая позиция содержит:
        - `product_id` (UUID товара)
        - `quantity` (количество)
        - `name` (название товара на момент заказа)
        - `price_per_one` (цена за единицу на момент заказа)
    """
    try:
        created_order = crud.create_order(db=db, order_data=order_in)
    except ValueError as e:
        # Ошибки от CRUD (например, неверный промокод, проблемы с товаром (если бы была проверка),
        # ошибки расчета, ошибки уникальности номера заказа)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Другие непредвиденные ошибки
        # Логирование e здесь было бы полезно
        print(f"Unexpected error creating order: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An unexpected error occurred while creating the order.")
    return created_order


@router.get("/", response_model=schemas.OrderListResponse)  # Обновляем response_model
def read_all_orders_endpoint(
        skip: int = Query(0, ge=0, description="Пропустить записи"),
        limit: int = Query(20, ge=1, le=100, description="Макс. кол-во записей"),
        status: Optional[schemas.OrderStatusPythonEnum] = Query(None, description="Фильтр по статусу заказа"),
        search: Optional[str] = Query(None, min_length=1, description="Поиск по номеру заказа, ФИО или email клиента"),
        db: Session = Depends(get_db)
):
    order_models, total_count = crud.get_all_orders(
        db=db, skip=skip, limit=limit, status=status, search_term=search  # Передаем search_term
    )

    # Конвертируем модели в Pydantic схемы OrderInList
    items_response = [schemas.OrderInList.model_validate(order) for order in order_models]

    current_page = (skip // limit) + 1 if limit > 0 else 1
    total_pages = ceil(total_count / limit) if limit > 0 else 1

    return schemas.OrderListResponse(
        items=items_response,
        total_count=total_count,
        page=current_page,
        limit=limit,
        pages=total_pages
    )


@router.get("/{order_id}", response_model=schemas.Order)
def read_order_by_id_endpoint(order_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Получить детальную информацию о заказе по его ID.
    Включает все позиции заказа и информацию о примененном промокоде.
    (Аутентификация/авторизация администратора или владельца заказа будет добавлена позже)
    """
    db_order = crud.get_order_by_id(db=db, order_id=order_id)
    if db_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    items_schema = [schemas.OrderItem.model_validate(item) for item in db_order.items]
    promocode_schema = schemas.Promocode.model_validate(db_order.promocode) if db_order.promocode else None

    return schemas.Order(
        order_id=db_order.order_id,
        number=db_order.number,
        status=db_order.status,
        customer_surname=db_order.customer_surname,
        customer_first_name=db_order.customer_first_name,
        customer_email=db_order.customer_email,
        customer_phone_number=db_order.customer_phone_number,
        promocode_uuid=db_order.promocode_uuid,
        total_cost=db_order.total_cost,
        total_cost_with_promo=db_order.total_cost_with_promo,
        created_at=db_order.created_at,
        updated_at=db_order.updated_at,
        items=items_schema,
        promocode_applied_details=promocode_schema  # Теперь передаем объект нужной схемы
    )


@router.patch("/{order_id}/status", response_model=schemas.Order)  # Возвращаем обновленный заказ
def update_order_status_endpoint(
        order_id: uuid.UUID,
        status_update: schemas.OrderUpdateStatus,
        db: Session = Depends(get_db)
):
    """
    Обновить статус заказа.
    (Аутентификация/авторизация администратора будет добавлена позже)
    """
    try:
        updated_order = crud.update_order_status(db=db, order_id=order_id, new_status=status_update.status)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=str(e))  # Например, недопустимый переход статуса

    if updated_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found to update status")

    # Аналогично read_order_by_id_endpoint, формируем ответ явно для promocode_applied_details
    items_schema = [schemas.OrderItem.model_validate(item) for item in updated_order.items]
    promocode_schema = schemas.Promocode.model_validate(updated_order.promocode) if updated_order.promocode else None

    return schemas.Order(
        order_id=updated_order.order_id,
        number=updated_order.number,
        status=updated_order.status,
        customer_surname=updated_order.customer_surname,
        customer_first_name=updated_order.customer_first_name,
        customer_email=updated_order.customer_email,
        customer_phone_number=updated_order.customer_phone_number,
        promocode_uuid=updated_order.promocode_uuid,
        total_cost=updated_order.total_cost,
        total_cost_with_promo=updated_order.total_cost_with_promo,
        created_at=updated_order.created_at,
        updated_at=updated_order.updated_at,
        items=items_schema,
        promocode_applied_details=promocode_schema
    )