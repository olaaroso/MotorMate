from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vehicle Maintenance Predictor API"
    MONGODB_URL: str 
    DATABASE_NAME: str 

    # FIX: Use model_config instead of class Config
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()