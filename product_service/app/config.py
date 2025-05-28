from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PRODUCT_DATABASE_URL: str = "postgresql+psycopg2://user:password@host:port/db_name"

    # Настройки для самого сервиса (если понадобятся)
    # APP_NAME: str = "Product Service"
    # DEBUG_MODE: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8', extra='ignore')


settings = Settings()


if __name__ == "__main__":
    print("Loaded settings:")
    print(f"  Product Database URL: {settings.PRODUCT_DATABASE_URL}")