def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        assert old in s, (path, old[:80])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8', newline='').write(s)

edit('src/lib/design/surgery.ts', [
("  if (minNeed > regionArea + 1e-6) return null;", "  if (process.env.SURGERY_DEBUG) console.log('[surgery] region', Math.round(regionArea), 'need', Math.round(need), 'min', Math.round(minNeed), 'rooms', rooms.map((r) => r.name).join(','), 'pieces', usePieces.length);\n  if (minNeed > regionArea + 1e-6) return null;"),
("  if (!best || hardCost(ctx, best.rects) > allowed) return null;", "  if (process.env.SURGERY_DEBUG && best) { const parts: Record<string, number> = {}; layoutEnergy(ctx, best.rects, parts); console.log('[surgery] hard', hardCost(ctx, best.rects).toFixed(2), 'allowed', allowed.toFixed(2), JSON.stringify(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * 10) / 10]))));}\n  if (!best || hardCost(ctx, best.rects) > allowed) return null;"),
("import { mulberry32, partitionUnion } from './planner/slicing';", "import { mulberry32, partitionUnion } from './planner/slicing';\nimport { layoutEnergy } from './planner/energy';"),
])

edit('src/lib/design/planner/index.ts', [
("  if (bandResult.ok) {\n    consider('band',", "  // An edit that must keep rooms where they are skips the band solver, which knows nothing about the old positions.\n  if (bandResult.ok && !options.anchors) {\n    consider('band',"),
("  ranked.sort((a, b) => (avoid.has(a.id) ? 1 : 0) - (avoid.has(b.id) ? 1 : 0) || rankScore(b) - rankScore(a));", """  // When editing, a plan that keeps rooms where they were is worth more than a slightly better-scoring rearrangement.
  const moved = (r: RankedPlan) => {
    if (!options.anchors) return 0;
    let count = 0;
    let total = 0;
    for (const cell of designCells(r.success.design)) {
      const old = options.anchors.get(cell.id);
      if (!old || cell.type === 'void') continue;
      total++;
      if (Math.abs(cell.rect.x - old.x) > 1.5 || Math.abs(cell.rect.y - old.y) > 1.5 || Math.abs(cell.rect.w - old.w) > 1.5 || Math.abs(cell.rect.d - old.d) > 1.5) count++;
    }
    return total ? count / total : 0;
  };
  const adjusted = (r: RankedPlan) => rankScore(r) - moved(r) * 30;
  ranked.sort((a, b) => (avoid.has(a.id) ? 1 : 0) - (avoid.has(b.id) ? 1 : 0) || adjusted(b) - adjusted(a));"""),
("import { computeEnvelope, validatePolygon } from './envelope';", "import { computeEnvelope, validatePolygon } from './envelope';\nimport { designCells } from '@/lib/geometry/planGeometry';"),
])
