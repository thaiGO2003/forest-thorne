import { getTechLayoutParentId, getTechRequirementIds } from "../data/techTree.js";
import type { TechBranch, TechNode } from "../data/techTree.js";

const TWO_PI = Math.PI * 2;
const LAYOUT_DISTANCE_EPSILON = 0.05;

export const TECH_TREE_LAYOUT_DEFAULTS = {
  nodeRadius: 22,
  baseRingRadius: 110,
  ringStep: 82,
  labelMaxWidth: 74,
  branchSectorRatio: 0.82,
  minNodeDistance: 56,
  parentChildGap: 60,
  iterations: 28
} as const;

interface Point {
  x: number;
  y: number;
}

interface NodeMetaEntry {
  id: string;
  branch: TechBranch | "ROOT";
  depth: number;
  parentId: string | null;
  parentIds: string[];
  angle: number;
  radius: number;
  preferredAngle: number;
  preferredRadius: number;
  branchStart: number;
  branchEnd: number;
  sliceStart?: number;
  sliceEnd?: number;
}

interface BranchSector {
  center: number;
  start: number;
  end: number;
}

interface GraphContext {
  byId: Record<string, TechNode>;
  childrenMap: Record<string, string[]>;
  layoutParentMap: Record<string, string | null>;
  nodeOrder: Map<string, number>;
  getDepth: (nodeId: string) => number;
  countLeaves: (nodeId: string) => number;
}

interface PlacePreferredOptions {
  nodes: TechNode[];
  branchOrder: readonly TechBranch[];
  baseRingRadius: number;
  ringStep: number;
  branchSectorRatio: number;
}

interface RelaxBranchOptions {
  nodeIds: string[];
  nodeMeta: Record<string, NodeMetaEntry>;
  nodeOrder: Map<string, number>;
  minNodeDistance: number;
  parentChildGap: number;
  baseRingRadius: number;
  ringStep: number;
  iterations: number;
}

interface EnforceBranchOptions {
  nodeIds: string[];
  nodeMeta: Record<string, NodeMetaEntry>;
  nodeOrder: Map<string, number>;
  minNodeDistance: number;
  parentChildGap: number;
  baseRingRadius: number;
  ringStep: number;
}

interface ComputeLayoutOptions {
  nodes: TechNode[];
  branchOrder: readonly TechBranch[];
  nodeRadius?: number;
  baseRingRadius?: number;
  ringStep?: number;
  labelMaxWidth?: number;
  branchSectorRatio?: number;
  minNodeDistance?: number;
  parentChildGap?: number;
  iterations?: number;
}

interface ContentBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TechTreeLayoutResult {
  positions: Record<string, Point>;
  nodeMeta: Record<string, NodeMetaEntry>;
  branchSectors: Record<string, BranchSector>;
  maxDepth: number;
  contentBounds: ContentBounds;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle: number): number {
  let next = angle;
  while (next <= -Math.PI) next += TWO_PI;
  while (next > Math.PI) next -= TWO_PI;
  return next;
}

function getLayoutMinDistance(minNodeDistance: number): number {
  return minNodeDistance + LAYOUT_DISTANCE_EPSILON;
}

function toCartesian(radius: number, angle: number): Point {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

function measureContentBounds(
  positions: Record<string, Point>,
  nodeRadius: number,
  labelMaxWidth: number
): ContentBounds {
  const points = Object.values(positions);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const paddingX = nodeRadius + labelMaxWidth + 30;
  const paddingY = nodeRadius + 80;

  return {
    minX: Math.min(...xs) - paddingX,
    maxX: Math.max(...xs) + paddingX,
    minY: Math.min(...ys) - paddingY,
    maxY: Math.max(...ys) + paddingY
  };
}

function buildGraph(nodes: TechNode[]): GraphContext {
  const nodeOrder = new Map<string, number>(nodes.map((node, index) => [node.id, index]));
  const byId: Record<string, TechNode> = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const childrenMap: Record<string, string[]> = {};
  const layoutParentMap: Record<string, string | null> = {};

  nodes.forEach((node) => {
    const layoutParentId = getTechLayoutParentId(node, byId);
    layoutParentMap[node.id] = layoutParentId;
    if (!layoutParentId) return;
    if (!childrenMap[layoutParentId]) childrenMap[layoutParentId] = [];
    childrenMap[layoutParentId].push(node.id);
  });

  Object.values(childrenMap).forEach((ids) => {
    ids.sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0));
  });

  const depthCache: Record<string, number> = { root: 0 };
  const leafCache: Record<string, number> = {};

  const getDepth = (nodeId: string): number => {
    if (depthCache[nodeId] != null) return depthCache[nodeId];
    const node = byId[nodeId];
    const requirementIds = getTechRequirementIds(node, byId);
    if (!requirementIds.length) {
      depthCache[nodeId] = 0;
      return 0;
    }
    const deepestParent = requirementIds.reduce((maxDepth, requirementId) => {
      if (!byId[requirementId]) return maxDepth;
      return Math.max(maxDepth, getDepth(requirementId));
    }, 0);
    depthCache[nodeId] = deepestParent + 1;
    return depthCache[nodeId];
  };

  const countLeaves = (nodeId: string): number => {
    if (leafCache[nodeId] != null) return leafCache[nodeId];
    const children = childrenMap[nodeId] ?? [];
    if (!children.length) {
      leafCache[nodeId] = 1;
      return 1;
    }
    const leafCount = children.reduce((sum, childId) => sum + countLeaves(childId), 0);
    leafCache[nodeId] = leafCount;
    return leafCount;
  };

  return {
    byId,
    childrenMap,
    layoutParentMap,
    nodeOrder,
    getDepth,
    countLeaves
  };
}

