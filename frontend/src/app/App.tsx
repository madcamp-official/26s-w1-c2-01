import React, { useState, useRef, useEffect } from "react";
import {
  Plus, Share2, Check, X, Copy, ArrowLeft, ZoomIn, ZoomOut,
  Trash2, Brain, LogOut, Link2, Globe, Bell, ChevronRight,
  Maximize2, Lock, UserPlus, Pencil, GitBranch,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type Screen = "login" | "workspace" | "invitation" | "canvas";
type Role = "owner" | "editor" | "viewer";

interface MemberData {
  id: string; name: string; email: string;
  role: Role; initials: string; color: string;
}
interface MapData { id: string; name: string; nodeCount: number; updatedAt: string; }
interface WorkspaceData { id: string; name: string; members: MemberData[]; maps: MapData[]; }
interface NodeData { id: string; text: string; x: number; y: number; color: string; parentId: string | null; }
interface EdgeData { from: string; to: string; }

// ─── Static data ────────────────────────────────────────────────────────────

const NODE_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6"];

const WORKSPACES: WorkspaceData[] = [
  {
    id: "ws1", name: "Product Team",
    members: [
      { id: "m1", name: "Alex Chen",  email: "alex@acme.com",   role: "owner",  initials: "AC", color: "#6366f1" },
      { id: "m2", name: "Sarah Kim",  email: "sarah@acme.com",  role: "editor", initials: "SK", color: "#06b6d4" },
      { id: "m3", name: "Jordan Lee", email: "jordan@acme.com", role: "editor", initials: "JL", color: "#10b981" },
      { id: "m4", name: "Maya Patel", email: "maya@acme.com",   role: "viewer", initials: "MP", color: "#f59e0b" },
    ],
    maps: [
      { id: "map1", name: "Product Strategy 2026", nodeCount: 24, updatedAt: "2 hours ago" },
      { id: "map2", name: "Q3 Roadmap",            nodeCount: 18, updatedAt: "Yesterday"   },
      { id: "map3", name: "User Research Themes",  nodeCount: 12, updatedAt: "3 days ago"  },
    ],
  },
  {
    id: "ws2", name: "Design System",
    members: [
      { id: "m1", name: "Alex Chen",  email: "alex@acme.com",  role: "owner",  initials: "AC", color: "#6366f1" },
      { id: "m5", name: "Priya Nair", email: "priya@acme.com", role: "editor", initials: "PN", color: "#ec4899" },
    ],
    maps: [
      { id: "map4", name: "Component Architecture", nodeCount: 31, updatedAt: "3 days ago" },
    ],
  },
];

const INIT_NODES: NodeData[] = [
  { id: "root", text: "Product Strategy 2026", x: 600,  y: 370, color: "#6366f1", parentId: null   },
  { id: "n1",   text: "Growth",                x: 880,  y: 220, color: "#8b5cf6", parentId: "root" },
  { id: "n2",   text: "Retention",             x: 880,  y: 370, color: "#06b6d4", parentId: "root" },
  { id: "n3",   text: "Revenue",               x: 880,  y: 520, color: "#10b981", parentId: "root" },
  { id: "n4",   text: "Acquisition",           x: 330,  y: 240, color: "#f59e0b", parentId: "root" },
  { id: "n5",   text: "SEO / Content",         x: 1130, y: 155, color: "#8b5cf6", parentId: "n1"   },
  { id: "n6",   text: "Viral Referral",        x: 1130, y: 280, color: "#8b5cf6", parentId: "n1"   },
  { id: "n7",   text: "Onboarding Flow",       x: 1130, y: 345, color: "#06b6d4", parentId: "n2"   },
  { id: "n8",   text: "Push Notifications",    x: 1130, y: 435, color: "#06b6d4", parentId: "n2"   },
  { id: "n9",   text: "Paid Plans",            x: 1130, y: 520, color: "#10b981", parentId: "n3"   },
  { id: "n10",  text: "Content Marketing",     x: 120,  y: 185, color: "#f59e0b", parentId: "n4"   },
  { id: "n11",  text: "Partnerships",          x: 120,  y: 310, color: "#f59e0b", parentId: "n4"   },
];

let _nodeCounter = 100;
const genId = () => `n${++_nodeCounter}`;

// ─── App root ───────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [activeWs, setActiveWs] = useState<WorkspaceData>(WORKSPACES[0]);
  const [activeMap, setActiveMap] = useState("Product Strategy 2026");

  return (
    <div className="size-full">
      {screen === "login" && (
        <LoginScreen
          onLogin={(name, email) => { setUser({ name, email }); setScreen("workspace"); }}
        />
      )}
      {screen === "workspace" && (
        <WorkspaceScreen
          user={user!}
          onOpenCanvas={(ws, map) => { setActiveWs(ws); setActiveMap(map); setScreen("canvas"); }}
          onViewInvitation={() => setScreen("invitation")}
          onLogout={() => { setUser(null); setScreen("login"); }}
        />
      )}
      {screen === "invitation" && (
        <InvitationScreen
          onAccept={() => setScreen("workspace")}
          onDecline={() => setScreen("workspace")}
        />
      )}
      {screen === "canvas" && (
        <CanvasScreen
          workspace={activeWs}
          mapName={activeMap}
          userInitials={user ? user.name.split(" ").map(n => n[0]).join("") : "?"}
          onBack={() => setScreen("workspace")}
        />
      )}
    </div>
  );
}

