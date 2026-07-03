import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router";

import { api, ApiUser } from "../api/client";
import { MapData, MemberData, WorkspaceData, WORKSPACES } from "./MindSpaceScreens";
import { InvitationPage } from "./pages/InvitationPage";
import { LoginPage } from "./pages/LoginPage";
import { MindMapPage } from "./pages/MindMapPage";
import { WorkspacePage } from "./pages/WorkspacePage";

type User = ApiUser;

const MEMBER_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceData>(WORKSPACES[0]);
  const [activeMap, setActiveMap] = useState<MapData>(WORKSPACES[0].maps[0]);
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(WORKSPACES);

  const loadWorkspaces = async (currentUser: User) => {
    const summaries = await api.listWorkspaces();
    const loaded = await Promise.all(summaries.map(async summary => {
      const [detail, maps] = await Promise.all([api.workspaceDetail(summary.id), api.listMaps(summary.id)]);
      const members: MemberData[] = (detail.members ?? []).map((membership, index) => ({
        id: String(membership.id), userId: membership.user.id, name: membership.user.name, email: membership.user.email,
        role: membership.role, initials: membership.user.name.split(" ").map(part => part[0]).join(""), color: MEMBER_COLORS[index % MEMBER_COLORS.length],
      }));
      return {
        id: String(summary.id), name: summary.name, ownerId: summary.owner_id,
        currentRole: members.find(member => member.userId === currentUser.id)?.role,
        members,
        maps: maps.map(map => ({ id: String(map.id), name: map.name, nodeCount: map.node_count ?? 1, updatedAt: new Date(map.updated_at).toLocaleString("ko-KR") })),
      } satisfies WorkspaceData;
    }));
    setWorkspaces(loaded.length ? loaded : WORKSPACES); // TODO: 빈 상태 전용 UI 구현 후 더미 fallback 제거
  };

  useEffect(() => {
    api.me().then(currentUser => { setUser(currentUser); return loadWorkspaces(currentUser); }).catch(() => api.logout());
  }, []);

  const openCanvas = (workspace: WorkspaceData, map: MapData) => {
    setActiveWorkspace(workspace);
    setActiveMap(map);
    navigate(`/workspaces/${workspace.id}/maps/${map.id}`);
  };

  const logout = () => {
    setUser(null);
    api.logout();
    navigate("/login", { replace: true });
  };

  return (
    <Routes>
      <Route path="/login" element={
        user
          ? <Navigate to="/workspaces" replace />
          : <LoginPage onLogin={async (name, email, password, isSignUp) => {
              if (isSignUp) await api.signup(email, password, name);
              const currentUser = await api.login(email, password);
              setUser(currentUser);
              await loadWorkspaces(currentUser);
              navigate("/workspaces");
            }} />
      } />
      <Route path="/workspaces" element={
        user
          ? <WorkspacePage user={user} workspaces={workspaces} onOpenCanvas={openCanvas} onViewInvitation={() => navigate("/invitations")} onLogout={logout}
              onMemberRoleChange={async (workspaceId, member, role) => {
                if (!member.userId) throw new Error("백엔드 사용자 ID가 없는 더미 멤버입니다");
                await api.updateMemberRole(Number(workspaceId), member.userId, role);
                setWorkspaces(prev => prev.map(workspace => workspace.id !== workspaceId ? workspace : {
                  ...workspace, members: workspace.members.map(item => item.id === member.id ? { ...item, role } : item),
                }));
              }} />
          : <Navigate to="/login" replace />
      } />
      <Route path="/invitations" element={
        user
          ? <InvitationPage user={user} workspaces={workspaces} onOpenCanvas={openCanvas} onClose={() => navigate("/workspaces")} onLogout={logout}
              onMemberRoleChange={async (workspaceId, member, role) => {
                if (!member.userId) throw new Error("백엔드 사용자 ID가 없는 더미 멤버입니다");
                await api.updateMemberRole(Number(workspaceId), member.userId, role);
              }} />
          : <Navigate to="/login" replace />
      } />
      <Route path="/workspaces/:workspaceId/maps/:mapId" element={
        user
          ? <MindMapPage
              workspace={activeWorkspace}
              map={activeMap}
              userInitials={user.name.split(" ").map(part => part[0]).join("")}
              currentUserId={user.id}
              currentRole={activeWorkspace.currentRole}
              onBack={() => navigate("/workspaces")}
            />
          : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to={user ? "/workspaces" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

