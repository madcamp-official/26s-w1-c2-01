import { useState, useRef, useEffect } from "react";
import { API_COLOR_HEX, NODE_COLORS, HEX_API_COLOR } from "../../data/const";
import { api, ApiBlock, ApiRecommendation, ApiComment } from "../../../api/client";

import {
    Role,
    WorkspaceData, NodeData, EdgeData, CommentData,
    RecommendationState, DragState, RecommendationItem
} from "../../data/type";

import {
  Plus, Share2, ArrowLeft, ZoomIn, ZoomOut,
  Trash2, LogOut, UserX, ChevronRight,
  Maximize2, Pencil, LocateFixed,
  ListTree,
  MessageCircle, SlidersHorizontal
} from "lucide-react";

import { relaxNodeCollisions, blocksToLocalNodes, placeRecommendations } from "../../utils/mindmapLayout";
import { applyWorkspaceRealtimeEvent } from "../../utils/realtime";

import { ToolBtn } from "../mindmap/ToolBtn";
import { MindNode } from "../mindmap/MindNode";
import { CommentPanel } from "../mindmap/CommentPanel";

import { ProfileModal } from "../modals/ProfileModal";
import { ShareModal } from "../modals/ShareModal";
import { RenameModal } from "../modals/RenameModal";
import { ConfirmModal } from "../modals/ConfirmModal";
import { DeleteAccountModal } from "../modals/DeleteAccountModal";

const apiCommentToLocal = (comment: ApiComment): CommentData => ({
  id: String(comment.id), nodeId: String(comment.block_id), authorId: comment.author.id,
  author: comment.author.name, content: comment.content, solved: comment.solved,
});