function placePreferredPositions({
  nodes,
  branchOrder,
  baseRingRadius,
  ringStep,
  branchSectorRatio
}: PlacePreferredOptions): {
  positions: Record<string, Point>;
  nodeMeta: Record<string, NodeMetaEntry>;
  branchSectors: Record<string, BranchSector>;
  maxDepth: number;
} {
  const { byId, childrenMap, layoutParentMap, getDepth, countLeaves } = buildGraph(nodes);
  const branchStep = TWO_PI / branchOrder.length;
  const positions: Record<string, Point> = { root: { x: 0, y: 0 } };
  const nodeMeta: Record<string, NodeMetaEntry> = {
    root: {
      id: "root",
      branch: "ROOT",
      depth: 0,
      parentId: null,
      parentIds: [],
      angle: 0,
      radius: 0,
      preferredAngle: 0,
      preferredRadius: 0,
      branchStart: -Math.PI,
      branchEnd: Math.PI
    }
  };
  const branchSectors: Record<string, BranchSector> = {};

  const placeSubtree = (
    nodeIds: string[],
    startAngle: number,
    endAngle: number,
    _depth: number,
    branchStart: number,
    branchEnd: number,
    branch: TechBranch
  ): void => {
    if (!nodeIds.length) return;
    const totalLeaves = nodeIds.reduce((sum, nodeId) => sum + countLeaves(nodeId), 0);
    let cursor = startAngle;

    nodeIds.forEach((nodeId) => {
      const leafCount = countLeaves(nodeId);
      const slice = ((endAngle - startAngle) * leafCount) / totalLeaves;
      const sliceStart = cursor;
      const sliceEnd = cursor + slice;
      const angle = (sliceStart + sliceEnd) / 2;
      const actualDepth = getDepth(nodeId);
      const radius = baseRingRadius + (actualDepth - 1) * ringStep;

      positions[nodeId] = toCartesian(radius, angle);
      nodeMeta[nodeId] = {
        id: nodeId,
        branch,
        depth: actualDepth,
        parentId: layoutParentMap[nodeId] ?? null,
        parentIds: getTechRequirementIds(byId[nodeId], byId),
        angle,
        radius,
        preferredAngle: angle,
        preferredRadius: radius,
        branchStart,
        branchEnd,
        sliceStart,
        sliceEnd
      };

      const childIds = childrenMap[nodeId] ?? [];
      if (childIds.length) {
        const padding = Math.min(0.08, slice * 0.18);
        const childStart = sliceStart + padding;
        const childEnd = sliceEnd - padding;
        placeSubtree(
          childIds,
          childStart < childEnd ? childStart : sliceStart,
          childEnd > childStart ? childEnd : sliceEnd,
          _depth + 1,
          branchStart,
          branchEnd,
          branch
        );
      }

      cursor = sliceEnd;
    });
  };

  branchOrder.forEach((branch, index) => {
    const center = -Math.PI / 2 + index * branchStep;
    const branchStart = center - (branchStep * branchSectorRatio) / 2;
    const branchEnd = center + (branchStep * branchSectorRatio) / 2;
    branchSectors[branch] = { center, start: branchStart, end: branchEnd };

    const branchRoots = nodes
      .filter((node) => node.branch === branch && (layoutParentMap[node.id] ?? null) === "root")
      .map((node) => node.id);

    placeSubtree(branchRoots, branchStart, branchEnd, 1, branchStart, branchEnd, branch);
  });

  const maxDepth = Math.max(...nodes.map((node) => getDepth(node.id)));

  return {
    positions,
    nodeMeta,
    branchSectors,
    maxDepth
  };
}

