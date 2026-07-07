import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "../../data/const";

export function ProfileModal({ user, onClose, onSave }: {
  user: { name: string; email: string };
  onClose: () => void;
  onSave: (payload: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setName(user.name); }, [user.name]);

  const wantsPasswordChange = newPassword.length > 0;
  const passwordUnmet = PASSWORD_REQUIREMENTS.filter(r => !r.test(newPassword));
  const passwordSameAsCurrent = wantsPasswordChange && currentPassword.length > 0 && newPassword === currentPassword;
  const trimmedName = name.trim();
  const nameChanged = trimmedName.length > 0 && trimmedName !== user.name;
  const hasChanges = nameChanged || wantsPasswordChange;
  const passwordInvalid = wantsPasswordChange && (passwordUnmet.length > 0 || !currentPassword || passwordSameAsCurrent);
  const canSubmit = hasChanges && trimmedName.length > 0 && !passwordInvalid && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError(""); setSaved(false);
    try {
      await onSave({
        name: nameChanged ? trimmedName : undefined,
        currentPassword: wantsPasswordChange ? currentPassword : undefined,
        newPassword: wantsPasswordChange ? newPassword : undefined,
      });
      setCurrentPassword(""); setNewPassword("");
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "프로필 수정에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const inp = "w-full px-4 py-2.5 rounded-xl border border-[#E0DFE0] text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all";
  const labelCls = "block text-[11px] font-bold text-[#0D0D14] uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E8E7EA]">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#F0EFF4] sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-[#0D0D14]">내 프로필</h3>
          <button onClick={onClose} aria-label="닫기"
            className="w-7 h-7 rounded-full hover:bg-[#F0EFF5] flex items-center justify-center transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-[#717182]" />
          </button>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          <div>
            <label className={labelCls}>이메일</label>
            <input disabled value={user.email} className={inp + " bg-[#F8F7F4] text-[#ABABAB]"} />
          </div>
          <div>
            <label className={labelCls}>이름</label>
            <input autoFocus value={name} onChange={e => { setName(e.target.value); setSaved(false); }}
              className={inp} />
          </div>

          <div className="pt-3 border-t border-[#F0EFF4] space-y-3">
            <p className={labelCls}>비밀번호 변경</p>
            <input type="password" placeholder="현재 비밀번호" value={currentPassword}
              onChange={e => { setCurrentPassword(e.target.value); setSaved(false); }} className={inp} />
            <div>
              <input type="password" placeholder="새 비밀번호" value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setSaved(false); }} className={inp} />
              {passwordSameAsCurrent && (
                <p className="mt-1.5 text-[11px] font-medium text-red-500">새 비밀번호는 현재 비밀번호와 같을 수 없습니다</p>
              )}
              {wantsPasswordChange && passwordUnmet.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {PASSWORD_REQUIREMENTS.map(r => {
                    const met = r.test(newPassword);
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
          </div>

          {error && <p className="text-xs text-red-500 whitespace-pre-line">{error}</p>}
          {saved && !error && <p className="text-xs font-medium text-emerald-600">저장되었습니다</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E0DFE0] text-sm text-[#717182] hover:bg-[#F3F2F6] font-medium transition-colors">
              닫기
            </button>
            <button onClick={submit} disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40">
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}