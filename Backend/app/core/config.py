from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Vehicle Maintenance Predictor API"
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "car_repair_db"
    NOMINATIM_USER_AGENT: str = "MotorMate/1.0"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        extra="ignore",
    )


settings = Settings()
