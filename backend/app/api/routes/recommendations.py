import logging

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.block_deps import require_block_write_access
from app.core.connection_manager import manager
from app.core.deps import get_current_user
from app.core.events import block_event
from app.core.workspace_deps import get_current_membership, require_write_access
from app.crud.block import create_block
from app.crud.recommendation_setting import get_or_create_setting, update_setting
from app.db import get_db
from app.models.block import Block
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.block import BlockPublic
from app.schemas.recommendation import (
    RecommendationApplyRequest,
    RecommendationItem,
    RecommendationSettingPublic,
    RecommendationSettingUpdate,
)
from app.services.recommendation_cache import (
    get_cached_recommendations,
    invalidate_recommendations,
    try_start_generation,
)
from app.worker import celery_app

logger = logging.getLogger(__name__)

router = APIRouter(tags=["recommendations"])


@router.get("/blocks/{block_id}/recommendations", response_model=list[RecommendationItem])
async def get_recommendations(
    limit: int = Query(default=6, ge=1, le=20),
    block: Block = Depends(require_block_write_access),
):
    cached = await get_cached_recommendations(block.id)
    if cached is None:
        # 캐시가 없다 = 아직 처리 전이거나 TTL 만료. 프론트가 완료될 때까지 이 엔드포인트를
        # 여러 번 폴링하므로, 이미 같은 블록에 대한 생성이 진행 중이면 또 큐에 넣지 않는다
        # (그렇지 않으면 폴링할 때마다 Gemini 호출이 중복으로 쌓여 rate limit에 쉽게 걸린다)
        if await try_start_generation(block.id):
            logger.info("[추천] block=%s 노드 선택 → 생성 작업 큐에 등록", block.id)
            celery_app.send_task("app.tasks.generate_recommendations", args=[block.id])
        else:
            logger.info("[추천] block=%s 노드 선택 → 이미 생성 진행 중이라 큐에 등록하지 않음 (폴링 대기)", block.id)
        # 완료되면 WebSocket recommendation:ready 이벤트로 알아서 push
        return []
    return cached[:limit]


@router.post(
    "/blocks/{block_id}/recommendations/apply",
    response_model=BlockPublic,
    status_code=status.HTTP_201_CREATED,
)
async def apply_recommendation(
    body: RecommendationApplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    block: Block = Depends(require_block_write_access),
):
    new_block = await create_block(
        db,
        map_id=block.map_id,
        parent_block_id=block.id,
        creator_id=current_user.id,
        content=body.content,
        color=block.color,    # 추천 적용 블록은 부모 색상을 그대로 상속
        source_type="recommended",
    )
    await manager.broadcast(block.map_id, block_event("block:created", new_block))
    # 부모(block)의 캐시된 추천에는 방금 선택한 단어가 그대로 남아있으므로 무효화해서
    # 다음 조회 시 새로 생긴 하위 블록을 반영해 재생성되도록 한다
    await invalidate_recommendations(block.id)
    # 이 블록도 새로운 아이디어이므로, 여기서부터 또 추천이 이어지도록 chaining
    if await try_start_generation(new_block.id):
        celery_app.send_task("app.tasks.generate_recommendations", args=[new_block.id])
    return new_block


@router.get(
    "/workspaces/{workspace_id}/recommendation-settings",
    response_model=RecommendationSettingPublic,
)
async def get_settings(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(get_current_membership),
):
    return await get_or_create_setting(db, workspace_id)


@router.patch(
    "/workspaces/{workspace_id}/recommendation-settings",
    response_model=RecommendationSettingPublic,
)
async def update_settings(
    workspace_id: int,
    body: RecommendationSettingUpdate,
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(require_write_access),
):
    setting = await get_or_create_setting(db, workspace_id)
    return await update_setting(
        db,
        setting,
        search_trend_weight=body.search_trend_weight,
        semantic_weight=body.semantic_weight,
    )