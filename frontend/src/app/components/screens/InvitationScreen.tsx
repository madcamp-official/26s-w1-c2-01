import { useState } from "react";
import { X, Brain } from "lucide-react";
import { ApiInvitation } from "../../../api/client";

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