function relaxBranchLayout({
  nodeIds,
  nodeMeta,
  nodeOrder,
  minNodeDistance,
  parentChildGap,
  baseRingRadius,
  ringStep,
  iterations
}: RelaxBranchOptions): void {
  if (!nodeIds.length) return;
  const targetMinDistance = getLayoutMinDistance(minNodeDistance);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const angleDelta: Record<string, number> = {};
    const radiusDelta: Record<string, number> = {};

    nodeIds.forEach((nodeId) => {
      angleDelta[nodeId] = 0;
      radiusDelta[nodeId] = 0;
    });

    for (let leftIndex = 0; leftIndex < nodeIds.length; leftIndex += 1) {
      const leftId = nodeIds[leftIndex];
      const left = nodeMeta[leftId];
      const leftPoint = toCartesian(left.radius, left.angle);

      for (let rightIndex = leftIndex + 1; rightIndex < nodeIds.length; rightIndex += 1) {
        const rightId = nodeIds[rightIndex];
        const right = nodeMeta[rightId];
        const rightPoint = toCartesian(right.radius, right.angle);
        const dx = rightPoint.x - leftPoint.x;
        const dy = rightPoint.y - leftPoint.y;
        const distance = Math.hypot(dx, dy);

        if (distance >= targetMinDistance) continue;

        const overlap = targetMinDistance - distance;
        const rawDiff = normalizeAngle(right.angle - left.angle);
        const preferredDiff = normalizeAngle(right.preferredAngle - left.preferredAngle);
        const orderDiff = (nodeOrder.get(rightId) ?? 0) - (nodeOrder.get(leftId) ?? 0);
        const direction = Math.sign(rawDiff || preferredDiff || orderDiff || 1);
        const avgRadius = Math.max((left.radius + right.radius) / 2, baseRingRadius * 0.75);
        const angularPush = Math.min(0.18, (overlap / avgRadius) * 0.92);
        const depthGap = Math.abs(left.depth - right.depth);
        const angleWeight = depthGap === 0 ? 1 : 0.72;

        angleDelta[leftId] -= direction * angularPush * 0.5 * angleWeight;
        angleDelta[rightId] += direction * angularPush * 0.5 * angleWeight;

        if (depthGap <= 1) {
          if (left.depth > right.depth) {
            radiusDelta[leftId] += overlap * 0.7;
          } else if (right.depth > left.depth) {
            radiusDelta[rightId] += overlap * 0.7;
          } else {
            const outwardId = orderDiff >= 0 ? rightId : leftId;
            radiusDelta[outwardId] += overlap * 0.82;
          }
        }
      }
    }

    nodeIds.forEach((nodeId) => {
      const node = nodeMeta[nodeId];
      const parent = node.parentId ? nodeMeta[node.parentId] : null;
      const minRadius = Math.max(
        baseRingRadius + (node.depth - 1) * ringStep * 0.62,
        parent ? parent.radius + parentChildGap : baseRingRadius
      );
      const maxRadius = node.preferredRadius + ringStep * 1.4;
      const nextAngle = node.angle + angleDelta[nodeId] + normalizeAngle(node.preferredAngle - node.angle) * 0.12;
      const nextRadius = node.radius + radiusDelta[nodeId] + (node.preferredRadius - node.radius) * 0.18;

      node.angle = clamp(nextAngle, node.branchStart, node.branchEnd);
      node.radius = clamp(nextRadius, minRadius, maxRadius);
    });
  }

  nodeIds.forEach((nodeId) => {
    const node = nodeMeta[nodeId];
    const parent = node.parentId ? nodeMeta[node.parentId] : null;
    const minRadius = Math.max(
      baseRingRadius + (node.depth - 1) * ringStep * 0.62,
      parent ? parent.radius + parentChildGap : baseRingRadius
    );

    node.angle = clamp(node.angle, node.branchStart, node.branchEnd);
    node.radius = Math.max(node.radius, minRadius);
  });
}

