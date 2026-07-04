from app.models.block import Block
from app.models.comment import Comment
from app.models.mindmap import MindMap
from app.models.workspace import Invitation, Workspace, WorkspaceMember
from app.schemas.block import BlockPublic
from app.schemas.comment import CommentPublic
from app.schemas.invitation import InvitationPublic
from app.schemas.mindmap import MindMapListItem
from app.schemas.workspace import WorkspaceMemberPublic, WorkspacePublic


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


def comment_event(event_type: str, comment: Comment) -> dict:
    """comment:created / comment:updated / comment:resolved / comment:reopened 이벤트 페이로드"""
    return {
        "type": event_type,
        "comment": CommentPublic.model_validate(comment).model_dump(mode="json"),
    }


def comment_deleted_event(comment_id: int, block_id: int) -> dict:
    return {"type": "comment:deleted", "commentId": comment_id, "blockId": block_id}


def workspace_event(event_type: str, workspace: Workspace) -> dict:
    """workspace:updated 이벤트 페이로드"""
    return {
        "type": event_type,
        "workspace": WorkspacePublic.model_validate(workspace).model_dump(mode="json"),
    }


def workspace_deleted_event(workspace_id: int) -> dict:
    return {"type": "workspace:deleted", "workspaceId": workspace_id}


def member_event(event_type: str, workspace_id: int, member: WorkspaceMember) -> dict:
    """member:added / member:updated 이벤트 페이로드"""
    return {
        "type": event_type,
        "workspaceId": workspace_id,
        "member": WorkspaceMemberPublic.model_validate(member).model_dump(mode="json"),
    }


def member_removed_event(workspace_id: int, user_id: int) -> dict:
    return {"type": "member:removed", "workspaceId": workspace_id, "userId": user_id}


def map_event(event_type: str, mindmap: MindMap, node_count: int) -> dict:
    """map:created / map:updated 이벤트 페이로드, 워크스페이스 화면의 마인드맵 목록 갱신용"""
    item = MindMapListItem(
        id=mindmap.id,
        workspace_id=mindmap.workspace_id,
        name=mindmap.name,
        root_block_id=mindmap.root_block_id,
        created_by=mindmap.created_by,
        created_at=mindmap.created_at,
        updated_at=mindmap.updated_at,
        node_count=node_count,
    )
    return {"type": event_type, "map": item.model_dump(mode="json")}


def map_deleted_event(workspace_id: int, map_id: int) -> dict:
    return {"type": "map:deleted", "workspaceId": workspace_id, "mapId": map_id}


def invitation_event(event_type: str, invitation: Invitation) -> dict:
    """invitation:created 이벤트 페이로드, 아직 워크스페이스 멤버가 아닌 초대받은 유저의 알림 채널로 브로드캐스트"""
    return {
        "type": event_type,
        "invitation": InvitationPublic.model_validate(invitation).model_dump(mode="json"),
    }