from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from .config import settings

DATABASE_URL = settings.PRODUCT_DATABASE_URL
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_db_tables(): # Не используется для основного запуска, если таблицы создаются скриптами
    from .models import Base
    Base.metadata.create_all(bind=engine)