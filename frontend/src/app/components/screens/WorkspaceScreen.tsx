import { useState, useEffect } from "react";
import { Role, MemberData, WorkspaceData, MapData } from "../../data/type";
import { applyWorkspaceRealtimeEvent } from "../../utils/realtime";
import { api } from "../../../api/client";

import {
    Plus, Share2, X,
    Trash2, Brain, LogOut, UserX, Bell, ChevronRight,
    Pencil, GitBranch,
    Menu, Users
} from "lucide-react";

import { ConfirmModal } from "../modals/ConfirmModal";
import { ProfileModal } from "../modals/ProfileModal";
import { CreateWorkspaceModal } from "../modals/CreateWorkspaceModal";
import { CreateMindMapModal } from "../modals/CreateMindMapModal";
import { ShareModal } from "../modals/ShareModal";
import { DeleteAccountModal } from "../modals/DeleteAccountModal";
import { RenameModal } from "../modals/RenameModal";

export function WorkspaceScreen({
  user, onOpenCanvas, onViewInvitation, onLogout, onDeleteAccount, onProfileUpdate, initialWorkspaces = [], pendingInvitationCount = 0, onMemberRoleChange, onInvite,
  onWorkspaceRename, onWorkspaceDelete, onMemberRemove, onWorkspaceLeave, onMapRename, onMapDelete,
}: {
  user: { id?: number; name: string; email: string };
  onOpenCanvas: (ws: WorkspaceData, map: MapData) => void;
  onViewInvitation: () => void;
  onLogout: () => void;
  onDeleteAccount?: () => Promise<void>;
  onProfileUpdate?: (payload: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
  initialWorkspaces?: WorkspaceData[];
  pendingInvitationCount?: number;
  onMemberRoleChange?: (workspaceId: string, member: MemberData, role: "editor" | "viewer") => Promise<void>;
  onInvite?: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onWorkspaceRename?: (workspaceId: string, name: string) => Promise<void>;
  onWorkspaceDelete?: (workspaceId: string) => Promise<void>;
  onMemberRemove?: (workspaceId: string, member: MemberData) => Promise<void>;
  onWorkspaceLeave?: (workspaceId: string) => Promise<void>;
  onMapRename?: (workspaceId: string, mapId: string, name: string) => Promise<void>;
  onMapDelete?: (workspaceId: string, mapId: string) => Promise<void>;
}) {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(initialWorkspaces);
  const [activeId, setActiveId]     = useState(initialWorkspaces[0]?.id ?? "");
  const [showShare, setShowShare]   = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateMap, setShowCreateMap] = useState(false);
  const [roleChange, setRoleChange] = useState<{ member: MemberData; role: "editor" | "viewer" } | null>(null);
  const [renamingWorkspace, setRenamingWorkspace] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [removingMember, setRemovingMember] = useState<MemberData | null>(null);
  const [leavingWorkspace, setLeavingWorkspace] = useState(false);
  const [renamingMap, setRenamingMap] = useState<MapData | null>(null);
  const [deletingMap, setDeletingMap] = useState<MapData | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    setWorkspaces(initialWorkspaces);
    if (!initialWorkspaces.some(item => item.id === activeId)) setActiveId(initialWorkspaces[0]?.id ?? "");
  }, [initialWorkspaces]);

  const ws = workspaces.find(w => w.id === activeId) ?? workspaces[0];

  // 지금 보고 있는 워크스페이스가 사라지면(삭제되거나, 본인이 제거되는 등) 목록의 첫 워크스페이스로 대체
  useEffect(() => {
    if (activeId && !workspaces.some(w => w.id === activeId)) setActiveId(workspaces[0]?.id ?? "");
  }, [workspaces, activeId]);

  // ── 실시간(WebSocket): 워크스페이스 이름/삭제, 멤버, 마인드맵 목록 변화를 반영 ──
  useEffect(() => {
    if (!ws) return;
    const socket = new WebSocket(api.workspaceSocketUrl(Number(ws.id)));
    socket.onmessage = event => {
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }
      setWorkspaces(prev => applyWorkspaceRealtimeEvent(prev, data, user.id));
    };
    return () => socket.close();
  }, [ws?.id]);
  const initials = user.name.split(" ").map(n => n[0]).join("");

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      {/* Top nav */}
      <header className="h-14 bg-white border-b border-[#E8E7EA] flex items-center px-3 sm:px-5 gap-2 sm:gap-3 flex-shrink-0">
        <button onClick={() => setShowSidebar(true)} aria-label="워크스페이스 목록 열기"
          className="lg:hidden -ml-1 w-8 h-8 rounded-lg hover:bg-[#F0EFF5] flex items-center justify-center transition-colors flex-shrink-0">
          <Menu className="w-4.5 h-4.5 text-[#717182]" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="hidden sm:block font-semibold text-[#0D0D14] tracking-tight">CoMind</span>
        </div>

        <div className="flex-1" />

        {/* Members drawer toggle (mobile/tablet only) */}
        {ws && (
          <button onClick={() => setShowMembers(true)} aria-label="멤버 목록 열기"
            className="lg:hidden w-8 h-8 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
            <Users className="w-4 h-4 text-[#717182]" />
          </button>
        )}

        {/* Invitation bell */}
        <button onClick={onViewInvitation}
          className="relative w-8 h-8 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
          <Bell className="w-4 h-4 text-[#717182]" />
          {pendingInvitationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
          )}
        </button>

        {/* User */}
        <div className="relative">
          <button onClick={() => setShowProfileMenu(open => !open)}
            className="flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-[#F0EFF5] transition-colors">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-700">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-[#0D0D14] leading-none">{user.name}</p>
              <p className="text-[11px] text-[#717182] mt-0.5">{user.email}</p>
            </div>
          </button>
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl border border-[#E8E7EA] bg-white py-1 shadow-lg">
                <button
                  onClick={() => { setShowProfileMenu(false); setShowProfile(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#717182] hover:bg-[#F8F7F4] hover:text-[#0D0D14]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  내 프로필
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); onLogout(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#717182] hover:bg-[#F8F7F4] hover:text-[#0D0D14]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  로그아웃
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); setDeletingAccount(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50"
                >
                  <UserX className="w-3.5 h-3.5" />
                  회원 탈퇴
                </button>
              </div>
            </>
          )}
          {showProfile && onProfileUpdate && (
            <ProfileModal user={user} onClose={() => setShowProfile(false)} onSave={onProfileUpdate} />
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile/tablet backdrop for the workspace-list drawer */}
        {showSidebar && (
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setShowSidebar(false)} />
        )}
        {/* Sidebar */}
        <aside className={[
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#E8E7EA] flex flex-col py-5 transition-transform duration-200",
          "lg:static lg:z-auto lg:w-56 lg:translate-x-0 lg:transition-none",
          showSidebar ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}>
          <div className="flex items-center justify-between px-5 mb-2">
            <p className="text-[10px] font-bold text-[#ABABAB] uppercase tracking-widest">워크스페이스</p>
            <button onClick={() => setShowSidebar(false)} aria-label="닫기"
              className="lg:hidden -mr-1.5 w-7 h-7 rounded-lg hover:bg-[#F0EFF5] flex items-center justify-center text-[#ABABAB]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 px-3">
            {workspaces.map(w => (
              <button key={w.id} onClick={() => { setActiveId(w.id); setShowSidebar(false); }}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors text-sm",
                  activeId === w.id
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-[#0D0D14] hover:bg-[#F3F2F6] font-medium",
                ].join(" ")}>
                <div className={[
                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                  activeId === w.id ? "bg-indigo-500 text-white" : "bg-[#EEEDEE] text-[#717182]",
                ].join(" ")}>
                  {w.name[0]}
                </div>
                <span className="truncate">{w.name}</span>
              </button>
            ))}
          </div>
          <div className="px-3 pt-3 mt-2 border-t border-[#E8E7EA]">
            <button onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[#C8C7D0] text-[#717182] hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all text-sm font-medium">
              <Plus className="w-4 h-4" />
              새 워크스페이스
            </button>
          </div>
        </aside>

        {/* Main */}
        {ws ? (
          <>
            <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 sm:mb-8">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <h1 className="text-xl sm:text-2xl font-semibold text-[#0D0D14] tracking-tight truncate">{ws.name}</h1>
                      {(ws.currentRole === "owner" || ws.currentRole === "editor") && (
                        <button onClick={() => setRenamingWorkspace(true)} title="워크스페이스 이름 수정"
                          className="p-1.5 rounded-lg text-[#ABABAB] hover:bg-[#F0EFF5] hover:text-[#0D0D14] transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {ws.currentRole === "owner" && (
                        <button onClick={() => setDeletingWorkspace(true)} title="워크스페이스 삭제"
                          className="p-1.5 rounded-lg text-[#ABABAB] hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {ws.currentRole && ws.currentRole !== "owner" && (
                        <button onClick={() => setLeavingWorkspace(true)} title="워크스페이스 나가기"
                          className="p-1.5 rounded-lg text-[#ABABAB] hover:bg-red-50 hover:text-red-500 transition-colors">
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-[#717182] mt-0.5">
                      멤버 {ws.members.length}명 · 마인드맵 {ws.maps.length}개
                    </p>
                  </div>
                  {(ws.currentRole === "owner" || ws.currentRole === "editor") && (
                    <button onClick={() => setShowShare(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-600/20 flex-shrink-0 self-start">
                      <Share2 className="w-4 h-4" />
                      워크스페이스 공유
                    </button>
                  )}
                </div>

                {/* Maps */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[11px] font-bold text-[#ABABAB] uppercase tracking-widest">마인드맵</h2>
                    {(ws.currentRole === "owner" || ws.currentRole === "editor") && (
                      <button onClick={() => setShowCreateMap(true)}
                        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-semibold">
                        <Plus className="w-3.5 h-3.5" />새 마인드맵
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2.5">
                    {ws.maps.length ? ws.maps.map(map => (
                      <div key={map.id} onClick={() => onOpenCanvas(ws, map)} role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenCanvas(ws, map); } }}
                        className="group flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#E8E7EA] hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/60 transition-all cursor-pointer">
                        <div className="flex flex-1 min-w-0 items-center gap-4 text-left">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                            <GitBranch className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#0D0D14] group-hover:text-indigo-700 transition-colors truncate">{map.name}</p>
                            <p className="text-xs text-[#717182] mt-0.5">노드 {map.nodeCount}개 · {map.updatedAt} 수정</p>
                          </div>
                        </div>
                        {(ws.currentRole === "owner" || ws.currentRole === "editor") && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={e => { e.stopPropagation(); setRenamingMap(map); }} title="마인드맵 이름 수정"
                              className="p-1.5 rounded-lg text-[#ABABAB] hover:bg-[#F0EFF5] hover:text-[#0D0D14] transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setDeletingMap(map); }} title="마인드맵 삭제"
                              className="p-1.5 rounded-lg text-[#ABABAB] hover:bg-red-50 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-[#C8C7D0] group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-[#E0DFE0] px-4 py-8 text-center text-sm text-[#ABABAB]">
                        아직 마인드맵이 없어요. 새 마인드맵을 만들어보세요.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </main>

            {/* Mobile/tablet backdrop for the members drawer */}
            {showMembers && (
              <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setShowMembers(false)} />
            )}
            <aside className={[
              "fixed inset-y-0 right-0 z-50 w-72 bg-white border-l border-[#E8E7EA] p-5 overflow-y-auto transition-transform duration-200",
              "lg:static lg:z-auto lg:flex-shrink-0 lg:translate-x-0 lg:transition-none",
              showMembers ? "translate-x-0" : "translate-x-full",
            ].join(" ")}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-bold text-[#ABABAB] uppercase tracking-widest">멤버</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-indigo-600">{ws.members.length}명</span>
                  <button onClick={() => setShowMembers(false)} aria-label="닫기"
                    className="lg:hidden -mr-1.5 w-7 h-7 rounded-lg hover:bg-[#F0EFF5] flex items-center justify-center text-[#ABABAB]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {[...ws.members].sort((a, b) => {
                  // 본인이 항상 맨 위, 그다음 소유자 > 편집자 > 뷰어 순, 같은 역할끼리는 가나다순
                  const aIsSelf = a.userId === user.id;
                  const bIsSelf = b.userId === user.id;
                  if (aIsSelf !== bIsSelf) return aIsSelf ? -1 : 1;
                  const roleOrder: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };
                  if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[a.role] - roleOrder[b.role];
                  return a.name.localeCompare(b.name, "ko");
                }).map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F8F7F4] transition-colors">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: m.color }}>{m.initials}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0D0D14] truncate">{m.name}</p>
                      <p className="text-[11px] text-[#717182] truncate">{m.email}</p>
                    </div>
                    {ws.currentRole === "owner" && m.role !== "owner" ? (
                      <div className="flex items-center gap-1">
                        <select value={m.role} onChange={event => setRoleChange({ member: m, role: event.target.value as "editor" | "viewer" })}
                          className="rounded-lg border border-[#E0DFE0] bg-white px-2 py-1 text-[10px] font-semibold text-[#717182]">
                          <option value="editor">편집자</option><option value="viewer">뷰어</option>
                        </select>
                        <button onClick={() => setRemovingMember(m)} title="멤버 제거"
                          className="p-1.5 rounded-lg text-[#ABABAB] hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : <span className="text-[10px] font-semibold text-[#717182]">
                      {m.role === "owner" ? "소유자" : m.role === "editor" ? "편집자" : "뷰어"}
                    </span>}
                  </div>
                ))}
              </div>
            </aside>
          </>
        ) : (
          <main className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
                <GitBranch className="w-6 h-6 text-indigo-500" />
              </div>
              <h2 className="text-lg font-semibold text-[#0D0D14] mb-1">워크스페이스가 없어요</h2>
              <p className="text-sm text-[#717182] mb-5">첫 워크스페이스를 만들고 팀과 마인드맵을 시작해보세요.</p>
              <button onClick={() => setShowCreate(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
                새 워크스페이스 만들기
              </button>
            </div>
          </main>
        )}
      </div>

      {showShare && ws && <ShareModal workspace={ws} onClose={() => setShowShare(false)} onInvite={onInvite} />}
      {showCreate && (
        <CreateWorkspaceModal
          onClose={() => setShowCreate(false)}
          onCreate={async wname => {
            const created = await api.createWorkspace(wname);
            const detail = await api.workspaceDetail(created.id);
            const members: MemberData[] = (detail.members ?? []).map((membership, index) => ({
              id: String(membership.id), userId: membership.user.id, name: membership.user.name, email: membership.user.email,
              role: membership.role, initials: membership.user.name.split(" ").map(part => part[0]).join(""),
              color: ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"][index % 5],
            }));
            const nw: WorkspaceData = {
              id: String(created.id), name: created.name, ownerId: created.owner_id, currentRole: "owner",
              members: members.length ? members : [{ id: "self", name: user.name, email: user.email, role: "owner",
                initials: user.name.split(" ").map(n => n[0]).join(""), color: "#6366f1" }],
              maps: [],
            };
            setWorkspaces(prev => [...prev, nw]);
            setActiveId(nw.id);
            setShowCreate(false);
          }}
        />
      )}
      {showCreateMap && ws && (
        <CreateMindMapModal
          onClose={() => setShowCreateMap(false)}
          onCreate={async mapName => {
            const created = await api.createMap(Number(ws.id), mapName);
            const map: MapData = { id: String(created.id), name: created.name, nodeCount: 1, updatedAt: "방금" };
            const updatedWorkspace = { ...ws, maps: [...ws.maps, map] };
            setWorkspaces(prev => prev.map(item => item.id === ws.id ? updatedWorkspace : item));
            setShowCreateMap(false);
            onOpenCanvas(updatedWorkspace, map);
          }}
        />
      )}
      {roleChange && ws && (
        <ConfirmModal
          title="멤버 역할을 변경할까요?"
          description={`${roleChange.member.name}님의 역할을 ${roleChange.role === "editor" ? "편집자" : "뷰어"}(으)로 변경합니다.`}
          confirmLabel="변경"
          onCancel={() => setRoleChange(null)}
          onConfirm={async () => {
            await onMemberRoleChange?.(ws.id, roleChange.member, roleChange.role);
            setWorkspaces(prev => prev.map(item => item.id !== ws.id ? item : {
              ...item, members: item.members.map(member => member.id === roleChange.member.id ? { ...member, role: roleChange.role } : member),
            }));
            setRoleChange(null);
          }}
        />
      )}
      {renamingWorkspace && ws && (
        <RenameModal
          title="워크스페이스 이름 수정"
          label="워크스페이스 이름"
          initialName={ws.name}
          onClose={() => setRenamingWorkspace(false)}
          onSubmit={async name => {
            await onWorkspaceRename?.(ws.id, name);
            setWorkspaces(prev => prev.map(item => item.id === ws.id ? { ...item, name } : item));
            setRenamingWorkspace(false);
          }}
        />
      )}
      {deletingWorkspace && ws && (
        <ConfirmModal
          title="워크스페이스를 삭제할까요?"
          description={`"${ws.name}" 워크스페이스와 소속된 모든 마인드맵이 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          danger
          onCancel={() => setDeletingWorkspace(false)}
          onConfirm={async () => {
            await onWorkspaceDelete?.(ws.id);
            setWorkspaces(prev => prev.filter(item => item.id !== ws.id));
            setActiveId(prev => prev === ws.id ? "" : prev);
            setDeletingWorkspace(false);
          }}
        />
      )}
      {removingMember && ws && (
        <ConfirmModal
          title="멤버를 제거할까요?"
          description={`${removingMember.name}님을 이 워크스페이스에서 제거합니다.`}
          confirmLabel="제거"
          danger
          onCancel={() => setRemovingMember(null)}
          onConfirm={async () => {
            await onMemberRemove?.(ws.id, removingMember);
            setWorkspaces(prev => prev.map(item => item.id !== ws.id ? item : {
              ...item, members: item.members.filter(member => member.id !== removingMember.id),
            }));
            setRemovingMember(null);
          }}
        />
      )}
      {leavingWorkspace && ws && (
        <ConfirmModal
          title="워크스페이스를 나가시겠어요?"
          description={`"${ws.name}" 워크스페이스에서 나가면 다시 초대받기 전까지 접근할 수 없습니다.`}
          confirmLabel="나가기"
          danger
          onCancel={() => setLeavingWorkspace(false)}
          onConfirm={async () => {
            await onWorkspaceLeave?.(ws.id);
            setWorkspaces(prev => prev.filter(item => item.id !== ws.id));
            setActiveId(prev => prev === ws.id ? "" : prev);
            setLeavingWorkspace(false);
          }}
        />
      )}
      {renamingMap && ws && (
        <RenameModal
          title="마인드맵 이름 수정"
          label="마인드맵 이름"
          initialName={renamingMap.name}
          onClose={() => setRenamingMap(null)}
          onSubmit={async name => {
            await onMapRename?.(ws.id, renamingMap.id, name);
            setWorkspaces(prev => prev.map(item => item.id !== ws.id ? item : {
              ...item, maps: item.maps.map(m => m.id === renamingMap.id ? { ...m, name } : m),
            }));
            setRenamingMap(null);
          }}
        />
      )}
      {deletingMap && ws && (
        <ConfirmModal
          title="마인드맵을 삭제할까요?"
          description={`"${deletingMap.name}" 마인드맵과 모든 노드, 댓글이 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          danger
          onCancel={() => setDeletingMap(null)}
          onConfirm={async () => {
            await onMapDelete?.(ws.id, deletingMap.id);
            setWorkspaces(prev => prev.map(item => item.id !== ws.id ? item : {
              ...item, maps: item.maps.filter(m => m.id !== deletingMap.id),
            }));
            setDeletingMap(null);
          }}
        />
      )}
      {deletingAccount && (
        <DeleteAccountModal
          onCancel={() => setDeletingAccount(false)}
          onConfirm={async () => { await onDeleteAccount?.(); }}
        />
      )}
    </div>
  );
}