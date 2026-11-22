"""Alternate entrypoint shim for hosts that look for app.py (Vercel/Render).

The real application lives in main.py; this simply re-exports it.
"""
from main import app

__all__ = ["app"]