export function CanvasScreen({
  workspace, mapId, mapName, user, currentUserId, currentRole = workspace.currentRole ?? "editor", onBack, onInvite, onLogout,
  onDeleteAccount, onProfileUpdate, onMapRename, onMapDelete,
}: {
  workspace: WorkspaceData;
  mapId: string;
  mapName: string;
  user: { name: string; email: string };
  currentUserId?: number;
  currentRole?: Role;
  onBack: () => void;
  onInvite?: (workspaceId: string, email: string, role: "editor" | "viewer") => Promise<void>;
  onLogout?: () => void;
  onDeleteAccount?: () => Promise<void>;
  onProfileUpdate?: (payload: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
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
  const [showProfile, setShowProfile] = useState(false);
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
      <div className="h-12 flex items-center px-2 sm:px-4 gap-1.5 sm:gap-3 flex-shrink-0 border-b border-[#E8E7EA] bg-white z-10">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-[#717182] hover:text-[#0D0D14] transition-colors mr-0.5 sm:mr-1 flex-shrink-0">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">돌아가기</span>
        </button>
        <div className="hidden sm:block w-px h-4 bg-[#E0DFE0] flex-shrink-0" />
        <span className="hidden sm:inline text-xs text-[#717182] flex-shrink-0 max-w-[100px] truncate">{liveWorkspace.name}</span>
        <ChevronRight className="hidden sm:block w-3 h-3 text-[#C8C7D0] flex-shrink-0" />
        <span className="text-xs font-semibold text-[#0D0D14] truncate min-w-0">{liveMapName}</span>
        {canEditMap && (
          <div className="hidden sm:flex items-center gap-0.5 -ml-1 flex-shrink-0">
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
        <div className="hidden sm:flex items-center flex-shrink-0" style={{ gap: "-6px" }} title="지금 접속 중인 사용자">
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
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
            style={{ background: "#4F46E5", color: "white" }}>
            <Share2 className="w-3 h-3" />
            <span className="hidden sm:inline">공유</span>
          </button>
        )}

        <div className="relative flex-shrink-0">
          <button onClick={() => setShowProfileMenu(open => !open)}
            className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
            {user.name.split(" ").map(part => part[0]).join("")}
          </button>
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl border border-[#E8E7EA] bg-white py-1 shadow-lg">
                <button
                  onClick={() => { setShowProfileMenu(false); setShowProfile(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#717182] hover:bg-[#F8F7F4] hover:text-[#0D0D14]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  내 프로필
                </button>
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
          {showProfile && onProfileUpdate && (
            <ProfileModal user={user} onClose={() => setShowProfile(false)} onSave={onProfileUpdate} />
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
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex max-w-[calc(100vw-2rem)] items-center gap-2 sm:gap-2.5 overflow-x-auto px-3 sm:px-3.5 py-2 rounded-2xl bg-white border border-[#E0DFE0] shadow-xl">
              <span className="text-xs max-w-[100px] truncate text-[#717182] flex-shrink-0">
                {selectedNode.text}
              </span>
              <div className="w-px h-4 bg-[#E0DFE0] flex-shrink-0" />
              {/* Color swatches */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {NODE_COLORS.map(c => (
                  <button key={c} onClick={() => changeColor(selectedId!, c)}
                    className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 flex-shrink-0"
                    style={{ backgroundColor: c, borderColor: selectedNode.color === c ? "#0D0D14" : "transparent" }} />
                ))}
              </div>
              <div className="w-px h-4 bg-[#E0DFE0] flex-shrink-0" />
              <button onClick={() => addChild(selectedId!)} disabled={!canEditMap}
                className="flex items-center gap-1 text-xs font-semibold transition-colors disabled:opacity-35 flex-shrink-0 whitespace-nowrap"
                style={{ color: "#4F46E5" }}>
                <Plus className="w-3 h-3" />하위 노드
              </button>
              <button onClick={() => autoArrangeChildren(selectedId!)}
                disabled={!nodes.some(node => node.parentId === selectedId)}
                className="flex items-center gap-1 text-xs transition-colors disabled:opacity-35 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap"
                style={{ color: "#717182" }}
                title="하위 노드 자동 정렬">
                <ListTree className="w-3 h-3" />자동 정렬
              </button>
              <button onClick={() => startEdit(selectedId!)} disabled={!canEditMap}
                className="flex items-center gap-1 text-xs transition-colors disabled:opacity-35 flex-shrink-0"
                style={{ color: "#717182" }}>
                <Pencil className="w-3 h-3" />
              </button>
              {selectedNode?.parentId !== null && canEditMap && (
                <>
                  <div className="w-px h-4 bg-[#E0DFE0] flex-shrink-0" />
                  <button onClick={() => requestDelete(selectedId!)}
                    className="text-xs transition-colors flex-shrink-0"
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
          <>
            {/* 모바일/태블릿에서는 캔버스를 덮는 드로어라, 배경을 탭하면 선택을 풀어 닫히게 한다 */}
            <div className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setSelectedId(null)} />
            <div className="fixed inset-y-0 right-0 z-30 w-[82vw] max-w-[272px] flex flex-col min-h-0 py-5 px-4 border-l border-[#E8E7EA] bg-white shadow-2xl md:relative md:z-auto md:w-64 md:max-w-none md:flex-shrink-0 md:shadow-none">
            {/* 화면이 좁으면 캔버스와 겹치는 좌측 플로팅 탭 대신, 패널 안쪽 상단에 가로 탭으로 전환 */}
            <div className="hidden md:flex absolute -left-11 top-5 flex-col overflow-hidden rounded-l-xl border border-r-0 border-[#E8E7EA] bg-white shadow-sm">
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

            <div className="flex md:hidden items-center gap-1 rounded-xl border border-[#E8E7EA] bg-[#F8F7F4] p-1 mb-4">
              <button onClick={() => setPanelMode("controls")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${panelMode === "controls" ? "bg-white text-indigo-600 shadow-sm" : "text-[#ABABAB]"}`}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                노드
              </button>
              <button onClick={() => setPanelMode("comments")}
                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${panelMode === "comments" ? "bg-white text-indigo-600 shadow-sm" : "text-[#ABABAB]"}`}>
                <MessageCircle className="h-3.5 w-3.5" />
                댓글
                {comments.filter(comment => comment.nodeId === selectedId && !comment.solved).length > 0 && (
                  <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                )}
              </button>
            </div>

            {panelMode === "controls" ? <>
            <p className="hidden md:block text-[10px] font-bold uppercase tracking-widest mb-4 text-[#ABABAB]">노드</p>

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
          </>
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