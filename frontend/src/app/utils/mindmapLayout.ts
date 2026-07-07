import { ApiBlock } from "../../api/client";
import { NodeData, RecommendationItem } from "../data/type";
import { API_COLOR_HEX } from "../data/const";

export function nodeBounds(node: NodeData) {
  const isRoot = node.parentId === null;
  const horizontalPadding = isRoot ? 48 : 34;
  const verticalPadding = isRoot ? 28 : 18;
  const minWidth = isRoot ? 200 : 100;
  const maxWidth = isRoot ? 300 : 240;
  const estimatedTextWidth = [...node.text].reduce(
    (width, character) => width + (character.charCodeAt(0) > 255 ? 14 : 7.5),
    0,
  );
  const width = Math.max(minWidth, Math.min(maxWidth, estimatedTextWidth + horizontalPadding));
  const contentWidth = Math.max(1, width - horizontalPadding);
  const lines = Math.max(1, Math.ceil(estimatedTextWidth / contentWidth));
  return {
    width,
    height: Math.max(isRoot ? 62 : 42, lines * 20 + verticalPadding),
  };
}

export function relaxNodeCollisions(input: NodeData[], pinnedIds = new Set<string>()): NodeData[] {
  const result = input.map(node => ({ ...node }));
  const root = result.find(node => node.parentId === null);
  if (root) pinnedIds.add(root.id);

  for (let iteration = 0; iteration < 20; iteration += 1) {
    let changed = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const a = result[i];
        const b = result[j];
        const sizeA = nodeBounds(a);
        const sizeB = nodeBounds(b);
        const overlapX = (sizeA.width + sizeB.width) / 2 + 30 - Math.abs(a.x - b.x);
        const overlapY = (sizeA.height + sizeB.height) / 2 + 28 - Math.abs(a.y - b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;

        changed = true;
        const aPinned = pinnedIds.has(a.id);
        const bPinned = pinnedIds.has(b.id);
        if (aPinned && bPinned) continue;
        const moveA = aPinned ? 0 : bPinned ? 1 : 0.5;
        const moveB = bPinned ? 0 : aPinned ? 1 : 0.5;

        // 더 적은 이동으로 분리되는 축을 선택해 레이아웃의 방향성을 최대한 유지한다.
        if (overlapX < overlapY) {
          const direction = a.x <= b.x ? -1 : 1;
          a.x += direction * overlapX * moveA;
          b.x -= direction * overlapX * moveB;
        } else {
          const direction = a.y <= b.y ? -1 : 1;
          a.y += direction * overlapY * moveA;
          b.y -= direction * overlapY * moveB;
        }
      }
    }
    if (!changed) break;
  }
  return result;
}

export function blocksToLocalNodes(blocks: ApiBlock[]): NodeData[] {
  // 좌표는 서버 공유 대상이 아니므로 매번 사용자별 로컬 레이아웃으로 계산한다.
  // 형제 개수만 보고 중앙 정렬하던 이전 방식은 가지마다 하위 트리 크기가 다르면
  // 겹침이 생겨서, 각 노드가 차지할 하위 트리 전체 폭(subtree span)을 먼저 구하고
  // 그 폭만큼 세로 공간을 배분하는 방식으로 바꿔 처음 진입 시에도 겹치지 않게 한다.
  const byParent = new Map<number | null, ApiBlock[]>();
  blocks.forEach(block => byParent.set(block.parent_block_id, [...(byParent.get(block.parent_block_id) ?? []), block]));

  const unitHeight = 120;
  const subtreeUnits = (block: ApiBlock): number => {
    const children = byParent.get(block.id) ?? [];
    return children.length === 0 ? 1 : children.reduce((sum, child) => sum + subtreeUnits(child), 0);
  };

  const result: NodeData[] = [];
  const place = (block: ApiBlock, depth: number, top: number): number => {
    const span = subtreeUnits(block) * unitHeight;
    result.push({
      id: String(block.id), parentId: block.parent_block_id === null ? null : String(block.parent_block_id),
      text: block.content, color: API_COLOR_HEX[block.color] ?? API_COLOR_HEX.indigo,
      x: 600 + depth * 250, y: top + span / 2,
    });
    let cursor = top;
    (byParent.get(block.id) ?? []).forEach(child => { cursor = place(child, depth + 1, cursor); });
    return top + span;
  };

  let cursor = 0;
  (byParent.get(null) ?? []).forEach(root => { cursor = place(root, 0, cursor); });

  // 긴 텍스트로 노드 폭이 커져 여전히 겹치는 경우를 대비한 마지막 안전망
  return relaxNodeCollisions(result);
}

export function placeRecommendations(
  source: NodeData,
  nodes: NodeData[],
  labels: string[],
  preferredDirection: 1 | -1,
): RecommendationItem[] {
  const baseAngle = preferredDirection === 1 ? 0 : Math.PI;
  const angleOffsets = [0, -0.48, 0.48, -0.9, 0.9, -1.35, 1.35, Math.PI];
  const radii = [210, 260, 315, 375, 440];
  const occupied = nodes.map(node => ({ x: node.x, y: node.y, ...nodeBounds(node) }));

  return labels.map((text, index) => {
    const width = Math.max(120, Math.min(220, text.length * 9 + 48));
    const candidates = radii.flatMap(radius => angleOffsets.map((offset, angleIndex) => {
      // 추천 노드마다 탐색 시작 각도를 살짝 바꿔 한쪽에만 몰리지 않게 한다.
      const angle = baseAngle + angleOffsets[(angleIndex + index * 2) % angleOffsets.length];
      return {
        x: source.x + Math.cos(angle) * radius,
        y: source.y + Math.sin(angle) * radius,
        width,
        height: 46,
        preference: radius + angleIndex * 5,
      };
    }));

    const scored = candidates.map(candidate => {
      const collisionPenalty = occupied.reduce((penalty, item) => {
        const overlapX = (candidate.width + item.width) / 2 + 24 - Math.abs(candidate.x - item.x);
        const overlapY = (candidate.height + item.height) / 2 + 24 - Math.abs(candidate.y - item.y);
        return penalty + (overlapX > 0 && overlapY > 0 ? 10000 + overlapX * overlapY : 0);
      }, 0);
      return { ...candidate, score: collisionPenalty + candidate.preference };
    }).sort((a, b) => a.score - b.score);

    const chosen = scored[0];
    occupied.push(chosen);
    return {
      id: `recommendation-${source.id}-${index}`,
      text,
      x: chosen.x,
      y: chosen.y,
      color: source.color,
    };
  });
}