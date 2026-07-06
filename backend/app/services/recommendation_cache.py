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


def _pending_key(block_id: int) -> str:
    return f"block:{block_id}:recommendations:pending"


async def try_start_generation(block_id: int, ttl_seconds: int = 20) -> bool:
    """같은 블록에 대해 추천 생성 태스크를 중복으로 큐에 넣지 않도록 하는 짧은 락.

    프론트는 캐시가 찰 때까지 GET을 여러 번 폴링하는데, 그때마다 매번 새 Celery
    태스크(=Gemini 호출)를 큐에 넣으면 같은 블록 하나에 요청이 겹겹이 쌓여 순식간에
    API rate limit(429)에 걸리고 이후 요청들이 전부 폴백으로 새버린다.
    SET NX EX로 원자적으로 선점해, 이미 생성이 진행 중이면 이번 요청은 큐에 넣지 않는다.
    TTL은 워커가 죽는 등 release_generation_lock이 못 불린 경우를 위한 안전망이다.
    """
    return bool(await _redis_client.set(_pending_key(block_id), "1", nx=True, ex=ttl_seconds))


async def release_generation_lock(block_id: int) -> None:
    """생성이 끝나면(성공/실패 무관) 곧바로 락을 풀어, TTL이 다 찰 때까지 재생성이 막히지 않게 한다."""
    await _redis_client.delete(_pending_key(block_id))