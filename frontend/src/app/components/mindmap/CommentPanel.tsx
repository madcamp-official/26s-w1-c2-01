import { useState } from "react";
import { CommentData } from "../../data/type";
import { Pencil, CheckCircle2 } from "lucide-react";

export function CommentPanel({ comments, currentUserId, canResolve, onCreate, onEdit, onResolve }: {
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