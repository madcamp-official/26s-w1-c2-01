from app.models.block import Block
from app.schemas.block import BlockPublic


def block_event(event_type: str, block: Block) -> dict:
    """
    block:created / block:updated / block:reparented 이벤트 페이로드
    REST API 응답(BlockPublic)과 동일한 모양으로 만들어서, 프론트가 WebSocket 이벤트와 HTTP 응답을 같은 파싱 로직으로 처리할 수 있도록 함
    """
    return {
        "type": event_type,
        "block": BlockPublic.model_validate(block).model_dump(mode="json"),
    }


def block_deleted_event(block_ids: list[int]) -> dict:
    """block:deleted 이벤트, 하위 서브트리 전체가 cascade로 같이 지워지므로 배열로 내려줌"""
    return {"type": "block:deleted", "blockIds": block_ids}