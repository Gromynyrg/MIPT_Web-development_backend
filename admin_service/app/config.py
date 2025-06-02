from pydantic_settings import BaseSettings, SettingsConfigDict
from datetime import timedelta


class Settings(BaseSettings):
    ADMIN_DATABASE_URL: str
    APP_NAME: str = "Admin Service (BFF)"

    # Настройки JWT
    SECRET_KEY: str = "your-super-secret-key-for-jwt-change-this"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # URL других сервисов (для проксирования)
    PRODUCT_SERVICE_INTERNAL_URL: str = "http://product_service:8000/api/v1"
    ORDER_SERVICE_INTERNAL_URL: str = "http://order_service:8000/api/v1"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8', extra='ignore')


settings = Settings()