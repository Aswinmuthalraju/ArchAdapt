import { Rect } from '@/lib/geometry/planGeometry';

/**
 * A slicing tree: each internal node cuts its rectangle in two with one straight wall.
 * 'V' puts a vertical wall (children side by side, a on the left); 'H' puts a horizontal wall (a toward the road).
 * Every leaf is a room. Any arrangement of rectangles that tiles a rectangle with straight cuts is a slicing tree,
 * which is how architects draw: you cannot get a room that is "wrapped" around another.
 */
export type SNode = { l: number } | { c: 'V' | 'H'; a: SNode; b: SNode };
type Cut = Extract<SNode, { c: 'V' | 'H' }>;

export const isLeaf = (n: SNode): n is { l: number } => 'l' in n;

export type Rng = () => number;

/** Small deterministic PRNG so the same brief always yields the same plan. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function leafIds(n: SNode, out: number[] = []): number[] {
  if (isLeaf(n)) out.push(n.l);
  else { leafIds(n.a, out); leafIds(n.b, out); }
  return out;
}

const countCuts = (n: SNode): number => (isLeaf(n) ? 0 : 1 + countCuts(n.a) + countCuts(n.b));
const countLeaves = (n: SNode): number => (isLeaf(n) ? 1 : countLeaves(n.a) + countLeaves(n.b));

/** Rebuilds the tree, replacing the k-th cut (pre-order) with fn(cut). */
function mapCut(n: SNode, k: number, fn: (c: Cut) => SNode, ctr = { i: 0 }): SNode {
  if (isLeaf(n)) return n;
  if (ctr.i++ === k) return fn(n);
  const a = mapCut(n.a, k, fn, ctr);
  const b = mapCut(n.b, k, fn, ctr);
  return a === n.a && b === n.b ? n : { c: n.c, a, b };
}

/** Rebuilds the tree, replacing the k-th leaf (left to right) with fn(leaf). */
function mapLeaf(n: SNode, k: number, fn: (l: { l: number }) => SNode, ctr = { i: 0 }): SNode {
  if (isLeaf(n)) return ctr.i++ === k ? fn(n) : n;
  const a = mapLeaf(n.a, k, fn, ctr);
  const b = mapLeaf(n.b, k, fn, ctr);
  return a === n.a && b === n.b ? n : { c: n.c, a, b };
}

function removeLeaf(n: SNode, id: number): SNode | null {
  if (isLeaf(n)) return n.l === id ? null : n;
  const a = removeLeaf(n.a, id);
  const b = removeLeaf(n.b, id);
  if (a === n.a && b === n.b) return n;
  if (!a) return b;
  if (!b) return a;
  return { c: n.c, a, b };
}

export interface Sizing {
  /** Share of the parent each leaf asks for (normally its target area). */
  weight: number[];
  /** Leaves with a fixed thickness (passages): thickness across the cut that created them. */
  strip: (number | undefined)[];
}

function wsum(n: SNode, w: number[]): number {
  return isLeaf(n) ? w[n.l] : wsum(n.a, w) + wsum(n.b, w);
}

const snap = (v: number) => Math.round(v * 2) / 2;

/** Lays a tree out inside `rect`, writing each leaf's rectangle to out[leaf]. Cuts land on half-foot marks. */
export function realize(n: SNode, rect: Rect, sz: Sizing, out: Rect[]): void {
  if (isLeaf(n)) { out[n.l] = rect; return; }
  const total = n.c === 'V' ? rect.w : rect.d;
  const sa = wsum(n.a, sz.weight);
  const sb = wsum(n.b, sz.weight);
  let ta = total * (sa / Math.max(1e-9, sa + sb));
  const stripA = isLeaf(n.a) ? sz.strip[n.a.l] : undefined;
  const stripB = isLeaf(n.b) ? sz.strip[n.b.l] : undefined;
  if (stripA !== undefined && stripB === undefined) ta = Math.min(stripA, total * 0.5);
  else if (stripB !== undefined && stripA === undefined) ta = total - Math.min(stripB, total * 0.5);
  ta = Math.max(Math.min(snap(ta), total - 0.5), 0.5);
  if (total < 1) ta = total / 2;
  if (n.c === 'V') {
    realize(n.a, { x: rect.x, y: rect.y, w: ta, d: rect.d }, sz, out);
    realize(n.b, { x: rect.x + ta, y: rect.y, w: rect.w - ta, d: rect.d }, sz, out);
  } else {
    realize(n.a, { x: rect.x, y: rect.y, w: rect.w, d: ta }, sz, out);
    realize(n.b, { x: rect.x, y: rect.y + ta, w: rect.w, d: rect.d - ta }, sz, out);
  }
}

