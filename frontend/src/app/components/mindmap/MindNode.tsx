import { NodeData } from "../../data/type";
import { MessageCircle } from "lucide-react";
import { nodeBounds } from "../../utils/mindmapLayout";

export function MindNode({
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