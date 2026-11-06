def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        assert old in s, (path, old[:80])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8', newline='').write(s)

# displacement guard in local re-solve
edit('src/lib/design/surgery.ts', [
("  if (!best || hardCost(ctx, best.rects) > allowed) return null;", """  if (!best || hardCost(ctx, best.rects) > allowed) return null;
  // Rooms the edit is not about may be nudged, never relocated: a bedroom must not jump from the back of the house to the road.
  for (let i = 0; i < rooms.length; i++) {
    const old = movable.find((c) => c.id === rooms[i].id);
    if (!old || pinned[old.id]) continue;
    const r = best.rects[i];
    const shift = Math.hypot(r.x + r.w / 2 - old.rect.x - old.rect.w / 2, r.y + r.d / 2 - old.rect.y - old.rect.d / 2);
    const resize = Math.abs(area(r) - area(old.rect)) / area(old.rect);
    if (shift > 6.5 || resize > 0.4) return null;
  }"""),
])

# warm start for the ground floor of a full re-plan
edit('src/lib/design/planner/optimizer.ts', [
("import { Rng, SNode, Sizing, isLeaf, leafIds, mulberry32, mutate, realize, seedTree, subtractRects } from './slicing';", "import { Rng, SNode, Sizing, insertBeside, isLeaf, leafIds, mulberry32, mutate, realize, seedTree, subtractRects, treeFromRects } from './slicing';"),
("export function hardCost(", """/** Rebuilds the previous arrangement as a starting point, so a re-plan after an edit begins from the plan the client already knows. */
export function warmStart(ctx: EnergyCtx, rooms: PRoom[], piece: Rect, anchors?: Map<string, Rect>): SNode[] | null {
  if (!anchors) return null;
  const known = rooms.map((r, i) => ({ id: i, rect: anchors.get(r.id) })).filter((x): x is { id: number; rect: Rect } => !!x.rect);
  if (known.length < 2) return null;
  const x0 = Math.min(...known.map((k) => k.rect.x)), y0 = Math.min(...known.map((k) => k.rect.y));
  const box: Rect = { x: x0, y: y0, w: Math.max(...known.map((k) => k.rect.x + k.rect.w)) - x0, d: Math.max(...known.map((k) => k.rect.y + k.rect.d)) - y0 };
  if (Math.abs(box.w * box.d - known.reduce((s, k) => s + k.rect.w * k.rect.d, 0)) > 3) return null;
  let tree = treeFromRects(known, box);
  if (!tree) return null;
  const sizing = sizingFor(rooms);
  const knownIds = new Set(known.map((k) => k.id));
  for (let id = 0; id < rooms.length; id++) {
    if (knownIds.has(id)) continue;
    let best: { tree: SNode; e: number } | null = null;
    for (const near of leafIds(tree)) for (const c of ['V', 'H'] as const) for (const first of [true, false]) {
      const cand = insertBeside(tree, near, id, c, first);
      const out: Rect[] = new Array(rooms.length);
      realize(cand, piece, sizing, out);
      if (leafIds(cand).some((l) => !out[l])) continue;
      const partial = out.map((r, i) => r || { x: piece.x, y: piece.y, w: 1, d: 1 });
      const e = layoutEnergy(ctx, partial);
      if (!best || e < best.e) best = { tree: cand, e };
    }
    if (best) tree = best.tree;
  }
  return [tree];
}

export function hardCost("""),
("    let ground = anneal(ctx0, [fpRect], bestGround!.trees, iterations(4200 * tightness), mulberry32(seedBase + 2), 3.2, 0.04);", """    const warm = warmStart(ctx0, groundRooms, fpRect, opts.anchors);
    let ground = warm
      ? anneal(ctx0, [fpRect], warm, iterations(2600), mulberry32(seedBase + 2), 1.4, 0.04)
      : anneal(ctx0, [fpRect], bestGround!.trees, iterations(4200 * tightness), mulberry32(seedBase + 2), 3.2, 0.04);"""),
("    const restarts = tightness > 1 ? 4 : 1;", "    const restarts = warm ? 0 : tightness > 1 ? 4 : 1;"),
])
