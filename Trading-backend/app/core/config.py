from pydantic_settings import BaseSettings
from sqlalchemy.engine import URL
from pydantic import computed_field

class Settings(BaseSettings):
    PROJECT_NAME: str = "Trading App"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Database (loaded from .env)
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_SERVER: str
    POSTGRES_PORT: str
    POSTGRES_DB: str

    # Zerodha
    ZERODHA_API_KEY: str = ""
    ZERODHA_API_SECRET: str = ""

    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        return str(
            URL.create(
                drivername="postgresql+psycopg2",
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PASSWORD,
                host=self.POSTGRES_SERVER,
                port=self.POSTGRES_PORT,
                database=self.POSTGRES_DB,
            )
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
