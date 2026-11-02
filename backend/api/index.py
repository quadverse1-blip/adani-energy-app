import sys
import os

# Ensure backend root is on Python path so 'app' package resolves cleanly
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

# Export for Vercel WSGI / ASGI handler
application = app

