import { useState } from "react";
import { X } from "lucide-react";

export function CreateWorkspaceModal({ onClose, onCreate }: {
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