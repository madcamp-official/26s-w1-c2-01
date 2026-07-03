import React, { useState, useRef, useEffect } from "react";
import {
  Plus, Share2, Check, X, Copy, ArrowLeft, ZoomIn, ZoomOut,
  Trash2, Brain, LogOut, Link2, Globe, Bell, ChevronRight,
  Maximize2, Lock, UserPlus, Pencil, GitBranch, LocateFixed,
  ListTree,
  MessageCircle, SlidersHorizontal, CheckCircle2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type Role = "owner" | "editor" | "viewer";

interface MemberData {
  id: string; name: string; email: string;
  role: Role; initials: string; color: string;
}
export interface MapData { id: string; name: string; nodeCount: number; updatedAt: string; }
export interface WorkspaceData { id: string; name: string; members: MemberData[]; maps: MapData[]; }
interface NodeData { id: string; text: string; x: number; y: number; color: string; parentId: string | null; }
interface EdgeData { from: string; to: string; }
interface CommentData { id: string; nodeId: string; author: string; content: string; solved: boolean; }

// ─── Static data ────────────────────────────────────────────────────────────

const NODE_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6"];

export const WORKSPACES: WorkspaceData[] = [
  {
    id: "ws1", name: "제품 팀",
    members: [
      { id: "m1", name: "Alex Chen",  email: "alex@acme.com",   role: "owner",  initials: "AC", color: "#6366f1" },
      { id: "m2", name: "Sarah Kim",  email: "sarah@acme.com",  role: "editor", initials: "SK", color: "#06b6d4" },
      { id: "m3", name: "Jordan Lee", email: "jordan@acme.com", role: "editor", initials: "JL", color: "#10b981" },
      { id: "m4", name: "Maya Patel", email: "maya@acme.com",   role: "viewer", initials: "MP", color: "#f59e0b" },
    ],
    maps: [
      { id: "map1", name: "2026 제품 전략", nodeCount: 24, updatedAt: "2시간 전" },
      { id: "map2", name: "3분기 로드맵",     nodeCount: 18, updatedAt: "어제"     },
      { id: "map3", name: "사용자 조사 주제", nodeCount: 12, updatedAt: "3일 전"  },
    ],
  },
  {
    id: "ws2", name: "디자인 시스템",
    members: [
      { id: "m1", name: "Alex Chen",  email: "alex@acme.com",  role: "owner",  initials: "AC", color: "#6366f1" },
      { id: "m5", name: "Priya Nair", email: "priya@acme.com", role: "editor", initials: "PN", color: "#ec4899" },
    ],
    maps: [
      { id: "map4", name: "컴포넌트 구조", nodeCount: 31, updatedAt: "3일 전" },
    ],
  },
];

const INIT_NODES: NodeData[] = [
  { id: "root", text: "2026 제품 전략", x: 600,  y: 370, color: "#6366f1", parentId: null   },
  { id: "n1",   text: "성장",           x: 880,  y: 220, color: "#8b5cf6", parentId: "root" },
  { id: "n2",   text: "사용자 유지",    x: 880,  y: 370, color: "#06b6d4", parentId: "root" },
  { id: "n3",   text: "수익",           x: 880,  y: 520, color: "#10b981", parentId: "root" },
  { id: "n4",   text: "사용자 확보",    x: 330,  y: 240, color: "#f59e0b", parentId: "root" },
  { id: "n5",   text: "검색 최적화 / 콘텐츠", x: 1130, y: 155, color: "#8b5cf6", parentId: "n1" },
  { id: "n6",   text: "추천 확산",       x: 1130, y: 280, color: "#8b5cf6", parentId: "n1" },
  { id: "n7",   text: "온보딩 흐름",     x: 1130, y: 345, color: "#06b6d4", parentId: "n2" },
  { id: "n8",   text: "푸시 알림",       x: 1130, y: 435, color: "#06b6d4", parentId: "n2" },
  { id: "n9",   text: "유료 요금제",     x: 1130, y: 520, color: "#10b981", parentId: "n3" },
  { id: "n10",  text: "콘텐츠 마케팅",   x: 120,  y: 185, color: "#f59e0b", parentId: "n4" },
  { id: "n11",  text: "파트너십",        x: 120,  y: 310, color: "#f59e0b", parentId: "n4" },
];

const INIT_COMMENTS: CommentData[] = [
  { id: "comment-1", nodeId: "root", author: "Sarah Kim", content: "이번 분기 핵심 목표와 연결하면 방향이 더 명확해질 것 같아요.", solved: false },
  { id: "comment-2", nodeId: "n1", author: "Jordan Lee", content: "성장 지표를 신규 사용자와 기존 사용자로 나눠서 확인해 보면 어떨까요?", solved: false },
  { id: "comment-3", nodeId: "n1", author: "Maya Patel", content: "지난 회의에서 논의한 실험 결과를 반영했습니다.", solved: true },
  { id: "comment-4", nodeId: "n2", author: "Sarah Kim", content: "리텐션 기준 기간을 7일과 30일로 함께 표시해 주세요.", solved: false },
];

const genId = () => `node-${crypto.randomUUID()}`;

// ─── Login Screen ───────────────────────────────────────────────────────────

export function LoginScreen({ onLogin }: { onLogin: (name: string, email: string) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName]         = useState("Alex Chen");
  const [email, setEmail]       = useState("alex@acme.com");
  const [password, setPassword] = useState("password");

  const inp = [
    "w-full px-4 py-3 rounded-xl border border-[#E0DFE0] bg-white",
    "text-sm text-[#0D0D14] placeholder-[#ABABAB]",
    "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all",
  ].join(" ");

  return (
    <div className="min-h-screen flex bg-[#0D0D14]">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex w-[46%] flex-col justify-between p-14 border-r border-white/[0.05] relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 60% at 30% 60%, rgba(99,102,241,0.13) 0%, transparent 100%)" }} />

        {/* Logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">MindSpace</span>
        </div>

        {/* Headline */}
        <div className="relative z-10 space-y-5">
          <h1 className="text-[3rem] font-light text-white leading-[1.1] tracking-tight">
            함께 생각하고,<br />
            <span className="text-indigo-400 font-extralight">모든 것을 연결하세요.</span>
          </h1>
          <p className="text-white/40 text-lg leading-relaxed max-w-[350px]">
            팀을 위한 공유 캔버스에서 아이디어를 실시간으로 만들고 연결하며 확장하세요.
          </p>
          <div className="flex items-center gap-5 pt-1">
            {["실시간 동기화", "무제한 노드", "팀 워크스페이스"].map(f => (
              <div key={f} className="flex items-center gap-1.5 text-xs text-white/30">
                <Check className="w-3 h-3 text-indigo-400" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Mini map preview */}
        <div className="relative z-10 rounded-2xl border border-white/[0.06] bg-[#080810] overflow-hidden h-48">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 480 192" preserveAspectRatio="xMidYMid meet">
            <defs>
              <marker id="dot" markerWidth="4" markerHeight="4" refX="2" refY="2">
                <circle cx="2" cy="2" r="1.5" fill="#6366f1" opacity="0.4" />
              </marker>
            </defs>
            {[
              ["215","96","305","60","#6366f1"],["215","96","305","96","#6366f1"],
              ["215","96","305","136","#6366f1"],["125","96","215","96","#6366f1"],
              ["305","60","390","42","#8b5cf6"],["305","60","390","76","#8b5cf6"],
            ].map(([x1,y1,x2,y2,c], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="1.5" opacity="0.4" />
            ))}
          </svg>
          {[
            { x:215, y:96,  w:92, label:"전략",      c:"#6366f1" },
            { x:305, y:60,  w:76, label:"성장",      c:"#8b5cf6" },
            { x:305, y:96,  w:82, label:"사용자 유지", c:"#06b6d4" },
            { x:305, y:136, w:76, label:"수익",      c:"#10b981" },
            { x:125, y:96,  w:80, label:"조사",      c:"#f59e0b" },
            { x:390, y:42,  w:62, label:"검색",      c:"#8b5cf6" },
            { x:390, y:76,  w:72, label:"추천",      c:"#8b5cf6" },
          ].map((n, i) => (
            <div key={i} className="absolute rounded-lg flex items-center justify-center"
              style={{ left: n.x, top: n.y, width: n.w, height: 23, transform: "translate(-50%,-50%)",
                backgroundColor: n.c + "1c", border: `1px solid ${n.c}44` }}>
              <span className="text-[10px] font-medium" style={{ color: n.c + "bb" }}>{n.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex items-center justify-center bg-[#F8F7F4] p-8">
        <div className="w-full max-w-[340px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-[#0D0D14] font-semibold text-lg">MindSpace</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[1.65rem] font-semibold text-[#0D0D14] tracking-tight mb-1">
              {isSignUp ? "계정 만들기" : "다시 만나 반가워요"}
            </h2>
            <p className="text-[#717182] text-sm">
              {isSignUp ? "팀과 함께 마인드맵을 시작하세요" : "워크스페이스에 로그인하세요"}
            </p>
          </div>

          <div className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-semibold text-[#0D0D14] uppercase tracking-wider mb-1.5">이름</label>
                <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력하세요" />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-[#0D0D14] uppercase tracking-wider mb-1.5">이메일</label>
              <input className={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-[#0D0D14] uppercase tracking-wider">비밀번호</label>
                {!isSignUp && <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">비밀번호 찾기</button>}
              </div>
              <input type="password" className={inp} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <button
              onClick={() => onLogin(isSignUp ? name : "Alex Chen", email)}
              className="w-full py-3 bg-[#0D0D14] hover:bg-[#1e1e2e] text-white rounded-xl text-sm font-semibold transition-colors mt-1"
            >
              {isSignUp ? "계정 만들기" : "로그인 →"}
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-[#717182]">
            {isSignUp ? "이미 계정이 있나요? " : "처음이신가요? "}
            <button onClick={() => setIsSignUp(s => !s)}
              className="font-semibold text-indigo-600 hover:text-indigo-700">
              {isSignUp ? "로그인" : "계정 만들기"}
            </button>
          </p>

          <div className="mt-7 pt-6 border-t border-[#E0DFE0]">
            <p className="text-xs text-[#ABABAB] text-center mb-3">다른 계정으로 계속하기</p>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E0DFE0] bg-white hover:bg-[#F3F2F5] text-sm text-[#0D0D14] font-medium transition-colors">
                <GoogleIcon /> Google
              </button>
              <button className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E0DFE0] bg-white hover:bg-[#F3F2F5] text-sm text-[#0D0D14] font-medium transition-colors">
                <GitHubIcon /> GitHub
              </button>
            </div>
          </div>

          <div className="mt-5 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
            <p className="text-xs text-indigo-600">데모: 로그인 버튼을 눌러 앱을 둘러보세요</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Workspace Screen ────────────────────────────────────────────────────────

export function WorkspaceScreen({
  user, onOpenCanvas, onViewInvitation, onLogout,
}: {
  user: { name: string; email: string };
  onOpenCanvas: (ws: WorkspaceData, map: MapData) => void;
  onViewInvitation: () => void;
  onLogout: () => void;
}) {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(WORKSPACES);
  const [activeId, setActiveId]     = useState("ws1");
  const [showShare, setShowShare]   = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateMap, setShowCreateMap] = useState(false);

  const ws = workspaces.find(w => w.id === activeId) ?? workspaces[0];
  const initials = user.name.split(" ").map(n => n[0]).join("");

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      {/* Top nav */}
      <header className="h-14 bg-white border-b border-[#E8E7EA] flex items-center px-5 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-[#0D0D14] tracking-tight">MindSpace</span>
        </div>

        <div className="flex-1" />

        {/* Invitation bell */}
        <button onClick={onViewInvitation}
          className="relative w-8 h-8 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
          <Bell className="w-4 h-4 text-[#717182]" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-xs font-bold text-indigo-700">{initials}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-[#0D0D14] leading-none">{user.name}</p>
            <p className="text-[11px] text-[#717182] mt-0.5">{user.email}</p>
          </div>
          <button onClick={onLogout}
            className="ml-1 p-1.5 rounded-lg hover:bg-[#F0EFF5] transition-colors">
            <LogOut className="w-4 h-4 text-[#717182]" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-[#E8E7EA] flex flex-col py-5 flex-shrink-0">
          <p className="text-[10px] font-bold text-[#ABABAB] uppercase tracking-widest px-5 mb-2">워크스페이스</p>
          <div className="flex-1 overflow-y-auto space-y-0.5 px-3">
            {workspaces.map(w => (
              <button key={w.id} onClick={() => setActiveId(w.id)}
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
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold text-[#0D0D14] tracking-tight">{ws.name}</h1>
                <p className="text-sm text-[#717182] mt-0.5">
                  멤버 {ws.members.length}명 · 마인드맵 {ws.maps.length}개
                </p>
              </div>
              <button onClick={() => setShowShare(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-600/20">
                <Share2 className="w-4 h-4" />
                워크스페이스 공유
              </button>
            </div>

            {/* Maps */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-bold text-[#ABABAB] uppercase tracking-widest">마인드맵</h2>
                <button onClick={() => setShowCreateMap(true)}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-semibold">
                  <Plus className="w-3.5 h-3.5" />새 마인드맵
                </button>
              </div>
              <div className="grid gap-2.5">
                {ws.maps.map(map => (
                  <button key={map.id} onClick={() => onOpenCanvas(ws, map)}
                    className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#E8E7EA] hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/60 transition-all text-left group">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0D0D14] group-hover:text-indigo-700 transition-colors">{map.name}</p>
                      <p className="text-xs text-[#717182] mt-0.5">노드 {map.nodeCount}개 · {map.updatedAt} 수정</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#C8C7D0] group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </main>

        <aside className="w-72 bg-white border-l border-[#E8E7EA] flex-shrink-0 p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold text-[#ABABAB] uppercase tracking-widest">멤버</h2>
            <span className="text-xs font-semibold text-indigo-600">{ws.members.length}명</span>
          </div>
          <div className="space-y-2">
            {ws.members.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F8F7F4] transition-colors">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: m.color }}>{m.initials}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0D0D14] truncate">{m.name}</p>
                  <p className="text-[11px] text-[#717182] truncate">{m.email}</p>
                </div>
                <span className="text-[10px] font-semibold text-[#717182]">
                  {m.role === "owner" ? "소유자" : m.role === "editor" ? "편집자" : "뷰어"}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {showShare  && <ShareModal workspace={ws} onClose={() => setShowShare(false)} />}
      {showCreate && (
        <CreateWorkspaceModal
          onClose={() => setShowCreate(false)}
          onCreate={wname => {
            const nw: WorkspaceData = {
              id: `ws-${Date.now()}`, name: wname,
              members: [{ id: "m1", name: user.name, email: user.email, role: "owner",
                initials: user.name.split(" ").map(n => n[0]).join(""), color: "#6366f1" }],
              maps: [],
            };
            setWorkspaces(prev => [...prev, nw]);
            setActiveId(nw.id);
            setShowCreate(false);
          }}
        />
      )}
      {showCreateMap && (
        <CreateMindMapModal
          onClose={() => setShowCreateMap(false)}
          onCreate={mapName => {
            const map: MapData = {
              id: `map-${Date.now()}`,
              name: mapName,
              nodeCount: 1,
              updatedAt: "방금",
            };
            const updatedWorkspace = { ...ws, maps: [...ws.maps, map] };
            setWorkspaces(prev => prev.map(item => item.id === ws.id ? updatedWorkspace : item));
            setShowCreateMap(false);
            onOpenCanvas(updatedWorkspace, map);
          }}
        />
      )}
    </div>
  );
}

// ─── Share Modal ────────────────────────────────────────────────────────────

function ShareModal({ workspace, onClose }: { workspace: WorkspaceData; onClose: () => void }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<"editor" | "viewer">("editor");
  const [copied, setCopied]           = useState(false);
  const [access, setAccess]           = useState<"invite" | "link">("invite");

  const shareUrl = `https://mindspace.app/join/${workspace.id}/abc123`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#E8E7EA]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF4]">
          <h3 className="font-semibold text-[#0D0D14]">“{workspace.name}” 공유</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#717182]" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Invite by email */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-2">이메일로 초대</label>
            <div className="flex gap-2">
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="동료의 이메일 주소"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all" />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as "editor" | "viewer")}
                className="px-3 py-2 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none bg-white text-[#0D0D14]">
                <option value="editor">편집자</option>
                <option value="viewer">뷰어</option>
              </select>
            </div>
            <button className="mt-2.5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              초대 보내기
            </button>
          </div>

          {/* Share link */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-2">공유 링크</label>
            <div className="flex gap-2 items-center px-3.5 py-3 rounded-xl bg-[#F8F7F4] border border-[#E8E7EA]">
              <Link2 className="w-3.5 h-3.5 text-[#ABABAB] flex-shrink-0" />
              <span className="flex-1 text-xs text-[#717182] truncate font-mono">{shareUrl}</span>
              <button onClick={handleCopy}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex-shrink-0">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          </div>

          {/* Access control */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-2">접근 권한</label>
            <div className="flex gap-2">
              {([
                { value: "invite", label: "초대받은 사람만", Icon: Lock  },
                { value: "link",   label: "링크가 있는 사람", Icon: Globe },
              ] as const).map(({ value, label, Icon }) => (
                <button key={value} onClick={() => setAccess(value)}
                  className={[
                    "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    access === value
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "border-[#E0DFE0] text-[#717182] hover:border-indigo-200",
                  ].join(" ")}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Members list */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-2">현재 멤버</label>
            <div className="space-y-2.5">
              {workspace.members.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: m.color }}>
                    {m.initials}
                  </div>
                  <span className="text-sm text-[#0D0D14] flex-1 font-medium">{m.name}</span>
                  <span className="text-xs text-[#717182]">{m.role === "owner" ? "소유자" : m.role === "editor" ? "편집자" : "뷰어"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create Workspace Modal ──────────────────────────────────────────────────

function CreateWorkspaceModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-[#E8E7EA]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF4]">
          <h3 className="font-semibold text-[#0D0D14]">새 워크스페이스</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#717182]" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-1.5">워크스페이스 이름</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="예: 마케팅 팀"
              onKeyDown={e => e.key === "Enter" && name.trim() && onCreate(name.trim())}
              className="w-full px-4 py-3 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E0DFE0] text-sm text-[#717182] hover:bg-[#F3F2F6] font-medium transition-colors">
              취소
            </button>
            <button onClick={() => name.trim() && onCreate(name.trim())}
              disabled={!name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40">
              만들기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateMindMapModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-[#E8E7EA]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF4]">
          <h3 className="font-semibold text-[#0D0D14]">새 마인드맵</h3>
          <button onClick={onClose} aria-label="닫기"
            className="w-7 h-7 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#717182]" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-1.5">마인드맵 이름</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="예: 신제품 아이디어"
              onKeyDown={e => e.key === "Enter" && name.trim() && onCreate(name.trim())}
              className="w-full px-4 py-3 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all" />
            <p className="mt-2 text-xs text-[#ABABAB]">같은 이름의 루트 노드가 함께 생성됩니다.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E0DFE0] text-sm text-[#717182] hover:bg-[#F3F2F6] font-medium transition-colors">
              취소
            </button>
            <button onClick={() => name.trim() && onCreate(name.trim())}
              disabled={!name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40">
              만들기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invitation Screen ───────────────────────────────────────────────────────

export function InvitationScreen({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const [accepted, setAccepted] = useState(false);

  if (accepted) {
    return (
      <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-8">
        <div className="relative w-full max-w-sm rounded-2xl border border-[#E8E7EA] bg-white p-8 text-center shadow-2xl">
          <button onClick={onDecline} aria-label="나가기"
            className="absolute right-4 top-4 w-8 h-8 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#717182]" />
          </button>
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-[#0D0D14] mb-2 tracking-tight">참여가 완료됐어요!</h2>
          <p className="text-[#717182] mb-6 text-sm">
            엔지니어링 리드 워크스페이스에 오신 것을 환영합니다. 이제 팀과 함께 마인드맵을 만들 수 있어요.
          </p>
          <button onClick={onAccept}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
            워크스페이스 열기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#E8E7EA]">
          <button onClick={onDecline} aria-label="나가기"
            className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full bg-white/15 border border-white/20 hover:bg-white/25 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
          {/* Header band */}
          <div className="px-8 pt-10 pb-8 text-center"
            style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}>
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/20">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-1 tracking-tight">워크스페이스에 초대받았어요!</h1>
            <p className="text-white/60 text-sm">MindSpace에서 팀과 함께 아이디어를 펼쳐보세요</p>
          </div>

          <div className="px-8 py-6">
            {/* Inviter */}
            <div className="flex items-center gap-3.5 mb-6 p-4 rounded-2xl bg-[#F8F7F4]">
              <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                SK
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0D0D14]">Sarah Kim</p>
                <p className="text-xs text-[#717182]">워크스페이스에 초대했어요</p>
              </div>
            </div>

            {/* Workspace info */}
            <div className="mb-6">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 flex-shrink-0">
                  E
                </div>
                <div>
                  <p className="font-semibold text-[#0D0D14]">엔지니어링 리드</p>
                  <p className="text-xs text-[#717182]">멤버 5명 · 마인드맵 8개</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "내 역할",  value: "편집자"      },
                  { label: "만료일",    value: "2026년 7월 10일" },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3.5 rounded-xl bg-[#F8F7F4] border border-[#E8E7EA]">
                    <p className="text-xs text-[#717182] mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-[#0D0D14]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={onDecline}
                className="flex-1 py-3 rounded-xl border border-[#E0DFE0] text-sm text-[#717182] hover:bg-[#F3F2F6] font-medium transition-colors">
                거절
              </button>
              <button onClick={() => setAccepted(true)}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/20">
                초대 수락
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[#ABABAB] mt-5">
          수락하면 MindSpace 이용약관에 동의하는 것으로 간주됩니다
        </p>
      </div>
    </div>
  );
}

// ─── Canvas Screen ───────────────────────────────────────────────────────────

interface DragState {
  type: "idle" | "node" | "pan";
  nodeId: string | null;
  startPointer: { x: number; y: number };
  startValue: { x: number; y: number };
  moved: boolean;
}

interface RecommendationState {
  sourceId: string;
  sourceX: number;
  sourceY: number;
  visible: boolean;
}

interface RecommendationItem {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

function placeRecommendations(
  source: NodeData,
  nodes: NodeData[],
  labels: string[],
  preferredDirection: 1 | -1,
): RecommendationItem[] {
  const baseAngle = preferredDirection === 1 ? 0 : Math.PI;
  const angleOffsets = [0, -0.48, 0.48, -0.9, 0.9, -1.35, 1.35, Math.PI];
  const radii = [210, 260, 315, 375, 440];
  const occupied = nodes.map(node => ({ x: node.x, y: node.y, ...nodeBounds(node) }));

  return labels.map((text, index) => {
    const width = Math.max(120, Math.min(220, text.length * 9 + 48));
    const candidates = radii.flatMap(radius => angleOffsets.map((offset, angleIndex) => {
      // 추천 노드마다 탐색 시작 각도를 살짝 바꿔 한쪽에만 몰리지 않게 한다.
      const angle = baseAngle + angleOffsets[(angleIndex + index * 2) % angleOffsets.length];
      return {
        x: source.x + Math.cos(angle) * radius,
        y: source.y + Math.sin(angle) * radius,
        width,
        height: 46,
        preference: radius + angleIndex * 5,
      };
    }));

    const scored = candidates.map(candidate => {
      const collisionPenalty = occupied.reduce((penalty, item) => {
        const overlapX = (candidate.width + item.width) / 2 + 24 - Math.abs(candidate.x - item.x);
        const overlapY = (candidate.height + item.height) / 2 + 24 - Math.abs(candidate.y - item.y);
        return penalty + (overlapX > 0 && overlapY > 0 ? 10000 + overlapX * overlapY : 0);
      }, 0);
      return { ...candidate, score: collisionPenalty + candidate.preference };
    }).sort((a, b) => a.score - b.score);

    const chosen = scored[0];
    occupied.push(chosen);
    return {
      id: `recommendation-${source.id}-${index}`,
      text,
      x: chosen.x,
      y: chosen.y,
      color: source.color,
    };
  });
}

function nodeBounds(node: NodeData) {
  const isRoot = node.id === "root";
  const horizontalPadding = isRoot ? 48 : 34;
  const verticalPadding = isRoot ? 28 : 18;
  const minWidth = isRoot ? 200 : 100;
  const maxWidth = isRoot ? 300 : 240;
  const estimatedTextWidth = [...node.text].reduce(
    (width, character) => width + (character.charCodeAt(0) > 255 ? 14 : 7.5),
    0,
  );
  const width = Math.max(minWidth, Math.min(maxWidth, estimatedTextWidth + horizontalPadding));
  const contentWidth = Math.max(1, width - horizontalPadding);
  const lines = Math.max(1, Math.ceil(estimatedTextWidth / contentWidth));
  return {
    width,
    height: Math.max(isRoot ? 62 : 42, lines * 20 + verticalPadding),
  };
}

function relaxNodeCollisions(input: NodeData[], pinnedIds = new Set<string>()): NodeData[] {
  const result = input.map(node => ({ ...node }));
  const root = result.find(node => node.id === "root");
  if (root) pinnedIds.add(root.id);

  for (let iteration = 0; iteration < 20; iteration += 1) {
    let changed = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const a = result[i];
        const b = result[j];
        const sizeA = nodeBounds(a);
        const sizeB = nodeBounds(b);
        const overlapX = (sizeA.width + sizeB.width) / 2 + 30 - Math.abs(a.x - b.x);
        const overlapY = (sizeA.height + sizeB.height) / 2 + 28 - Math.abs(a.y - b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;

        changed = true;
        const aPinned = pinnedIds.has(a.id);
        const bPinned = pinnedIds.has(b.id);
        if (aPinned && bPinned) continue;
        const moveA = aPinned ? 0 : bPinned ? 1 : 0.5;
        const moveB = bPinned ? 0 : aPinned ? 1 : 0.5;

        // 더 적은 이동으로 분리되는 축을 선택해 레이아웃의 방향성을 최대한 유지한다.
        if (overlapX < overlapY) {
          const direction = a.x <= b.x ? -1 : 1;
          a.x += direction * overlapX * moveA;
          b.x -= direction * overlapX * moveB;
        } else {
          const direction = a.y <= b.y ? -1 : 1;
          a.y += direction * overlapY * moveA;
          b.y -= direction * overlapY * moveB;
        }
      }
    }
    if (!changed) break;
  }
  return result;
}

export function CanvasScreen({
  workspace, mapName, userInitials, onBack,
}: {
  workspace: WorkspaceData;
  mapName: string;
  userInitials: string;
  onBack: () => void;
}) {
  const [nodes, setNodes]       = useState<NodeData[]>(() =>
    INIT_NODES.map(node => node.id === "root" ? { ...node, text: mapName } : { ...node })
  );
  const [edges, setEdges]       = useState<EdgeData[]>(
    INIT_NODES.filter(n => n.parentId).map(n => ({ from: n.parentId!, to: n.id }))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editText, setEditText]     = useState("");
  const [pan, setPan]               = useState({ x: 80, y: 40 });
  const [zoom, setZoom]             = useState(0.78);
  const [showShare, setShowShare]   = useState(false);
  const [isRecentering, setIsRecentering] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationState | null>(null);
  const [hoveredRecommendationId, setHoveredRecommendationId] = useState<string | null>(null);
  const [acceptingRecommendationId, setAcceptingRecommendationId] = useState<string | null>(null);
  const [isAutoArranging, setIsAutoArranging] = useState(false);
  const [isZoomAnimating, setIsZoomAnimating] = useState(false);
  const [panelMode, setPanelMode] = useState<"controls" | "comments">("controls");
  const [comments, setComments] = useState<CommentData[]>(INIT_COMMENTS);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef     = useRef<DragState>({ type: "idle", nodeId: null, startPointer: { x: 0, y: 0 }, startValue: { x: 0, y: 0 }, moved: false });
  const stateRef    = useRef({ pan, zoom });
  const nodesRef = useRef(nodes);
  const recommendationDragSourceRef = useRef<string | null>(null);
  const recommendationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationAcceptRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationCommitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { stateRef.current = { pan, zoom }; }, [pan, zoom]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  useEffect(() => () => {
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
    if (recommendationRevealRef.current) clearTimeout(recommendationRevealRef.current);
    if (recommendationAcceptRef.current) clearTimeout(recommendationAcceptRef.current);
    if (recommendationCommitRef.current) clearTimeout(recommendationCommitRef.current);
  }, []);

  // Native wheel listener (passive: false required for preventDefault)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { pan: p, zoom: z } = stateRef.current;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.11 : 0.9;
      const newZ = Math.max(0.15, Math.min(3, z * factor));
      setPan({ x: mx - (mx - p.x) * (newZ / z), y: my - (my - p.y) * (newZ / z) });
      setZoom(newZ);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const selectedNode = nodes.find(n => n.id === selectedId) ?? null;

  // ── Pointer handlers ──

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Nodes call stopPropagation, so this only fires on background
    setSelectedId(null);
    setRecommendations(null);
    dragRef.current = {
      type: "pan",
      nodeId: null,
      startPointer: { x: e.clientX, y: e.clientY },
      startValue: { ...pan },
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId)!;
    dragRef.current = {
      type: "node",
      nodeId,
      startPointer: { x: e.clientX, y: e.clientY },
      startValue: { x: node.x, y: node.y },
      moved: false,
    };
    setSelectedId(nodeId);
    recommendationDragSourceRef.current = recommendations?.sourceId === nodeId ? nodeId : null;
    if (recommendationDragSourceRef.current) {
      // 추천 가지를 드래그 시작 위치의 원래 노드 안으로 먼저 접는다.
      setRecommendations(current => current ? { ...current, visible: false } : null);
      if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
      if (recommendationRevealRef.current) clearTimeout(recommendationRevealRef.current);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.type === "idle") return;
    const dx = e.clientX - d.startPointer.x;
    const dy = e.clientY - d.startPointer.y;
    if (Math.hypot(dx, dy) > 5) d.moved = true;
    if (d.type === "pan") {
      setPan({ x: d.startValue.x + dx, y: d.startValue.y + dy });
    } else if (d.type === "node" && d.nodeId && d.nodeId !== "root") {
      const z = stateRef.current.zoom;
      setNodes(prev => {
        const next = prev.map(n =>
          n.id === d.nodeId
            ? { ...n, x: d.startValue.x + dx / z, y: d.startValue.y + dy / z }
            : n
        );
        nodesRef.current = next;
        return next;
      });
    }
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    if (drag.type === "node" && drag.nodeId && !drag.moved) {
      centerNode(drag.nodeId);
      scheduleRecommendations(drag.nodeId);
    } else if (drag.type === "node" && drag.nodeId && drag.moved && recommendationDragSourceRef.current === drag.nodeId) {
      // 접히는 짧은 애니메이션 뒤 드롭된 위치에서 다시 펼친다.
      scheduleRecommendations(drag.nodeId, 460, true);
    }
    if (drag.type === "node" && drag.nodeId && drag.moved) settleNodeCollisions(drag.nodeId);
    recommendationDragSourceRef.current = null;
    dragRef.current.type = "idle";
  };

  // ── Edit ──

  const startEdit = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setEditingId(nodeId);
    setEditText(node.text);
    setRecommendations(null);
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
  };

  const commitEdit = () => {
    if (!editingId) return;
    setNodes(prev => prev.map(n => n.id === editingId ? { ...n, text: editText.trim() || n.text } : n));
    setEditingId(null);
  };

  // ── Add child ──

  const addChild = (parentId: string) => {
    const parent = nodes.find(n => n.id === parentId)!;
    const siblings = nodes.filter(n => n.parentId === parentId);
    const newId = genId();
    const newNode: NodeData = {
      id: newId,
      text: "새 아이디어",
      x: parent.x + 220,
      y: parent.y + (siblings.length * 80) - (siblings.length / 2 * 80),
      color: parent.color,
      parentId,
    };
    setNodes(prev => [...prev, newNode]);
    setEdges(prev => [...prev, { from: parentId, to: newId }]);
    setSelectedId(newId);
    setEditingId(newId);
    setEditText(newNode.text);
  };

  // ── Delete ──

  const deleteNode = (nodeId: string) => {
    if (nodeId === "root") return;
    const toDelete = new Set<string>();
    const collect = (id: string) => {
      toDelete.add(id);
      nodes.filter(n => n.parentId === id).forEach(c => collect(c.id));
    };
    collect(nodeId);
    setNodes(prev => prev.filter(n => !toDelete.has(n.id)));
    setEdges(prev => prev.filter(e => !toDelete.has(e.from) && !toDelete.has(e.to)));
    setSelectedId(null);
  };

  const requestDelete = (nodeId: string) => {
    if (nodeId !== "root") setPendingDeleteId(nodeId);
  };

  // ── Color ──

  const changeColor = (nodeId: string, color: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, color } : n));
  };

  const autoArrangeChildren = (parentId: string) => {
    const parent = nodes.find(node => node.id === parentId);
    const children = nodes.filter(node => node.parentId === parentId);
    if (!parent || children.length === 0) return;

    const root = nodes.find(node => node.id === "root") ?? parent;
    const arranged = nodes.map(node => ({ ...node }));
    const byId = new Map(arranged.map(node => [node.id, node]));
    const childNodes = (id: string) => arranged.filter(node => node.parentId === id).sort((a, b) => a.y - b.y);
    const subtreeUnits = (id: string): number => {
      const descendants = childNodes(id);
      return descendants.length === 0 ? 1 : descendants.reduce((sum, child) => sum + subtreeUnits(child.id), 0);
    };
    const layoutGroup = (parentNode: NodeData, items: NodeData[], direction: number) => {
      const unitHeight = 96;
      const totalHeight = items.reduce((sum, child) => sum + subtreeUnits(child.id) * unitHeight, 0);
      let cursor = parentNode.y - totalHeight / 2;
      items.forEach(child => {
        const span = subtreeUnits(child.id) * unitHeight;
        const target = byId.get(child.id)!;
        target.x = parentNode.x + direction * (parentNode.id === "root" ? 290 : 240);
        target.y = cursor + span / 2;
        cursor += span;
        const descendants = childNodes(child.id);
        if (descendants.length) layoutGroup(target, descendants, direction);
      });
    };

    if (parentId === "root") {
      const left = children.filter(child => child.x < parent.x);
      const right = children.filter(child => child.x >= parent.x);
      if (left.length) layoutGroup(byId.get(parentId)!, left, -1);
      if (right.length) layoutGroup(byId.get(parentId)!, right, 1);
    } else {
      layoutGroup(byId.get(parentId)!, children, parent.x >= root.x ? 1 : -1);
    }

    const next = relaxNodeCollisions(arranged, new Set([parentId]));

    setRecommendations(null);
    setIsAutoArranging(true);
    nodesRef.current = next;
    setNodes(next);
    window.setTimeout(() => setIsAutoArranging(false), 450);
  };

  const settleNodeCollisions = (movedId: string) => {
    const next = relaxNodeCollisions(nodesRef.current);
    if (next.every((node, index) => node.x === nodesRef.current[index].x && node.y === nodesRef.current[index].y)) return;
    setRecommendations(current => current?.sourceId === movedId ? { ...current, visible: false } : current);
    setIsAutoArranging(true);
    nodesRef.current = next;
    setNodes(next);
    window.setTimeout(() => setIsAutoArranging(false), 450);
  };

  // ── Reset view ──

  const resetView = () => {
    if (selectedId) return;
    setIsRecentering(true);
    setPan({ x: 80, y: 40 });
    setZoom(0.78);
    window.setTimeout(() => setIsRecentering(false), 700);
  };

  const smoothZoom = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { pan: currentPan, zoom: currentZoom } = stateRef.current;
    const nextZoom = Math.max(0.15, Math.min(3, currentZoom * factor));
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    setIsZoomAnimating(true);
    setPan({
      x: centerX - (centerX - currentPan.x) * (nextZoom / currentZoom),
      y: centerY - (centerY - currentPan.y) * (nextZoom / currentZoom),
    });
    setZoom(nextZoom);
    window.setTimeout(() => setIsZoomAnimating(false), 280);
  };

  const centerNode = (nodeId: string) => {
    const viewport = viewportRef.current;
    const node = nodes.find(item => item.id === nodeId);
    if (!viewport || !node) return;
    const currentZoom = stateRef.current.zoom;
    setIsRecentering(true);
    setPan({
      x: viewport.clientWidth / 2 - node.x * currentZoom,
      y: viewport.clientHeight / 2 - node.y * currentZoom,
    });
    window.setTimeout(() => setIsRecentering(false), 700);
  };

  const scheduleRecommendations = (nodeId: string, delay = 720, preserveCollapsing = false) => {
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
    if (recommendationRevealRef.current) clearTimeout(recommendationRevealRef.current);
    if (!preserveCollapsing) setRecommendations(null);
    setHoveredRecommendationId(null);
    setAcceptingRecommendationId(null);

    // 중앙 정렬이 끝난 뒤, 시작점에서 목표 위치로 뻗어 나오게 두 단계로 표시한다.
    recommendationTimerRef.current = setTimeout(() => {
      const source = nodesRef.current.find(node => node.id === nodeId);
      if (!source) return;
      setRecommendations({ sourceId: nodeId, sourceX: source.x, sourceY: source.y, visible: false });
      recommendationRevealRef.current = setTimeout(() => {
        setRecommendations({ sourceId: nodeId, sourceX: source.x, sourceY: source.y, visible: true });
      }, 40);
    }, delay);
  };

  const acceptRecommendation = (item: RecommendationItem) => {
    if (!recommendationSource || acceptingRecommendationId) return;
    const parentId = recommendationSource.id;
    setAcceptingRecommendationId(item.id);

    // 먼저 확대하고, 원래 크기로 돌아온 순간 실제 노드로 확정한다.
    recommendationAcceptRef.current = setTimeout(() => {
      setAcceptingRecommendationId(null);
    }, 180);
    recommendationCommitRef.current = setTimeout(() => {
      const newId = genId();
      setNodes(prev => [...prev, {
        id: newId,
        text: item.text,
        x: item.x,
        y: item.y,
        color: item.color,
        parentId,
      }]);
      setEdges(prev => [...prev, { from: parentId, to: newId }]);
      setRecommendations(null);
      setHoveredRecommendationId(null);
      setSelectedId(newId);
    }, 380);
  };

  const returnToRoot = () => {
    const viewport = viewportRef.current;
    const root = nodes.find(node => node.id === "root");
    if (!viewport || !root) return;
    setSelectedId(null);
    setEditingId(null);
    setRecommendations(null);
    const targetZoom = 0.78;
    setIsRecentering(true);
    setZoom(targetZoom);
    setPan({
      x: viewport.clientWidth / 2 - root.x * targetZoom,
      y: viewport.clientHeight / 2 - root.y * targetZoom,
    });
    window.setTimeout(() => setIsRecentering(false), 700);
  };

  const recommendationSource = recommendations
    ? (() => {
        const source = nodes.find(node => node.id === recommendations.sourceId);
        return source ? { ...source, x: recommendations.sourceX, y: recommendations.sourceY } : null;
      })()
    : null;
  const recommendationItems: RecommendationItem[] = recommendationSource
    ? placeRecommendations(
        recommendationSource,
        nodes,
        ["관련 키워드", "새로운 관점", "실행 아이디어"],
        recommendationSource.id === "root" || recommendationSource.x >= (nodes.find(node => node.id === "root")?.x ?? 600) ? 1 : -1,
      )
    : [];

  return (
    <div className="size-full flex flex-col overflow-hidden bg-[#F8F7F4]">
      {/* ── Top bar ── */}
      <div className="h-12 flex items-center px-4 gap-3 flex-shrink-0 border-b border-[#E8E7EA] bg-white z-10">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-[#717182] hover:text-[#0D0D14] transition-colors mr-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          돌아가기
        </button>
        <div className="w-px h-4 bg-[#E0DFE0]" />
        <span className="text-xs text-[#717182]">{workspace.name}</span>
        <ChevronRight className="w-3 h-3 text-[#C8C7D0]" />
        <span className="text-xs font-semibold text-[#0D0D14]">{mapName}</span>

        <div className="flex-1" />

        {/* Collaborator avatars */}
        <div className="flex items-center" style={{ gap: "-6px" }}>
          <div className="flex -space-x-1.5">
            {workspace.members.slice(0, 3).map((m, i) => (
              <div key={m.id} title={m.name}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2"
                style={{ backgroundColor: m.color, borderColor: "#FFFFFF", zIndex: 10 - i }}>
                {m.initials}
              </div>
            ))}
            {workspace.members.length > 3 && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold border-2"
                style={{ backgroundColor: "#F0EFF4", borderColor: "#FFFFFF", color: "#717182" }}>
                +{workspace.members.length - 3}
              </div>
            )}
          </div>
        </div>

        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: "#4F46E5", color: "white" }}>
          <Share2 className="w-3 h-3" />
          공유
        </button>

        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
          {userInitials}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left toolbar ── */}
        <div className="w-12 flex flex-col items-center py-4 gap-2.5 flex-shrink-0 border-r border-[#E8E7EA] bg-white">
          <ToolBtn
            onClick={() => selectedId && addChild(selectedId)}
            disabled={!selectedId}
            title="하위 노드 추가"
            active>
            <Plus className="w-4 h-4 text-indigo-600" />
          </ToolBtn>
          <ToolBtn
            onClick={() => selectedId && startEdit(selectedId)}
            disabled={!selectedId}
            title="이름 수정">
            <Pencil className="w-4 h-4 text-[#717182]" />
          </ToolBtn>
          <ToolBtn
            onClick={() => selectedId && autoArrangeChildren(selectedId)}
            disabled={!selectedId || !nodes.some(node => node.parentId === selectedId)}
            title="하위 노드 자동 정렬">
            <ListTree className="w-4 h-4 text-[#717182]" />
          </ToolBtn>
          <ToolBtn
            onClick={() => selectedId && requestDelete(selectedId)}
            disabled={!selectedId || selectedId === "root"}
            title="노드 삭제"
            danger>
            <Trash2 className="w-4 h-4" style={{ color: "#F87171" }} />
          </ToolBtn>
          <div className="w-5 h-px my-1 bg-[#E8E7EA]" />
          <ToolBtn onClick={() => smoothZoom(1.15)} title="확대">
            <ZoomIn className="w-4 h-4 text-[#717182]" />
          </ToolBtn>
          <ToolBtn onClick={() => smoothZoom(1 / 1.15)} title="축소">
            <ZoomOut className="w-4 h-4 text-[#717182]" />
          </ToolBtn>
          <ToolBtn onClick={resetView} disabled={Boolean(selectedId)} title={selectedId ? "노드 선택을 해제하면 사용할 수 있어요" : "화면 맞춤"}>
            <Maximize2 className="w-4 h-4 text-[#717182]" />
          </ToolBtn>
        </div>

        {/* ── Canvas viewport ── */}
        <div
          ref={viewportRef}
          className="flex-1 relative overflow-hidden select-none"
          style={{ cursor: "default", touchAction: "none", background: "#FFFFFF" }}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Dot grid */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(circle, rgba(15,23,42,0.12) 1px, transparent 1px)",
            backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
            backgroundPosition: `${pan.x % (22 * zoom)}px ${pan.y % (22 * zoom)}px`,
            transition: isRecentering
              ? "background-position 700ms cubic-bezier(0.22, 1, 0.36, 1), background-size 700ms cubic-bezier(0.22, 1, 0.36, 1)"
              : isZoomAnimating
                ? "background-position 260ms cubic-bezier(0.22, 1, 0.36, 1), background-size 260ms cubic-bezier(0.22, 1, 0.36, 1)"
                : "none",
          }} />

          {/* Canvas world */}
          <div
            className="absolute"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              transition: isRecentering
                ? "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)"
                : isZoomAnimating
                  ? "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)"
                  : "none",
              width: 2400,
              height: 1600,
            }}
          >
            {/* SVG edges */}
            <svg className="absolute inset-0 pointer-events-none overflow-visible" width={2400} height={1600}
              style={{ overflow: "visible" }}>
              <defs>
                {NODE_COLORS.map(c => (
                  <marker key={c} id={`dot-${c.replace("#","")}`} markerWidth="6" markerHeight="6" refX="3" refY="3">
                    <circle cx="3" cy="3" r="1.5" fill={c} opacity="0.5" />
                  </marker>
                ))}
              </defs>
              {edges.map(edge => {
                const from = nodes.find(n => n.id === edge.from);
                const to   = nodes.find(n => n.id === edge.to);
                if (!from || !to) return null;
                const mx = (from.x + to.x) / 2;
                return (
                  <path
                    key={`${edge.from}-${edge.to}`}
                    d={`M ${from.x} ${from.y} C ${mx} ${from.y} ${mx} ${to.y} ${to.x} ${to.y}`}
                    fill="none"
                    stroke={from.color}
                    strokeWidth={2}
                    strokeOpacity={0.28}
                    strokeLinecap="round"
                  />
                );
              })}
              {recommendationSource && recommendationItems.map((item, index) => {
                const mx = (recommendationSource.x + item.x) / 2;
                return (
                  <path
                    key={`edge-${item.id}`}
                    d={`M ${recommendationSource.x} ${recommendationSource.y} C ${mx} ${recommendationSource.y} ${mx} ${item.y} ${item.x} ${item.y}`}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={2}
                    strokeOpacity={0.25}
                    pathLength={1}
                    style={{
                      strokeDasharray: 1,
                      strokeDashoffset: recommendations?.visible ? 0 : 1,
                      transition: `stroke-dashoffset 480ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 70}ms`,
                    }}
                  />
                );
              })}
            </svg>

            {/* 자동 추천 노드 */}
            {recommendationSource && recommendationItems.map((item, index) => (
              <div key={item.id} className="absolute"
                style={{
                  left: recommendations?.visible ? item.x : recommendationSource.x,
                  top: recommendations?.visible ? item.y : recommendationSource.y,
                  transform: `translate(-50%, -50%) scale(${recommendations?.visible ? 1 : 0.65})`,
                  opacity: recommendations?.visible
                    ? (hoveredRecommendationId === item.id || acceptingRecommendationId === item.id ? 0.92 : 0.58)
                    : 0,
                  transition: `left 520ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 70}ms, top 520ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 70}ms, transform 520ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 70}ms, opacity 320ms ease ${index * 70}ms`,
                }}>
                <button
                  type="button"
                  onPointerDown={event => event.stopPropagation()}
                  onMouseEnter={() => setHoveredRecommendationId(item.id)}
                  onMouseLeave={() => setHoveredRecommendationId(null)}
                  onClick={() => acceptRecommendation(item)}
                  className="px-4 py-2.5 rounded-xl border border-dashed text-sm font-semibold whitespace-nowrap shadow-sm cursor-pointer"
                  style={{
                    color: "#0D0D14",
                    borderColor: `${item.color}99`,
                    background: `${item.color}18`,
                    transform: `scale(${acceptingRecommendationId === item.id ? 1.16 : 1})`,
                    transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease",
                  }}>
                  {item.text}
                </button>
              </div>
            ))}

            {/* Nodes */}
            {nodes.map(node => (
              <MindNode
                key={node.id}
                node={node}
                selected={selectedId === node.id}
                editing={editingId === node.id}
                editText={editText}
                onPointerDown={e => handleNodePointerDown(e, node.id)}
                onDoubleClick={() => startEdit(node.id)}
                onEditChange={setEditText}
                onEditCommit={commitEdit}
                onEditCancel={() => setEditingId(null)}
                animatePosition={isAutoArranging}
                commentCount={comments.filter(comment => comment.nodeId === node.id).length}
              />
            ))}
          </div>

          {/* Zoom label */}
          <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-lg text-xs font-mono"
            style={{ background: "rgba(255,255,255,0.92)", border: "1px solid #E8E7EA", color: "#717182" }}>
            {Math.round(zoom * 100)}%
          </div>

          <button onClick={returnToRoot} onPointerDown={e => e.stopPropagation()} aria-label="루트 노드로 돌아가기" title="루트 노드로 돌아가기"
            className="absolute bottom-14 right-4 w-10 h-10 rounded-xl bg-white border border-[#E0DFE0] shadow-lg hover:border-indigo-300 hover:text-indigo-600 flex items-center justify-center transition-colors text-[#717182]">
            <LocateFixed className="w-5 h-5" />
          </button>

          {/* Hint when idle */}
          {!selectedNode && !editingId && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs pointer-events-none"
              style={{ color: "#ABABAB" }}>
              클릭하여 선택 · 두 번 클릭하여 수정 · 스크롤하여 확대/축소 · 드래그하여 이동
            </div>
          )}

          {/* Bottom context bar when node selected */}
          {selectedNode && !editingId && (
            <div onPointerDown={e => e.stopPropagation()}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white border border-[#E0DFE0] shadow-xl">
              <span className="text-xs max-w-[100px] truncate text-[#717182]">
                {selectedNode.text}
              </span>
              <div className="w-px h-4 bg-[#E0DFE0]" />
              {/* Color swatches */}
              <div className="flex items-center gap-1">
                {NODE_COLORS.map(c => (
                  <button key={c} onClick={() => changeColor(selectedId!, c)}
                    className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-125"
                    style={{ backgroundColor: c, borderColor: selectedNode.color === c ? "#0D0D14" : "transparent" }} />
                ))}
              </div>
              <div className="w-px h-4 bg-[#E0DFE0]" />
              <button onClick={() => addChild(selectedId!)}
                className="flex items-center gap-1 text-xs font-semibold transition-colors"
                style={{ color: "#4F46E5" }}>
                <Plus className="w-3 h-3" />하위 노드
              </button>
              <button onClick={() => autoArrangeChildren(selectedId!)}
                disabled={!nodes.some(node => node.parentId === selectedId)}
                className="flex items-center gap-1 text-xs transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ color: "#717182" }}
                title="하위 노드 자동 정렬">
                <ListTree className="w-3 h-3" />자동 정렬
              </button>
              <button onClick={() => startEdit(selectedId!)}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: "#717182" }}>
                <Pencil className="w-3 h-3" />
              </button>
              {selectedId !== "root" && (
                <>
                  <div className="w-px h-4 bg-[#E0DFE0]" />
                  <button onClick={() => requestDelete(selectedId!)}
                    className="text-xs transition-colors"
                    style={{ color: "#F87171" }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Right properties panel ── */}
        {selectedNode && !editingId && (
          <div className="relative w-64 flex flex-col min-h-0 py-5 px-4 flex-shrink-0 border-l border-[#E8E7EA] bg-white">
            <div className="absolute -left-11 top-5 flex flex-col overflow-hidden rounded-l-xl border border-r-0 border-[#E8E7EA] bg-white shadow-sm">
              <button onClick={() => setPanelMode("controls")} title="노드 조작"
                className={`flex h-10 w-10 items-center justify-center transition-colors ${panelMode === "controls" ? "bg-indigo-50 text-indigo-600" : "text-[#ABABAB] hover:bg-[#F8F7F4]"}`}>
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              <button onClick={() => setPanelMode("comments")} title="댓글"
                className={`relative flex h-10 w-10 items-center justify-center border-t border-[#E8E7EA] transition-colors ${panelMode === "comments" ? "bg-indigo-50 text-indigo-600" : "text-[#ABABAB] hover:bg-[#F8F7F4]"}`}>
                <MessageCircle className="h-4 w-4" />
                {comments.filter(comment => comment.nodeId === selectedId && !comment.solved).length > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-indigo-500" />
                )}
              </button>
            </div>

            {panelMode === "controls" ? <>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4 text-[#ABABAB]">노드</p>

            <div className="space-y-5">
              <div>
                <p className="text-[10px] mb-1.5 text-[#ABABAB]">이름</p>
                <p className="text-sm font-semibold leading-snug text-[#0D0D14]">
                  {selectedNode.text}
                </p>
              </div>

              <div>
                <p className="text-[10px] mb-2 text-[#ABABAB]">색상</p>
                <div className="grid grid-cols-4 gap-2">
                  {NODE_COLORS.map(c => (
                    <button key={c} onClick={() => changeColor(selectedId!, c)}
                      className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c + "30", borderColor: selectedNode.color === c ? c : c + "40" }} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] mb-2 text-[#ABABAB]">작업</p>
                <div className="space-y-1.5">
                  <button onClick={() => addChild(selectedId!)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818CF8" }}>
                    <Plus className="w-3.5 h-3.5" />
                    하위 노드 추가
                  </button>
                  <button onClick={() => startEdit(selectedId!)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{ background: "#F8F7F4", border: "1px solid #E8E7EA", color: "#717182" }}>
                    <Pencil className="w-3.5 h-3.5" />
                    이름 수정
                  </button>
                  {selectedId !== "root" && (
                    <button onClick={() => requestDelete(selectedId!)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                      노드 삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
            </> : <CommentPanel
              comments={comments.filter(comment => comment.nodeId === selectedId)}
              onResolve={commentId => setComments(prev => prev.map(comment => comment.id === commentId ? { ...comment, solved: true } : comment))}
            />}
          </div>
        )}
      </div>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-node-title"
            className="w-full max-w-sm rounded-2xl border border-[#E8E7EA] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <h2 id="delete-node-title" className="text-lg font-bold text-[#0D0D14]">노드를 삭제할까요?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#717182]">
              이 노드에 연결된 모든 하위 노드도 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setPendingDeleteId(null)}
                className="rounded-xl border border-[#E0DFE0] px-4 py-2.5 text-sm font-semibold text-[#717182] hover:bg-[#F8F7F4]">
                취소
              </button>
              <button onClick={() => { deleteNode(pendingDeleteId); setPendingDeleteId(null); }}
                className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {showShare && <ShareModal workspace={workspace} onClose={() => setShowShare(false)} />}
    </div>
  );
}

function CommentPanel({ comments, onResolve }: {
  comments: CommentData[];
  onResolve: (commentId: string) => void;
}) {
  const openComments = comments.filter(comment => !comment.solved);
  const solvedComments = comments.filter(comment => comment.solved);

  const commentCard = (comment: CommentData, solved: boolean) => (
    <div key={comment.id} className={`rounded-xl border p-3 ${solved ? "border-[#E8E7EA] bg-[#F8F7F4] opacity-65" : "border-indigo-100 bg-indigo-50/45"}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-[#0D0D14]">{comment.author}</span>
        {solved && <span className="text-[10px] font-medium text-emerald-600">해결됨</span>}
      </div>
      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#717182]">{comment.content}</p>
      {!solved && (
        <div className="mt-2 flex justify-end">
          <button onClick={() => onResolve(comment.id)} aria-label="댓글 해결" title="해결됨으로 표시"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[#ABABAB] transition-colors hover:bg-emerald-100 hover:text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#ABABAB]">댓글</p>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">{openComments.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {openComments.length ? openComments.map(comment => commentCard(comment, false)) : (
          <div className="rounded-xl border border-dashed border-[#E0DFE0] px-3 py-6 text-center text-xs text-[#ABABAB]">남은 댓글이 없어요.</div>
        )}
        {solvedComments.length > 0 && (
          <div className="pt-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-[#E8E7EA]" />
              <span className="text-[10px] font-semibold text-[#ABABAB]">해결된 댓글 {solvedComments.length}</span>
              <div className="h-px flex-1 bg-[#E8E7EA]" />
            </div>
            <div className="space-y-2">{solvedComments.map(comment => commentCard(comment, true))}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mind Node component ─────────────────────────────────────────────────────

function MindNode({
  node, selected, editing, editText,
  onPointerDown, onDoubleClick, onEditChange, onEditCommit, onEditCancel, animatePosition, commentCount,
}: {
  node: NodeData;
  selected: boolean;
  editing: boolean;
  editText: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onEditChange: (v: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  animatePosition: boolean;
  commentCount: number;
}) {
  const isRoot = node.id === "root";
  const dimensions = nodeBounds(node);

  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="absolute"
      style={{
        left: node.x,
        top: node.y,
        transform: "translate(-50%, -50%)",
        cursor: isRoot ? "default" : "grab",
        userSelect: "none",
        transition: animatePosition ? "left 420ms cubic-bezier(0.22, 1, 0.36, 1), top 420ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
      }}
    >
      {commentCount > 0 && !editing && (
        <div className="absolute -left-2 -top-3 z-10 flex h-6 min-w-6 items-center justify-center gap-1 rounded-full border-2 border-white bg-[#0D0D14] px-1.5 text-[10px] font-bold text-white shadow-md">
          <MessageCircle className="h-3 w-3" />
          {commentCount}
        </div>
      )}
      {editing ? (
        <div className="rounded-xl overflow-hidden"
          style={{ border: `2px solid ${node.color}`, background: node.color + "20", width: dimensions.width }}>
          <input
            autoFocus
            value={editText}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onEditCommit}
            onKeyDown={e => {
              if (e.key === "Enter") onEditCommit();
              if (e.key === "Escape") onEditCancel();
            }}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            className="w-full px-4 py-2.5 bg-transparent text-sm font-semibold text-center focus:outline-none"
            style={{ color: "#0D0D14", caretColor: node.color }}
          />
        </div>
      ) : (
        <div
          className="flex items-center justify-center text-center transition-all duration-100"
          style={{
            padding: isRoot ? "14px 24px" : "9px 17px",
            borderRadius: 12,
            background: selected ? node.color + "28" : node.color + "16",
            border: isRoot ? `4px solid ${node.color}` : selected ? `2px solid ${node.color}` : `1px solid ${node.color}50`,
            boxShadow: selected ? `0 0 0 3px ${node.color}20, 0 8px 32px ${node.color}18` : undefined,
            width: dimensions.width,
            height: dimensions.height,
          }}
        >
          <span
            className="text-sm font-semibold whitespace-normal break-words"
            style={{ color: "#0D0D14", lineHeight: "20px", overflowWrap: "anywhere" }}
          >
            {node.text}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Toolbar button ──────────────────────────────────────────────────────────

function ToolBtn({
  children, onClick, disabled, title, active, danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
      style={{
        background: active
          ? "#EEF2FF"
          : danger
          ? "#FEF2F2"
          : "transparent",
        border: active
          ? "1px solid #C7D2FE"
          : danger
          ? "1px solid #FECACA"
          : "1px solid #E8E7EA",
      }}
    >
      {children}
    </button>
  );
}

// ─── Icon helpers ────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}
