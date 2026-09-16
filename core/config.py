from pydantic_settings import BaseSettings 

class Settings(BaseSettings):
    PROJECT_Name: str = "Vehicle Maintaince Predictor API"
    MONGODB_URL: str = "mongodb://locathost:27017"
    DATABASE_NAME: str = "car_repair_db"
    VIN_API_KEY: str = ""

    class config:
        env_file = ".env"

settings = Settings()