// ─── Login Screen ───────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (name: string, email: string) => void }) {
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
            Think together,<br />
            <span className="text-indigo-400 font-extralight">map everything.</span>
          </h1>
          <p className="text-white/40 text-lg leading-relaxed max-w-[350px]">
            A shared canvas for your team. Build, connect, and explore concepts in real time.
          </p>
          <div className="flex items-center gap-5 pt-1">
            {["Real-time sync", "Unlimited nodes", "Team workspaces"].map(f => (
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
            { x:215, y:96,  w:92, label:"Strategy",  c:"#6366f1" },
            { x:305, y:60,  w:76, label:"Growth",    c:"#8b5cf6" },
            { x:305, y:96,  w:82, label:"Retention", c:"#06b6d4" },
            { x:305, y:136, w:76, label:"Revenue",   c:"#10b981" },
            { x:125, y:96,  w:80, label:"Research",  c:"#f59e0b" },
            { x:390, y:42,  w:62, label:"SEO",       c:"#8b5cf6" },
            { x:390, y:76,  w:72, label:"Referral",  c:"#8b5cf6" },
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
              {isSignUp ? "Create account" : "Welcome back"}
            </h2>
            <p className="text-[#717182] text-sm">
              {isSignUp ? "Start mapping with your team" : "Sign in to your workspace"}
            </p>
          </div>

          <div className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-semibold text-[#0D0D14] uppercase tracking-wider mb-1.5">Full name</label>
                <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-[#0D0D14] uppercase tracking-wider mb-1.5">Email</label>
              <input className={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-[#0D0D14] uppercase tracking-wider">Password</label>
                {!isSignUp && <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Forgot?</button>}
              </div>
              <input type="password" className={inp} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <button
              onClick={() => onLogin(isSignUp ? name : "Alex Chen", email)}
              className="w-full py-3 bg-[#0D0D14] hover:bg-[#1e1e2e] text-white rounded-xl text-sm font-semibold transition-colors mt-1"
            >
              {isSignUp ? "Create account" : "Sign in →"}
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-[#717182]">
            {isSignUp ? "Already have an account? " : "New here? "}
            <button onClick={() => setIsSignUp(s => !s)}
              className="font-semibold text-indigo-600 hover:text-indigo-700">
              {isSignUp ? "Sign in" : "Create account"}
            </button>
          </p>

          <div className="mt-7 pt-6 border-t border-[#E0DFE0]">
            <p className="text-xs text-[#ABABAB] text-center mb-3">Or continue with</p>
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
            <p className="text-xs text-indigo-600">Demo: click "Sign in" to explore the app</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Workspace Screen ────────────────────────────────────────────────────────

function WorkspaceScreen({
  user, onOpenCanvas, onViewInvitation, onLogout,
}: {
  user: { name: string; email: string };
  onOpenCanvas: (ws: WorkspaceData, map: string) => void;
  onViewInvitation: () => void;
  onLogout: () => void;
}) {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(WORKSPACES);
  const [activeId, setActiveId]     = useState("ws1");
  const [showShare, setShowShare]   = useState(false);
  const [showCreate, setShowCreate] = useState(false);

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
          <p className="text-[10px] font-bold text-[#ABABAB] uppercase tracking-widest px-5 mb-2">Workspaces</p>
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
              New workspace
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold text-[#0D0D14] tracking-tight">{ws.name}</h1>
                <p className="text-sm text-[#717182] mt-0.5">
                  {ws.members.length} members · {ws.maps.length} maps
                </p>
              </div>
              <button onClick={() => setShowShare(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-600/20">
                <Share2 className="w-4 h-4" />
                Share workspace
              </button>
            </div>

            {/* Members */}
            <section className="mb-8">
              <h2 className="text-[11px] font-bold text-[#ABABAB] uppercase tracking-widest mb-3">Members</h2>
              <div className="bg-white rounded-2xl border border-[#E8E7EA] divide-y divide-[#F0EFF4]">
                {ws.members.map(m => (
                  <div key={m.id} className="flex items-center gap-3.5 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: m.color }}>
                      {m.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0D0D14]">{m.name}</p>
                      <p className="text-xs text-[#717182]">{m.email}</p>
                    </div>
                    <span className={[
                      "px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize",
                      m.role === "owner"  ? "bg-indigo-100 text-indigo-700" :
                      m.role === "editor" ? "bg-emerald-100 text-emerald-700" :
                                            "bg-[#F0EFF4] text-[#717182]",
                    ].join(" ")}>
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Maps */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-bold text-[#ABABAB] uppercase tracking-widest">Mind Maps</h2>
                <button className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-semibold">
                  <Plus className="w-3.5 h-3.5" />New map
                </button>
              </div>
              <div className="grid gap-2.5">
                {ws.maps.map(map => (
                  <button key={map.id} onClick={() => onOpenCanvas(ws, map.name)}
                    className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#E8E7EA] hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/60 transition-all text-left group">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0D0D14] group-hover:text-indigo-700 transition-colors">{map.name}</p>
                      <p className="text-xs text-[#717182] mt-0.5">{map.nodeCount} nodes · Updated {map.updatedAt}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#C8C7D0] group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </main>
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
          <h3 className="font-semibold text-[#0D0D14]">Share "{workspace.name}"</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#717182]" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Invite by email */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-2">Invite by email</label>
            <div className="flex gap-2">
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all" />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as "editor" | "viewer")}
                className="px-3 py-2 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none bg-white text-[#0D0D14]">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button className="mt-2.5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              Send invitation
            </button>
          </div>

          {/* Share link */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-2">Share link</label>
            <div className="flex gap-2 items-center px-3.5 py-3 rounded-xl bg-[#F8F7F4] border border-[#E8E7EA]">
              <Link2 className="w-3.5 h-3.5 text-[#ABABAB] flex-shrink-0" />
              <span className="flex-1 text-xs text-[#717182] truncate font-mono">{shareUrl}</span>
              <button onClick={handleCopy}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex-shrink-0">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Access control */}
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-2">Access</label>
            <div className="flex gap-2">
              {([
                { value: "invite", label: "Invite only",       Icon: Lock  },
                { value: "link",   label: "Anyone with link",  Icon: Globe },
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
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-2">Current members</label>
            <div className="space-y-2.5">
              {workspace.members.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: m.color }}>
                    {m.initials}
                  </div>
                  <span className="text-sm text-[#0D0D14] flex-1 font-medium">{m.name}</span>
                  <span className="text-xs text-[#717182] capitalize">{m.role}</span>
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
          <h3 className="font-semibold text-[#0D0D14]">New workspace</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#717182]" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-1.5">Workspace name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Marketing Team"
              onKeyDown={e => e.key === "Enter" && name.trim() && onCreate(name.trim())}
              className="w-full px-4 py-3 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E0DFE0] text-sm text-[#717182] hover:bg-[#F3F2F6] font-medium transition-colors">
              Cancel
            </button>
            <button onClick={() => name.trim() && onCreate(name.trim())}
              disabled={!name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40">
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invitation Screen ───────────────────────────────────────────────────────

function InvitationScreen({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const [accepted, setAccepted] = useState(false);

  if (accepted) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-[#0D0D14] mb-2 tracking-tight">You are in!</h2>
          <p className="text-[#717182] mb-6 text-sm">
            Welcome to the Engineering Leads workspace. You can now collaborate on mind maps with the team.
          </p>
          <button onClick={onAccept}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
            Open workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D14] flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-white/5">
          {/* Header band */}
          <div className="px-8 pt-10 pb-8 text-center"
            style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}>
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/20">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-1 tracking-tight">You are invited!</h1>
            <p className="text-white/60 text-sm">Join a collaborative workspace on MindSpace</p>
          </div>

          <div className="px-8 py-6">
            {/* Inviter */}
            <div className="flex items-center gap-3.5 mb-6 p-4 rounded-2xl bg-[#F8F7F4]">
              <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                SK
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0D0D14]">Sarah Kim</p>
                <p className="text-xs text-[#717182]">invited you to join a workspace</p>
              </div>
            </div>

            {/* Workspace info */}
            <div className="mb-6">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 flex-shrink-0">
                  E
                </div>
                <div>
                  <p className="font-semibold text-[#0D0D14]">Engineering Leads</p>
                  <p className="text-xs text-[#717182]">5 members · 8 mind maps</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Your role",  value: "Editor"      },
                  { label: "Expires",    value: "Jul 10, 2026" },
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
                Decline
              </button>
              <button onClick={() => setAccepted(true)}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/20">
                Accept invitation
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-5">
          By accepting you agree to MindSpace Terms of Service
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
}

function CanvasScreen({
  workspace, mapName, userInitials, onBack,
}: {
  workspace: WorkspaceData;
  mapName: string;
  userInitials: string;
  onBack: () => void;
}) {
  const [nodes, setNodes]       = useState<NodeData[]>(INIT_NODES);
  const [edges, setEdges]       = useState<EdgeData[]>(
    INIT_NODES.filter(n => n.parentId).map(n => ({ from: n.parentId!, to: n.id }))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editText, setEditText]     = useState("");
  const [pan, setPan]               = useState({ x: 80, y: 40 });
  const [zoom, setZoom]             = useState(0.78);
  const [showShare, setShowShare]   = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef     = useRef<DragState>({ type: "idle", nodeId: null, startPointer: { x: 0, y: 0 }, startValue: { x: 0, y: 0 } });
  const stateRef    = useRef({ pan, zoom });

  useEffect(() => { stateRef.current = { pan, zoom }; }, [pan, zoom]);

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
    dragRef.current = {
      type: "pan",
      nodeId: null,
      startPointer: { x: e.clientX, y: e.clientY },
      startValue: { ...pan },
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
    };
    setSelectedId(nodeId);
    viewportRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.type === "idle") return;
    const dx = e.clientX - d.startPointer.x;
    const dy = e.clientY - d.startPointer.y;
    if (d.type === "pan") {
      setPan({ x: d.startValue.x + dx, y: d.startValue.y + dy });
    } else if (d.type === "node" && d.nodeId) {
      const z = stateRef.current.zoom;
      setNodes(prev => prev.map(n =>
        n.id === d.nodeId
          ? { ...n, x: d.startValue.x + dx / z, y: d.startValue.y + dy / z }
          : n
      ));
    }
  };

  const handlePointerUp = () => { dragRef.current.type = "idle"; };

  // ── Edit ──

  const startEdit = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setEditingId(nodeId);
    setEditText(node.text);
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
      text: "New idea",
      x: parent.x + 220,
      y: parent.y + (siblings.length * 80) - (siblings.length / 2 * 80),
      color: parent.color,
      parentId,
    };
    setNodes(prev => [...prev, newNode]);
    setEdges(prev => [...prev, { from: parentId, to: newId }]);
    setSelectedId(newId);
    setTimeout(() => startEdit(newId), 30);
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

  // ── Color ──

  const changeColor = (nodeId: string, color: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, color } : n));
  };

  // ── Reset view ──

  const resetView = () => { setPan({ x: 80, y: 40 }); setZoom(0.78); };

  return (
    <div className="size-full flex flex-col overflow-hidden" style={{ background: "#07070F" }}>
      {/* ── Top bar ── */}
      <div className="h-12 flex items-center px-4 gap-3 flex-shrink-0 border-b z-10"
        style={{ background: "#0D0D1C", borderColor: "rgba(255,255,255,0.06)" }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors mr-1"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}>
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.1)" }} />
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{workspace.name}</span>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.15)" }} />
        <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{mapName}</span>

        <div className="flex-1" />

        {/* Collaborator avatars */}
        <div className="flex items-center" style={{ gap: "-6px" }}>
          <div className="flex -space-x-1.5">
            {workspace.members.slice(0, 3).map((m, i) => (
              <div key={m.id} title={m.name}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2"
                style={{ backgroundColor: m.color, borderColor: "#0D0D1C", zIndex: 10 - i }}>
                {m.initials}
              </div>
            ))}
            {workspace.members.length > 3 && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold border-2"
                style={{ backgroundColor: "rgba(255,255,255,0.1)", borderColor: "#0D0D1C", color: "rgba(255,255,255,0.5)" }}>
                +{workspace.members.length - 3}
              </div>
            )}
          </div>
        </div>

        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: "#4F46E5", color: "white" }}>
          <Share2 className="w-3 h-3" />
          Share
        </button>

        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
          {userInitials}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left toolbar ── */}
        <div className="w-12 flex flex-col items-center py-4 gap-2.5 flex-shrink-0 border-r"
          style={{ background: "#0D0D1C", borderColor: "rgba(255,255,255,0.06)" }}>
          <ToolBtn
            onClick={() => selectedId && addChild(selectedId)}
            disabled={!selectedId}
            title="Add child node"
            active>
            <Plus className="w-4 h-4" style={{ color: "#818CF8" }} />
          </ToolBtn>
          <ToolBtn
            onClick={() => selectedId && startEdit(selectedId)}
            disabled={!selectedId}
            title="Edit label">
            <Pencil className="w-4 h-4" style={{ color: "rgba(255,255,255,0.35)" }} />
          </ToolBtn>
          <ToolBtn
            onClick={() => selectedId && selectedId !== "root" && deleteNode(selectedId)}
            disabled={!selectedId || selectedId === "root"}
            title="Delete node"
            danger>
            <Trash2 className="w-4 h-4" style={{ color: "#F87171" }} />
          </ToolBtn>
          <div className="w-5 h-px my-1" style={{ background: "rgba(255,255,255,0.07)" }} />
          <ToolBtn onClick={() => setZoom(z => Math.min(3, z * 1.15))} title="Zoom in">
            <ZoomIn className="w-4 h-4" style={{ color: "rgba(255,255,255,0.35)" }} />
          </ToolBtn>
          <ToolBtn onClick={() => setZoom(z => Math.max(0.15, z / 1.15))} title="Zoom out">
            <ZoomOut className="w-4 h-4" style={{ color: "rgba(255,255,255,0.35)" }} />
          </ToolBtn>
          <ToolBtn onClick={resetView} title="Fit view">
            <Maximize2 className="w-4 h-4" style={{ color: "rgba(255,255,255,0.35)" }} />
          </ToolBtn>
        </div>

        {/* ── Canvas viewport ── */}
        <div
          ref={viewportRef}
          className="flex-1 relative overflow-hidden select-none"
          style={{ cursor: "default", touchAction: "none" }}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Dot grid */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
            backgroundPosition: `${pan.x % (22 * zoom)}px ${pan.y % (22 * zoom)}px`,
          }} />

          {/* Canvas world */}
          <div
            className="absolute"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: 2400,
              height: 1600,
            }}
          >
            {/* SVG edges */}
            <svg className="absolute inset-0 pointer-events-none" width={2400} height={1600}>
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
            </svg>

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
              />
            ))}
          </div>

          {/* Zoom label */}
          <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-lg text-xs font-mono"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}>
            {Math.round(zoom * 100)}%
          </div>

          {/* Hint when idle */}
          {!selectedNode && !editingId && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs pointer-events-none"
              style={{ color: "rgba(255,255,255,0.15)" }}>
              Click to select · Double-click to edit · Scroll to zoom · Drag canvas to pan
            </div>
          )}

          {/* Bottom context bar when node selected */}
          {selectedNode && !editingId && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl shadow-2xl"
              style={{ background: "#1A1A2E", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-xs max-w-[100px] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                {selectedNode.text}
              </span>
              <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.1)" }} />
              {/* Color swatches */}
              <div className="flex items-center gap-1">
                {NODE_COLORS.map(c => (
                  <button key={c} onClick={() => changeColor(selectedId!, c)}
                    className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-125"
                    style={{ backgroundColor: c, borderColor: selectedNode.color === c ? "white" : "transparent" }} />
                ))}
              </div>
              <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.1)" }} />
              <button onClick={() => addChild(selectedId!)}
                className="flex items-center gap-1 text-xs font-semibold transition-colors"
                style={{ color: "#818CF8" }}>
                <Plus className="w-3 h-3" />Child
              </button>
              <button onClick={() => startEdit(selectedId!)}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                <Pencil className="w-3 h-3" />
              </button>
              {selectedId !== "root" && (
                <>
                  <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <button onClick={() => deleteNode(selectedId!)}
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
          <div className="w-52 flex flex-col py-5 px-4 flex-shrink-0 border-l"
            style={{ background: "#0D0D1C", borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.25)" }}>
              Node
            </p>

            <div className="space-y-5">
              <div>
                <p className="text-[10px] mb-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>Label</p>
                <p className="text-sm font-medium leading-snug" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {selectedNode.text}
                </p>
              </div>

              <div>
                <p className="text-[10px] mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Color</p>
                <div className="grid grid-cols-4 gap-2">
                  {NODE_COLORS.map(c => (
                    <button key={c} onClick={() => changeColor(selectedId!, c)}
                      className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c + "30", borderColor: selectedNode.color === c ? c : c + "40" }} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Actions</p>
                <div className="space-y-1.5">
                  <button onClick={() => addChild(selectedId!)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818CF8" }}>
                    <Plus className="w-3.5 h-3.5" />
                    Add child node
                  </button>
                  <button onClick={() => startEdit(selectedId!)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                    <Pencil className="w-3.5 h-3.5" />
                    Edit label
                  </button>
                  {selectedId !== "root" && (
                    <button onClick={() => deleteNode(selectedId!)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete node
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showShare && <ShareModal workspace={workspace} onClose={() => setShowShare(false)} />}
    </div>
  );
}

// ─── Mind Node component ─────────────────────────────────────────────────────

function MindNode({
  node, selected, editing, editText,
  onPointerDown, onDoubleClick, onEditChange, onEditCommit, onEditCancel,
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
}) {
  const isRoot = node.id === "root";

  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="absolute"
      style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)", cursor: "grab", userSelect: "none" }}
    >
      {editing ? (
        <div className="rounded-xl overflow-hidden"
          style={{ border: `2px solid ${node.color}`, background: node.color + "20" }}>
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
            className="px-4 py-2.5 bg-transparent text-sm font-medium focus:outline-none min-w-[120px]"
            style={{ color: "rgba(255,255,255,0.9)", caretColor: node.color }}
          />
        </div>
      ) : (
        <div
          className="transition-all duration-100"
          style={{
            padding: isRoot ? "10px 18px" : "8px 16px",
            borderRadius: 12,
            background: selected ? node.color + "28" : node.color + "16",
            border: selected ? `2px solid ${node.color}` : `1px solid ${node.color}50`,
            boxShadow: selected ? `0 0 0 3px ${node.color}20, 0 8px 32px ${node.color}18` : undefined,
            minWidth: isRoot ? 170 : 100,
          }}
        >
          <span
            className="text-sm font-medium whitespace-nowrap"
            style={{ color: "rgba(255,255,255,0.82)" }}
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
          ? "rgba(99,102,241,0.18)"
          : danger
          ? "rgba(239,68,68,0.1)"
          : "transparent",
        border: active
          ? "1px solid rgba(99,102,241,0.3)"
          : danger
          ? "1px solid rgba(239,68,68,0.2)"
          : "1px solid rgba(255,255,255,0.07)",
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
