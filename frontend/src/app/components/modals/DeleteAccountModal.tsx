import { useState } from "react";

export function DeleteAccountModal({ onCancel, onConfirm }: {
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