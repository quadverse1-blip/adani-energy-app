import sys
import os

# Ensure backend root is on Python path so 'app' package resolves cleanly
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

# Vercel ASGI Middleware: restores original client path whether rewritten or direct
class VercelPathMiddleware:
    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in ("http", "websocket"):
            headers = dict(scope.get("headers", []))
            matched_path = headers.get(b"x-matched-path")
            if matched_path:
                scope["path"] = matched_path.decode("utf-8")
            elif scope.get("path", "").startswith("/api/index.py"):
                rem = scope["path"][len("/api/index.py"):]
                scope["path"] = rem if rem.startswith("/") else ("/" + rem)
            elif scope.get("path", "").startswith("/api/index"):
                rem = scope["path"][len("/api/index"):]
                scope["path"] = rem if rem.startswith("/") else ("/" + rem)
        await self.asgi_app(scope, receive, send)

app.add_middleware(VercelPathMiddleware)

# Export for Vercel
application = app
