from pydantic_settings import BaseSettings, SettingsConfigDict
import os
from pathlib import Path

APP_BASE_DIR = Path(__file__).parent.resolve()
STATIC_FILES_DIR = APP_BASE_DIR / "static"
PRODUCT_IMAGES_DIR = STATIC_FILES_DIR / "product_images"


class Settings(BaseSettings):
    PRODUCT_DATABASE_URL: str

    APP_NAME: str = "Product Service"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8', extra='ignore')


settings = Settings()

os.makedirs(PRODUCT_IMAGES_DIR, exist_ok=True)

if __name__ == "__main__":
    print("Loaded settings:")
    print(f"  Product Database URL: {settings.PRODUCT_DATABASE_URL}")
    print(f"  App Base Dir: {APP_BASE_DIR}")
    print(f"  Static Files Dir: {STATIC_FILES_DIR}")
    print(f"  Product Images Dir: {PRODUCT_IMAGES_DIR}")