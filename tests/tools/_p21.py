def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        assert old in s, (path, old[:80])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8', newline='').write(s)

edit('src/lib/design/surgery.ts', [
("import { layoutEnergy } from './planner/energy';", "import { layoutEnergy } from './planner/energy';\nimport { Envelope, computeEnvelope } from './planner/envelope';"),
("function pRoomOf(cell: Cell): PRoom {", """const OPEN_ROOM_TYPES: RoomType[] = ['courtyard', 'void', 'terrace', 'balcony', 'parking', 'entrance'];
const coverageLimit = (plotArea: number) => Math.min(0.62, (plotArea <= 1500 ? 0.65 : plotArea <= 2500 ? 0.55 : plotArea <= 5000 ? 0.44 : plotArea <= 8000 ? 0.38 : 0.32) * 1.2);

/** Ground-floor area covered by walled rooms, as a share of the plot. */
function groundCoverage(cells: Cell[], plotArea: number): number {
  return sum(cells.filter((c) => c.floor === 0 && !OPEN_ROOM_TYPES.includes(c.type)).map((c) => area(c.rect))) / plotArea;
}

const overlaps = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.06 && Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y) > 0.06;

/**
 * The most natural way to enlarge a ground-floor room that has an outside wall: push that wall outward into the plot.
 * Nothing else moves. Only offered when the new strip fits the buildable outline and the plot keeps its open land.
 */
function planExtensions(target: Cell, cells: Cell[], deltaArea: number, env: Envelope, plotArea: number): { dir: Dir; t: number; rect: Rect }[] {
  if (target.floor !== 0 || deltaArea <= 0 || FIXED_TYPES.includes(target.type)) return [];
  const out: { dir: Dir; t: number; rect: Rect; cost: number }[] = [];
  const r = target.rect;
  for (const dir of ['left', 'right', 'front', 'rear'] as Dir[]) {
    const vertical = dir === 'left' || dir === 'right';
    const cross = vertical ? r.d : r.w;
    const t = Math.min(Math.ceil((deltaArea / cross) * 2) / 2, 14);
    if (t < 0.5) continue;
    const strip: Rect = dir === 'left' ? { x: r.x - t, y: r.y, w: t, d: r.d } : dir === 'right' ? { x: r.x + r.w, y: r.y, w: t, d: r.d } : dir === 'front' ? { x: r.x, y: r.y - t, w: r.w, d: t } : { x: r.x, y: r.y + r.d, w: r.w, d: t };
    if (cells.some((c) => c !== target && c.floor === 0 && overlaps(c.rect, strip))) continue;
    // The whole side must be an outside wall (nothing touches it).
    if (cells.some((c) => c !== target && c.floor === 0 && c.type !== 'void' && sharedEdge(r, c.rect) && ((vertical && Math.abs((dir === 'left' ? c.rect.x + c.rect.w : c.rect.x) - (dir === 'left' ? r.x : r.x + r.w)) < 0.06) || (!vertical && Math.abs((dir === 'front' ? c.rect.y + c.rect.d : c.rect.y) - (dir === 'front' ? r.y : r.y + r.d)) < 0.06)))) continue;
    if (!env.fits({ x: strip.x + 0.05, y: strip.y + 0.05, w: strip.w - 0.1, d: strip.d - 0.1 })) continue;
    const grown = { ...r };
    if (dir === 'left') { grown.x -= t; grown.w += t; } else if (dir === 'right') grown.w += t; else if (dir === 'front') { grown.y -= t; grown.d += t; } else grown.d += t;
    // Keep proportions sensible and the garden intact.
    if (Math.max(grown.w, grown.d) / Math.min(grown.w, grown.d) > maxAspectOf(target.type) + 0.2) continue;
    if (groundCoverage(cells, plotArea) + (strip.w * strip.d) / plotArea > coverageLimit(plotArea)) continue;
    // Prefer growing toward the rear or sides over the road frontage, and keep side setbacks generous.
    out.push({ dir, t, rect: grown, cost: (dir === 'front' ? 3 : 0) + t * 0.1 });
  }
  return out.sort((a, b) => a.cost - b.cost);
}

/** A new room built against an outside wall of an existing ground-floor room (a bathroom beside its bedroom, a study off the living room). */
function planAnnex(room: PRoom, hosts: Cell[], cells: Cell[], env: Envelope, plotArea: number): { rect: Rect; host: Cell }[] {
  const options: { rect: Rect; host: Cell; cost: number }[] = [];
  const target = Math.max(room.minArea * 1.05, room.target);
  for (const host of hosts) {
    if (host.floor !== 0 || FIXED_TYPES.includes(host.type)) continue;
    const r = host.rect;
    for (const dir of ['left', 'right', 'front', 'rear'] as Dir[]) {
      const vertical = dir === 'left' || dir === 'right';
      const sideLen = vertical ? r.d : r.w;
      if (sideLen < room.minSide + 0.4) continue;
      // Along the wall: as long as the host's wall allows (at most 1.6x the natural size); outward: the rest of the area.
      const along = Math.min(sideLen, Math.max(room.minSide, Math.sqrt(target * 1.3)));
      const out = Math.max(room.minSide, Math.ceil((target / along) * 2) / 2);
      for (const corner of [0, 1]) {
        const offset = corner === 0 ? 0 : sideLen - along;
        const rect: Rect = dir === 'left' ? { x: r.x - out, y: r.y + offset, w: out, d: along } : dir === 'right' ? { x: r.x + r.w, y: r.y + offset, w: out, d: along } : dir === 'front' ? { x: r.x + offset, y: r.y - out, w: along, d: out } : { x: r.x + offset, y: r.y + r.d, w: along, d: out };
        const snapped = { x: round2(rect.x), y: round2(rect.y), w: round2(rect.w), d: round2(rect.d) };
        if (cells.some((c) => c.floor === 0 && overlaps(c.rect, snapped))) continue;
        if (!env.fits({ x: snapped.x + 0.05, y: snapped.y + 0.05, w: snapped.w - 0.1, d: snapped.d - 0.1 })) continue;
        // The strip must be wholly outside the building: no other room's wall may touch the side it is built on.
        if (groundCoverage(cells, plotArea) + (snapped.w * snapped.d) / plotArea > coverageLimit(plotArea)) continue;
        const aspect = Math.max(snapped.w, snapped.d) / Math.min(snapped.w, snapped.d);
        if (aspect > maxAspectOf(room.type) + 0.2) continue;
        options.push({ rect: snapped, host, cost: (dir === 'front' ? 3 : 0) + aspect * 0.2 + (corner === 1 ? 0.05 : 0) });
      }
    }
  }
  return options.sort((a, b) => a.cost - b.cost).slice(0, 12);
}

function pRoomOf(cell: Cell): PRoom {"""),
# resize: extension first
("""      // Try the cheapest clean wall first; keep the first one that leaves a plan every rule still accepts.
      let pushed = false;""", """      // The most natural move first: push an outside wall outward. Nothing else in the house changes.
      const plotArea = design.plot.polygon ? design.plot.totalArea || design.plot.width * design.plot.depth : design.plot.width * design.plot.depth;
      const env = computeEnvelope(request.site);
      let pushed = false;
      for (const ext of planExtensions(cell, cells, delta, env, plotArea)) {
        const trial = cells.map((c) => (c.id === cell.id ? { ...c, rect: { x: round2(ext.rect.x), y: round2(ext.rect.y), w: round2(ext.rect.w), d: round2(ext.rect.d) } } : c));
        const probe = rebuild(request, trial, []);
        if (!probe || !validateFloorPlan(probe).isValid) continue;
        cells = trial;
        achievedInfo = { wanted: Math.round(wanted), got: Math.round(area(trial.find((c) => c.id === cell.id)!.rect)), roomName: cell.name, before: Math.round(area(cell.rect)) };
        notes.push(`${cell.name} grew by pushing its ${ext.dir} outside wall ${ext.t} ft into the plot. No other room moved or changed size.`);
        pushed = true;
        break;
      }
      if (pushed) continue;
      // Otherwise slide an inside wall: the cheapest first; keep the first that leaves a plan every rule still accepts."""),
# add room: annex first
("""      const seeds = anchor ? [anchor] : [...pool]""", """      if (floor === 0) {
        const plotArea = design.plot.width * design.plot.depth;
        const env = computeEnvelope(request.site);
        const hosts = anchor ? [anchor] : [...onFloor.filter((c) => ['living', 'dining', 'lounge', 'bedroom', 'master_bedroom', 'kitchen'].includes(c.type))];
        for (const option of planAnnex(newRoom, hosts, cells, env, plotArea)) {
          const cell: Cell = { id: newRoom.id, name: newRoom.name, type: newRoom.type, floor: 0, rect: option.rect, room: null, program: newRoom.ref };
          const trial = [...cells, cell];
          const probe = rebuild(request, trial, []);
          if (!probe || !validateFloorPlan(probe).isValid) continue;
          cells = trial;
          chosen = [option.host];
          notes.push(`${added.name} was built against an outside wall of ${option.host.name}, so no existing room moved or changed size.`);
          break;
        }
        if (chosen) { placedOn = 0; break; }
      }
      const seeds = anchor ? [anchor] : [...pool]"""),
])
