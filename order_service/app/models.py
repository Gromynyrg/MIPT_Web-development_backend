import enum
import uuid
from sqlalchemy import Column, String, DECIMAL, Integer, Boolean, ForeignKey, TIMESTAMP, Enum as SQLAlchemyEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func


# Определяем Python Enum для статусов заказа
class OrderStatusPythonEnum(str, enum.Enum):
    NEW = "NEW"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    AWAITING_PAYMENT = "AWAITING_PAYMENT"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    REFUNDED = "REFUNDED"
    ON_HOLD = "ON_HOLD"
    PARTIALLY_SHIPPED = "PARTIALLY_SHIPPED"


Base = declarative_base()


class Promocode(Base):
    __tablename__ = "promocodes"

    promocode_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promocode_name = Column(String(32), nullable=False, unique=True)
    percent = Column(Integer, nullable=True)  # CHECK constraint в SQL
    value = Column(DECIMAL(10, 2), nullable=True)  # CHECK constraint в SQL
    min_order_cost = Column(DECIMAL(10, 2), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="TRUE")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Связь с заказами (один промокод - много заказов)
    # orders = relationship("Order", back_populates="promocode") # Если нужна обратная связь


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    number = Column(String(32), nullable=False, unique=True)  # Уникальный номер заказа
    status = Column(
        SQLAlchemyEnum(
            OrderStatusPythonEnum,
            name="order_status_enum",  # Имя ENUM типа в БД
            create_type=False,  # Тип уже создан в БД
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
        server_default=OrderStatusPythonEnum.NEW.value  # Значение по умолчанию
    )
    customer_surname = Column(String(128), nullable=False)
    customer_first_name = Column(String(128), nullable=False)
    customer_email = Column(String(128), nullable=False)
    customer_phone_number = Column(String(32), nullable=False)

    promocode_uuid = Column(UUID(as_uuid=True), ForeignKey("promocodes.promocode_id", ondelete="SET NULL"),
                            nullable=True)

    total_cost = Column(DECIMAL(12, 2), nullable=False)  # Сумма до скидки
    total_cost_with_promo = Column(DECIMAL(12, 2), nullable=False)  # Сумма после скидки

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Связь с позициями заказа (один заказ - много позиций)
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin")
    # Связь с промокодом (много заказов - один промокод)
    promocode = relationship("Promocode")


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)

    quantity = Column(Integer, nullable=False)
    price_per_one = Column(DECIMAL(10, 2), nullable=False)
    name = Column(String(128), nullable=False)

    # Связь с заказом (много позиций - один заказ)
    order = relationship("Order", back_populates="items")

    # __table_args__ = (UniqueConstraint('order_id', 'product_id', name='uq_order_product'),)
