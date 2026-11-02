import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Adani Smart Meter Workforce & Attendance Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "adani-workforce-prod-jwt-secret-key-super-secure-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Firebase Cloud Configuration
    FIREBASE_API_KEY: str = os.getenv("FIREBASE_API_KEY", "AIzaSyD3PFo-2s8hw2A5KgK7herT9cU0WqmWGjg")
    FIREBASE_AUTH_DOMAIN: str = os.getenv("FIREBASE_AUTH_DOMAIN", "adani-energy-2f5e0.firebaseapp.com")
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "adani-energy-2f5e0")
    FIREBASE_STORAGE_BUCKET: str = os.getenv("FIREBASE_STORAGE_BUCKET", "adani-energy-2f5e0.firebasestorage.app")
    FIREBASE_MESSAGING_SENDER_ID: str = os.getenv("FIREBASE_MESSAGING_SENDER_ID", "381966539358")
    FIREBASE_APP_ID: str = os.getenv("FIREBASE_APP_ID", "1:381966539358:web:1d6b976a8f5f7598d3b2cf")
    FIREBASE_MEASUREMENT_ID: str = os.getenv("FIREBASE_MEASUREMENT_ID", "G-5F4Y1JX3EB")
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")

    # Storage & Automatic 24-Hour Cleanup
    STORAGE_MODE: str = os.getenv("STORAGE_MODE", "local")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/tmp/uploads" if (os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")) else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"))
    AUTO_DELETE_PHOTOS_AFTER_24H: bool = os.getenv("AUTO_DELETE_PHOTOS_AFTER_24H", "true").lower() == "true"
    PHOTO_RETENTION_HOURS: int = int(os.getenv("PHOTO_RETENTION_HOURS", "24"))
    
    # Shift parameters
    SHIFT_START_TIME: str = "09:30"
    GRACE_END_TIME: str = "09:45"
    SHIFT_END_TIME: str = "18:00"
    FULL_DAY_MIN_HOURS: float = 8.0
    HALF_DAY_MIN_HOURS: float = 4.0
    DEFAULT_GEOFENCE_RADIUS_METERS: float = 500.0
    MAX_ALLOWABLE_GPS_ACCURACY_METERS: float = 50.0

    CORS_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"

settings = Settings()
