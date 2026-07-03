import asyncio
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse

from app.core.connection_manager import manager
from app.core.security import decode_token
from app.crud.mindmap import get_mindmap
from app.crud.user import get_user_by_id
from app.crud.workspace import get_membership
from app.db import SessionLocal

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/maps/{map_id}")
async def map_socket(websocket: WebSocket, map_id: int, token: str = Query(...)) -> None:
    """
    마인드맵(캔버스) 단위 실시간 채널

    워크스페이스 단위가 아니라 마인드맵 단위로 채널을 나눈 이유:
    같은 워크스페이스라도 팀원마다 다른 마인드맵을 보고 있을 수 있어서, 지금 보고 있는 캔버스 이벤트만 받는 것
    """
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("access 토큰이 아닙니다")
        user_id = int(payload["sub"])
    except (ValueError, KeyError):
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

    await websocket.accept()
    manager.connect(map_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(map_id, websocket)


@router.get("/sse/workspaces/{workspace_id}")
async def workspace_events(workspace_id: int) -> StreamingResponse:
    async def stream():
        while True:
            yield f"data: {json.dumps({'type': 'heartbeat', 'workspaceId': workspace_id})}\n\n"
            await asyncio.sleep(15)

    return StreamingResponse(stream(), media_type="text/event-stream")

