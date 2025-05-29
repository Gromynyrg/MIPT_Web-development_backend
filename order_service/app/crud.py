from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Tuple
import uuid
from decimal import Decimal
from datetime import datetime
from . import models, schemas


# --- Promocode CRUD ---

def get_promocode_by_id(db: Session, promocode_id: uuid.UUID) -> Optional[models.Promocode]:
    return db.query(models.Promocode).filter(models.Promocode.promocode_id == promocode_id).first()


def get_promocode_by_name(db: Session, promocode_name: str) -> Optional[models.Promocode]:
    return db.query(models.Promocode).filter(models.Promocode.promocode_name == promocode_name).first()


def get_all_promocodes(db: Session, skip: int = 0, limit: int = 100) -> List[models.Promocode]:
    return db.query(models.Promocode).offset(skip).limit(limit).all()


def create_promocode(db: Session, promocode_data: schemas.PromocodeCreate) -> models.Promocode:
    if get_promocode_by_name(db, promocode_name=promocode_data.promocode_name):
        raise ValueError(f"Promocode with name '{promocode_data.promocode_name}' already exists.")

    # Проверка на одновременное указание percent и value (можно вынести в Pydantic валидатор)
    if promocode_data.percent is not None and promocode_data.value is not None:
        raise ValueError("Only one of 'percent' or 'value' can be set for a promocode discount.")
    if promocode_data.percent is None and promocode_data.value is None and promocode_data.min_order_cost is None:
        raise ValueError("Promocode must have a discount (percent/value) or a minimum order cost.")

    db_promocode = models.Promocode(**promocode_data.model_dump())
    db.add(db_promocode)
    try:
        db.commit()
        db.refresh(db_promocode)
    except IntegrityError as e:
        db.rollback()
        # Имя ограничения для promocode_name в БД, скорее всего, 'promocodes_promocode_name_key'
        if "promocodes_promocode_name_key" in str(e.orig).lower():
            raise ValueError(f"Promocode name '{promocode_data.promocode_name}' already exists (DB check).")
        raise ValueError("Could not create promocode due to DB integrity error.") from e
    return db_promocode


def update_promocode(db: Session, promocode_id: uuid.UUID, promocode_update_data: schemas.PromocodeCreate) -> Optional[
    models.Promocode]:
    # Используем PromocodeCreate для обновления, т.к. структура похожа. Можно создать PromocodeUpdate.
    db_promocode = get_promocode_by_id(db, promocode_id)
    if not db_promocode:
        return None

    update_data = promocode_update_data.model_dump(exclude_unset=True)

    # Проверка на уникальность имени, если оно меняется
    if "promocode_name" in update_data and update_data["promocode_name"] != db_promocode.promocode_name:
        if get_promocode_by_name(db, promocode_name=update_data["promocode_name"]):
            raise ValueError(f"Another promocode with name '{update_data['promocode_name']}' already exists.")


    new_percent = update_data.get("percent", db_promocode.percent)
    new_value = update_data.get("value", db_promocode.value)
    if new_percent is not None and new_value is not None:
        raise ValueError("Only one of 'percent' or 'value' can be set for a promocode discount when updating.")

    for key, value in update_data.items():
        setattr(db_promocode, key, value)

    try:
        db.commit()
        db.refresh(db_promocode)
    except IntegrityError as e:
        db.rollback()
        # ... (обработка IntegrityError) ...
        raise ValueError("Could not update promocode due to DB integrity error.") from e
    return db_promocode


def delete_promocode(db: Session, promocode_id: uuid.UUID) -> Optional[models.Promocode]:
    db_promocode = get_promocode_by_id(db, promocode_id)
    if db_promocode:
        # Подумать об обработке заказов, использующих этот промокод.
        # Сейчас ForeignKey ondelete="SET NULL", так что заказы не удалятся.
        db.delete(db_promocode)
        db.commit()
    return db_promocode


# --- Order & OrderItem CRUD (будут добавлены дальше) ---

def calculate_order_totals(
        items_data: List[schemas.OrderItemCreate],
        promocode: Optional[models.Promocode] = None
) -> Tuple[Decimal, Decimal, Optional[uuid.UUID]]:
    """
    Рассчитывает общую стоимость заказа и стоимость с учетом промокода.
    Возвращает (total_cost, total_cost_with_promo, applied_promocode_uuid).
    """
    total_cost = sum(item.price_per_one * item.quantity for item in items_data)
    total_cost_with_promo = total_cost
    applied_promocode_uuid: Optional[uuid.UUID] = None

    if promocode and promocode.is_active:
        # Проверяем минимальную сумму заказа для промокода
        if promocode.min_order_cost is not None and total_cost < promocode.min_order_cost:
            print(
                f"Promocode {promocode.promocode_name} not applied: order total {total_cost} is less than min required {promocode.min_order_cost}")
            # Промокод не применяется, но мы можем все равно его записать в заказ, если логика это позволяет
            # В данном случае, если не прошел min_order_cost, скидку не даем
        else:
            applied_promocode_uuid = promocode.promocode_id
            if promocode.percent is not None:
                discount_amount = (total_cost * Decimal(promocode.percent)) / Decimal(100)
                total_cost_with_promo = total_cost - discount_amount
            elif promocode.value is not None:
                total_cost_with_promo = total_cost - promocode.value

            # Убедимся, что цена не стала отрицательной
            if total_cost_with_promo < Decimal(0):
                total_cost_with_promo = Decimal(0)

    # Округление до 2 знаков после запятой
    return total_cost.quantize(Decimal("0.01")), total_cost_with_promo.quantize(Decimal("0.01")), applied_promocode_uuid


