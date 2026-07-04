import asyncio
import json

import redis as redis_sync
from celery import Celery

from app.config import settings

celery_app = Celery(
    "brainstorm",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(task_track_started=True, task_serializer="json", accept_content=["json"])

RECOMMENDATION_CACHE_TTL_SECONDS = 300    # 5분
RECOMMENDATION_PUBSUB_CHANNEL = "recommendation_events"


@celery_app.task(name="app.tasks.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="app.tasks.generate_recommendations")
def generate_recommendations(block_id: int) -> None:
    """블록 생성 시 호출되는 추천 생성 태스크"""
    asyncio.run(_generate_recommendations_async(block_id))


async def _generate_recommendations_async(block_id: int) -> None:
    # 여기서만 쓰는 지연 import: FastAPI api 프로세스 시작 시점에는 필요 없는 것들이라
    # (특히 embedding 쪽은 무거운 sentence-transformers를 물고 있음) worker 태스크 실행 시점에만 로드
    from app.crud.block import (
        get_block,
        list_ancestor_contents,
        list_child_contents,
        list_same_color_siblings,
    )
    from app.crud.mindmap import get_mindmap
    from app.db import SessionLocal, engine
    from app.services.gemini_recommendation import generate_keyword_suggestions

    try:
        async with SessionLocal() as db:
            block = await get_block(db, block_id)
            if block is None:
                return

            mindmap = await get_mindmap(db, block.map_id)
            if mindmap is None:
                return

            # 이미 나온 단어는 다시 추천하지 않는다: 원본 자신 + 루트까지의 조상 + 이미 있는 하위 노드
            ancestors = await list_ancestor_contents(db, block)
            existing_children = await list_child_contents(db, block.id)
            # 같은 색상=같은 주제 그룹으로 보고, 같은 맵 안에서 같은 색을 가진 다른 노드들을 맥락으로 준다
            color_group = await list_same_color_siblings(db, block.map_id, block.color, block.id)

            exclude = [block.content, *ancestors, *existing_children]
            map_id = block.map_id
            content = block.content

        # 1) Gemini로 "같은 색상 그룹" 맥락 + 제외 목록을 반영한 연관 키워드 생성
        suggestions = generate_keyword_suggestions(
            content=content, color_group=color_group, exclude=exclude, limit=6,
        )
        combined = [
            {"content": word, "score": round(1.0 - index * 0.05, 2), "source": "gemini"}
            for index, word in enumerate(suggestions)
        ]

        # 2) Gemini 키가 없거나 호출이 실패했을 때만, 기존 방식(사전적 유사도 + 관련검색어)으로 폴백
        if not combined:
            combined = await _fallback_recommendations(block_id, content, exclude)

        # 3) Redis에 캐싱 (TTL) — GET /blocks/{id}/recommendations가 이 키를 읽음
        redis_client = redis_sync.Redis.from_url(settings.redis_url, decode_responses=True)
        redis_client.setex(
            f"block:{block_id}:recommendations",
            RECOMMENDATION_CACHE_TTL_SECONDS,
            json.dumps(combined),
        )

        # 4) API 프로세스에 완료를 알림 (WebSocket 브로드캐스트는 api 프로세스만 할 수 있으므로
        #    Redis pub/sub으로 다리를 놓음 — app/core/recommendation_listener.py가 구독)
        redis_client.publish(
            RECOMMENDATION_PUBSUB_CHANNEL,
            json.dumps({"map_id": map_id, "block_id": block_id, "recommendations": combined}),
        )
    finally:
        # asyncio.run()은 태스크마다 새 이벤트 루프를 만드는 반면 engine의 커넥션 풀은
        # 워커 프로세스 전역으로 공유된다. 여기서 풀을 비워두지 않으면 다음 태스크가
        # 새 루프에서 이전 루프에 묶인 커넥션을 재사용하려다 "attached to a different loop" 에러가 난다.
        await engine.dispose()


async def _fallback_recommendations(block_id: int, content: str, exclude: list[str]) -> list[dict]:
    """Gemini API 키가 없거나 호출이 실패했을 때만 쓰는 기존 방식: 사전적 유사도(임베딩) + 관련검색어"""
    from app.crud.block import find_semantic_neighbors, get_block, set_block_embedding
    from app.crud.mindmap import get_mindmap
    from app.crud.recommendation_setting import get_or_create_setting
    from app.db import SessionLocal
    from app.services.embedding import compute_embedding
    from app.services.recommendation import fetch_related_search_terms, merge_recommendations

    async with SessionLocal() as db:
        block = await get_block(db, block_id)
        if block is None:
            return []
        mindmap = await get_mindmap(db, block.map_id)
        if mindmap is None:
            return []
        setting = await get_or_create_setting(db, mindmap.workspace_id)

        embedding = compute_embedding(block.content)
        await set_block_embedding(db, block, embedding)
        semantic_candidates = await find_semantic_neighbors(db, block, mindmap.workspace_id, limit=5)
        search_weight = setting.search_trend_weight
        semantic_weight = setting.semantic_weight

    search_terms = await fetch_related_search_terms(content, limit=5)
    exclude_keys = {item.strip().lower() for item in exclude}
    return merge_recommendations(
        semantic_candidates,
        search_terms,
        semantic_weight=semantic_weight,
        search_weight=search_weight,
        exclude=exclude_keys,
    )