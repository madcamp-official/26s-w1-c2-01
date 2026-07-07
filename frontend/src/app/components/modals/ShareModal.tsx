import { useEffect, useRef, useState } from "react";
import { WorkspaceData } from "../../data/type";
import { api } from "../../../api/client";
import { ApiUserSearchResult } from "../../../api/client";
import { X, UserPlus } from "lucide-react";

export function ShareModal({ workspace, onClose, onInvite }: {
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