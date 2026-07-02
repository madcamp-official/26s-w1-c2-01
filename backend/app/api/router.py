from fastapi import APIRouter

from app.api.routes import health, realtime

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(realtime.router)

