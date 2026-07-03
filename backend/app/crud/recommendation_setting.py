from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recommendation_setting import RecommendationSetting


async def get_or_create_setting(db: AsyncSession, workspace_id: int) -> RecommendationSetting:
    stmt = select(RecommendationSetting).where(RecommendationSetting.workspace_id == workspace_id)
    result = await db.execute(stmt)
    setting = result.scalar_one_or_none()
    if setting is None:
        # 초대되기 전에는 이 레코드가 없을 수 있으므로, 조회 시점에 기본값(0.5/0.5)으로 하나 만듦
        setting = RecommendationSetting(workspace_id=workspace_id)
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    return setting


async def update_setting(
    db: AsyncSession, setting: RecommendationSetting, *, search_trend_weight: float, semantic_weight: float
) -> RecommendationSetting:
    setting.search_trend_weight = search_trend_weight
    setting.semantic_weight = semantic_weight
    await db.commit()
    await db.refresh(setting)
    return setting