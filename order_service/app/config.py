from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ORDER_DATABASE_URL: str
    APP_NAME: str = "Order Service"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8', extra='ignore')


settings = Settings()

if __name__ == "__main__":
    print("Loaded Order Service settings:")
    print(f"  Order Database URL: {settings.ORDER_DATABASE_URL}")