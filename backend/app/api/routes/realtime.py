import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.core.connection_manager import manager, workspace_manager
from app.core.security import decode_token
from app.crud.mindmap import get_mindmap
from app.crud.user import get_user_by_id
from app.crud.workspace import get_membership, get_workspace
from app.db import SessionLocal

router = APIRouter(tags=["realtime"])


async def _authenticate(token: str) -> int | None:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("access 토큰이 아닙니다")
        return int(payload["sub"])
    except (ValueError, KeyError):
        return None


@router.websocket("/ws/maps/{map_id}")
async def map_socket(websocket: WebSocket, map_id: int, token: str = Query(...)) -> None:
    """
    마인드맵(캔버스) 단위 실시간 채널

    워크스페이스 단위가 아니라 마인드맵 단위로 채널을 나눈 이유:
    같은 워크스페이스라도 팀원마다 다른 마인드맵을 보고 있을 수 있어서, 지금 보고 있는 캔버스 이벤트만 받는 것

    노드/댓글/추천 이벤트 외에, 지금 이 맵에 접속해 있는 사용자 목록(presence)도 함께 브로드캐스트한다.
    """
    user_id = await _authenticate(token)
    if user_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with SessionLocal() as db:
        user = await get_user_by_id(db, user_id)
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        mindmap = await get_mindmap(db, map_id)
        if mindmap is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        membership = await get_membership(db, mindmap.workspace_id, user.id)
        if membership is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_info = {"id": user.id, "name": user.name, "email": user.email, "selected_block_id": None}

    await websocket.accept()
    manager.connect(map_id, websocket, user_info)
    await manager.broadcast(map_id, {"type": "presence:update", "users": manager.list_users(map_id)})
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue
            # 클라이언트 -> 서버: 지금 선택 중인 노드가 바뀔 때마다 알려주면, 다른 접속자에게 presence와 함께 브로드캐스트
            if payload.get("type") == "selection:update":
                manager.update_selection(map_id, websocket, payload.get("blockId"))
                await manager.broadcast(map_id, {"type": "presence:update", "users": manager.list_users(map_id)})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(map_id, websocket)
        await manager.broadcast(map_id, {"type": "presence:update", "users": manager.list_users(map_id)})


@router.websocket("/ws/workspaces/{workspace_id}")
async def workspace_socket(websocket: WebSocket, workspace_id: int, token: str = Query(...)) -> None:
    """
    워크스페이스 화면 단위 실시간 채널 (워크스페이스 이름 변경/삭제, 멤버 변화, 마인드맵 목록 변화)

    presence는 필요 없어서(요청 범위는 마인드맵 화면의 접속자 표시) user_info 없이 연결만 추적한다.
    """
    user_id = await _authenticate(token)
    if user_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with SessionLocal() as db:
        workspace = await get_workspace(db, workspace_id)
        if workspace is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        membership = await get_membership(db, workspace_id, user_id)
        if membership is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await websocket.accept()
    workspace_manager.connect(workspace_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        workspace_manager.disconnect(workspace_id, websocket)
