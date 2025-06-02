from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.api.v1 import products as api_products
from app.db import engine, Base
from app.config import settings, STATIC_FILES_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting up {settings.APP_NAME}...")
    print("Startup complete.")
    yield
    print(f"Shutting down {settings.APP_NAME}...")
    if hasattr(engine, 'dispose'): # Для синхронного движка
        engine.dispose()
    print("Shutdown complete.")

app = FastAPI(
    title="Lampochka Factory - Product Service",
    description="Микросервис для управления товарами (лампочками).",
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

app.mount("/static", StaticFiles(directory=STATIC_FILES_DIR), name="static")
app.include_router(api_products.router, prefix="/api/v1")


@app.get("/health", tags=["Health Check"])
async def health_check():
    return {"status": "ok", "service": "Product Service"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)