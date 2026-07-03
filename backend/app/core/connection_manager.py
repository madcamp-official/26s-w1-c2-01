from fastapi import WebSocket


class ConnectionManager:
    """map_id 단위로 접속 중인 WebSocket들을 관리"""

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}

    def connect(self, map_id: int, websocket: WebSocket) -> None:
        self._connections.setdefault(map_id, set()).add(websocket)

    def disconnect(self, map_id: int, websocket: WebSocket) -> None:
        connections = self._connections.get(map_id)
        if connections is None:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(map_id, None)

    async def broadcast(self, map_id: int, message: dict) -> None:
        connections = self._connections.get(map_id)
        if not connections:
            return
        dead: set[WebSocket] = set()
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            connections.discard(ws)


# 앱 전체에서 공유하는 단일 인스턴스
manager = ConnectionManager()