import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.core.recommendation_listener import listen_for_recommendations
from app.db import engine

# uvicorn은 자체 로거(uvicorn/uvicorn.access)만 설정하고 root 로거는 그대로 두기 때문에,
# app 코드에서 남기는 logger.info(...)가 기본값(WARNING)에 막혀 터미널에 아예 안 보인다.
# 추천 흐름 디버깅용 로그(어떤 모델을 쓰는지, 폴백 여부 등)가 보이도록 명시적으로 INFO로 올려둔다.
logging.basicConfig(level=logging.INFO)


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

