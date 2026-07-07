import React, { useState, useEffect } from "react";
import { api } from "../../../api/client";
import { Brain, Check } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "../../data/const";

// 로그인 화면 왼쪽 패널을 채우는 장식 요소. 실제 데이터가 아니라 브랜딩용 정적 배치이므로 모듈 스코프 상수로 둔다.
// 로고(좌상단, x<26% y<15%)와 헤드라인 텍스트가 흐르는 가운데 밴드(대략 x<60%, y 26~78%)만 비워두고,
// 그 위/아래 여백과 오른쪽 세로줄에는 촘촘히 배치해 밀도를 확보한다.
// CoMind는 마인드맵 서비스이므로 텍스트 뱃지 대신, 서로 연결된 노드-엣지 그래프로 표현해 은은하게 움직이게 한다.
const NETWORK_NODES = [
  { x: 60, y: 8,  r: 3.4, color: "#ef4444", dx: 5,  dy: -4, dur: 3.6, delay: 0 },
  { x: 78, y: 5,  r: 2.6, color: "#06b6d4", dx: -4, dy: 5,  dur: 4.2, delay: 0.3 },
  { x: 92, y: 14, r: 4,   color: "#8b5cf6", dx: -5, dy: -4, dur: 3.9, delay: 0.6 },
  { x: 12, y: 20, r: 3,   color: "#f59e0b", dx: 4,  dy: 5,  dur: 4.6, delay: 0.15 },
  { x: 34, y: 18, r: 2.4, color: "#3b82f6", dx: -4, dy: 4,  dur: 4.1, delay: 0.9 },
  { x: 82, y: 28, r: 3.2, color: "#f59e0b", dx: 5,  dy: 4,  dur: 3.7, delay: 0.45 },
  { x: 92, y: 40, r: 2.8, color: "#8b5cf6", dx: -5, dy: 5,  dur: 4.4, delay: 0.75 },
  { x: 78, y: 52, r: 3.6, color: "#3b82f6", dx: 4,  dy: -5, dur: 3.95, delay: 0.2 },
  { x: 90, y: 64, r: 2.6, color: "#ef4444", dx: -4, dy: -5, dur: 4.7, delay: 1.05 },
  { x: 80, y: 76, r: 3,   color: "#10b981", dx: 5,  dy: 4,  dur: 3.6, delay: 0.5 },
  { x: 92, y: 88, r: 2.8, color: "#ec4899", dx: -4, dy: -4, dur: 4.45, delay: 0.1 },
  { x: 6,  y: 86, r: 3.4, color: "#6366f1", dx: 4,  dy: -5, dur: 4.05, delay: 0.7 },
  { x: 26, y: 92, r: 2.6, color: "#ec4899", dx: -5, dy: 4,  dur: 4.8, delay: 0.35 },
  { x: 50, y: 88, r: 3.8, color: "#6366f1", dx: 4,  dy: 5,  dur: 3.75, delay: 0.95 },
  { x: 66, y: 82, r: 2.8, color: "#8b5cf6", dx: -4, dy: -4, dur: 4.25, delay: 0.25 },
];

// 헤드라인이 흐르는 가운데 밴드를 가로지르지 않도록 상단/우측/하단 클러스터 안에서만 서로 이어준다.
const NETWORK_EDGES = [
  [0, 1], [1, 2], [0, 4], [4, 3],
  [2, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10],
  [10, 12], [12, 11], [12, 13], [13, 14], [14, 9], [13, 9],
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
  const [emailTaken, setEmailTaken] = useState(false);

  const inp = [
    "w-full px-4 py-3 rounded-2xl text-sm text-[#0D0D14] placeholder-[#C0BFC8] bg-[#FAFAFA]",
    "border-2 border-[#E2E0F0] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all",
  ].join(" ");

  const passwordUnmet = PASSWORD_REQUIREMENTS.filter(r => !r.test(password));
  const passwordInvalid = isSignUp && passwordUnmet.length > 0;

  useEffect(() => {
    if (!isSignUp || !/^\S+@\S+\.\S+$/.test(email)) { setEmailTaken(false); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { available } = await api.checkEmailAvailability(email);
        if (!cancelled) setEmailTaken(!available);
      } catch {
        if (!cancelled) setEmailTaken(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [email, isSignUp]);

  const submit = async () => {
    if (passwordInvalid || emailTaken) return;
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

        {/* 서로 연결된 노드 그래프: 마인드맵 서비스임을 은은하게 드러내며, 전체가 느리게 흔들리고 각 노드가 조금씩 떠다닌다 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none login-network" aria-hidden="true">
          {NETWORK_EDGES.map(([a, b], i) => {
            const from = NETWORK_NODES[a], to = NETWORK_NODES[b];
            return (
              <line key={i} x1={`${from.x}%`} y1={`${from.y}%`} x2={`${to.x}%`} y2={`${to.y}%`}
                stroke={from.color} strokeWidth={1} strokeOpacity={0.16} />
            );
          })}
          {NETWORK_NODES.map((n, i) => (
            <circle key={i} cx={`${n.x}%`} cy={`${n.y}%`} r={n.r} fill={n.color} opacity={0.55}
              className="login-network-node"
              style={{ "--dx": `${n.dx}px`, "--dy": `${n.dy}px`, animationDuration: `${n.dur}s`, animationDelay: `${n.delay}s` } as React.CSSProperties} />
          ))}
        </svg>

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
                  {isSignUp && emailTaken && (
                    <p className="mt-1.5 text-[11px] font-medium text-red-500">이미 사용 중인 이메일입니다</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "#6366f1" }}>비밀번호</label>
                  <input type="password" className={inp} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    onKeyDown={e => e.key === "Enter" && submit()} />
                  {isSignUp && passwordUnmet.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {PASSWORD_REQUIREMENTS.map(r => {
                        const met = r.test(password);
                        return (
                          <li key={r.label} className="flex items-center gap-1 text-[11px] font-medium transition-colors"
                            style={{ color: met ? "#10b981" : "#ABABAB" }}>
                            <Check className="w-3 h-3" style={{ opacity: met ? 1 : 0.35 }} />
                            {r.label}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {error && <p className="text-xs text-red-500 whitespace-pre-line">{error}</p>}

                <button
                  onClick={submit}
                  disabled={submitting || passwordInvalid || (isSignUp && emailTaken)}
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
