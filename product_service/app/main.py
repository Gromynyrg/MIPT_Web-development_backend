from fastapi import FastAPI
from contextlib import asynccontextmanager # Для lifespan менеджера в новых версиях FastAPI

from app.api.v1 import products as api_products # Импортируем наш роутер
from app.db import engine, Base #, create_db_tables # Импортируем движок и Base для моделей
from app.config import settings # Импортируем настройки

# Lifespan менеджер (рекомендуемый способ для управления ресурсами при старте/останове)
# https://fastapi.tiangolo.com/advanced/events/
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код, который выполняется перед запуском приложения
    print(f"Starting up {settings.APP_NAME if hasattr(settings, 'APP_NAME') else 'Product Service'}...")
    # Если нужно создавать таблицы при старте (не рекомендуется для production с Docker init скриптами)
    # print("Creating database tables...")
    # Base.metadata.create_all(bind=engine) # Это синхронная операция, для async нужно иначе
    # create_db_tables()
    print("Startup complete.")
    yield
    # Код, который выполняется при завершении работы приложения
    print(f"Shutting down {settings.APP_NAME if hasattr(settings, 'APP_NAME') else 'Product Service'}...")
    if hasattr(engine, 'dispose'): # Для синхронного движка
        engine.dispose()
    # Если бы был async_engine:
    # await async_engine.dispose()
    print("Shutdown complete.")


# Создаем экземпляр FastAPI приложения
# Передаем lifespan менеджер
app = FastAPI(
    title="Lampochka Factory - Product Service",
    description="Микросервис для управления товарами (лампочками).",
    version="0.1.0",
    lifespan=lifespan # В старых версиях FastAPI использовались @app.on_event("startup") / @app.on_event("shutdown")
)

# Подключаем роутеры API
# Можно добавить префикс для всех API версий, например /api
app.include_router(api_products.router, prefix="/api/v1") # Роуты будут доступны по /api/v1/products/...

# Простой эндпоинт для проверки работоспособности сервиса
@app.get("/health", tags=["Health Check"])
async def health_check():
    # Здесь можно добавить проверку доступности БД или других зависимостей
    return {"status": "ok", "service": "Product Service"}

# Если запускаем этот файл напрямую (например, для локальной разработки без Docker)
if __name__ == "__main__":
    import uvicorn
    # Uvicorn рекомендуется запускать через командную строку,
    # но для простоты можно так для локального тестирования.
    # host="0.0.0.0" делает сервис доступным со всех сетевых интерфейсов.
    # reload=True автоматически перезапускает сервер при изменениях кода (только для разработки).
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
    # Обрати внимание, что порт 8001 здесь - это порт, на котором Uvicorn будет слушать
    # ВАШУ ЛОКАЛЬНУЮ МАШИНУ, если вы запускаете product_service НЕ в Docker.
    # При запуске в Docker порт будет управляться docker-compose.