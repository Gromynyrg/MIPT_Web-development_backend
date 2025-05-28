from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base # Импортируем, если Base не будет в models.py

from .config import settings # Импортируем наши настройки

# Формируем URL для подключения к БД из настроек
DATABASE_URL = settings.PRODUCT_DATABASE_URL

# Создаем движок SQLAlchemy
# echo=True полезно для отладки, выводит SQL-запросы в консоль. В продакшене лучше убрать.
# Для асинхронной работы (если будешь использовать async эндпоинты FastAPI с async SQLAlchemy)
# понадобится create_async_engine из sqlalchemy.ext.asyncio
engine = create_engine(DATABASE_URL, echo=False) # Пока ставим echo=False

# Создаем фабрику сессий
# autocommit=False и autoflush=False - стандартные настройки для управления транзакциями вручную
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для декларативных моделей (если он не импортируется из models.py)
# Обычно Base = declarative_base() находится в models.py, и мы бы импортировали его оттуда:
# from .models import Base
# Но если он здесь, то:
Base = declarative_base()


# Функция-зависимость для FastAPI для получения сессии БД
# Эта функция будет использоваться в каждом эндпоинте, который требует доступ к БД
def get_db():
    db = SessionLocal()
    try:
        yield db  # Предоставляем сессию
    finally:
        db.close() # Закрываем сессию после использования

# Функция для создания таблиц в БД (если они еще не созданы)
# Обычно вызывается один раз при старте приложения или через отдельный скрипт/команду
# В нашем случае таблицы создаются через docker-entrypoint-initdb.d, поэтому эта функция
# может быть не нужна для production, но полезна для тестов или локальной разработки без Docker.
def create_db_tables():
    # Импортируем модели здесь, чтобы избежать циклических зависимостей,
    # если Base определен в models.py и db.py импортирует Base из models.py.
    # Если Base определен в db.py, то импорт моделей здесь не обязателен для Base.metadata.create_all.
    from .models import Base # Убедись, что Base импортируется или определен
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    # Пример использования: можно вызвать для создания таблиц при запуске скрипта
    print(f"Connecting to database: {DATABASE_URL}")
    print("Creating database tables if they don't exist...")
    # create_db_tables() # Раскомментируй, если хочешь создать таблицы при запуске этого файла
    print("Tables should be ready (or already exist).")