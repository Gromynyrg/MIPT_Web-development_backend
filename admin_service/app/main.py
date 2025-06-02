from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
import httpx
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth_router, products_proxy_router, orders_proxy_router
from app.db import engine as admin_engine, BaseAdmin  # Для создания таблиц админа, если нужно
from app.config import settings
from app.crud import create_admin_user, get_user_by_username  # Для создания первого админа
from app.schemas import UserCreate
from app.db import SessionLocalAdmin

# Глобальный HTTP клиент для проксирования
# Должен быть создан и закрыт в lifespan
http_client: httpx.AsyncClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    print(f"Starting up {settings.APP_NAME}...")
    http_client = httpx.AsyncClient()

    db = SessionLocalAdmin()
    try:
        default_admin_username = "admin"
        user = get_user_by_username(db, username=default_admin_username)
        if not user:
            print(f"Default admin user '{default_admin_username}' not found, creating one...")
            default_admin_password = "adminpassword"
            admin_in = UserCreate(username=default_admin_username, password=default_admin_password)
            create_admin_user(db=db, user_in=admin_in)
            print(
                f"Default admin user '{default_admin_username}' created with password '{default_admin_password}'. CHANGE IT!")
        else:
            print(f"Default admin user '{default_admin_username}' already exists.")
    except Exception as e:
        print(f"Error during admin user creation/check: {e}")
    finally:
        db.close()

    print("Admin Service startup complete.")
    yield
    print(f"Shutting down {settings.APP_NAME}...")
    await http_client.aclose()
    if hasattr(admin_engine, 'dispose'):
        admin_engine.dispose()
    print("Admin Service shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Admin BFF for Lampochka Factory. Handles authentication and proxies requests to backend services.",
    version="0.1.0",
    lifespan=lifespan
)

origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://127.0.0.1:5500",
    "null",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(products_proxy_router.router, prefix="/api/v1")
app.include_router(orders_proxy_router.router, prefix="/api/v1")


@app.get("/admin/health", tags=["Health Check"])
async def health_check_admin():
    return {"status": "ok", "service": "Admin Service"}
