import json

import redis.asyncio as redis_asyncio

from app.config import settings
from app.core.connection_manager import manager

CHANNEL = "recommendation_events"


async def listen_for_recommendations() -> None:
    """
    Celery worker와 FastAPI api는 서로 다른 프로세스라, worker가 ConnectionManager(api 프로세스 메모리 안에만 있는 객체)를 직접 호출할 수 없음
    그래서 worker는 추천 계산이 끝나면 Redis의 `recommendation_events` 채널에 publish만 하고, 이 함수가 api 프로세스에서 그 채널을 구독하고 있다가 받으면 WebSocket으로 전달
    """
    client = redis_asyncio.from_url(settings.redis_url, decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(CHANNEL)

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue
        try:
            payload = json.loads(message["data"])
        except (json.JSONDecodeError, TypeError):
            continue

        event = {
            "type": "recommendation:ready",
            "blockId": payload["block_id"],
            "recommendations": payload["recommendations"],
        }
        await manager.broadcast(payload["map_id"], event)