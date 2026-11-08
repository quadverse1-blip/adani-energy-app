import sys
import os
import traceback
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# 1. Resolve backend path dynamically so 'app' package resolves in all setups
current_file = os.path.abspath(__file__)
current_dir = os.path.dirname(current_file)

candidates = [
    os.path.dirname(current_dir), # backend
    os.path.abspath(os.path.join(current_dir, "..", "..", "backend")),
    os.path.dirname(os.path.dirname(current_dir)), # root
]

backend_dir = None
for candidate in candidates:
    if os.path.isdir(os.path.join(candidate, "app")):
        backend_dir = candidate
        break

if backend_dir and backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# 2. Safely import FastAPI app with crash protection
try:
    from app.main import app as main_app
    app = main_app
except Exception as e:
    tb = traceback.format_exc()
    sys.stderr.write(f"[Vercel Cold-Start Error] Failed to import app: {tb}\n")
    app = FastAPI(title="Adani API Initialization Fallback")
    err_detail = {
        "status": "error",
        "service": "Adani Smart Meter Workforce API",
        "error": "FastAPI Initialization Failed",
        "detail": str(e),
        "traceback": tb.splitlines()
    }
    @app.api_route("/", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    async def vercel_init_fallback(path_name: str = ""):
        return JSONResponse(status_code=500, content=err_detail)

application = app
