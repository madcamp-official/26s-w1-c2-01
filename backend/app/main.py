import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.core.recommendation_listener import listen_for_recommendations
from app.db import engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    listener_task = asyncio.create_task(listen_for_recommendations())
    yield
    listener_task.cancel()
    await engine.dispose()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"message": settings.app_name, "docs": "/docs"}

