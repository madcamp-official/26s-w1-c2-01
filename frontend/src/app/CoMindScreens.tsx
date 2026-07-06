import React, { useState, useRef, useEffect } from "react";
import { api, ApiBlock, ApiComment, ApiInvitation, ApiRecommendation, ApiUserSearchResult } from "../api/client";
import {
  Plus, Share2, Check, X, ArrowLeft, ZoomIn, ZoomOut,
  Trash2, Brain, LogOut, UserPlus, UserX, Bell, ChevronRight,
  Maximize2, Pencil, GitBranch, LocateFixed,
  ListTree,
  MessageCircle, SlidersHorizontal, CheckCircle2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type Role = "owner" | "editor" | "viewer";

export interface MemberData {
  id: string; name: string; email: string;
  role: Role; initials: string; color: string; userId?: number;
}
export interface MapData { id: string; name: string; nodeCount: number; updatedAt: string; }
export interface WorkspaceData { id: string; name: string; members: MemberData[]; maps: MapData[]; ownerId?: number; currentRole?: Role; }
export interface NodeData { id: string; text: string; x: number; y: number; color: string; parentId: string | null; }
interface EdgeData { from: string; to: string; }
interface CommentData { id: string; nodeId: string; authorId?: number; author: string; content: string; solved: boolean; }

// ─── Static data ────────────────────────────────────────────────────────────

const NODE_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6"];

const API_COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1", violet: "#8b5cf6", cyan: "#06b6d4", emerald: "#10b981",
  amber: "#f59e0b", red: "#ef4444", pink: "#ec4899", blue: "#3b82f6",
};
const HEX_API_COLOR = Object.fromEntries(Object.entries(API_COLOR_HEX).map(([name, hex]) => [hex, name]));

function blocksToLocalNodes(blocks: ApiBlock[]): NodeData[] {
  // 좌표는 서버 공유 대상이 아니므로 매번 사용자별 로컬 레이아웃으로 계산한다.
  // 형제 개수만 보고 중앙 정렬하던 이전 방식은 가지마다 하위 트리 크기가 다르면
  // 겹침이 생겨서, 각 노드가 차지할 하위 트리 전체 폭(subtree span)을 먼저 구하고
  // 그 폭만큼 세로 공간을 배분하는 방식으로 바꿔 처음 진입 시에도 겹치지 않게 한다.
  const byParent = new Map<number | null, ApiBlock[]>();
  blocks.forEach(block => byParent.set(block.parent_block_id, [...(byParent.get(block.parent_block_id) ?? []), block]));

  const unitHeight = 120;
  const subtreeUnits = (block: ApiBlock): number => {
    const children = byParent.get(block.id) ?? [];
    return children.length === 0 ? 1 : children.reduce((sum, child) => sum + subtreeUnits(child), 0);
  };

  const result: NodeData[] = [];
  const place = (block: ApiBlock, depth: number, top: number): number => {
    const span = subtreeUnits(block) * unitHeight;
    result.push({
      id: String(block.id), parentId: block.parent_block_id === null ? null : String(block.parent_block_id),
      text: block.content, color: API_COLOR_HEX[block.color] ?? API_COLOR_HEX.indigo,
      x: 600 + depth * 250, y: top + span / 2,
    });
    let cursor = top;
    (byParent.get(block.id) ?? []).forEach(child => { cursor = place(child, depth + 1, cursor); });
    return top + span;
  };

  let cursor = 0;
  (byParent.get(null) ?? []).forEach(root => { cursor = place(root, 0, cursor); });

  // 긴 텍스트로 노드 폭이 커져 여전히 겹치는 경우를 대비한 마지막 안전망
  return relaxNodeCollisions(result);
}

const apiCommentToLocal = (comment: ApiComment): CommentData => ({
  id: String(comment.id), nodeId: String(comment.block_id), authorId: comment.author.id,
  author: comment.author.name, content: comment.content, solved: comment.solved,
});

const MEMBER_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

// ─── 워크스페이스 화면 실시간(WebSocket) 이벤트 반영 ─────────────────────────
// 워크스페이스/멤버/마인드맵 목록 변경을 로컬 workspaces 배열에 순수 함수로 반영한다.
function applyWorkspaceRealtimeEvent(prev: WorkspaceData[], data: any, currentUserId?: number): WorkspaceData[] {
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
            members: w.members.map(item => item.id === memberId ? { ...item, role: m.role } : item),
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

// ─── Login Screen ───────────────────────────────────────────────────────────

// 로그인 화면 왼쪽 패널을 채우는 장식 요소. 실제 데이터가 아니라 브랜딩용 정적 배치이므로 모듈 스코프 상수로 둔다.
// 로고(좌상단, x<26% y<15%)와 헤드라인 텍스트가 흐르는 가운데 밴드(대략 x<60%, y 26~78%)만 비워두고,
// 그 위/아래 여백과 오른쪽 세로줄에는 촘촘히 배치해 밀도를 확보한다.
const LOGIN_FLOATERS = [
  { x: 60, y: 8,  w: 62, color: "#ef4444", label: "구축" },
  { x: 78, y: 5,  w: 60, color: "#06b6d4", label: "연결" },
  { x: 92, y: 14, w: 70, color: "#8b5cf6", label: "브레인스토밍" },
  { x: 12, y: 20, w: 58, color: "#f59e0b", label: "메모" },
  { x: 34, y: 18, w: 56, color: "#3b82f6", label: "흐름" },
  { x: 82, y: 28, w: 60, color: "#f59e0b", label: "정리" },
  { x: 92, y: 40, w: 58, color: "#8b5cf6", label: "탐색" },
  { x: 78, y: 52, w: 60, color: "#3b82f6", label: "생각" },
  { x: 90, y: 64, w: 58, color: "#ef4444", label: "구상" },
  { x: 80, y: 76, w: 56, color: "#10b981", label: "기록" },
  { x: 92, y: 88, w: 58, color: "#ec4899", label: "공유" },
  { x: 6,  y: 86, w: 62, color: "#6366f1", label: "아이디어" },
  { x: 26, y: 92, w: 62, color: "#ec4899", label: "동기화" },
  { x: 50, y: 88, w: 58, color: "#6366f1", label: "확장" },
  { x: 66, y: 82, w: 58, color: "#8b5cf6", label: "발산" },
];

const LOGIN_SPARKLES = [
  { x: 62, y: 48, size: 15, color: "#f59e0b" },
  { x: 90, y: 55, size: 12, color: "#10b981" },
  { x: 78, y: 88, size: 16, color: "#3b82f6" },
  { x: 52, y: 6,  size: 11, color: "#8b5cf6" },
  { x: 86, y: 9,  size: 13, color: "#06b6d4" },
  { x: 16, y: 32, size: 12, color: "#ec4899" },
  { x: 70, y: 20, size: 10, color: "#6366f1" },
  { x: 96, y: 30, size: 9,  color: "#3b82f6" },
];

function SparkleIcon({ className, style, fill }: { className?: string; style?: React.CSSProperties; fill: string }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill={fill}>
      <path d="M12 2 L13.4 9.8 L21 12 L13.4 14.2 L12 22 L10.6 14.2 L3 12 L10.6 9.8 Z" />
    </svg>
  );
}