/** Builds a starting tree: leaves are ordered by `order`, then bisected by weight, cutting across the longer side. */
export function seedTree(ids: number[], order: (id: number) => number, weight: (id: number) => number, rect: Rect, rng: Rng, jitter = 0.15): SNode {
  const keyed = ids.map((id) => ({ id, key: order(id) + (rng() - 0.5) * jitter })).sort((p, q) => p.key - q.key).map((p) => p.id);
  const build = (list: number[], r: Rect): SNode => {
    if (list.length === 1) return { l: list[0] };
    const total = list.reduce((s, id) => s + weight(id), 0);
    // Find the split that best halves the weight while keeping order.
    let acc = 0;
    let at = 1;
    let best = Infinity;
    for (let i = 1; i < list.length; i++) {
      acc += weight(list[i - 1]);
      const diff = Math.abs(acc - total / 2);
      if (diff < best) { best = diff; at = i; }
    }
    const left = list.slice(0, at);
    const right = list.slice(at);
    const share = left.reduce((s, id) => s + weight(id), 0) / total;
    // The order runs front-to-rear when we cut H and left-to-right when we cut V; cut across the longer side.
    const c: 'V' | 'H' = r.w >= r.d * (0.85 + rng() * 0.3) ? 'V' : 'H';
    const ra: Rect = c === 'V' ? { x: r.x, y: r.y, w: r.w * share, d: r.d } : { x: r.x, y: r.y, w: r.w, d: r.d * share };
    const rb: Rect = c === 'V' ? { x: r.x + ra.w, y: r.y, w: r.w - ra.w, d: r.d } : { x: r.x, y: r.y + ra.d, w: r.w, d: r.d - ra.d };
    return { c, a: build(left, ra), b: build(right, rb) };
  };
  return build(keyed, rect);
}

export type Move = 'swap' | 'flip' | 'mirror' | 'rotate' | 'relocate' | 'cross-swap' | 'cross-move';

/** Returns a modified copy of the forest (list of trees, one per piece), or null when the move does not apply. */
export function mutate(trees: SNode[], rng: Rng, links?: [number, number][]): SNode[] | null {
  const pick = rng();
  if (links && links.length && pick < 0.16) {
    // Put a room that must touch another (a bathroom and its bedroom) right beside it.
    const [moving, anchor] = links[Math.floor(rng() * links.length)];
    const from = trees.findIndex((tr) => leafIds(tr).includes(moving));
    const to = trees.findIndex((tr) => leafIds(tr).includes(anchor));
    if (from < 0 || to < 0) return null;
    const rest = removeLeaf(trees[from], moving);
    if (!rest) return null;
    const base = from === to ? rest : trees[to];
    const k = leafIds(base).indexOf(anchor);
    if (k < 0) return null;
    const dir: 'V' | 'H' = rng() < 0.5 ? 'V' : 'H';
    const first = rng() < 0.5;
    const placed = mapLeaf(base, k, (leaf) => ({ c: dir, a: first ? { l: moving } : leaf, b: first ? leaf : { l: moving } }));
    const out2 = trees.slice();
    if (from === to) out2[from] = placed; else { out2[from] = rest; out2[to] = placed; }
    return out2;
  }
  const t = Math.floor(rng() * trees.length);
  const tree = trees[t];
  const leaves = countLeaves(tree);
  const cuts = countCuts(tree);
  const out = trees.slice();

  if (pick < 0.34) {
    // Swap two rooms (possibly in different pieces).
    const all = trees.map(countLeaves);
    const total = all.reduce((s, n) => s + n, 0);
    if (total < 2) return null;
    const locate = (k: number) => { let i = 0; while (k >= all[i]) { k -= all[i]; i++; } return { piece: i, k }; };
    const p = locate(Math.floor(rng() * total));
    const q = locate(Math.floor(rng() * total));
    if (p.piece === q.piece && p.k === q.k) return null;
    const idP = leafIds(trees[p.piece])[p.k];
    const idQ = leafIds(trees[q.piece])[q.k];
    out[p.piece] = mapLeaf(out[p.piece], p.k, () => ({ l: idQ }));
    out[q.piece] = mapLeaf(out[q.piece], q.k, () => ({ l: idP }));
    return out;
  }
  if (pick < 0.50) {
    if (!cuts) return null;
    out[t] = mapCut(tree, Math.floor(rng() * cuts), (c) => ({ c: c.c === 'V' ? 'H' : 'V', a: c.a, b: c.b }));
    return out;
  }
  if (pick < 0.62) {
    if (!cuts) return null;
    out[t] = mapCut(tree, Math.floor(rng() * cuts), (c) => ({ c: c.c, a: c.b, b: c.a }));
    return out;
  }
  if (pick < 0.76) {
    if (cuts < 2) return null;
    // Re-associate: (a,(x,y)) -> ((a,x),y) or ((x,y),b) -> (x,(y,b)).
    out[t] = mapCut(tree, Math.floor(rng() * cuts), (c) => {
      if (!isLeaf(c.b) && rng() < 0.5) return { c: c.b.c, a: { c: c.c, a: c.a, b: c.b.a }, b: c.b.b };
      if (!isLeaf(c.a)) return { c: c.a.c, a: c.a.a, b: { c: c.c, a: c.a.b, b: c.b } };
      return c;
    });
    return out;
  }
  // Move one room next to another (within a piece, or into another piece).
  const targetPiece = trees.length > 1 && rng() < 0.4 ? Math.floor(rng() * trees.length) : t;
  if (leaves < 2 && targetPiece === t) return null;
  if (leaves < 2 && trees.length > 1 && targetPiece !== t) {
    // never empty a piece
    return null;
  }
  const idx = Math.floor(rng() * leaves);
  const moving = leafIds(tree)[idx];
  const rest = removeLeaf(tree, moving);
  if (!rest) return null;
  const base = targetPiece === t ? rest : trees[targetPiece];
  const nearK = Math.floor(rng() * countLeaves(base));
  const dir: 'V' | 'H' = rng() < 0.5 ? 'V' : 'H';
  const first = rng() < 0.5;
  const placed = mapLeaf(base, nearK, (leaf) => ({ c: dir, a: first ? { l: moving } : leaf, b: first ? leaf : { l: moving } }));
  if (targetPiece === t) out[t] = placed;
  else { out[t] = rest; out[targetPiece] = placed; }
  return out;
}

