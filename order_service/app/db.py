from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from .config import settings # Импортируем настройки ИМЕННО ЭТОГО сервиса

DATABASE_URL = settings.ORDER_DATABASE_URL # Используем URL для БД заказов

engine = create_engine(DATABASE_URL, echo=False) # echo=False для продакшена, True для отладки SQL

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Эта функция здесь для полноты, но таблицы создаются SQL-скриптами
def create_order_db_tables():
    from .models import Base
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    print(f"Connecting to Order Service database: {DATABASE_URL}")
    # create_order_db_tables()
    print("Order Service tables should be ready (or already exist).")