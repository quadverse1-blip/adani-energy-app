import os
from typing import Any, List
from pydantic_settings import BaseSettings

def _clean_str(val: str, default: str) -> str:
    if not val:
        return default
    return val.strip().strip("'\"")

def _clean_int(val: str, default: int) -> int:
    if not val:
        return default
    try:
        return int(val.strip().strip("'\""))
    except Exception:
        return default

class Settings(BaseSettings):
    PROJECT_NAME: str = "Adani Smart Meter Workforce & Attendance Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = _clean_str(os.getenv("SECRET_KEY", ""), "adani-workforce-prod-jwt-secret-key-super-secure-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = _clean_int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", ""), 60 * 24 * 7)
    
    # Firebase Cloud Configuration
    FIREBASE_API_KEY: str = _clean_str(os.getenv("FIREBASE_API_KEY", ""), "AIzaSyD3PFo-2s8hw2A5KgK7herT9cU0WqmWGjg")
    FIREBASE_AUTH_DOMAIN: str = _clean_str(os.getenv("FIREBASE_AUTH_DOMAIN", ""), "adani-energy-2f5e0.firebaseapp.com")
    FIREBASE_PROJECT_ID: str = _clean_str(os.getenv("FIREBASE_PROJECT_ID", ""), "adani-energy-2f5e0")
    FIREBASE_STORAGE_BUCKET: str = _clean_str(os.getenv("FIREBASE_STORAGE_BUCKET", ""), "adani-energy-2f5e0.firebasestorage.app").replace("gs://", "").strip("/")
    FIREBASE_MESSAGING_SENDER_ID: str = _clean_str(os.getenv("FIREBASE_MESSAGING_SENDER_ID", ""), "381966539358")
    FIREBASE_APP_ID: str = _clean_str(os.getenv("FIREBASE_APP_ID", ""), "1:381966539358:web:1d6b976a8f5f7598d3b2cf")
    FIREBASE_MEASUREMENT_ID: str = _clean_str(os.getenv("FIREBASE_MEASUREMENT_ID", ""), "G-5F4Y1JX3EB")
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")

    # Storage & Automatic 24-Hour Cleanup
    STORAGE_MODE: str = _clean_str(os.getenv("STORAGE_MODE", ""), "firebase_storage")
    UPLOAD_DIR: str = os.getenv(
        "UPLOAD_DIR",
        "/tmp/uploads" if (os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")) else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
    )
    AUTO_DELETE_PHOTOS_AFTER_24H: bool = os.getenv("AUTO_DELETE_PHOTOS_AFTER_24H", "true").lower() == "true"
    PHOTO_RETENTION_HOURS: int = _clean_int(os.getenv("PHOTO_RETENTION_HOURS", ""), 24)
    AUTO_DELETE_PHOTOS_WINDOW_START_HOUR: int = _clean_int(os.getenv("AUTO_DELETE_PHOTOS_WINDOW_START_HOUR", ""), 0)
    AUTO_DELETE_PHOTOS_WINDOW_END_HOUR: int = _clean_int(os.getenv("AUTO_DELETE_PHOTOS_WINDOW_END_HOUR", ""), 1)
    AUTO_DELETE_PHOTOS_SCHEDULE: str = "12:00 AM IST (Midnight)"
    
    # Shift parameters
    SHIFT_START_TIME: str = "09:30"
    GRACE_END_TIME: str = "09:45"
    SHIFT_END_TIME: str = "18:00"
    FULL_DAY_MIN_HOURS: float = 8.0
    HALF_DAY_MIN_HOURS: float = 4.0
    DEFAULT_GEOFENCE_RADIUS_METERS: float = 500.0
    MAX_ALLOWABLE_GPS_ACCURACY_METERS: float = 50.0

    # SMTP Email Configuration
    SMTP_HOST: str = _clean_str(os.getenv("SMTP_HOST", ""), "smtp.gmail.com")
    SMTP_PORT: int = _clean_int(os.getenv("SMTP_PORT", ""), 587)
    SMTP_USER: str = _clean_str(os.getenv("SMTP_USER", ""), "aeslbs8@gmail.com")
    SMTP_PASSWORD: str = _clean_str(os.getenv("SMTP_PASSWORD", ""), "dura eonv ejor xues")
    SMTP_FROM_EMAIL: str = _clean_str(os.getenv("SMTP_FROM_EMAIL", ""), "aeslbs8@gmail.com")
    SMTP_FROM_NAME: str = _clean_str(os.getenv("SMTP_FROM_NAME", ""), "Adani Smart Meter Workforce Operations")
    OTP_EXPIRATION_MINUTES: int = _clean_int(os.getenv("OTP_EXPIRATION_MINUTES", ""), 10)

    CORS_ORIGINS: Any = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"

try:
    settings = Settings()
except Exception as e:
    print(f"[Warning] Settings parsing fallback triggered: {e}")
    # Minimal fallback settings so server never crashes on startup
    class FallbackSettings:
        PROJECT_NAME = "Adani Smart Meter Workforce & Attendance Platform"
        API_V1_STR = "/api/v1"
        SECRET_KEY = "adani-workforce-prod-jwt-secret-key-super-secure-2026"
        ALGORITHM = "HS256"
        ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
        FIREBASE_API_KEY = "AIzaSyD3PFo-2s8hw2A5KgK7herT9cU0WqmWGjg"
        FIREBASE_AUTH_DOMAIN = "adani-energy-2f5e0.firebaseapp.com"
        FIREBASE_PROJECT_ID = "adani-energy-2f5e0"
        FIREBASE_STORAGE_BUCKET = "adani-energy-2f5e0.firebasestorage.app"
        FIREBASE_MESSAGING_SENDER_ID = "381966539358"
        FIREBASE_APP_ID = "1:381966539358:web:1d6b976a8f5f7598d3b2cf"
        FIREBASE_MEASUREMENT_ID = "G-5F4Y1JX3EB"
        FIREBASE_SERVICE_ACCOUNT_PATH = ""
        STORAGE_MODE = "local"
        UPLOAD_DIR = "/tmp/uploads"
        AUTO_DELETE_PHOTOS_AFTER_24H = True
        PHOTO_RETENTION_HOURS = 24
        SHIFT_START_TIME = "09:30"
        GRACE_END_TIME = "09:45"
        SHIFT_END_TIME = "18:00"
        FULL_DAY_MIN_HOURS = 8.0
        HALF_DAY_MIN_HOURS = 4.0
        DEFAULT_GEOFENCE_RADIUS_METERS = 500.0
        MAX_ALLOWABLE_GPS_ACCURACY_METERS = 50.0
        # SMTP Fallback
        SMTP_HOST = "smtp.gmail.com"
        SMTP_PORT = 587
        SMTP_USER = "aeslbs8@gmail.com"
        SMTP_PASSWORD = "dura eonv ejor xues"
        SMTP_FROM_EMAIL = "aeslbs8@gmail.com"
        SMTP_FROM_NAME = "Adani Smart Meter Workforce Operations"
        OTP_EXPIRATION_MINUTES = 10
        CORS_ORIGINS = ["*"]
    settings = FallbackSettings()
