from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.block_deps import get_block_and_check_membership, require_block_write_access
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
from app.services.recommendation_cache import get_cached_recommendations, invalidate_recommendations
from app.worker import celery_app

router = APIRouter(tags=["recommendations"])


@router.get("/blocks/{block_id}/recommendations", response_model=list[RecommendationItem])
async def get_recommendations(
    limit: int = Query(default=6, ge=1, le=20),
    block: Block = Depends(get_block_and_check_membership),
):
    cached = await get_cached_recommendations(block.id)
    if cached is None:
        # 캐시가 없다 = 아직 처리 전이거나 TTL 만료, 다시 생성 요청만 걸어두고 빈 리스트를 반환
        # 완료되면 WebSocket recommendation:ready 이벤트로 알아서 push
        celery_app.send_task("app.tasks.generate_recommendations", args=[block.id])
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