function enforceBranchSpacing({
  nodeIds,
  nodeMeta,
  nodeOrder,
  minNodeDistance,
  parentChildGap,
  baseRingRadius,
  ringStep
}: EnforceBranchOptions): void {
  if (!nodeIds.length) return;
  const targetMinDistance = getLayoutMinDistance(minNodeDistance);

  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;

    for (let leftIndex = 0; leftIndex < nodeIds.length; leftIndex += 1) {
      const leftId = nodeIds[leftIndex];
      const left = nodeMeta[leftId];
      const leftPoint = toCartesian(left.radius, left.angle);

      for (let rightIndex = leftIndex + 1; rightIndex < nodeIds.length; rightIndex += 1) {
        const rightId = nodeIds[rightIndex];
        const right = nodeMeta[rightId];
        const rightPoint = toCartesian(right.radius, right.angle);
        const dx = rightPoint.x - leftPoint.x;
        const dy = rightPoint.y - leftPoint.y;
        const distance = Math.hypot(dx, dy);

        if (distance >= targetMinDistance) continue;

        moved = true;
        const overlap = targetMinDistance - distance;
        const rawDiff = normalizeAngle(right.angle - left.angle);
        const preferredDiff = normalizeAngle(right.preferredAngle - left.preferredAngle);
        const orderDiff = (nodeOrder.get(rightId) ?? 0) - (nodeOrder.get(leftId) ?? 0);
        const direction = Math.sign(rawDiff || preferredDiff || orderDiff || 1);
        const avgRadius = Math.max((left.radius + right.radius) / 2, baseRingRadius * 0.75);
        const angularPush = Math.min(0.22, (overlap / avgRadius) * 1.2);

        left.angle = clamp(left.angle - direction * angularPush * 0.5, left.branchStart, left.branchEnd);
        right.angle = clamp(right.angle + direction * angularPush * 0.5, right.branchStart, right.branchEnd);

        if (left.depth === right.depth) {
          const outwardId = orderDiff >= 0 ? rightId : leftId;
          nodeMeta[outwardId].radius += overlap * 0.9;
        } else {
          const deeperId = left.depth > right.depth ? leftId : rightId;
          nodeMeta[deeperId].radius += overlap * 0.85;
        }
      }
    }

    nodeIds.forEach((nodeId) => {
      const node = nodeMeta[nodeId];
      const parent = node.parentId ? nodeMeta[node.parentId] : null;
      const minRadius = Math.max(
        baseRingRadius + (node.depth - 1) * ringStep * 0.62,
        parent ? parent.radius + parentChildGap : baseRingRadius
      );
      const maxRadius = node.preferredRadius + ringStep * 1.6;

      node.angle = clamp(node.angle, node.branchStart, node.branchEnd);
      node.radius = clamp(node.radius, minRadius, maxRadius);
    });

    if (!moved) break;
  }
}

export function computeTechTreeLayout({
  nodes,
  branchOrder,
  nodeRadius = TECH_TREE_LAYOUT_DEFAULTS.nodeRadius,
  baseRingRadius = TECH_TREE_LAYOUT_DEFAULTS.baseRingRadius,
  ringStep = TECH_TREE_LAYOUT_DEFAULTS.ringStep,
  labelMaxWidth = TECH_TREE_LAYOUT_DEFAULTS.labelMaxWidth,
  branchSectorRatio = TECH_TREE_LAYOUT_DEFAULTS.branchSectorRatio,
  minNodeDistance = TECH_TREE_LAYOUT_DEFAULTS.minNodeDistance,
  parentChildGap = TECH_TREE_LAYOUT_DEFAULTS.parentChildGap,
  iterations = TECH_TREE_LAYOUT_DEFAULTS.iterations
}: ComputeLayoutOptions): TechTreeLayoutResult {
  const { positions, nodeMeta, branchSectors, maxDepth } = placePreferredPositions({
    nodes,
    branchOrder,
    baseRingRadius,
    ringStep,
    branchSectorRatio
  });
  const { nodeOrder } = buildGraph(nodes);

  branchOrder.forEach((branch) => {
    const branchNodeIds = nodes
      .filter((node) => node.branch === branch)
      .map((node) => node.id)
      .sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0));

    relaxBranchLayout({
      nodeIds: branchNodeIds,
      nodeMeta,
      nodeOrder,
      minNodeDistance,
      parentChildGap,
      baseRingRadius,
      ringStep,
      iterations
    });

    enforceBranchSpacing({
      nodeIds: branchNodeIds,
      nodeMeta,
      nodeOrder,
      minNodeDistance,
      parentChildGap,
      baseRingRadius,
      ringStep
    });
  });

  Object.keys(nodeMeta).forEach((nodeId) => {
    const node = nodeMeta[nodeId];
    positions[nodeId] = toCartesian(node.radius, node.angle);
  });

  return {
    positions,
    nodeMeta,
    branchSectors,
    maxDepth,
    contentBounds: measureContentBounds(positions, nodeRadius, labelMaxWidth)
  };
}
