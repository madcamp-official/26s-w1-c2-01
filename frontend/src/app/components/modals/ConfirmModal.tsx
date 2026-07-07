import { useState } from "react";

export function ConfirmModal({ title, description, confirmLabel, onCancel, onConfirm, danger }: {
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