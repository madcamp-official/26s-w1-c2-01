import { WorkspaceData, MemberData, MapData } from "./type";

export const PASSWORD_REQUIREMENTS: { label: string; test: (value: string) => boolean }[] = [
  { label: "8자 이상", test: value => value.length >= 8 },
  { label: "영문 포함", test: value => /[A-Za-z]/.test(value) },
  { label: "숫자 포함", test: value => /[0-9]/.test(value) },
  { label: "특수문자 포함", test: value => /[^A-Za-z0-9]/.test(value) },
];

const MEMBER_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

// ─── 워크스페이스 화면 실시간(WebSocket) 이벤트 반영 ─────────────────────────
// 워크스페이스/멤버/마인드맵 목록 변경을 로컬 workspaces 배열에 순수 함수로 반영한다.
export function applyWorkspaceRealtimeEvent(prev: WorkspaceData[], data: any, currentUserId?: number): WorkspaceData[] {
  switch (data.type) {
    case "workspace:updated": {
      const id = String(data.workspace.id);
      return prev.map(w => w.id === id ? { ...w, name: data.workspace.name } : w);
    }
    case "workspace:deleted": {
      const id = String(data.workspaceId);
      return prev.filter(w => w.id !== id);
    }
    case "member:added":
    case "member:updated": {
      const workspaceId = String(data.workspaceId);
      const m = data.member;
      return prev.map(w => {
        if (w.id !== workspaceId) return w;
        // 지금 로그인한 본인의 역할이 바뀐 경우, 버튼 활성화 등 권한 기반 UI가
        // 새로고침 없이 즉시 반영되도록 currentRole도 함께 갱신한다
        const nextCurrentRole = currentUserId && m.user.id === currentUserId ? m.role : w.currentRole;
        const memberId = String(m.id);
        if (w.members.some(item => item.id === memberId)) {
          return {
            ...w, currentRole: nextCurrentRole,
            members: w.members.map(item => item.id === memberId
              ? {
                  ...item, role: m.role, name: m.user.name, email: m.user.email,
                  initials: m.user.name.split(" ").map((part: string) => part[0]).join(""),
                }
              : item),
          };
        }
        const newMember: MemberData = {
          id: memberId, userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role,
          initials: m.user.name.split(" ").map((part: string) => part[0]).join(""),
          color: MEMBER_COLORS[w.members.length % MEMBER_COLORS.length],
        };
        return { ...w, currentRole: nextCurrentRole, members: [...w.members, newMember] };
      });
    }
    case "member:removed": {
      const workspaceId = String(data.workspaceId);
      if (currentUserId && data.userId === currentUserId) return prev.filter(w => w.id !== workspaceId);
      return prev.map(w => w.id !== workspaceId ? w : { ...w, members: w.members.filter(m => m.userId !== data.userId) });
    }
    case "map:created": {
      const workspaceId = String(data.map.workspace_id);
      return prev.map(w => {
        if (w.id !== workspaceId || w.maps.some(map => map.id === String(data.map.id))) return w;
        const newMap: MapData = { id: String(data.map.id), name: data.map.name, nodeCount: data.map.node_count, updatedAt: "방금" };
        return { ...w, maps: [...w.maps, newMap] };
      });
    }
    case "map:updated": {
      const workspaceId = String(data.map.workspace_id);
      return prev.map(w => w.id !== workspaceId ? w : {
        ...w, maps: w.maps.map(map => map.id === String(data.map.id) ? { ...map, name: data.map.name, nodeCount: data.map.node_count } : map),
      });
    }
    case "map:deleted": {
      const workspaceId = String(data.workspaceId);
      return prev.map(w => w.id !== workspaceId ? w : { ...w, maps: w.maps.filter(map => map.id !== String(data.mapId)) });
    }
    default:
      return prev;
  }
}