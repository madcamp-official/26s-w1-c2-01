from fastapi import WebSocket


class ConnectionManager:
    """channel_id(맵 또는 워크스페이스 id) 단위로 접속 중인 WebSocket들을 관리

    연결마다 user_info를 함께 들고 있어서, 맵 채널에서는 "지금 누가 들어와 있는지"(presence)를
    조회할 수 있다. user_info가 필요 없는 채널(워크스페이스 채널)은 넘기지 않아도 된다.
    """

    def __init__(self) -> None:
        self._connections: dict[int, dict[WebSocket, dict | None]] = {}

    def connect(self, channel_id: int, websocket: WebSocket, user_info: dict | None = None) -> None:
        self._connections.setdefault(channel_id, {})[websocket] = user_info

    def disconnect(self, channel_id: int, websocket: WebSocket) -> None:
        connections = self._connections.get(channel_id)
        if connections is None:
            return
        connections.pop(websocket, None)
        if not connections:
            self._connections.pop(channel_id, None)

    def update_selection(self, channel_id: int, websocket: WebSocket, block_id: int | None) -> None:
        """이 연결의 사용자가 지금 선택 중인 노드(블록)를 갱신 (다른 사용자에게 presence와 함께 보여주기 위함)"""
        connections = self._connections.get(channel_id)
        if connections is None or websocket not in connections:
            return
        info = connections[websocket]
        if info is not None:
            info["selected_block_id"] = block_id

    def list_users(self, channel_id: int) -> list[dict]:
        """현재 채널에 연결된 유저 목록 (같은 유저가 여러 탭으로 접속해도 한 번만)"""
        connections = self._connections.get(channel_id, {})
        by_user_id: dict[int, dict] = {}
        for info in connections.values():
            if info is not None:
                by_user_id[info["id"]] = info
        return list(by_user_id.values())

    async def broadcast(self, channel_id: int, message: dict) -> None:
        connections = self._connections.get(channel_id)
        if not connections:
            return
        dead: set[WebSocket] = set()
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            connections.pop(ws, None)


# 앱 전체에서 공유하는 단일 인스턴스 (map_id 채널: 노드/댓글/추천/presence)
manager = ConnectionManager()
# 워크스페이스 단위 채널 (워크스페이스/멤버/마인드맵 목록 변경) - id 네임스페이스가 겹치므로 별도 인스턴스
workspace_manager = ConnectionManager()
