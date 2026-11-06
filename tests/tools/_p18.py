def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        assert old in s, (path, old[:80])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8', newline='').write(s)

edit('src/lib/design/planner/model.ts', [
("  hardBoost?: number;\n}", "  hardBoost?: number;\n  /** Where each room used to be (by id). Rooms are pulled back toward these positions so an edit does not make rooms jump. */\n  anchors?: Map<string, Rect>;\n  /** Cost per foot of displacement from the anchor (default 0.18). */\n  stayWeight?: number;\n  /** Rooms that are meant to change (their anchor is only a weak pull). */\n  freeIds?: Set<string>;\n}"),
])

edit('src/lib/design/planner/energy.ts', [
("  reached: Uint8Array;\n  hops: Int16Array;\n}\nconst cache", "  reached: Uint8Array;\n  hops: Int16Array;\n  anchor: (Rect | undefined)[];\n}\nconst cache"),
("transitSide: new Float64Array(N * 4), openLight: new Float64Array(N), reached: new Uint8Array(N), hops: new Int16Array(N)\n  };", "transitSide: new Float64Array(N * 4), openLight: new Float64Array(N), reached: new Uint8Array(N), hops: new Int16Array(N),\n    anchor: rooms.map((r) => ctx.anchors?.get(r.id))\n  };"),
("  // ---- Regularity: fewer distinct wall lines", """  // ---- Stability: rooms stay where they were unless the edit needs them to move ----
  if (ctx.anchors) {
    const base = ctx.stayWeight ?? 0.18;
    for (let i = 0; i < m; i++) {
      const a = prep.anchor[i];
      if (!a) continue;
      const free = ctx.freeIds?.has(rooms[i].id);
      const weight = free ? base * 0.25 : base;
      const r = R[i];
      add('stay', weight * (Math.abs(r.x + r.w / 2 - (a.x + a.w / 2)) + Math.abs(r.y + r.d / 2 - (a.y + a.d / 2)) + 0.4 * (Math.abs(r.w - a.w) + Math.abs(r.d - a.d))));
    }
  }

  // ---- Regularity: fewer distinct wall lines"""),
])

edit('src/lib/design/planner/optimizer.ts', [
("  /** Stop retrying once this much time has passed (ms).", "  /** Where rooms were before an edit (by id). Plans that keep rooms where they were are preferred. */\n  anchors?: Map<string, Rect>;\n  /** Rooms the edit is about: they may move freely. */\n  freeIds?: Set<string>;\n  /** Stop retrying once this much time has passed (ms)."),
("      rooms, fixed, footprint: fp, frontY: fp.y, floor, floors, arch, pairs, hot, compass, tight, groundLines: ground\n    });", "      rooms, fixed, footprint: fp, frontY: fp.y, floor, floors, arch, pairs, hot, compass, tight, groundLines: ground,\n      anchors: opts.anchors, freeIds: opts.freeIds\n    });"),
("function footprintCandidates(env: Envelope, area: number): Footprint[] {\n  const out: Footprint[] = [];", "function footprintCandidates(env: Envelope, area: number, previous?: Rect): Footprint[] {\n  const out: Footprint[] = [];\n  // An edit keeps the footprint the house already has when the programme still fits in it.\n  if (previous && env.fits(previous) && previous.w * previous.d >= area * 0.96) out.push({ rect: previous, label: 'existing footprint' });"),
("    const footprints = footprintCandidates(env, groundArea);", "    const previousFootprint = opts.anchors ? (() => {\n      const rs = groundRooms.map((r) => opts.anchors!.get(r.id)).filter((r): r is Rect => !!r);\n      if (rs.length < 3) return undefined;\n      const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));\n      return { x: x0, y: y0, w: Math.max(...rs.map((r) => r.x + r.w)) - x0, d: Math.max(...rs.map((r) => r.y + r.d)) - y0 };\n    })() : undefined;\n    const footprints = footprintCandidates(env, groundArea, previousFootprint);"),
])

edit('src/lib/design/surgery.ts', [
("    groundLines: ground.length ? groundLines(ground.map((c) => c.rect), ground.map(pRoomOf)) : undefined\n  };", "    groundLines: ground.length ? groundLines(ground.map((c) => c.rect), ground.map(pRoomOf)) : undefined,\n    // Rooms that are not the subject of the edit keep to where they were; only a nudge is allowed.\n    anchors: new Map(movable.map((c) => [c.id, c.rect] as [string, Rect])),\n    freeIds: new Set([...Object.keys(pinned), ...newRooms.map((r) => r.id)]),\n    stayWeight: 0.35\n  };"),
])

edit('src/lib/design/whatIf.ts', [
("    const stage = realiseProgram(applied.program, site, applied.constraints, { hot: constraints.modes.includes('climate_adaptive'), intent: design.program?.intent });", "    // The old positions pull the new plan back toward them, so a full re-plan moves as little as the change allows.\n    const anchors = new Map<string, Rect>(designCells(design).map((c) => [c.id, c.rect] as [string, Rect]));\n    const freeIds = new Set(delta.ops.flatMap((op) => ('target' in op && op.target ? [applied.program.rooms.find((r) => r.id === op.target || r.name === op.target)?.id || op.target] : [])));\n    const stage = realiseProgram(applied.program, site, applied.constraints, { hot: constraints.modes.includes('climate_adaptive'), intent: design.program?.intent, anchors, freeIds, effort: 1.3 });"),
("import { EditDiff,", "import { Rect, designCells } from '@/lib/geometry/planGeometry';\nimport { EditDiff,"),
])