/**
 * Rebuilds the slicing tree of an existing arrangement: rectangles that tile `bbox` exactly are split by a straight cut
 * that no rectangle crosses, recursively. Returns null when the arrangement is not a slicing one.
 */
export function treeFromRects(items: { id: number; rect: Rect }[], bbox: Rect): SNode | null {
  if (items.length === 0) return null;
  if (items.length === 1) return { l: items[0].id };
  const E = 0.12;
  const tries: { c: 'V' | 'H'; at: number; a: typeof items; b: typeof items }[] = [];
  const xs = Array.from(new Set(items.flatMap((it) => [it.rect.x, it.rect.x + it.rect.w]))).filter((v) => v > bbox.x + E && v < bbox.x + bbox.w - E);
  const ys = Array.from(new Set(items.flatMap((it) => [it.rect.y, it.rect.y + it.rect.d]))).filter((v) => v > bbox.y + E && v < bbox.y + bbox.d - E);
  for (const at of xs) {
    const a = items.filter((it) => it.rect.x + it.rect.w <= at + E);
    const b = items.filter((it) => it.rect.x >= at - E);
    if (a.length && b.length && a.length + b.length === items.length) tries.push({ c: 'V', at, a, b });
  }
  for (const at of ys) {
    const a = items.filter((it) => it.rect.y + it.rect.d <= at + E);
    const b = items.filter((it) => it.rect.y >= at - E);
    if (a.length && b.length && a.length + b.length === items.length) tries.push({ c: 'H', at, a, b });
  }
  tries.sort((p, q) => Math.abs(p.a.length - p.b.length) - Math.abs(q.a.length - q.b.length));
  for (const t of tries) {
    const boxA: Rect = t.c === 'V' ? { x: bbox.x, y: bbox.y, w: t.at - bbox.x, d: bbox.d } : { x: bbox.x, y: bbox.y, w: bbox.w, d: t.at - bbox.y };
    const boxB: Rect = t.c === 'V' ? { x: t.at, y: bbox.y, w: bbox.x + bbox.w - t.at, d: bbox.d } : { x: bbox.x, y: t.at, w: bbox.w, d: bbox.y + bbox.d - t.at };
    const left = treeFromRects(t.a, boxA);
    const right = left && treeFromRects(t.b, boxB);
    if (left && right) return { c: t.c, a: left, b: right };
  }
  return null;
}

/** Puts a new room beside an existing one in a tree. */
export function insertBeside(tree: SNode, near: number, id: number, c: 'V' | 'H', first: boolean): SNode {
  const at = leafIds(tree).indexOf(near);
  return mapLeaf(tree, at, (leaf) => ({ c, a: first ? { l: id } : leaf, b: first ? leaf : { l: id } }));
}

