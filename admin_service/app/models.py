import enum
import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, TIMESTAMP, Enum as SQLAlchemyEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func


class UserRolePythonEnum(str, enum.Enum):
    ADMIN = "ADMIN"


Base = declarative_base()


class AdminUser(Base):
    __tablename__ = "admin_users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(64), nullable=False, unique=True)
    hash_password = Column(String(256), nullable=False)
    role = Column(
        SQLAlchemyEnum(
            UserRolePythonEnum,
            name="user_role_enum",
            create_type=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
        default=UserRolePythonEnum.ADMIN
    )
    is_active = Column(Boolean, nullable=False, server_default="TRUE")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)