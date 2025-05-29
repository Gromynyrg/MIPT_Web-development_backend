import enum
import uuid
from sqlalchemy import Column, String, Text, DECIMAL, Integer, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.types import Enum as SQLAlchemyEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func


class LampTechnologyEnum(str, enum.Enum):
    LED = "Светодиодная"
    INCANDESCENT = "Накаливания"
    HALOGEN = "Галогенная"
    FLUORESCENT = "Люминесцентная"
    OTHER = "Другая"


class EnergyEfficiencyClassEnum(str, enum.Enum):
    A_PLUS_PLUS = "A++"
    A_PLUS = "A+"
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"
    F = "F"
    G = "G"


Base = declarative_base()


class Product(Base):
    __tablename__ = "products"

    product_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(128), nullable=False, unique=True)
    article = Column(String(32), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    price = Column(DECIMAL(10, 2), nullable=False)
    stock_quantity = Column(Integer, nullable=False, server_default="0")
    is_active = Column(Boolean, nullable=False, server_default="TRUE")
    manufacturer = Column(String(128), nullable=False)

    product_technology = Column(
        SQLAlchemyEnum(
            LampTechnologyEnum,
            name="lamp_technology",
            create_type=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False
    )
    socket = Column(String(32), nullable=False)
    power = Column(DECIMAL(5, 1), nullable=False)
    lumens = Column(Integer, nullable=True)
    color_temperature = Column(Integer, nullable=True)
    voltage = Column(String(32), nullable=True)
    class_energy_efficiency = Column(
        SQLAlchemyEnum(
            EnergyEfficiencyClassEnum,
            name="energy_efficiency_class",
            create_type=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=True
    )

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan", lazy="selectin")

    def __repr__(self):
        return f"<Product(name='{self.name}', article='{self.article}')>"


class ProductImage(Base):
    __tablename__ = "product_images"

    product_image_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False)
    image_url = Column(String(512), nullable=False)  # Храним относительный URL как строку
    upload_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Product", back_populates="images")

    def __repr__(self):
        return f"<ProductImage(url='{self.image_url}')>"