def create_order(db: Session, order_data: schemas.OrderCreate) -> models.Order:
    # 1. Проверить и получить промокод, если указан
    active_promocode_model: Optional[models.Promocode] = None
    if order_data.promocode_name_applied:
        active_promocode_model = get_promocode_by_name(db, promocode_name=order_data.promocode_name_applied)
        if not active_promocode_model or not active_promocode_model.is_active:
            # Можно бросить ошибку или просто не применять промокод
            print(f"Warning: Promocode '{order_data.promocode_name_applied}' not found or not active.")
            active_promocode_model = None  # Сбрасываем, чтобы не применялся

    for item_data in order_data.items:
        if item_data.price_per_one <= 0 or item_data.quantity <= 0:
            raise ValueError(f"Invalid price or quantity for product {item_data.product_id}.")

    total_cost, total_cost_with_promo, applied_promo_uuid = calculate_order_totals(
        items_data=order_data.items,
        promocode=active_promocode_model
    )

    timestamp_part = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_part = uuid.uuid4().hex[:6].upper()
    order_number = f"LP-{timestamp_part}-{random_part}"

    while db.query(models.Order).filter(models.Order.number == order_number).first():
        random_part = uuid.uuid4().hex[:6].upper()
        order_number = f"LP-{timestamp_part}-{random_part}"

    db_order_data = order_data.model_dump(exclude={"items", "promocode_name_applied"})
    db_order = models.Order(
        **db_order_data,
        number=order_number,
        promocode_uuid=applied_promo_uuid,
        total_cost=total_cost,
        total_cost_with_promo=total_cost_with_promo,
        status=models.OrderStatusPythonEnum.NEW  # Начальный статус
    )
    db.add(db_order)

    try:
        db.flush()
        db.refresh(db_order)
    except IntegrityError as e_flush_order:
        db.rollback()
        # ... обработка ошибок уникальности номера заказа или других ограничений ...
        raise ValueError(f"Could not prepare order for saving: {str(e_flush_order)}") from e_flush_order

    order_item_models = []
    for item_data in order_data.items:
        db_item = models.OrderItem(
            order_id=db_order.order_id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            price_per_one=item_data.price_per_one,
            name=item_data.name
        )
        db.add(db_item)
        order_item_models.append(db_item)

    try:
        db.commit()
        db.refresh(db_order)
        for item_model in order_item_models:
            db.refresh(item_model)
    except Exception as e_commit:
        db.rollback()
        raise ValueError(f"Could not commit order: {str(e_commit)}") from e_commit

    return db_order


def get_order_by_id(db: Session, order_id: uuid.UUID) -> Optional[models.Order]:
    """
    Получает заказ по его ID вместе со связанными позициями и информацией о промокоде.
    """
    return (
        db.query(models.Order)
        .filter(models.Order.order_id == order_id)
        .first()
    )


def get_order_by_number(db: Session, order_number: str) -> Optional[models.Order]:
    """
    Получает заказ по его номеру.
    """
    return db.query(models.Order).filter(models.Order.number == order_number).first()


def get_all_orders(
        db: Session,
        skip: int = 0,
        limit: int = 20,
        status: Optional[schemas.OrderStatusPythonEnum] = None,  # Фильтр по статусу
        customer_email: Optional[str] = None  # Фильтр по email клиента
        # Можно добавить другие фильтры: по дате, сумме и т.д.
) -> List[models.Order]:
    """
    Получает список заказов с пагинацией и опциональными фильтрами.
    """
    query = db.query(models.Order)

    if status:
        query = query.filter(models.Order.status == status)

    if customer_email:
        query = query.filter(
            models.Order.customer_email.ilike(f"%{customer_email}%"))  # Поиск по части email, без учета регистра

    # Сортировка по умолчанию - по дате создания (сначала новые)
    query = query.order_by(models.Order.created_at.desc())

    return query.offset(skip).limit(limit).all()


def update_order_status(
        db: Session,
        order_id: uuid.UUID,
        new_status: schemas.OrderStatusPythonEnum
) -> Optional[models.Order]:
    """
    Обновляет статус существующего заказа.
    """
    db_order = get_order_by_id(db, order_id=order_id)
    if not db_order:
        return None

    db_order.status = new_status

    try:
        db.commit()
        db.refresh(db_order)
    except Exception as e:
        db.rollback()
        # Логирование ошибки e
        raise ValueError(f"Could not update order status: {str(e)}") from e

    return db_order
