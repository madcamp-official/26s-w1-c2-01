import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router";

import { api, ApiInvitation, ApiUser } from "../api/client";
import { MapData, MemberData, WorkspaceData } from "./MindSpaceScreens";
import { InvitationPage } from "./pages/InvitationPage";
import { LoginPage } from "./pages/LoginPage";
import { MindMapPage } from "./pages/MindMapPage";
import { WorkspacePage } from "./pages/WorkspacePage";

type User = ApiUser;

const MEMBER_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] text-sm text-[#717182]">
      불러오는 중...
    </div>
  );
}

// 새로고침 시에도 URL의 워크스페이스/맵으로 화면을 그대로 유지하기 위해,
// workspaces 목록이 로드되면 URL 파라미터로부터 activeWorkspace/activeMap을 다시 찾아 맞춰준다.
function MindMapRoute({
  user, bootstrapped, workspaces, activeWorkspace, activeMap, onResolve, userInitials, onBack, onInvite, onLogout,
}: {
  user: User | null;
  bootstrapped: boolean;
  workspaces: WorkspaceData[];
  activeWorkspace: WorkspaceData | null;
  activeMap: MapData | null;
  onResolve: (workspace: WorkspaceData, map: MapData) => void;
  userInitials: string;
  onBack: () => void;
  onInvite: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onLogout: () => void;
}) {
  const { workspaceId, mapId } = useParams();
  const matchedWorkspace = workspaces.find(workspace => workspace.id === workspaceId);
  const matchedMap = matchedWorkspace?.maps.find(map => map.id === mapId);

  useEffect(() => {
    if (matchedWorkspace && matchedMap) onResolve(matchedWorkspace, matchedMap);
  }, [matchedWorkspace, matchedMap]);

  if (!user) return bootstrapped ? <Navigate to="/login" replace /> : <LoadingScreen />;

  if (activeWorkspace?.id === workspaceId && activeMap?.id === mapId) {
    return (
      <MindMapPage
        workspace={activeWorkspace}
        map={activeMap}
        userInitials={userInitials}
        currentUserId={user.id}
        currentRole={activeWorkspace.currentRole}
        onBack={onBack}
        onInvite={onInvite}
        onLogout={onLogout}
      />
    );
  }

  if (!bootstrapped || !matchedWorkspace) return <LoadingScreen />;
  return <Navigate to="/workspaces" replace />;
}

function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceData | null>(null);
  const [activeMap, setActiveMap] = useState<MapData | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [invitations, setInvitations] = useState<ApiInvitation[]>([]);
  const [bootstrapped, setBootstrapped] = useState(false);

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
    setWorkspaces(loaded);
  };

  const loadInvitations = () => api.listInvitations().then(setInvitations).catch(() => setInvitations([]));

  useEffect(() => {
    api.me().then(currentUser => {
      setUser(currentUser);
      return Promise.all([loadWorkspaces(currentUser), loadInvitations()]);
    }).catch(() => api.logout())
      .finally(() => setBootstrapped(true));
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

  const inviteToWorkspace = async (workspaceId: string, email: string, role: "editor" | "viewer") => {
    const results = await api.searchUsers(email);
    const match = results.find(candidate => candidate.email.toLowerCase() === email.toLowerCase());
    if (!match) throw new Error("해당 이메일의 사용자를 찾을 수 없습니다");
    await api.inviteToWorkspace(Number(workspaceId), match.id, role);
  };

  return (
    <Routes>
      <Route path="/login" element={
        !bootstrapped
          ? <LoadingScreen />
          : user
          ? <Navigate to="/workspaces" replace />
          : <LoginPage onLogin={async (name, email, password, isSignUp) => {
              if (isSignUp) await api.signup(email, password, name);
              const currentUser = await api.login(email, password);
              setUser(currentUser);
              await Promise.all([loadWorkspaces(currentUser), loadInvitations()]);
              navigate("/workspaces");
            }} />
      } />
      <Route path="/workspaces" element={
        !bootstrapped
          ? <LoadingScreen />
          : user
          ? <WorkspacePage user={user} workspaces={workspaces} pendingInvitationCount={invitations.length} onOpenCanvas={openCanvas} onViewInvitation={() => navigate("/invitations")} onLogout={logout}
              onInvite={inviteToWorkspace}
              onMemberRoleChange={async (workspaceId, member, role) => {
                if (!member.userId) throw new Error("사용자 ID를 확인할 수 없습니다");
                await api.updateMemberRole(Number(workspaceId), member.userId, role);
                setWorkspaces(prev => prev.map(workspace => workspace.id !== workspaceId ? workspace : {
                  ...workspace, members: workspace.members.map(item => item.id === member.id ? { ...item, role } : item),
                }));
              }} />
          : <Navigate to="/login" replace />
      } />
      <Route path="/invitations" element={
        !bootstrapped
          ? <LoadingScreen />
          : user
          ? <InvitationPage user={user} workspaces={workspaces} invitations={invitations} onOpenCanvas={openCanvas} onClose={() => navigate("/workspaces")} onLogout={logout}
              onInvite={inviteToWorkspace}
              onMemberRoleChange={async (workspaceId, member, role) => {
                if (!member.userId) throw new Error("사용자 ID를 확인할 수 없습니다");
                await api.updateMemberRole(Number(workspaceId), member.userId, role);
              }}
              onAccept={async invitationId => {
                await api.acceptInvitation(invitationId);
                await Promise.all([loadWorkspaces(user), loadInvitations()]);
              }}
              onReject={async invitationId => {
                await api.rejectInvitation(invitationId);
                await loadInvitations();
              }} />
          : <Navigate to="/login" replace />
      } />
      <Route path="/workspaces/:workspaceId/maps/:mapId" element={
        <MindMapRoute
          user={user}
          bootstrapped={bootstrapped}
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          activeMap={activeMap}
          onResolve={(workspace, map) => { setActiveWorkspace(workspace); setActiveMap(map); }}
          userInitials={user ? user.name.split(" ").map(part => part[0]).join("") : ""}
          onBack={() => { if (user) loadWorkspaces(user); navigate("/workspaces"); }}
          onInvite={inviteToWorkspace}
          onLogout={logout}
        />
      } />
      <Route path="*" element={!bootstrapped ? <LoadingScreen /> : <Navigate to={user ? "/workspaces" : "/login"} replace />} />
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
