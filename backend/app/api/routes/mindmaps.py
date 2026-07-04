from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.connection_manager import manager, workspace_manager
from app.core.deps import get_current_user
from app.core.events import map_deleted_event, map_event
from app.core.mindmap_deps import get_mindmap_and_check_membership, require_mindmap_write_access
from app.core.workspace_deps import get_current_membership, require_write_access
from app.crud.block import count_blocks_grouped_by_map
from app.crud.mindmap import create_mindmap, delete_mindmap, list_mindmaps, update_mindmap_name
from app.db import get_db
from app.models.mindmap import MindMap
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.mindmap import MindMapCreate, MindMapListItem, MindMapPublic, MindMapUpdate

router = APIRouter(tags=["mindmaps"])


@router.post(
    "/workspaces/{workspace_id}/maps",
    response_model=MindMapPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create(
    workspace_id: int,
    body: MindMapCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(require_write_access),
):
    created = await create_mindmap(db, workspace_id, current_user.id, body.name)
    # 새 마인드맵은 루트 노드가 함께 생성되므로 node_count=1
    await workspace_manager.broadcast(workspace_id, map_event("map:created", created, node_count=1))
    return created


@router.get("/workspaces/{workspace_id}/maps", response_model=list[MindMapListItem])
async def list_by_workspace(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    _membership: WorkspaceMember = Depends(get_current_membership),
):
    mindmaps = await list_mindmaps(db, workspace_id)
    counts = await count_blocks_grouped_by_map(db, [m.id for m in mindmaps])
    return [
        MindMapListItem(
            id=m.id,
            workspace_id=m.workspace_id,
            name=m.name,
            root_block_id=m.root_block_id,
            created_by=m.created_by,
            created_at=m.created_at,
            updated_at=m.updated_at,
            node_count=counts.get(m.id, 0),
        )
        for m in mindmaps
    ]


@router.get("/maps/{map_id}", response_model=MindMapPublic)
async def get_detail(mindmap: MindMap = Depends(get_mindmap_and_check_membership)):
    return mindmap


@router.patch("/maps/{map_id}", response_model=MindMapPublic)
async def update(
    body: MindMapUpdate,
    db: AsyncSession = Depends(get_db),
    mindmap: MindMap = Depends(require_mindmap_write_access),
):
    updated = await update_mindmap_name(db, mindmap, body.name)
    counts = await count_blocks_grouped_by_map(db, [updated.id])
    await workspace_manager.broadcast(
        updated.workspace_id, map_event("map:updated", updated, node_count=counts.get(updated.id, 0))
    )
    # 지금 이 맵 화면에 들어와 있는 사람에게도 이름 변경을 알림
    await manager.broadcast(updated.id, {"type": "map:renamed", "name": updated.name})
    return updated


@router.delete("/maps/{map_id}")
async def delete(
    db: AsyncSession = Depends(get_db),
    mindmap: MindMap = Depends(require_mindmap_write_access),
):
    map_id, workspace_id = mindmap.id, mindmap.workspace_id
    await delete_mindmap(db, mindmap)
    await workspace_manager.broadcast(workspace_id, map_deleted_event(workspace_id, map_id))
    # 지금 이 맵을 보고 있는 사람은 더 이상 볼 수 없으므로 캔버스 화면에서 알 수 있게 알림
    await manager.broadcast(map_id, {"type": "map:deleted", "mapId": map_id})
    return {"message": "마인드맵이 삭제되었습니다"}