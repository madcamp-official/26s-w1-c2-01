import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/workspaces/{workspace_id}")
async def workspace_socket(websocket: WebSocket, workspace_id: int) -> None:
    """Temporary echo channel; replace with Redis pub/sub and JWT authentication."""
    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            await websocket.send_json({"workspaceId": workspace_id, "payload": payload})
    except WebSocketDisconnect:
        return


@router.get("/sse/workspaces/{workspace_id}")
async def workspace_events(workspace_id: int) -> StreamingResponse:
    async def stream():
        while True:
            yield f"data: {json.dumps({'type': 'heartbeat', 'workspaceId': workspace_id})}\n\n"
            await asyncio.sleep(15)

    return StreamingResponse(stream(), media_type="text/event-stream")