/** Splits a rectilinear region (a bounding rectangle minus blocks) into rectangles. */
export function subtractRects(region: Rect, blocks: Rect[], horizontalFirst: boolean, isFreeAt?: (cx: number, cy: number) => boolean): Rect[] {
  const xs = new Set<number>([region.x, region.x + region.w]);
  const ys = new Set<number>([region.y, region.y + region.d]);
  for (const b of blocks) {
    for (const v of [b.x, b.x + b.w]) if (v > region.x && v < region.x + region.w) xs.add(v);
    for (const v of [b.y, b.y + b.d]) if (v > region.y && v < region.y + region.d) ys.add(v);
  }
  const X = [...xs].sort((p, q) => p - q);
  const Y = [...ys].sort((p, q) => p - q);
  const free: boolean[][] = [];
  for (let j = 0; j < Y.length - 1; j++) {
    free[j] = [];
    for (let i = 0; i < X.length - 1; i++) {
      const cx = (X[i] + X[i + 1]) / 2;
      const cy = (Y[j] + Y[j + 1]) / 2;
      free[j][i] = isFreeAt ? isFreeAt(cx, cy) : !blocks.some((b) => cx > b.x && cx < b.x + b.w && cy > b.y && cy < b.y + b.d);
    }
  }
  const pieces: Rect[] = [];
  if (horizontalFirst) {
    // Runs along x in each row strip, then merge identical runs vertically.
    const open: { x0: number; x1: number; j0: number }[] = [];
    const flush = (keep: (r: { x0: number; x1: number }) => boolean, j: number) => {
      for (let k = open.length - 1; k >= 0; k--) {
        if (!keep(open[k])) { pieces.push({ x: open[k].x0, y: Y[open[k].j0], w: open[k].x1 - open[k].x0, d: Y[j] - Y[open[k].j0] }); open.splice(k, 1); }
      }
    };
    for (let j = 0; j < Y.length - 1; j++) {
      const runs: { x0: number; x1: number }[] = [];
      let start = -1;
      for (let i = 0; i <= X.length - 1; i++) {
        const isFree = i < X.length - 1 && free[j][i];
        if (isFree && start < 0) start = i;
        if (!isFree && start >= 0) { runs.push({ x0: X[start], x1: X[i] }); start = -1; }
      }
      flush((o) => runs.some((r) => Math.abs(r.x0 - o.x0) < 1e-6 && Math.abs(r.x1 - o.x1) < 1e-6), j);
      for (const r of runs) if (!open.some((o) => Math.abs(r.x0 - o.x0) < 1e-6 && Math.abs(r.x1 - o.x1) < 1e-6)) open.push({ ...r, j0: j });
    }
    flush(() => false, Y.length - 1);
  } else {
    const open: { y0: number; y1: number; i0: number }[] = [];
    const flush = (keep: (r: { y0: number; y1: number }) => boolean, i: number) => {
      for (let k = open.length - 1; k >= 0; k--) {
        if (!keep(open[k])) { pieces.push({ x: X[open[k].i0], y: open[k].y0, w: X[i] - X[open[k].i0], d: open[k].y1 - open[k].y0 }); open.splice(k, 1); }
      }
    };
    for (let i = 0; i < X.length - 1; i++) {
      const runs: { y0: number; y1: number }[] = [];
      let start = -1;
      for (let j = 0; j <= Y.length - 1; j++) {
        const isFree = j < Y.length - 1 && free[j][i];
        if (isFree && start < 0) start = j;
        if (!isFree && start >= 0) { runs.push({ y0: Y[start], y1: Y[j] }); start = -1; }
      }
      flush((o) => runs.some((r) => Math.abs(r.y0 - o.y0) < 1e-6 && Math.abs(r.y1 - o.y1) < 1e-6), i);
      for (const r of runs) if (!open.some((o) => Math.abs(r.y0 - o.y0) < 1e-6 && Math.abs(r.y1 - o.y1) < 1e-6)) open.push({ ...r, i0: i });
    }
    flush(() => false, X.length - 1);
  }
  return pieces.filter((p) => p.w > 0.4 && p.d > 0.4);
}

/** Splits the union of several rectangles into non-overlapping rectangles. */
export function partitionUnion(rects: Rect[], horizontalFirst = true): Rect[] {
  if (!rects.length) return [];
  const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.d));
  return subtractRects({ x: x0, y: y0, w: x1 - x0, d: y1 - y0 }, rects, horizontalFirst, (cx, cy) => rects.some((r) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.d));
}
