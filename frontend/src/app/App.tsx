import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router";

import { api, ApiInvitation, ApiUser } from "../api/client";
import { MapData, MemberData, WorkspaceData } from "./data/type";
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
// 별도 state에 복사해두지 않고 매 렌더마다 workspaces 목록 + URL 파라미터에서 직접 찾는다.
// (workspaces가 막 채워진 시점에 별도 "resolved" state로 한 박자 늦게 반영하면,
//  그 사이 렌더에서 아직 못 찾은 것으로 오판해 /workspaces로 리다이렉트되는 경쟁 상태가 생긴다)
function MindMapRoute({
  user, bootstrapped, workspaces, onBack, onInvite, onLogout, onDeleteAccount, onProfileUpdate, onMapRename, onMapDelete,
}: {
  user: User | null;
  bootstrapped: boolean;
  workspaces: WorkspaceData[];
  onBack: () => void;
  onInvite: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onProfileUpdate: (payload: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
  onMapRename: (workspaceId: string, mapId: string, name: string) => Promise<void>;
  onMapDelete: (workspaceId: string, mapId: string) => Promise<void>;
}) {
  const { workspaceId, mapId } = useParams();
  const matchedWorkspace = workspaces.find(workspace => workspace.id === workspaceId);
  const matchedMap = matchedWorkspace?.maps.find(map => map.id === mapId);

  if (!user) return bootstrapped ? <Navigate to="/login" replace /> : <LoadingScreen />;

  if (matchedWorkspace && matchedMap) {
    return (
      <MindMapPage
        workspace={matchedWorkspace}
        map={matchedMap}
        user={user}
        currentUserId={user.id}
        currentRole={matchedWorkspace.currentRole}
        onBack={onBack}
        onInvite={onInvite}
        onLogout={onLogout}
        onDeleteAccount={onDeleteAccount}
        onProfileUpdate={onProfileUpdate}
        onMapRename={name => onMapRename(matchedWorkspace.id, matchedMap.id, name)}
        onMapDelete={async () => { await onMapDelete(matchedWorkspace.id, matchedMap.id); onBack(); }}
      />
    );
  }

  if (!bootstrapped) return <LoadingScreen />;
  return <Navigate to="/workspaces" replace />;
}

function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
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
        maps: maps.map(map => ({ id: String(map.id), name: map.name, nodeCount: map.node_count ?? 1, updatedAt: new Date(map.updated_at).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" }) })),
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

  // ── 실시간(WebSocket): 로그인해 있는 동안 다른 사람이 워크스페이스에 초대하면 즉시 알림 목록에 반영 ──
  useEffect(() => {
    if (!user) return;
    const socket = new WebSocket(api.userSocketUrl(user.id));
    socket.onmessage = event => {
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === "invitation:created") {
        setInvitations(prev => prev.some(item => item.id === data.invitation.id) ? prev : [data.invitation, ...prev]);
      }
    };
    return () => socket.close();
  }, [user?.id]);

  const openCanvas = (workspace: WorkspaceData, map: MapData) => {
    // WorkspaceScreen/InvitationScreen은 새 마인드맵 생성 시 자기 자신의 로컬 workspaces 사본만
    // 갱신하므로, MindMapRoute가 참조하는 이 최상위 workspaces state에도 반영해둬야
    // 생성 직후 바로 해당 캔버스로 진입할 수 있다 (없으면 못 찾아 /workspaces로 튕겨나간다).
    setWorkspaces(prev => prev.some(item => item.id === workspace.id)
      ? prev.map(item => item.id === workspace.id ? workspace : item)
      : [...prev, workspace]);
    navigate(`/workspaces/${workspace.id}/maps/${map.id}`);
  };

  const logout = () => {
    setUser(null);
    api.logout();
    navigate("/login", { replace: true });
  };

  const deleteAccount = async () => {
    await api.deleteAccount();
    logout();
  };

  const updateProfile = async (payload: { name?: string; currentPassword?: string; newPassword?: string }) => {
    const updated = await api.updateProfile(payload);
    setUser(updated);
  };

  const inviteToWorkspace = async (workspaceId: string, email: string, role: "editor" | "viewer") => {
    const results = await api.searchUsers(email);
    const match = results.find(candidate => candidate.email.toLowerCase() === email.toLowerCase());
    if (!match) throw new Error("해당 이메일의 사용자를 찾을 수 없습니다");
    await api.inviteToWorkspace(Number(workspaceId), match.id, role);
  };

  const renameWorkspace = async (workspaceId: string, name: string) => {
    await api.updateWorkspace(Number(workspaceId), name);
    setWorkspaces(prev => prev.map(workspace => workspace.id === workspaceId ? { ...workspace, name } : workspace));
  };

  const deleteWorkspace = async (workspaceId: string) => {
    await api.deleteWorkspace(Number(workspaceId));
    setWorkspaces(prev => prev.filter(workspace => workspace.id !== workspaceId));
  };

  const removeMember = async (workspaceId: string, member: MemberData) => {
    if (!member.userId) throw new Error("사용자 ID를 확인할 수 없습니다");
    await api.removeMember(Number(workspaceId), member.userId);
    setWorkspaces(prev => prev.map(workspace => workspace.id !== workspaceId ? workspace : {
      ...workspace, members: workspace.members.filter(item => item.id !== member.id),
    }));
  };

  const leaveWorkspace = async (workspaceId: string) => {
    await api.leaveWorkspace(Number(workspaceId));
    setWorkspaces(prev => prev.filter(workspace => workspace.id !== workspaceId));
  };

  const renameMap = async (workspaceId: string, mapId: string, name: string) => {
    await api.updateMap(Number(mapId), name);
    setWorkspaces(prev => prev.map(workspace => workspace.id !== workspaceId ? workspace : {
      ...workspace, maps: workspace.maps.map(map => map.id === mapId ? { ...map, name } : map),
    }));
  };

  const deleteMap = async (workspaceId: string, mapId: string) => {
    await api.deleteMap(Number(mapId));
    setWorkspaces(prev => prev.map(workspace => workspace.id !== workspaceId ? workspace : {
      ...workspace, maps: workspace.maps.filter(map => map.id !== mapId),
    }));
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
              onDeleteAccount={deleteAccount}
              onProfileUpdate={updateProfile}
              onInvite={inviteToWorkspace}
              onMemberRoleChange={async (workspaceId, member, role) => {
                if (!member.userId) throw new Error("사용자 ID를 확인할 수 없습니다");
                await api.updateMemberRole(Number(workspaceId), member.userId, role);
                setWorkspaces(prev => prev.map(workspace => workspace.id !== workspaceId ? workspace : {
                  ...workspace, members: workspace.members.map(item => item.id === member.id ? { ...item, role } : item),
                }));
              }}
              onWorkspaceRename={renameWorkspace}
              onWorkspaceDelete={deleteWorkspace}
              onMemberRemove={removeMember}
              onWorkspaceLeave={leaveWorkspace}
              onMapRename={renameMap}
              onMapDelete={deleteMap} />
          : <Navigate to="/login" replace />
      } />
      <Route path="/invitations" element={
        !bootstrapped
          ? <LoadingScreen />
          : user
          ? <InvitationPage user={user} workspaces={workspaces} invitations={invitations} onOpenCanvas={openCanvas} onClose={() => navigate("/workspaces")} onLogout={logout}
              onDeleteAccount={deleteAccount}
              onProfileUpdate={updateProfile}
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
              }}
              onWorkspaceRename={renameWorkspace}
              onWorkspaceDelete={deleteWorkspace}
              onMemberRemove={removeMember}
              onWorkspaceLeave={leaveWorkspace}
              onMapRename={renameMap}
              onMapDelete={deleteMap} />
          : <Navigate to="/login" replace />
      } />
      <Route path="/workspaces/:workspaceId/maps/:mapId" element={
        <MindMapRoute
          user={user}
          bootstrapped={bootstrapped}
          workspaces={workspaces}
          onBack={() => { if (user) loadWorkspaces(user); navigate("/workspaces"); }}
          onInvite={inviteToWorkspace}
          onLogout={logout}
          onDeleteAccount={deleteAccount}
          onProfileUpdate={updateProfile}
          onMapRename={renameMap}
          onMapDelete={deleteMap}
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
