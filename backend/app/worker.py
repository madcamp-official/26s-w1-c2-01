import asyncio
import json
import logging
import time

import redis as redis_sync
from celery import Celery

from app.config import settings

logger = logging.getLogger(__name__)

celery_app = Celery(
    "brainstorm",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    accept_content=["json"],
    # Gemini 호출이 hang되거나 비정상적으로 오래 걸리는 작업이 워커 슬롯을 영영 붙잡아
    # 뒤에 밀린 추천들이 더 밀리는 걸 막기 위한 안전장치 (정상 케이스는 수 초 내 종료).
    # Gemini timeout(12s) + 실패 시 폴백(관련검색어 호출 최대 5s)까지 감안한 여유값
    task_soft_time_limit=25,
    task_time_limit=30,
    # 기본값(prefetch_multiplier=4)은 워커가 실행 여력보다 훨씬 많은 작업을 미리 당겨와
    # 쟁여두는 동작이라, 소요 시간이 들쭉날쭉한 이 작업(Gemini 응답 속도 편차가 큼)에서는
    # 한쪽 스레드가 여러 개를 쥐고 있는 동안 다른 스레드가 놀 수 있다. 1로 낮춰 스레드가
    # 하나 끝낼 때마다 큐에서 하나씩만 가져가게 해서 분배를 고르게 한다.
    worker_prefetch_multiplier=1,
    # 배포 중 `docker compose up -d --build`로 worker 컨테이너가 재생성되면, 기본 설정(작업을
    # 받자마자 ack)에서는 처리 중이던 추천 작업이 그대로 유실된다. late ack + 유실 시 재큐잉으로
    # 컨테이너가 재시작돼도 처리 중이던 추천이 사라지지 않고 다음 워커가 이어받게 한다.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

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
    # worker 태스크 실행 시점에만 로드
    from app.crud.block import get_block, list_other_contents_in_map, list_same_color_siblings
    from app.crud.mindmap import get_mindmap
    from app.db import SessionLocal, engine
    from app.services.gemini_recommendation import generate_keyword_suggestions

    task_started_at = time.monotonic()
    logger.info("[추천] block=%s 작업 시작", block_id)

    # 락 해제를 setex 성공 이후로 미루면, 그 전(DB 조회, Gemini 호출, JSON 직렬화 등) 어디서든
    # 예외가 나는 순간 pending 락이 TTL(20초)이 다 찰 때까지 안 풀린다. 그동안은 GET
    # /blocks/{id}/recommendations가 폴링해도 재생성이 아예 큐에 들어가지 않아 "추천이 영영
    # 안 뜬다"로 보인다. 그래서 실패해도 반드시 풀리도록 finally에서 지운다.
    redis_client = redis_sync.Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        try:
            async with SessionLocal() as db:
                block = await get_block(db, block_id)
                if block is None:
                    return

                mindmap = await get_mindmap(db, block.map_id)
                if mindmap is None:
                    return

                # 이미 나온 단어는 다시 추천하지 않는다: 조상/하위뿐 아니라 이 맵의 다른 가지에 있는
                # 노드까지 전부 포함 (루트 포함) — 맵 전체에서 같은 단어가 중복 추천되지 않도록 함
                exclude = await list_other_contents_in_map(db, block.map_id, block.id)
                exclude.append(block.content)
                # 같은 색상=같은 주제 그룹으로 보고, 같은 맵 안에서 같은 색을 가진 다른 노드들을 맥락으로 준다
                color_group = await list_same_color_siblings(db, block.map_id, block.color, block.id)

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
                logger.info("[추천] block=%s Gemini 결과 없음 → 관련검색어 폴백으로 전환", block_id)
                combined = await _fallback_recommendations(block_id, content, exclude)

            source = combined[0]["source"] if combined else "none"
            logger.info(
                "[추천] block=%s 완료: source=%s 결과=%d개 (%.2fs)",
                block_id, source, len(combined), time.monotonic() - task_started_at,
            )

            # 3) Redis에 캐싱 (TTL) — GET /blocks/{id}/recommendations가 이 키를 읽음
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
        except Exception:
            logger.exception(
                "[추천] block=%s 작업 실패 (%.2fs 경과)", block_id, time.monotonic() - task_started_at,
            )
            raise
    finally:
        # 성공/실패 무관하게 중복 생성 방지 락(app/services/recommendation_cache.py의
        # try_start_generation)을 풀어서, 실패했을 때도 다음 폴링에서 바로 재생성을 시도할 수 있게 한다.
        # 워커는 별도 프로세스라 API 쪽 async redis 클라이언트를 그대로 쓰지 않고, 같은 키 규칙만 맞춘다.
        redis_client.delete(f"block:{block_id}:recommendations:pending")
        # asyncio.run()은 태스크마다 새 이벤트 루프를 만드는 반면 engine의 커넥션 풀은
        # 워커 프로세스 전역으로 공유된다. 여기서 풀을 비워두지 않으면 다음 태스크가
        # 새 루프에서 이전 루프에 묶인 커넥션을 재사용하려다 "attached to a different loop" 에러가 난다.
        await engine.dispose()


async def _fallback_recommendations(block_id: int, content: str, exclude: list[str]) -> list[dict]:
    """Gemini API 키가 없거나 호출이 실패했을 때만 쓰는 기존 방식: 관련검색어"""
    from app.crud.block import get_block
    from app.crud.mindmap import get_mindmap
    from app.crud.recommendation_setting import get_or_create_setting
    from app.db import SessionLocal
    from app.services.recommendation import fetch_related_search_terms, merge_recommendations, normalize_dedup_key

    async with SessionLocal() as db:
        block = await get_block(db, block_id)
        if block is None:
            return []
        mindmap = await get_mindmap(db, block.map_id)
        if mindmap is None:
            return []
        setting = await get_or_create_setting(db, mindmap.workspace_id)
        search_weight = setting.search_trend_weight

    # 순위 재조정(원본 포함 후보 감점)이 걸러낼 걸 감안해 후보 풀을 넉넉히 가져온다
    search_terms = await fetch_related_search_terms(content, limit=10)
    exclude_keys = {normalize_dedup_key(item) for item in exclude}
    return merge_recommendations(
        [],
        search_terms,
        semantic_weight=0.0,
        search_weight=search_weight,
        exclude=exclude_keys,
        source_content=content,
    )