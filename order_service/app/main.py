from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.api.v1 import orders as api_orders
from app.api.v1 import promocodes as api_promocodes
from app.db import engine, Base
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting up {settings.APP_NAME}...")
    print("Order Service startup complete.")
    yield
    print(f"Shutting down {settings.APP_NAME}...")
    if hasattr(engine, 'dispose'): # Для синхронного движка
        engine.dispose()
    print("Order Service shutdown complete.")

app = FastAPI(
    title="Lampochka Factory - Order Service",
    description="Микросервис для управления заказами и промокодами.",
    version="0.1.0",
    lifespan=lifespan
)

client_origins = [
    "http://localhost",         # Общий для разработки
    "http://127.0.0.1",       # Общий для разработки
    "null",                     # Для file:///
    "http://127.0.0.1:5501",
    "http://localhost:5501",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=client_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры API
app.include_router(api_orders.router, prefix="/api/v1") # Эндпоинты будут /api/v1/orders...
app.include_router(api_promocodes.router, prefix="/api/v1") # Эндпоинты будут /api/v1/promocodes...


@app.get("/health", tags=["Health Check"])
async def health_check():
    # TODO: Можно добавить проверку доступности БД
    return {"status": "ok", "service": "Order Service"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
