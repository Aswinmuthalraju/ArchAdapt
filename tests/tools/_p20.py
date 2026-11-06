def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        assert old in s, (path, old[:80])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8', newline='').write(s)

edit('src/lib/design/planner/slicing.ts', [
("/** Splits a rectilinear region", """/**
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

/** Splits a rectilinear region"""),
])

edit('src/lib/design/surgery.ts', [
("import { mulberry32, partitionUnion } from './planner/slicing';", "import { SNode, insertBeside, leafIds, mulberry32, partitionUnion, realize, treeFromRects } from './planner/slicing';"),
# rectangular-region path: keep the topology, change the proportions
("""  let best: FloorSolution | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const rng = mulberry32(1234 + attempt * 77);
    const start = startTrees(rooms, usePieces, rng, ARCHETYPES[archId], floor);""", """  let best: FloorSolution | null = null;
  // When the rooms fill a rectangle, keep the way they are cut up and only change the proportions (and place any new room beside a neighbour).
  const bbox: Rect = { x: Math.min(...regionRects.map((r) => r.x)), y: Math.min(...regionRects.map((r) => r.y)), w: 0, d: 0 };
  bbox.w = Math.max(...regionRects.map((r) => r.x + r.w)) - bbox.x;
  bbox.d = Math.max(...regionRects.map((r) => r.y + r.d)) - bbox.y;
  const rectangular = Math.abs(area(bbox) - regionArea) < 1.5;
  const starts: SNode[][] = [];
  if (rectangular) {
    const existingItems = movable.map((c, i) => ({ id: i, rect: c.rect }));
    const known = extraRegion.length ? null : treeFromRects(existingItems, bbox);
    if (known) {
      const newIds = newRooms.map((_, k) => movable.length + k);
      let seeds: SNode[] = [known];
      for (const nid of newIds) {
        const grown: { tree: SNode; e: number }[] = [];
        for (const base of seeds) {
          for (const near of leafIds(base)) for (const c of ['V', 'H'] as const) for (const first of [true, false]) {
            const tree = insertBeside(base, near, nid, c, first);
            const out: Rect[] = new Array(rooms.length);
            realize(tree, bbox, { weight: rooms.map((r) => Math.max(8, r.target)), strip: rooms.map((r) => r.strip) }, out);
            if (out.some((r, i) => i <= nid && !r)) continue;
            grown.push({ tree, e: layoutEnergy(ctx, out.slice(0, rooms.length)) });
          }
        }
        seeds = grown.sort((p, q) => p.e - q.e).slice(0, 4).map((g) => g.tree);
      }
      seeds.forEach((tree) => starts.push([tree]));
    }
  }
  const evaluate = (sol: FloorSolution) => hardCost(ctx, sol.rects);
  for (const tree of starts) {
    const sol = anneal(ctx, rectangular ? [bbox] : usePieces, tree, 1500, mulberry32(5), 1.2, 0.05);
    const fixedSol = repair(ctx, rectangular ? [bbox] : usePieces, sol, 1500, mulberry32(11));
    if (!best || evaluate(fixedSol) < evaluate(best) - 0.2 || (Math.abs(evaluate(fixedSol) - evaluate(best)) <= 0.2 && fixedSol.energy < best.energy)) best = fixedSol;
    if (evaluate(best) < allowed) break;
  }
  for (let attempt = 0; attempt < 4 && (!best || evaluate(best) > allowed); attempt++) {
    const rng = mulberry32(1234 + attempt * 77);
    const start = startTrees(rooms, usePieces, rng, ARCHETYPES[archId], floor);"""),
("    if (hardCost(ctx, best.rects) < allowed && attempt >= 1) break;\n  }", "  }"),
# resize: try groups that form a rectangle first
("""      for (const size of [2, 3, 4, 5]) {
        const ids = [cell.id, ...ring.slice(0, size).map((n) => n.id)];
        // Keep each room together with its own bath or dressing room.
        cells.filter((c) => ids.includes(c.room?.attachedTo || '') && !ids.includes(c.id)).forEach((c) => ids.push(c.id));
        resolved = resolveRegion(design, cells, cell.floor, ids, [], [], !!request.hot, [], { [cell.id]: wanted });
        if (resolved) break;
      }""", """      const groups: string[][] = [];
      const pool = ring.slice(0, 5);
      const subsets = (n: number): number[][] => (n === 0 ? [[]] : subsets(n - 1).flatMap((s) => [s, [...s, n - 1]]));
      for (const pick of subsets(pool.length).filter((s) => s.length >= 1 && s.length <= 3)) {
        const ids = [cell.id, ...pick.map((k) => pool[k].id)];
        cells.filter((c) => ids.includes(c.room?.attachedTo || '') && !ids.includes(c.id)).forEach((c) => ids.push(c.id));
        const rects = cells.filter((c) => ids.includes(c.id)).map((c) => c.rect);
        const bx = Math.min(...rects.map((r) => r.x)), by = Math.min(...rects.map((r) => r.y));
        const bw = Math.max(...rects.map((r) => r.x + r.w)) - bx, bd = Math.max(...rects.map((r) => r.y + r.d)) - by;
        const rectangular = Math.abs(bw * bd - sum(rects.map(area))) < 1.5;
        groups.push(ids);
        void rectangular;
      }
      const scored = groups.map((ids) => {
        const rects = cells.filter((c) => ids.includes(c.id)).map((c) => c.rect);
        const bx = Math.min(...rects.map((r) => r.x)), by = Math.min(...rects.map((r) => r.y));
        const bw = Math.max(...rects.map((r) => r.x + r.w)) - bx, bd = Math.max(...rects.map((r) => r.y + r.d)) - by;
        return { ids, rectangular: Math.abs(bw * bd - sum(rects.map(area))) < 1.5, size: sum(rects.map(area)) };
      }).sort((p, q) => Number(q.rectangular) - Number(p.rectangular) || p.size - q.size).slice(0, 10);
      for (const group of scored) {
        resolved = resolveRegion(design, cells, cell.floor, group.ids, [], [], !!request.hot, [], { [cell.id]: wanted });
        if (resolved) break;
      }"""),
])
