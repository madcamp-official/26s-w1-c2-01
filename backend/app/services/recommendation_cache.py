import json

import redis.asyncio as redis_asyncio

from app.config import settings

# 일반 앱 캐시용 redis_url(db 0)을 사용 — Celery 브로커/백엔드(db 1, 2)와는 분리되어 있음
_redis_client = redis_asyncio.from_url(settings.redis_url, decode_responses=True)


def _cache_key(block_id: int) -> str:
    return f"block:{block_id}:recommendations"


async def get_cached_recommendations(block_id: int) -> list[dict] | None:
    raw = await _redis_client.get(_cache_key(block_id))
    if raw is None:
        return None
    return json.loads(raw)


async def invalidate_recommendations(block_id: int) -> None:
    """블록의 캐시된 추천을 지운다. 하위 블록이 새로 생겨 제외 목록이 바뀌었을 때 사용."""
    await _redis_client.delete(_cache_key(block_id))