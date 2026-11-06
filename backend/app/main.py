import os
import sys

# Ensure backend root directory is in sys.path so 'app' package is always resolvable
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from fastapi import FastAPI, Request
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

# Vercel Serverless Path Normalization Middleware
@app.middleware("http")
async def vercel_path_normalizer(request: Request, call_next):
    # Check if path was passed via Vercel rewrite (?path=$1)
    path_param = request.query_params.get("path")
    if path_param:
        clean_path = path_param if path_param.startswith("/") else f"/{path_param}"
        request.scope["path"] = clean_path
    else:
        raw_path = request.headers.get("x-forwarded-uri") or request.scope.get("path", "")
        if "?" in raw_path:
            raw_path = raw_path.split("?")[0]
        prefixes = (
            "/backend/api/index.py",
            "/backend/api/index",
            "/backend/api",
            "/api/index.py",
            "/api/index"
        )
        for p in prefixes:
            if raw_path.startswith(p):
                rem = raw_path[len(p):]
                raw_path = rem if rem.startswith("/") else ("/" + rem)
                break
        if raw_path:
            request.scope["path"] = raw_path
    return await call_next(request)

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

# Middleware to ensure 8:00 AM - 9:00 AM IST photo deletion and 6:00 PM IST auto-checkout run reliably on request activity
@app.middleware("http")
async def check_scheduled_cleanup_middleware(request: Request, call_next):
    try:
        from app.services.storage_service import storage_service
        storage_service.check_and_run_scheduled_8am_cleanup()
    except Exception:
        pass
    try:
        from app.services.attendance_service import attendance_service
        attendance_service.check_and_run_scheduled_6pm_auto_checkout()
    except Exception:
        pass
    return await call_next(request)

# Automatic Schedulers:
# 1. 8:00 AM - 9:00 AM IST Check-in Photo Deletion Scheduler
# 2. 6:00 PM IST Automatic Check-Out Scheduler for open shifts
@app.on_event("startup")
async def start_auto_cleanup_scheduler():
    is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    if is_serverless:
        # In Vercel serverless functions, background loops cause FUNCTION_INVOCATION_FAILED.
        # Scheduled tasks are handled cleanly by Vercel Cron and middleware.
        return

    import asyncio
    from app.services.storage_service import storage_service
    from app.services.attendance_service import attendance_service

    async def _cleanup_loop():
        # Immediate check on server boot
        try:
            storage_service.check_and_run_scheduled_8am_cleanup()
        except Exception:
            pass

        # Continuously monitor every 60 seconds
        while True:
            await asyncio.sleep(60)
            try:
                storage_service.check_and_run_scheduled_8am_cleanup()
            except Exception:
                pass

    async def _auto_checkout_6pm_loop():
        # Immediate check on server boot
        try:
            attendance_service.check_and_run_scheduled_6pm_auto_checkout()
        except Exception:
            pass

        # Continuously monitor every 30 seconds for 6:00 PM IST shift conclusion
        while True:
            await asyncio.sleep(30)
            try:
                attendance_service.check_and_run_scheduled_6pm_auto_checkout()
            except Exception:
                pass

    asyncio.create_task(_cleanup_loop())
    asyncio.create_task(_auto_checkout_6pm_loop())

@app.api_route("/api/v1/attendance/auto-checkout-6pm", methods=["GET", "POST"])
@app.api_route("/attendance/auto-checkout-6pm", methods=["GET", "POST"])
@app.api_route("/api/cron/auto-checkout-6pm", methods=["GET", "POST"])
async def trigger_6pm_auto_checkout(force: bool = False):
    """
    Triggers 6:00 PM IST automatic checkout for all active shifts.
    Runs via backend scheduler, Vercel cron, or Admin on-demand trigger.
    """
    from app.services.attendance_service import attendance_service
    result = attendance_service.perform_auto_checkout_all_open_shifts(force=force)
    return result

@app.get("/api/cron/cleanup-photos")
@app.get("/cron/cleanup-photos")
async def cron_cleanup_photos():
    """Vercel Cron endpoint scheduled daily between 8:00 AM - 9:00 AM IST."""
    from app.services.storage_service import storage_service
    result = storage_service.cleanup_previous_days_photos(force=True)
    return result

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Adani Smart Meter Workforce API",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