export function LoginScreen({ onLogin }: { onLogin: (name: string, email: string, password: string, isSignUp: boolean) => Promise<void> | void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inp = [
    "w-full px-4 py-3 rounded-2xl text-sm text-[#0D0D14] placeholder-[#C0BFC8] bg-[#FAFAFA]",
    "border-2 border-[#E2E0F0] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all",
  ].join(" ");

  const submit = async () => {
    setSubmitting(true); setError("");
    try { await onLogin(name, email, password, isSignUp); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "로그인에 실패했습니다"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex">
      {/* ══ 왼쪽 패널: 브랜딩 ══ */}
      <div className="hidden lg:flex w-[46%] flex-col p-14 relative overflow-hidden flex-shrink-0" style={{ background: "#0D0D14" }}>
        {/* 은은한 색 번짐 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute rounded-full" style={{ width: 520, height: 520, top: -160, right: -60, background: "#6366f1", filter: "blur(110px)", opacity: 0.22 }} />
          <div className="absolute rounded-full" style={{ width: 560, height: 560, bottom: -180, left: -80, background: "#06b6d4", filter: "blur(120px)", opacity: 0.14 }} />
          <div className="absolute rounded-full" style={{ width: 360, height: 360, top: "38%", left: "28%", background: "#8b5cf6", filter: "blur(100px)", opacity: 0.16, transform: "translate(-50%,-50%)" }} />
          <div className="absolute rounded-full" style={{ width: 300, height: 300, bottom: "20%", right: "18%", background: "#f59e0b", filter: "blur(90px)", opacity: 0.10 }} />
          {/* 헤드라인이 놓이는 자리만 살짝 어둡게 - 딱 떨어지는 박스가 아니라 다른 색 번짐과 같은 방식의 부드러운 비네트 */}
          <div className="absolute" style={{
            width: 640, height: 460, top: "50%", left: "8%",
            background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, transparent 72%)",
            transform: "translate(-18%,-50%)",
          }} />
        </div>

        {/* 점 그리드 */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.065) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />

        {/* 떠다니는 노드 뱃지: 실제 UI 문구와 헷갈리지 않도록 아주 옅은 톤으로만 배치 */}
        {LOGIN_FLOATERS.map((f, i) => (
          <div key={i} className="absolute pointer-events-none flex items-center justify-center"
            style={{ left: `${f.x}%`, top: `${f.y}%`, width: f.w, height: 26, borderRadius: 999, background: f.color + "10", border: `1px solid ${f.color}2a` }}>
            <span className="text-[10px] font-medium tracking-wide" style={{ color: f.color + "70" }}>{f.label}</span>
          </div>
        ))}

        {/* 반짝이 */}
        {LOGIN_SPARKLES.map((s, i) => (
          <SparkleIcon key={i} fill={s.color} className="absolute pointer-events-none"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: 0.4 }} />
        ))}

        {/* 로고 */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 24px rgba(99,102,241,0.45)" }}>
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-black text-xl tracking-tight">CoMind</span>
        </div>

        {/* 헤드라인 + 기능 뱃지: 티 나는 박스 대신, 뒤쪽 비네트와 옅어진 떠다니는 뱃지로만 대비를 준다.
            워드마크를 없애 flex 자식이 로고 하나만 남았으므로, 남은 세로 공간 안에서 직접 가운데 정렬한다. */}
        <div className="relative z-10 flex-1 flex flex-col justify-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold w-fit"
            style={{ background: "rgba(99,102,241,0.18)", border: "1.5px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
            <span className="w-2 h-2 rounded-full bg-indigo-400" style={{ boxShadow: "0 0 6px #818cf8" }} />
            실시간 협업 지원 중
          </div>

          <h1 className="text-[3.4rem] font-black leading-[1.15] tracking-tight" style={{ textShadow: "0 4px 28px rgba(0,0,0,0.5)" }}>
            <span className="text-white">함께 생각하고,</span><br />
            <span style={{ background: "linear-gradient(90deg, #818cf8 0%, #a78bfa 45%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              모든 것을 연결하세요.
            </span>
          </h1>

          <p className="text-white/60 text-lg leading-relaxed max-w-[350px]" style={{ textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}>
            팀을 위한 공유 캔버스에서 아이디어를 실시간으로 만들고 연결하며 확장하세요.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { label: "실시간 동기화", color: "#6366f1" },
              { label: "무제한 노드", color: "#06b6d4" },
              { label: "팀 워크스페이스", color: "#8b5cf6" },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: f.color + "2e", border: `1.5px solid ${f.color}70`, color: "white" }}>
                <Check className="w-3 h-3" />
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ 오른쪽 패널: 폼 ══ */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden" style={{ background: "#F8F7F4" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.055) 1.5px, transparent 1.5px)", backgroundSize: "22px 22px" }} />

        <svg className="absolute top-7 right-7 opacity-20 pointer-events-none" width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="32" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="5 5" />
          <circle cx="36" cy="36" r="20" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5 5" />
          <circle cx="36" cy="36" r="8"  fill="none" stroke="#06b6d4" strokeWidth="1.5" />
        </svg>
        <svg className="absolute top-10 left-10 opacity-15 pointer-events-none" width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="17" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />
        </svg>
        <svg className="absolute bottom-12 right-16 opacity-15 pointer-events-none" width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="21" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 4" />
        </svg>
        <svg className="absolute top-1/4 left-1/4 opacity-12 pointer-events-none" width="34" height="34" viewBox="0 0 34 34">
          <circle cx="17" cy="17" r="14" fill="none" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="3 4" />
        </svg>
        <svg className="absolute bottom-1/3 left-20 opacity-12 pointer-events-none" width="30" height="30" viewBox="0 0 30 30">
          <circle cx="15" cy="15" r="12" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 4" />
        </svg>
        <SparkleIcon fill="#6366f1" className="absolute bottom-8 left-8 opacity-15 pointer-events-none" style={{ width: 28, height: 28 }} />
        <SparkleIcon fill="#8b5cf6" className="absolute top-1/3 left-5 opacity-12 pointer-events-none" style={{ width: 20, height: 20 }} />
        <SparkleIcon fill="#f59e0b" className="absolute top-16 right-1/3 opacity-15 pointer-events-none" style={{ width: 16, height: 16 }} />
        <SparkleIcon fill="#06b6d4" className="absolute bottom-1/4 right-10 opacity-15 pointer-events-none" style={{ width: 22, height: 22 }} />
        <SparkleIcon fill="#ec4899" className="absolute top-1/2 right-6 opacity-12 pointer-events-none" style={{ width: 14, height: 14 }} />
        <SparkleIcon fill="#3b82f6" className="absolute bottom-10 left-1/3 opacity-12 pointer-events-none" style={{ width: 18, height: 18 }} />
        <SparkleIcon fill="#10b981" className="absolute top-6 left-1/2 opacity-12 pointer-events-none" style={{ width: 15, height: 15 }} />
        <SparkleIcon fill="#f59e0b" className="absolute bottom-6 right-1/4 opacity-12 pointer-events-none" style={{ width: 17, height: 17 }} />
        <SparkleIcon fill="#8b5cf6" className="absolute top-2/3 left-16 opacity-12 pointer-events-none" style={{ width: 13, height: 13 }} />
        <SparkleIcon fill="#6366f1" className="absolute top-10 right-1/4 opacity-12 pointer-events-none" style={{ width: 12, height: 12 }} />
        {[
          { top: "18%", left: "60%", color: "#6366f1" },
          { top: "72%", left: "42%", color: "#06b6d4" },
          { top: "40%", left: "88%", color: "#f59e0b" },
          { top: "85%", left: "22%", color: "#8b5cf6" },
        ].map((d, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none"
            style={{ top: d.top, left: d.left, width: 6, height: 6, background: d.color, opacity: 0.25 }} />
        ))}

        <div className="w-full max-w-[400px] relative z-10">
          {/* 모바일 로고 */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Brain className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-black text-xl text-[#0D0D14]">CoMind</span>
          </div>

          {/* 폼 카드 */}
          <div className="bg-white rounded-3xl overflow-hidden"
            style={{ boxShadow: "0 12px 50px rgba(99,102,241,0.14), 0 2px 12px rgba(0,0,0,0.06)", border: "1.5px solid rgba(99,102,241,0.1)" }}>
            <div className="h-1.5" style={{ background: "linear-gradient(90deg, #4F46E5 0%, #7C3AED 40%, #06b6d4 100%)" }} />

            <div className="px-7 pt-6 pb-7">
              <div className="mb-6">
                <h2 className="text-[1.75rem] font-black text-[#0D0D14] tracking-tight leading-tight mb-1.5">
                  {isSignUp ? "계정 만들기" : "다시 만나 반가워요"}
                </h2>
                <p className="text-sm" style={{ color: "#888" }}>
                  {isSignUp ? "팀과 함께 마인드맵을 시작하세요" : "워크스페이스에 로그인하세요"}
                </p>
              </div>

              <div className="space-y-3.5">
                {isSignUp && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#6366f1" }}>이름</label>
                    <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력하세요" />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#6366f1" }}>이메일</label>
                  <input className={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#6366f1" }}>비밀번호</label>
                  <input type="password" className={inp} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    onKeyDown={e => e.key === "Enter" && submit()} />
                </div>

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button
                  onClick={submit}
                  disabled={submitting}
                  className="w-full py-3.5 rounded-2xl text-white text-sm font-black tracking-wide transition-all hover:opacity-90 hover:shadow-xl mt-1 disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg, #4F46E5 0%, #7C3AED 55%, #06b6d4 100%)", boxShadow: "0 6px 24px rgba(79,70,229,0.38)" }}
                >
                  {submitting ? "처리 중..." : isSignUp ? "계정 만들기 →" : "로그인 →"}
                </button>
              </div>

              <p className="mt-4 text-center text-sm" style={{ color: "#888" }}>
                {isSignUp ? "이미 계정이 있나요? " : "처음이신가요? "}
                <button onClick={() => setIsSignUp(s => !s)} className="font-black" style={{ color: "#6366f1" }}>
                  {isSignUp ? "로그인" : "계정 만들기"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Workspace Screen ────────────────────────────────────────────────────────

export function WorkspaceScreen({
  user, onOpenCanvas, onViewInvitation, onLogout, onDeleteAccount, initialWorkspaces = [], pendingInvitationCount = 0, onMemberRoleChange, onInvite,
  onWorkspaceRename, onWorkspaceDelete, onMemberRemove, onWorkspaceLeave, onMapRename, onMapDelete,
}: {
  user: { id?: number; name: string; email: string };
  onOpenCanvas: (ws: WorkspaceData, map: MapData) => void;
  onViewInvitation: () => void;
  onLogout: () => void;
  onDeleteAccount?: () => Promise<void>;
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
  const [deletingAccount, setDeletingAccount] = useState(false);

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
      <header className="h-14 bg-white border-b border-[#E8E7EA] flex items-center px-5 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-[#0D0D14] tracking-tight">CoMind</span>
        </div>

        <div className="flex-1" />

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
        {ws ? (
          <>
            <main className="flex-1 overflow-y-auto p-8">
              <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="flex items-center gap-1">
                      <h1 className="text-2xl font-semibold text-[#0D0D14] tracking-tight">{ws.name}</h1>
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
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-600/20">
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

// ─── Share Modal ────────────────────────────────────────────────────────────

function ShareModal({ workspace, onClose, onInvite }: {
  workspace: WorkspaceData;
  onClose: () => void;
  onInvite?: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<"editor" | "viewer">("editor");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError]   = useState("");
  const [suggestions, setSuggestions] = useState<ApiUserSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    const query = inviteEmail.trim();
    if (query.length < 2) { setSuggestions([]); return; }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const results = await api.searchUsers(query).catch(() => []);
      if (searchSeq.current === seq) setSuggestions(results);
    }, 250);
    return () => clearTimeout(timer);
  }, [inviteEmail]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || status === "sending") return;
    setStatus("sending"); setError(""); setShowSuggestions(false);
    try {
      await onInvite?.(workspace.id, email, inviteRole);
      setStatus("sent");
      setInviteEmail("");
      setSuggestions([]);
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "초대에 실패했습니다");
    }
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
              <div className="relative flex-1">
                <input value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setStatus("idle"); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                  placeholder="동료의 이메일 주소"
                  onKeyDown={e => e.key === "Enter" && handleInvite()}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all" />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E8E7EA] rounded-xl shadow-lg z-10 overflow-hidden max-h-48 overflow-y-auto">
                    {suggestions.map(candidate => (
                      <button key={candidate.id} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setInviteEmail(candidate.email); setSuggestions([]); setShowSuggestions(false); }}
                        className="w-full flex flex-col items-start px-3.5 py-2 text-left hover:bg-[#F3F2F6] transition-colors">
                        <span className="text-sm font-medium text-[#0D0D14]">{candidate.name}</span>
                        <span className="text-xs text-[#717182]">{candidate.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as "editor" | "viewer")}
                className="px-3 py-2 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none bg-white text-[#0D0D14]">
                <option value="editor">편집자</option>
                <option value="viewer">뷰어</option>
              </select>
            </div>
            <button onClick={handleInvite} disabled={!inviteEmail.trim() || status === "sending"}
              className="mt-2.5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              <UserPlus className="w-4 h-4" />
              {status === "sending" ? "보내는 중..." : "초대 보내기"}
            </button>
            {status === "sent" && <p className="mt-2 text-xs text-emerald-600">초대를 보냈습니다.</p>}
            {status === "error" && <p className="mt-2 text-xs text-red-500">{error}</p>}
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
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true); setError("");
    try { await onCreate(name.trim()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "워크스페이스 생성에 실패했습니다"); }
    finally { setSubmitting(false); }
  };

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
              onKeyDown={e => e.key === "Enter" && submit()}
              className="w-full px-4 py-3 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all" />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E0DFE0] text-sm text-[#717182] hover:bg-[#F3F2F6] font-medium transition-colors">
              취소
            </button>
            <button onClick={submit}
              disabled={!name.trim() || submitting}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40">
              {submitting ? "만드는 중..." : "만들기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateMindMapModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true); setError("");
    try { await onCreate(name.trim()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "마인드맵 생성에 실패했습니다"); }
    finally { setSubmitting(false); }
  };

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
              onKeyDown={e => e.key === "Enter" && submit()}
              className="w-full px-4 py-3 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all" />
            <p className="mt-2 text-xs text-[#ABABAB]">같은 이름의 루트 노드가 함께 생성됩니다.</p>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E0DFE0] text-sm text-[#717182] hover:bg-[#F3F2F6] font-medium transition-colors">
              취소
            </button>
            <button onClick={submit}
              disabled={!name.trim() || submitting}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40">
              {submitting ? "만드는 중..." : "만들기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, description, confirmLabel, onCancel, onConfirm, danger }: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  danger?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#E8E7EA] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-[#0D0D14]">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#717182]">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border border-[#E0DFE0] px-4 py-2 text-sm font-medium text-[#717182]">취소</button>
          <button disabled={submitting} onClick={async () => { setSubmitting(true); try { await onConfirm(); } finally { setSubmitting(false); } }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${danger ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"}`}>
            {submitting ? (danger ? "삭제 중..." : "변경 중...") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountModal({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true); setError("");
    try { await onConfirm(); }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : "회원 탈퇴에 실패했습니다");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#E8E7EA] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-[#0D0D14]">정말 탈퇴하시겠어요?</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#717182]">
          계정을 삭제하면 더 이상 로그인할 수 없고, 이 작업은 되돌릴 수 없습니다.
        </p>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border border-[#E0DFE0] px-4 py-2 text-sm font-medium text-[#717182]">취소</button>
          <button disabled={submitting} onClick={submit}
            className="rounded-xl bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? "탈퇴 중..." : "회원 탈퇴"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RenameModal({ title, label, initialName, submitLabel = "저장", onClose, onSubmit }: {
  title: string;
  label: string;
  initialName: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true); setError("");
    try { await onSubmit(name.trim()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "이름 변경에 실패했습니다"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-[#E8E7EA]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF4]">
          <h3 className="font-semibold text-[#0D0D14]">{title}</h3>
          <button onClick={onClose} aria-label="닫기"
            className="w-7 h-7 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#717182]" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-1.5">{label}</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              className="w-full px-4 py-3 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all" />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E0DFE0] text-sm text-[#717182] hover:bg-[#F3F2F6] font-medium transition-colors">
              취소
            </button>
            <button onClick={submit}
              disabled={!name.trim() || submitting}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40">
              {submitting ? "저장 중..." : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invitation Screen ───────────────────────────────────────────────────────

export function InvitationScreen({ invitations, onAccept, onReject, onClose }: {
  invitations: ApiInvitation[];
  onAccept: (invitationId: number) => Promise<void>;
  onReject: (invitationId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  const act = async (invitationId: number, action: (id: number) => Promise<void>) => {
    if (busyId) return;
    setBusyId(invitationId);
    try { await action(invitationId); }
    finally { setBusyId(null); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#E8E7EA]">
          <button onClick={onClose} aria-label="나가기"
            className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full bg-white/15 border border-white/20 hover:bg-white/25 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
          {/* Header band */}
          <div className="px-8 pt-10 pb-8 text-center"
            style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}>
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/20">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-1 tracking-tight">받은 초대</h1>
            <p className="text-white/60 text-sm">
              {invitations.length ? `${invitations.length}개의 워크스페이스 초대가 있어요` : "CoMind에서 팀과 함께 아이디어를 펼쳐보세요"}
            </p>
          </div>

          <div className="px-8 py-6 max-h-[60vh] overflow-y-auto space-y-4">
            {invitations.length === 0 && (
              <p className="text-center text-sm text-[#717182] py-6">받은 초대가 없습니다.</p>
            )}
            {invitations.map(invitation => (
              <div key={invitation.id} className="p-4 rounded-2xl border border-[#E8E7EA] bg-[#F8F7F4]">
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="relative w-11 h-11 flex-shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center font-bold text-indigo-700">
                      {invitation.workspace.name[0]}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 border-2 border-[#F8F7F4] flex items-center justify-center text-white text-[9px] font-bold">
                      {invitation.inviter.name.split(" ").map(part => part[0]).join("")}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0D0D14] truncate">{invitation.workspace.name}</p>
                    <p className="text-xs text-[#717182] truncate">
                      <span className="font-medium text-[#4B4B57]">{invitation.inviter.name}</span>님이 초대함 · {invitation.role === "editor" ? "편집자" : "뷰어"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button disabled={busyId === invitation.id} onClick={() => act(invitation.id, onReject)}
                    className="flex-1 py-2.5 rounded-xl border border-[#E0DFE0] text-sm text-[#717182] hover:bg-[#F3F2F6] font-medium transition-colors disabled:opacity-50">
                    거절
                  </button>
                  <button disabled={busyId === invitation.id} onClick={() => act(invitation.id, onAccept)}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/20 disabled:opacity-50">
                    {busyId === invitation.id ? "처리 중..." : "초대 수락"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-[#ABABAB] mt-5">
          수락하면 CoMind 이용약관에 동의하는 것으로 간주됩니다
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
  const isRoot = node.parentId === null;
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
  const root = result.find(node => node.parentId === null);
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
  workspace, mapId, mapName, userInitials, currentUserId, currentRole = workspace.currentRole ?? "editor", onBack, onInvite, onLogout,
  onDeleteAccount, onMapRename, onMapDelete,
}: {
  workspace: WorkspaceData;
  mapId: string;
  mapName: string;
  userInitials: string;
  currentUserId?: number;
  currentRole?: Role;
  onBack: () => void;
  onInvite?: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onLogout?: () => void;
  onDeleteAccount?: () => Promise<void>;
  onMapRename?: (name: string) => Promise<void>;
  onMapDelete?: () => Promise<void>;
}) {
  const [nodes, setNodes]       = useState<NodeData[]>([]);
  const [edges, setEdges]       = useState<EdgeData[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editText, setEditText]     = useState("");
  const [pan, setPan]               = useState({ x: 80, y: 40 });
  const [zoom, setZoom]             = useState(0.78);
  const [showShare, setShowShare]   = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [renamingMap, setRenamingMap] = useState(false);
  const [deletingMap, setDeletingMap] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isRecentering, setIsRecentering] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationState | null>(null);
  const [recommendationContents, setRecommendationContents] = useState<string[]>([]);
  const [hoveredRecommendationId, setHoveredRecommendationId] = useState<string | null>(null);
  const [acceptingRecommendationId, setAcceptingRecommendationId] = useState<string | null>(null);
  const [isAutoArranging, setIsAutoArranging] = useState(false);
  const [isZoomAnimating, setIsZoomAnimating] = useState(false);
  const [panelMode, setPanelMode] = useState<"controls" | "comments">("controls");
  const [comments, setComments] = useState<CommentData[]>([]);
  const [liveMapName, setLiveMapName] = useState(mapName);
  const [presence, setPresence] = useState<{ id: number; name: string; email: string; selected_block_id: number | null }[]>([]);
  // 소유자가 멤버 역할(편집자/뷰어)을 바꾸면 워크스페이스 채널로 실시간 반영되도록,
  // props로 받은 workspace의 스냅샷을 로컬에 두고 웹소켓 이벤트로 갱신한다
  const [liveWorkspace, setLiveWorkspace] = useState<WorkspaceData>(() => ({ ...workspace, currentRole }));
  useEffect(() => { setLiveWorkspace({ ...workspace, currentRole }); }, [workspace, currentRole]);
  const canEditMap = liveWorkspace.currentRole === "owner" || liveWorkspace.currentRole === "editor";

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef     = useRef<DragState>({ type: "idle", nodeId: null, startPointer: { x: 0, y: 0 }, startValue: { x: 0, y: 0 }, moved: false });
  const stateRef    = useRef({ pan, zoom });
  const nodesRef = useRef(nodes);
  const recommendationDragSourceRef = useRef<string | null>(null);
  const recommendationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationAcceptRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationCommitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationRequestIdRef = useRef(0);
  const recommendationsRef = useRef<RecommendationState | null>(null);
  const onBackRef = useRef(onBack);
  const mapSocketRef = useRef<WebSocket | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => { stateRef.current = { pan, zoom }; }, [pan, zoom]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { recommendationsRef.current = recommendations; }, [recommendations]);
  useEffect(() => { onBackRef.current = onBack; });
  useEffect(() => { setLiveMapName(mapName); }, [mapName]);

  useEffect(() => () => {
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
    if (recommendationRevealRef.current) clearTimeout(recommendationRevealRef.current);
    if (recommendationAcceptRef.current) clearTimeout(recommendationAcceptRef.current);
    if (recommendationCommitRef.current) clearTimeout(recommendationCommitRef.current);
  }, []);

  useEffect(() => {
    setMapLoading(true);
    api.listBlocks(Number(mapId)).then(blocks => {
      const loaded = blocksToLocalNodes(blocks);
      setNodes(loaded); nodesRef.current = loaded;
      setEdges(loaded.filter(node => node.parentId).map(node => ({ from: node.parentId!, to: node.id })));
      // '루트 노드로 돌아가기'와 같은 계산으로, 처음 진입했을 때도 루트 노드가 화면 중앙에 오도록 맞춘다.
      const root = loaded.find(node => node.parentId === null);
      const viewport = viewportRef.current;
      if (root && viewport) {
        const targetZoom = 0.78;
        setZoom(targetZoom);
        setPan({
          x: viewport.clientWidth / 2 - root.x * targetZoom,
          y: viewport.clientHeight / 2 - root.y * targetZoom,
        });
      }
    }).catch(() => { /* TODO: 전역 API 오류 UI */ })
      .finally(() => setMapLoading(false));
    // 노드를 클릭하기 전에도 댓글 개수가 바로 보이도록 맵 전체 댓글을 한 번에 불러온다.
    api.listCommentsByMap(Number(mapId)).then(items => {
      setComments(items.map(apiCommentToLocal));
    }).catch(() => { /* TODO: 전역 API 오류 UI */ });
  }, [mapId]);

  // ── 실시간(WebSocket): 워크스페이스 채널 — 소유자가 내 역할을 바꾸면 새로고침 없이 반영 ──
  useEffect(() => {
    const socket = new WebSocket(api.workspaceSocketUrl(Number(workspace.id)));
    socket.onmessage = event => {
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === "workspace:deleted" || (data.type === "member:removed" && data.userId === currentUserId)) {
        onBackRef.current();
        return;
      }
      setLiveWorkspace(prev => applyWorkspaceRealtimeEvent([prev], data, currentUserId)[0] ?? prev);
    };
    return () => socket.close();
  }, [workspace.id, currentUserId]);

  // ── 실시간(WebSocket): 같은 맵을 보고 있는 다른 사용자의 노드/댓글/추천/접속자 변화를 반영 ──
  useEffect(() => {
    const socket = new WebSocket(api.mapSocketUrl(Number(mapId)));
    mapSocketRef.current = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "selection:update", blockId: selectedIdRef.current ? Number(selectedIdRef.current) : null }));
    };
    socket.onmessage = event => {
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }

      switch (data.type) {
        case "block:created": {
          const block = data.block as ApiBlock;
          const id = String(block.id);
          const parentId = block.parent_block_id === null ? null : String(block.parent_block_id);
          setNodes(prev => {
            if (prev.some(n => n.id === id)) return prev;    // 이미 내 쪽 낙관적 업데이트로 존재
            const parent = prev.find(n => n.id === parentId);
            const siblings = prev.filter(n => n.parentId === parentId);
            const newNode: NodeData = {
              id, text: block.content, color: API_COLOR_HEX[block.color] ?? API_COLOR_HEX.indigo, parentId,
              x: parent ? parent.x + 220 : 600,
              y: parent ? parent.y + (siblings.length * 80) - (siblings.length / 2 * 80) : 370,
            };
            const next = relaxNodeCollisions([...prev, newNode]);
            nodesRef.current = next;
            return next;
          });
          if (parentId) setEdges(prev => prev.some(e => e.to === id) ? prev : [...prev, { from: parentId, to: id }]);
          break;
        }
        case "block:updated":
        case "block:reparented": {
          const block = data.block as ApiBlock;
          const id = String(block.id);
          const parentId = block.parent_block_id === null ? null : String(block.parent_block_id);
          setNodes(prev => prev.map(n => n.id === id
            ? { ...n, text: block.content, color: API_COLOR_HEX[block.color] ?? n.color, parentId }
            : n));
          if (data.type === "block:reparented") {
            setEdges(prev => {
              const filtered = prev.filter(e => e.to !== id);
              return parentId ? [...filtered, { from: parentId, to: id }] : filtered;
            });
          }
          break;
        }
        case "block:deleted": {
          const ids = new Set((data.blockIds as number[]).map(String));
          setNodes(prev => prev.filter(n => !ids.has(n.id)));
          setEdges(prev => prev.filter(e => !ids.has(e.from) && !ids.has(e.to)));
          setSelectedId(prev => prev && ids.has(prev) ? null : prev);
          setEditingId(prev => prev && ids.has(prev) ? null : prev);
          break;
        }
        case "comment:created":
        case "comment:updated":
        case "comment:resolved":
        case "comment:reopened": {
          const local = apiCommentToLocal(data.comment);
          setComments(prev => prev.some(c => c.id === local.id) ? prev.map(c => c.id === local.id ? local : c) : [...prev, local]);
          break;
        }
        case "comment:deleted": {
          const commentId = String(data.commentId);
          setComments(prev => prev.filter(c => c.id !== commentId));
          break;
        }
        case "recommendation:ready": {
          const sourceId = String(data.blockId);
          // 지금 이 노드에 대한 추천을 기다리는 중(아직 펼쳐지지 않음)이었다면, 폴링을 기다리지 않고 바로 반영한다.
          if (recommendationsRef.current?.sourceId === sourceId && !recommendationsRef.current.visible) {
            const items = (data.recommendations as ApiRecommendation[]).slice(0, 3).map(item => item.content);
            setRecommendationContents(items);
            if (recommendationRevealRef.current) clearTimeout(recommendationRevealRef.current);
            recommendationRevealRef.current = setTimeout(() => {
              setRecommendations(current => current && current.sourceId === sourceId ? { ...current, visible: true } : current);
            }, 40);
          }
          break;
        }
        case "presence:update":
          setPresence(data.users);
          break;
        case "map:renamed":
          setLiveMapName(data.name);
          break;
        case "map:deleted":
          onBackRef.current();
          break;
        default:
          break;
      }
    };
    return () => { mapSocketRef.current = null; socket.close(); };
  }, [mapId]);

  // 지금 선택 중인 노드가 바뀔 때마다 다른 접속자에게 알려서, 서로 어떤 노드를 보고 있는지 실시간으로 공유한다.
  useEffect(() => {
    selectedIdRef.current = selectedId;
    const socket = mapSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "selection:update", blockId: selectedId ? Number(selectedId) : null }));
  }, [selectedId]);

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
    clearRecommendations();
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
    } else if (d.type === "node" && d.nodeId && nodesRef.current.find(n => n.id === d.nodeId)?.parentId !== null) {
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
      if (canEditMap) scheduleRecommendations(drag.nodeId);
    } else if (drag.type === "node" && drag.nodeId && drag.moved && recommendationDragSourceRef.current === drag.nodeId) {
      // 접히는 짧은 애니메이션 뒤 드롭된 위치에서 다시 펼친다.
      if (canEditMap) scheduleRecommendations(drag.nodeId, 460, true);
    }
    if (drag.type === "node" && drag.nodeId && drag.moved) settleNodeCollisions(drag.nodeId);
    recommendationDragSourceRef.current = null;
    dragRef.current.type = "idle";
  };

  // ── Edit ──

  const startEdit = (nodeId: string) => {
    if (!canEditMap) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setEditingId(nodeId);
    setEditText(node.text);
    clearRecommendations();
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const content = editText.trim();
    setNodes(prev => prev.map(n => n.id === editingId ? { ...n, text: content || n.text } : n));
    if (content) api.updateBlock(Number(editingId), { content }).catch(() => { /* TODO: optimistic rollback/toast */ });
    setEditingId(null);
  };

  // ── Add child ──

  const addChild = async (parentId: string) => {
    if (!canEditMap) return;
    const parent = nodes.find(n => n.id === parentId)!;
    const siblings = nodes.filter(n => n.parentId === parentId);
    let newId: string;
    try {
      const created = await api.createBlock(Number(mapId), "새 아이디어", Number(parentId), HEX_API_COLOR[parent.color]);
      newId = String(created.id);
    } catch { return; }
    const newNode: NodeData = {
      id: newId,
      text: "새 아이디어",
      x: parent.x + 220,
      y: parent.y + (siblings.length * 80) - (siblings.length / 2 * 80),
      color: parent.color,
      parentId,
    };
    // 이 실행 중에 같은 블록 생성의 WebSocket 이벤트(block:created)가 먼저 도착해 이미 추가돼 있을 수 있으므로,
    // id가 이미 있으면 중복 추가하지 않는다 (그렇지 않으면 같은 노드가 두 개로 겹쳐 보이는 버그가 생긴다).
    setNodes(prev => prev.some(n => n.id === newId) ? prev : [...prev, newNode]);
    setEdges(prev => prev.some(e => e.to === newId) ? prev : [...prev, { from: parentId, to: newId }]);
    setSelectedId(newId);
    setEditingId(newId);
    setEditText(newNode.text);
  };

  // ── Delete ──

  const deleteNode = (nodeId: string) => {
    if (!canEditMap) return;
    const target = nodes.find(n => n.id === nodeId);
    if (!target || target.parentId === null) return;
    const toDelete = new Set<string>();
    const collect = (id: string) => {
      toDelete.add(id);
      nodes.filter(n => n.parentId === id).forEach(c => collect(c.id));
    };
    collect(nodeId);
    setNodes(prev => prev.filter(n => !toDelete.has(n.id)));
    setEdges(prev => prev.filter(e => !toDelete.has(e.from) && !toDelete.has(e.to)));
    setSelectedId(null);
    api.deleteBlock(Number(nodeId)).catch(() => { /* TODO: optimistic rollback/toast */ });
  };

  const requestDelete = (nodeId: string) => {
    const target = nodes.find(n => n.id === nodeId);
    if (target && target.parentId !== null) setPendingDeleteId(nodeId);
  };

  // ── Color ──

  const changeColor = (nodeId: string, color: string) => {
    if (!canEditMap) return;
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, color } : n));
    api.updateBlock(Number(nodeId), { color: HEX_API_COLOR[color] }).catch(() => { /* TODO: optimistic rollback/toast */ });
  };

  const autoArrangeChildren = (parentId: string) => {
    const parent = nodes.find(node => node.id === parentId);
    const children = nodes.filter(node => node.parentId === parentId);
    if (!parent || children.length === 0) return;

    const root = nodes.find(node => node.parentId === null) ?? parent;
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
        target.x = parentNode.x + direction * (parentNode.parentId === null ? 290 : 240);
        target.y = cursor + span / 2;
        cursor += span;
        const descendants = childNodes(child.id);
        if (descendants.length) layoutGroup(target, descendants, direction);
      });
    };

    if (parent.parentId === null) {
      const left = children.filter(child => child.x < parent.x);
      const right = children.filter(child => child.x >= parent.x);
      if (left.length) layoutGroup(byId.get(parentId)!, left, -1);
      if (right.length) layoutGroup(byId.get(parentId)!, right, 1);
    } else {
      layoutGroup(byId.get(parentId)!, children, parent.x >= root.x ? 1 : -1);
    }

    const next = relaxNodeCollisions(arranged, new Set([parentId]));

    clearRecommendations();
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

  const clearRecommendations = () => {
    recommendationRequestIdRef.current += 1;
    setRecommendations(null);
    setRecommendationContents([]);
  };

  const loadRecommendationsFor = async (nodeId: string) => {
    const requestId = ++recommendationRequestIdRef.current;
    const blockId = Number(nodeId);
    let attempts = 0;
    const maxAttempts = 10;
    while (requestId === recommendationRequestIdRef.current && attempts < maxAttempts) {
      const items = await api.getRecommendations(blockId).catch(() => []);
      if (requestId !== recommendationRequestIdRef.current) return;
      if (items.length) {
        setRecommendationContents(items.slice(0, 3).map(item => item.content));
        // 추천 단어(10~20초 소요)가 준비된 뒤에야 펼쳐지는 애니메이션을 재생한다.
        // 준비되기 전에 미리 재생해두면 내용이 도착했을 때 애니메이션 없이 바로 나타나 버린다.
        recommendationRevealRef.current = setTimeout(() => {
          setRecommendations(current => current && current.sourceId === nodeId ? { ...current, visible: true } : current);
        }, 40);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) await new Promise(resolve => setTimeout(resolve, 1500));
    }
  };

  const scheduleRecommendations = (nodeId: string, delay = 720, preserveCollapsing = false) => {
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
    if (recommendationRevealRef.current) clearTimeout(recommendationRevealRef.current);
    if (!preserveCollapsing) clearRecommendations();
    setHoveredRecommendationId(null);
    setAcceptingRecommendationId(null);

    recommendationTimerRef.current = setTimeout(() => {
      const source = nodesRef.current.find(node => node.id === nodeId);
      if (!source) return;
      // 추천 단어가 도착하기 전까지는 visible: false로 멈춰두고, 내용이 준비되면 펼쳐진다.
      setRecommendations({ sourceId: nodeId, sourceX: source.x, sourceY: source.y, visible: false });
      loadRecommendationsFor(nodeId);
    }, delay);
  };

  const acceptRecommendation = (item: RecommendationItem) => {
    if (!canEditMap || !recommendationSource || acceptingRecommendationId) return;
    const parentId = recommendationSource.id;
    setAcceptingRecommendationId(item.id);

    // 먼저 확대하고, 원래 크기로 돌아온 순간 실제 노드로 확정한다.
    recommendationAcceptRef.current = setTimeout(() => {
      setAcceptingRecommendationId(null);
    }, 180);
    recommendationCommitRef.current = setTimeout(async () => {
      try {
        const created = await api.applyRecommendation(Number(parentId), item.text);
        const newId = String(created.id);
        // block:created WebSocket 이벤트가 먼저 도착해 이미 추가돼 있을 수 있으므로 중복 추가 방지
        setNodes(prev => prev.some(n => n.id === newId) ? prev : [...prev, {
          id: newId,
          text: item.text,
          x: item.x,
          y: item.y,
          color: item.color,
          parentId,
        }]);
        setEdges(prev => prev.some(e => e.to === newId) ? prev : [...prev, { from: parentId, to: newId }]);
        setSelectedId(newId);
      } catch { /* TODO: 실패 토스트 */ }
      finally {
        clearRecommendations();
        setHoveredRecommendationId(null);
      }
    }, 380);
  };

  const returnToRoot = () => {
    const viewport = viewportRef.current;
    const root = nodes.find(node => node.parentId === null);
    if (!viewport || !root) return;
    setSelectedId(null);
    setEditingId(null);
    clearRecommendations();
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
  const recommendationItems: RecommendationItem[] = recommendationSource && recommendationContents.length
    ? placeRecommendations(
        recommendationSource,
        nodes,
        recommendationContents,
        recommendationSource.parentId === null || recommendationSource.x >= (nodes.find(node => node.parentId === null)?.x ?? 600) ? 1 : -1,
      )
    : [];

  // 지금 다른 사용자가 선택 중인 노드 id -> 그 사용자(들) 목록 (이름/색상 표시용)
  const remoteSelectionsByNodeId = new Map<string, { name: string; color: string }[]>();
  presence.forEach(person => {
    if (person.id === currentUserId || person.selected_block_id == null) return;
    const nodeId = String(person.selected_block_id);
    const member = liveWorkspace.members.find(m => m.userId === person.id);
    const entry = { name: person.name, color: member?.color ?? "#6366f1" };
    remoteSelectionsByNodeId.set(nodeId, [...(remoteSelectionsByNodeId.get(nodeId) ?? []), entry]);
  });

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
        <span className="text-xs text-[#717182]">{liveWorkspace.name}</span>
        <ChevronRight className="w-3 h-3 text-[#C8C7D0]" />
        <span className="text-xs font-semibold text-[#0D0D14]">{liveMapName}</span>
        {canEditMap && (
          <div className="flex items-center gap-0.5 -ml-1">
            <button onClick={() => setRenamingMap(true)} title="마인드맵 이름 수정"
              className="p-1 rounded-lg text-[#ABABAB] hover:bg-[#F0EFF5] hover:text-[#0D0D14] transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => setDeletingMap(true)} title="마인드맵 삭제"
              className="p-1 rounded-lg text-[#ABABAB] hover:bg-red-50 hover:text-red-500 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* 지금 이 마인드맵에 실시간으로 접속해 있는 사용자 */}
        <div className="flex items-center" style={{ gap: "-6px" }} title="지금 접속 중인 사용자">
          <div className="flex -space-x-1.5">
            {presence.slice(0, 4).map((person, i) => {
              const member = liveWorkspace.members.find(m => m.userId === person.id);
              const initials = member?.initials ?? person.name.split(" ").map(part => part[0]).join("");
              return (
                <div key={person.id} title={person.name}
                  className="relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2"
                  style={{ backgroundColor: member?.color ?? "#6366f1", borderColor: "#FFFFFF", zIndex: 10 - i }}>
                  {initials}
                  <span className="absolute -right-0.5 -bottom-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                </div>
              );
            })}
            {presence.length > 4 && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold border-2"
                style={{ backgroundColor: "#F0EFF4", borderColor: "#FFFFFF", color: "#717182" }}>
                +{presence.length - 4}
              </div>
            )}
          </div>
        </div>

        {canEditMap && (
          <button onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "#4F46E5", color: "white" }}>
            <Share2 className="w-3 h-3" />
            공유
          </button>
        )}

        <div className="relative">
          <button onClick={() => setShowProfileMenu(open => !open)}
            className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
            {userInitials}
          </button>
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl border border-[#E8E7EA] bg-white py-1 shadow-lg">
                <button
                  onClick={() => { setShowProfileMenu(false); onLogout?.(); }}
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
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left toolbar ── */}
        <div className="w-12 flex flex-col items-center py-4 gap-2.5 flex-shrink-0 border-r border-[#E8E7EA] bg-white">
          <ToolBtn
            onClick={() => selectedId && addChild(selectedId)}
            disabled={!selectedId || !canEditMap}
            title="하위 노드 추가"
            active>
            <Plus className="w-4 h-4 text-indigo-600" />
          </ToolBtn>
          <ToolBtn
            onClick={() => selectedId && startEdit(selectedId)}
            disabled={!selectedId || !canEditMap}
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
            disabled={!selectedId || selectedNode?.parentId === null || !canEditMap}
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
          {mapLoading && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#ABABAB] pointer-events-none">
              마인드맵을 불러오는 중...
            </div>
          )}

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
                onDoubleClick={() => canEditMap && startEdit(node.id)}
                onEditChange={setEditText}
                onEditCommit={commitEdit}
                onEditCancel={() => setEditingId(null)}
                animatePosition={isAutoArranging}
                commentCount={comments.filter(comment => comment.nodeId === node.id && !comment.solved).length}
                remoteSelectors={remoteSelectionsByNodeId.get(node.id) ?? []}
              />
            ))}
          </div>

          {/* Zoom label */}
          <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-lg text-xs font-mono"
            style={{ background: "rgba(255,255,255,0.92)", border: "1px solid #E8E7EA", color: "#717182" }}>
            {Math.round(zoom * 100)}%
          </div>

          <div className="group absolute bottom-14 right-4">
            <button onClick={returnToRoot} onPointerDown={e => e.stopPropagation()} aria-label="루트 노드로 돌아가기"
              className="w-10 h-10 rounded-xl bg-white border border-[#E0DFE0] shadow-lg hover:border-indigo-300 hover:text-indigo-600 flex items-center justify-center transition-colors text-[#717182]">
              <LocateFixed className="w-5 h-5" />
            </button>
            <span className="pointer-events-none absolute right-full top-1/2 z-50 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0D0D14] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              루트 노드로 돌아가기
            </span>
          </div>

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
              <button onClick={() => addChild(selectedId!)} disabled={!canEditMap}
                className="flex items-center gap-1 text-xs font-semibold transition-colors disabled:opacity-35"
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
              <button onClick={() => startEdit(selectedId!)} disabled={!canEditMap}
                className="flex items-center gap-1 text-xs transition-colors disabled:opacity-35"
                style={{ color: "#717182" }}>
                <Pencil className="w-3 h-3" />
              </button>
              {selectedNode?.parentId !== null && canEditMap && (
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
                    disabled={!canEditMap}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818CF8" }}>
                    <Plus className="w-3.5 h-3.5" />
                    하위 노드 추가
                  </button>
                  <button onClick={() => startEdit(selectedId!)}
                    disabled={!canEditMap}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{ background: "#F8F7F4", border: "1px solid #E8E7EA", color: "#717182" }}>
                    <Pencil className="w-3.5 h-3.5" />
                    이름 수정
                  </button>
                  {selectedNode?.parentId !== null && canEditMap && (
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
              currentUserId={currentUserId}
              canResolve={canEditMap}
              onCreate={async content => {
                const created = await api.createComment(Number(selectedId), content);
                const local = apiCommentToLocal(created);
                // comment:created WebSocket 이벤트가 먼저 도착해 이미 추가돼 있을 수 있으므로 중복 추가 방지
                setComments(prev => prev.some(c => c.id === local.id) ? prev : [...prev, local]);
              }}
              onEdit={async (commentId, content) => {
                await api.updateComment(Number(commentId), content);
                setComments(prev => prev.map(comment => comment.id === commentId ? { ...comment, content } : comment));
              }}
              onResolve={async commentId => {
                await api.resolveComment(Number(commentId), true);
                setComments(prev => prev.map(comment => comment.id === commentId ? { ...comment, solved: true } : comment));
              }}
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

      {showShare && <ShareModal workspace={liveWorkspace} onClose={() => setShowShare(false)} onInvite={onInvite} />}
      {renamingMap && (
        <RenameModal
          title="마인드맵 이름 수정"
          label="마인드맵 이름"
          initialName={liveMapName}
          onClose={() => setRenamingMap(false)}
          onSubmit={async name => {
            await onMapRename?.(name);
            setRenamingMap(false);
          }}
        />
      )}
      {deletingMap && (
        <ConfirmModal
          title="마인드맵을 삭제할까요?"
          description={`"${liveMapName}" 마인드맵과 모든 노드, 댓글이 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          danger
          onCancel={() => setDeletingMap(false)}
          onConfirm={async () => {
            await onMapDelete?.();
            setDeletingMap(false);
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

function CommentPanel({ comments, currentUserId, canResolve, onCreate, onEdit, onResolve }: {
  comments: CommentData[];
  currentUserId?: number;
  canResolve: boolean;
  onCreate: (content: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onResolve: (commentId: string) => Promise<void>;
}) {
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const openComments = comments.filter(comment => !comment.solved);
  const solvedComments = comments.filter(comment => comment.solved);

  const commentCard = (comment: CommentData, solved: boolean) => (
    <div key={comment.id} className={`rounded-xl border p-3 ${solved ? "border-[#E8E7EA] bg-[#F8F7F4] opacity-65" : "border-indigo-100 bg-indigo-50/45"}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-[#0D0D14]">{comment.author}</span>
        {solved && <span className="text-[10px] font-medium text-emerald-600">해결됨</span>}
      </div>
      {editingCommentId === comment.id ? (
        <div className="space-y-2">
          <textarea value={editingContent} onChange={event => setEditingContent(event.target.value)}
            className="w-full resize-none rounded-lg border border-indigo-200 bg-white p-2 text-xs outline-none" />
          <div className="flex justify-end gap-1">
            <button onClick={() => setEditingCommentId(null)} className="px-2 py-1 text-[10px] text-[#717182]">취소</button>
            <button onClick={async () => { if (!editingContent.trim()) return; await onEdit(comment.id, editingContent.trim()); setEditingCommentId(null); }}
              className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white">저장</button>
          </div>
        </div>
      ) : <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#717182]">{comment.content}</p>}
      {!solved && (
        <div className="mt-2 flex justify-end gap-1">
          {comment.authorId === currentUserId && (
            <button onClick={() => { setEditingCommentId(comment.id); setEditingContent(comment.content); }} aria-label="댓글 수정" title="댓글 수정"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[#ABABAB] hover:bg-indigo-100 hover:text-indigo-600">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canResolve && <button onClick={() => onResolve(comment.id)} aria-label="댓글 해결" title="해결됨으로 표시"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[#ABABAB] transition-colors hover:bg-emerald-100 hover:text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </button>}
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
      <div className="mt-3 border-t border-[#E8E7EA] pt-3">
        <textarea value={newComment} onChange={event => setNewComment(event.target.value)} placeholder="댓글을 입력하세요"
          className="w-full resize-none rounded-xl border border-[#E0DFE0] p-2.5 text-xs outline-none focus:border-indigo-300" />
        <button onClick={async () => { if (!newComment.trim()) return; await onCreate(newComment.trim()); setNewComment(""); }}
          disabled={!newComment.trim()} className="mt-2 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white disabled:opacity-40">댓글 작성</button>
      </div>
    </div>
  );
}

// ─── Mind Node component ─────────────────────────────────────────────────────

function MindNode({
  node, selected, editing, editText,
  onPointerDown, onDoubleClick, onEditChange, onEditCommit, onEditCancel, animatePosition, commentCount, remoteSelectors,
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
  remoteSelectors: { name: string; color: string }[];
}) {
  const isRoot = node.parentId === null;
  const dimensions = nodeBounds(node);
  const remoteColor = remoteSelectors[0]?.color;

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
      {remoteSelectors.length > 0 && !editing && (
        <div className="absolute -right-2 -top-3 z-10 flex h-6 items-center justify-center whitespace-nowrap rounded-full border-2 border-white px-2 text-[10px] font-bold text-white shadow-md"
          style={{ backgroundColor: remoteColor }}>
          {remoteSelectors.map(s => s.name).join(", ")}
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
            boxShadow: [
              selected ? `0 0 0 3px ${node.color}20, 0 8px 32px ${node.color}18` : null,
              remoteColor ? `0 0 0 2px ${remoteColor}99` : null,
            ].filter(Boolean).join(", ") || undefined,
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
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
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
      {title && (
        <span
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0D0D14] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        >
          {title}
        </span>
      )}
    </div>
  );
}

