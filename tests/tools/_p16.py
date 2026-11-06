def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        assert old in s, (path, old[:80])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8', newline='').write(s)

edit('src/lib/design/surgery.ts', [
# pinned areas + baseline-relative acceptance
("design: StructuredDesignJSON, cells: Cell[], floor: number, movableIds: string[], newRooms: PRoom[], extraPairs: PairSpec[], hot: boolean, extraRegion: Rect[] = []\n): Cell[] | null {",
 "design: StructuredDesignJSON, cells: Cell[], floor: number, movableIds: string[], newRooms: PRoom[], extraPairs: PairSpec[], hot: boolean, extraRegion: Rect[] = [], pinned: Record<string, number> = {}\n): Cell[] | null {"),
("  const rooms: PRoom[] = [...movable.map(pRoomOf), ...newRooms];\n", "  const rooms: PRoom[] = [...movable.map(pRoomOf), ...newRooms];\n  // A size the client asked for is a requirement of this edit, not a hint: the room may not come back smaller.\n  rooms.forEach((r) => { const want = pinned[r.id]; if (want) { r.target = want; r.minArea = Math.max(r.minArea, want * 0.93); } });\n"),
("  let best: FloorSolution | null = null;\n  for (let attempt = 0; attempt < 4; attempt++) {", "  // Rules the plan already bent before the edit are not held against the edit.\n  const baseRooms = movable.map(pRoomOf);\n  const baseCtx: EnergyCtx = { ...ctx, rooms: baseRooms, fixed };\n  const baseline = baseRooms.length === rooms.length - newRooms.length && !extraRegion.length ? hardCost(baseCtx, movable.map((c) => c.rect)) : 0;\n  const allowed = Math.max(0.25, baseline + 0.1);\n  let best: FloorSolution | null = null;\n  for (let attempt = 0; attempt < 4; attempt++) {"),
("    if (hardCost(ctx, best.rects) < 0.25 && attempt >= 1) break;\n  }\n  if (!best || hardCost(ctx, best.rects) > 0.25) return null;", "    if (hardCost(ctx, best.rects) < allowed && attempt >= 1) break;\n  }\n  if (!best || hardCost(ctx, best.rects) > allowed) return null;"),
# resize: escalate neighbours and pin the requested area
("""      const ids = [cell.id, ...neighboursOf(cell, cells).filter((n) => !FIXED_TYPES.includes(n.type)).slice(0, 3).map((n) => n.id)];
      const resolved = resolveRegion(design, cells.map((c) => (c.id === cell.id ? { ...c, program: c.program ? { ...c.program, areaSqFt: Math.round(wanted) } : c.program } : c)).map((c) => (c.id === cell.id ? { ...c, rect: c.rect } : c)), cell.floor, ids, [], [], !!request.hot);""",
 """      const ring = neighboursOf(cell, cells).filter((n) => !FIXED_TYPES.includes(n.type));
      let resolved: Cell[] | null = null;
      for (const size of [2, 3, 4, 5]) {
        const ids = [cell.id, ...ring.slice(0, size).map((n) => n.id)];
        // Keep each room together with its own bath or dressing room.
        cells.filter((c) => ids.includes(c.room?.attachedTo || '') && !ids.includes(c.id)).forEach((c) => ids.push(c.id));
        resolved = resolveRegion(design, cells, cell.floor, ids, [], [], !!request.hot, [], { [cell.id]: wanted });
        if (resolved) break;
      }"""),
# add room: escalate group sizes up to 6
("        for (let grow = 0; grow < 4; grow++) {", "        for (let grow = 0; grow < 5; grow++) {"),
("          if (regionArea >= needMin * 1.08) break;", "          if (regionArea >= needMin * 1.25) break;"),
])
