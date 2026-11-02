import os
import sys

# Ensure backend root directory is in sys.path so 'app' package is always resolvable
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import (
    auth,
    attendance,
    sites,
    employees,
    salary,
    dashboard,
    tracking,
    reports,
    holidays
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend REST API for Adani Smart Meter Workforce & Attendance Management Platform",
    version="1.0.3",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists and mount static files
try:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
except Exception as e:
    print(f"[Warning] Could not mount /uploads: {e}")

# Include Routers under API_V1_STR
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(attendance.router, prefix=settings.API_V1_STR)
app.include_router(sites.router, prefix=settings.API_V1_STR)
app.include_router(employees.router, prefix=settings.API_V1_STR)
app.include_router(salary.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(tracking.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(holidays.router, prefix=settings.API_V1_STR)

# Also mount directly under root without prefix as requested by prompt endpoints
app.include_router(auth.router)
app.include_router(attendance.router)
app.include_router(sites.router)
app.include_router(employees.router)
app.include_router(salary.router)
app.include_router(dashboard.router)
app.include_router(tracking.router)
app.include_router(reports.router)
app.include_router(holidays.router)

# Automatic 24-Hour Photo Deletion Scheduler
@app.on_event("startup")
async def start_auto_cleanup_scheduler():
    import asyncio
    from app.services.storage_service import storage_service

    async def _cleanup_loop():
        # Initial cleanup pass on server start
        try:
            if settings.AUTO_DELETE_PHOTOS_AFTER_24H:
                storage_service.cleanup_expired_photos(max_age_hours=settings.PHOTO_RETENTION_HOURS)
        except Exception as e:
            pass

        # Periodic hourly cleanup
        while True:
            await asyncio.sleep(3600)
            try:
                if settings.AUTO_DELETE_PHOTOS_AFTER_24H:
                    storage_service.cleanup_expired_photos(max_age_hours=settings.PHOTO_RETENTION_HOURS)
            except Exception as e:
                pass

    asyncio.create_task(_cleanup_loop())

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Adani Smart Meter Workforce API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "/auth/login",
            "/attendance/check-in",
            "/attendance/check-out",
            "/attendance/today",
            "/attendance/history",
            "/sites",
            "/employees",
            "/salary/slip/{employeeId}",
            "/dashboard/stats",
            "/locations/live",
            "/reports/export"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
