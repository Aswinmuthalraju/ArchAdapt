import { DesignIntent, RoomType, StructuredDesignJSON } from '@/types/architectural';
import { ROOM_TYPE_SPECS, inferRoomType, isBedroomType } from './roomTypes';
import { designCells, exteriorSegments, planCompass, sharedEdge, PlanCell } from '@/lib/geometry/planGeometry';
import { validateFloorPlan } from './validateFloorPlan';

export interface QualityMetrics {
  valid: boolean;
  errors: string[];
  /** Rooms that cannot be reached from the entrance or stair without crossing a bedroom. */
  unreachableRooms: number;
  /** Bedrooms entered straight from living, dining, kitchen or the entrance rather than a passage, landing or stair. */
  exposedBedrooms: number;
  bedrooms: number;
  /** Mean number of doors between the entrance (or the stair, upstairs) and a bedroom. */
  avgDoorsToBedroom: number;
  /** Passage and lobby area as a share of enclosed area. */
  circulationShare: number;
  undersizedRooms: string[];
  elongatedRooms: string[];
  /** Habitable rooms more than 1.9x the standard size for their type. */
  oversizedRooms: string[];
  /** Open terrace or balcony area as a share of enclosed area (a big dead terrace is wasted plan). */
  openAreaShare: number;
  /** Distinct interior wall lines per room: lower reads as a calmer, more buildable plan. */
  wallLinesPerRoom: number;
  adjacencySatisfied: number;
  adjacencyRequired: number;
  habitableRooms: number;
  habitableWithWindow: number;
  habitableBorrowingLight: number;
  /** Bedrooms and the living room with windows on two different walls (cross ventilation). */
  crossVentilated: number;
  crossVentilationCandidates: number;
  /** Ground enclosed + open-roofed area over the buildable area (not a quality target on its own). */
  envelopeUtilization: number;
  groundCoverage: number;
  /** Rooms (as listed) whose rectangle sticks out of the buildable region. */
  envelopeViolations: number;
  /** Mean distance (ft) from a wet room to the nearest other wet room on its floor. */
  wetClusterDistance: number;
  /** Share of upper-floor bathrooms that sit over a wet room of the floor below. */
  wetStacked: number;
  /** Share of upper-floor wall length that sits on a ground-floor wall line. */
  structuralStacking: number;
  totalBuiltUpAreaSqFt: number;
  /** Share of the client's stated adjacency/privacy wishes that the plan honours (1 when none were stated). */
  intentSatisfaction: number;
  intentChecked: number;
  /** Sun-facing wall length of bedrooms, living and kitchen weighted by how hot that compass side is, per 100 sq ft of those rooms. Only judged in warm climates. */
  solarLoad: number;
  /** Share of upper-floor enclosed area that stands over ground-floor enclosed rooms (1 = no unsupported overhang). */
  upperSupport: number;
  /** Share of the ground-floor enclosed footprint that the floor above covers with enclosed rooms (not open terrace). */
  upperCoverage: number;
  /** Mean enclosed area / bounding-box area per floor: 1 is a clean rectangle, low is a ragged outline. */
  outlineCompactness: number;
}

export interface QualityReport {
  /** 0-100. Zero when the plan fails validation. */
  score: number;
  metrics: QualityMetrics;
  parts: { key: string; label: string; weight: number; score: number; detail: string }[];
}

const TRANSIT: RoomType[] = ['entrance', 'living', 'dining', 'lounge', 'passage', 'stair', 'courtyard'];
const PROTECTED: RoomType[] = ['lounge', 'passage', 'stair'];
const EXPOSED: RoomType[] = ['living', 'dining', 'entrance', 'kitchen'];
const WET: RoomType[] = ['kitchen', 'bathroom', 'utility'];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const HEAT: Record<string, number> = { N: 0, NE: 0, E: 1, NW: 2, SE: 2, S: 3, W: 5, SW: 5 };

export function evaluateDesign(design: StructuredDesignJSON, options: { hot?: boolean; intent?: DesignIntent } = {}): QualityReport {
  const report = validateFloorPlan(design);
  const cells = designCells(design);
  const byId = new Map(cells.map((c) => [c.id, c]));
  const rooms = design.rooms.map((room) => ({ room, type: inferRoomType(room), cell: byId.get(room.id)! }));
  const floors = Math.max(1, design.floorsCount || 1);
  const typeOf = new Map(rooms.map((r) => [r.room.id, r.type]));
  const doors = (design.openings || []).filter((op) => (op.connects || []).length === 2 && op.type !== 'window');
  const neighbours = (id: string) => doors.filter((d) => d.connects!.includes(id)).map((d) => d.connects!.find((o) => o !== id)!);

  // ---- Circulation ----
  let unreachable = 0;
  let exposed = 0;
  let bedCount = 0;
  const hopsToBed: number[] = [];
  const depthBase = new Map<number, number>();
  for (let level = 0; level < floors; level++) {
    const onFloor = rooms.filter((r) => r.cell.floor === level && r.type !== 'void' && r.type !== 'parking');
    const root = level === 0 ? onFloor.find((r) => r.type === 'entrance') || onFloor.find((r) => r.type === 'living') : onFloor.find((r) => r.type === 'stair');
    if (!root) { unreachable += onFloor.length; continue; }
    const dist = new Map<string, number>([[root.room.id, 0]]);
    const queue = [root.room.id];
    for (let qi = 0; qi < queue.length; qi++) {
      const id = queue[qi];
      const t = typeOf.get(id)!;
      for (const next of neighbours(id)) {
        if (dist.has(next)) continue;
        const nt = typeOf.get(next);
        if (!nt || nt === 'void' || nt === 'parking') continue;
        const passable = !!ROOM_TYPE_SPECS[t].hubPriority && t !== 'kitchen' || ((isBedroomType(t) || t === 'guest_room') && ['bathroom', 'dressing', 'balcony', 'terrace'].includes(nt)) || (t === 'kitchen' && ['utility', 'store', 'puja', 'balcony', 'terrace'].includes(nt)) || (t === 'dressing' && nt === 'bathroom');
        if (!passable) continue;
        dist.set(next, dist.get(id)! + 1);
        queue.push(next);
      }
    }
    if (level === 0) {
      const stair = onFloor.find((r) => r.type === 'stair');
      depthBase.set(1, stair ? dist.get(stair.room.id) ?? 3 : 3);
    }
    for (const r of onFloor) {
      if (!dist.has(r.room.id) && !(r.room.derived && ['terrace', 'balcony'].includes(r.type))) unreachable++;
      if (isBedroomType(r.type) || r.type === 'guest_room') {
        bedCount++;
        if (dist.has(r.room.id)) hopsToBed.push(dist.get(r.room.id)! + (level > 0 ? depthBase.get(1) ?? 3 : 0));
        const around = neighbours(r.room.id).map((n) => typeOf.get(n)!).filter(Boolean);
        if (around.some((t) => EXPOSED.includes(t)) && !around.some((t) => PROTECTED.includes(t))) exposed++;
      }
    }
  }

  // ---- Room sizes and shapes ----
  const undersized: string[] = [];
  const elongated: string[] = [];
  const oversized: string[] = [];
  let openArea = 0;
  let enclosedArea = 0;
  let circArea = 0;
  for (const r of rooms) {
    if (r.type === 'void') continue;
    const { w, d } = r.cell.rect;
    const spec = ROOM_TYPE_SPECS[r.type];
    const area = w * d;
    if (!r.room.derived && (area < spec.minArea * 0.9 || Math.min(w, d) < spec.minSide - 0.3)) undersized.push(r.room.name);
    if (spec.habitable && Math.max(w, d) / Math.min(w, d) > 2.1) elongated.push(r.room.name);
    if (spec.habitable && area > spec.targetArea * 2.25) oversized.push(r.room.name);
    if ((r.type === 'terrace' || r.type === 'balcony') && r.cell.floor > 0) openArea += area;
    if (!['parking', 'courtyard', 'terrace', 'balcony', 'entrance'].includes(r.type)) {
      enclosedArea += area;
      if (r.type === 'passage' || (r.type === 'lounge' && r.room.derived)) circArea += area;
    }
  }

  // ---- Adjacency ----
  const required = (design.spatialGraph?.requiredAdjacencies || []).filter(([a, b]) => byId.has(a) && byId.has(b));
  const touching = (a: string, b: string) => {
    const ca = byId.get(a)!;
    const cb = byId.get(b)!;
    if (ca.floor !== cb.floor) return false;
    const e = sharedEdge(ca.rect, cb.rect);
    return !!e && e.length >= 2.5;
  };
  const implicit: [string, string][] = [];
  for (const k of rooms.filter((r) => r.type === 'kitchen')) for (const d of rooms.filter((r) => r.type === 'dining' && r.cell.floor === k.cell.floor)) implicit.push([k.room.id, d.room.id]);
  const pairs = [...required, ...implicit];
  const satisfied = pairs.filter(([a, b]) => touching(a, b)).length;

  // ---- Daylight ----
  const hab = rooms.filter((r) => ROOM_TYPE_SPECS[r.type].habitable);
  const windowed = (id: string) => (design.openings || []).filter((op) => (op.type === 'window' || op.type === 'sliding_glass') && (op.connects || []).includes(id));
  const withWindow = hab.filter((r) => windowed(r.room.id).length > 0).length;
  const borrowing = hab.length - withWindow;
  const cvCandidates = rooms.filter((r) => isBedroomType(r.type) || r.type === 'living');
  const floorCells = (level: number): PlanCell[] => cells.filter((c) => c.floor === level);
  const crossVent = cvCandidates.filter((r) => {
    const sides = new Set(exteriorSegments(r.cell, floorCells(r.cell.floor)).filter((s) => s.length >= 3.5).map((s) => s.side));
    return sides.size >= 2;
  }).length;

  // ---- Site ----
  const ground = rooms.filter((r) => r.cell.floor === 0 && r.type !== 'void' && r.type !== 'courtyard');
  const groundArea = ground.reduce((s, r) => s + r.cell.rect.w * r.cell.rect.d, 0);
  const plot = design.plot;
  const plotArea = plot ? plot.width * plot.depth : 1;
  const buildable = design.buildableAreaSqFt || plotArea;
  const envelopeViolations = report.issues.filter((i) => i.code === 'OUT_OF_ENVELOPE' || i.code === 'OUT_OF_PLOT' || i.code === 'OVER_ENVELOPE').length;

  // ---- Services ----
  let nearTotal = 0;
  let nearCount = 0;
  for (let level = 0; level < floors; level++) {
    const wet = rooms.filter((r) => r.cell.floor === level && WET.includes(r.type));
    for (const a of wet) {
      let best = Infinity;
      for (const b of wet) if (a !== b) best = Math.min(best, Math.hypot(a.cell.rect.x + a.cell.rect.w / 2 - b.cell.rect.x - b.cell.rect.w / 2, a.cell.rect.y + a.cell.rect.d / 2 - b.cell.rect.y - b.cell.rect.d / 2));
      if (Number.isFinite(best)) { nearTotal += best; nearCount++; }
    }
  }
  const upperBaths = rooms.filter((r) => r.type === 'bathroom' && r.cell.floor > 0);
  const stackedBaths = upperBaths.filter((b) => rooms.some((g) => g.cell.floor === b.cell.floor - 1 && WET.includes(g.type) && Math.min(b.cell.rect.x + b.cell.rect.w, g.cell.rect.x + g.cell.rect.w) - Math.max(b.cell.rect.x, g.cell.rect.x) > 1.5 && Math.min(b.cell.rect.y + b.cell.rect.d, g.cell.rect.y + g.cell.rect.d) - Math.max(b.cell.rect.y, g.cell.rect.y) > 1.5)).length;
  let stackOn = 0;
  let stackTotal = 0;
  const lineSet = (level: number, axis: 'x' | 'y') => {
    const s: number[] = [];
    floorCells(level).forEach((c) => (axis === 'x' ? s.push(c.rect.x, c.rect.x + c.rect.w) : s.push(c.rect.y, c.rect.y + c.rect.d)));
    return s;
  };
  for (let level = 1; level < floors; level++) {
    const gx = lineSet(level - 1, 'x');
    const gy = lineSet(level - 1, 'y');
    for (const c of floorCells(level).filter((x) => x.type !== 'void')) {
      for (const v of [c.rect.x, c.rect.x + c.rect.w]) { stackTotal += c.rect.d; if (gx.some((g) => Math.abs(g - v) < 0.6)) stackOn += c.rect.d; }
      for (const v of [c.rect.y, c.rect.y + c.rect.d]) { stackTotal += c.rect.w; if (gy.some((g) => Math.abs(g - v) < 0.6)) stackOn += c.rect.w; }
    }
  }

  let lineTotal = 0;
  for (let level = 0; level < floors; level++) {
    const cs = floorCells(level).filter((c) => c.type !== 'void');
    if (!cs.length) continue;
    const minX = Math.min(...cs.map((c) => c.rect.x)), maxX = Math.max(...cs.map((c) => c.rect.x + c.rect.w));
    const minY = Math.min(...cs.map((c) => c.rect.y)), maxY = Math.max(...cs.map((c) => c.rect.y + c.rect.d));
    const xs = new Set<number>(), ys = new Set<number>();
    cs.forEach((c) => {
      [c.rect.x, c.rect.x + c.rect.w].forEach((v) => { if (v > minX + 0.2 && v < maxX - 0.2) xs.add(Math.round(v * 2)); });
      [c.rect.y, c.rect.y + c.rect.d].forEach((v) => { if (v > minY + 0.2 && v < maxY - 0.2) ys.add(Math.round(v * 2)); });
    });
    lineTotal += (xs.size + ys.size) / cs.length;
  }
  const wallLinesPerRoom = lineTotal / floors;
  const compass = planCompass(design.plot?.orientation || 'N');
  let heat = 0;
  let heatArea = 0;
  for (const r of rooms.filter((x) => isBedroomType(x.type) || x.type === 'living' || x.type === 'kitchen')) {
    heatArea += r.cell.rect.w * r.cell.rect.d;
    for (const seg of exteriorSegments(r.cell, floorCells(r.cell.floor))) if (!seg.facesOpenSpace) heat += seg.length * (HEAT[compass[seg.side]] ?? 2);
  }
  // ---- The client's own stated wishes ----
  let intentChecked = 0;
  let intentScore = 0;
  for (const link of options.intent?.adjacency || []) {
    const as = rooms.filter((r) => r.room.id === link.a || r.type === link.a);
    const bs = rooms.filter((r) => r.room.id === link.b || r.type === link.b);
    for (const a of as) {
      const options2 = bs.filter((b) => b !== a && b.cell.floor === a.cell.floor);
      if (!options2.length) continue;
      const kind = link.kind || 'adj';
      const share = (b: typeof a) => sharedEdge(a.cell.rect, b.cell.rect)?.length ?? 0;
      const dist = (b: typeof a) => Math.hypot(a.cell.rect.x + a.cell.rect.w / 2 - b.cell.rect.x - b.cell.rect.w / 2, a.cell.rect.y + a.cell.rect.d / 2 - b.cell.rect.y - b.cell.rect.d / 2);
      const weight = link.weight / 10;
      intentChecked += weight;
      if (kind === 'adj') intentScore += weight * (options2.some((b) => share(b) >= 2.5) ? 1 : 0);
      else if (kind === 'near') intentScore += weight * (options2.some((b) => share(b) > 0 || dist(b) <= 18) ? 1 : 0);
      else intentScore += weight * (options2.every((b) => share(b) < 2) ? 1 : 0);
    }
  }
  const solarLoad = heatArea ? (heat / heatArea) * 100 : 0;

  // ---- Massing: upper floors stand on the floor below, in a simple outline ----
  // Load-bearing walls and column grids run straight down (Ching, Building Construction Illustrated; NBC 2016 Part 6),
  // so an upper room should sit over a ground room, not over the car porch or open air, and the upper floor should
  // use the footprint it is built on rather than float as a small box in one corner of it.
  const OPEN_KINDS = ['parking', 'courtyard', 'terrace', 'balcony', 'entrance', 'void'];
  const enclosedOn = (level: number) => floorCells(level).filter((c) => !OPEN_KINDS.includes(c.type));
  const overlap = (a: PlanCell['rect'], b: PlanCell['rect']) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y));
  let supportedArea = 0, upperEnclosed = 0, coveredArea = 0, groundEnclosedArea = 0;
  const groundEnclosed = enclosedOn(0);
  groundEnclosed.forEach((c) => { groundEnclosedArea += c.rect.w * c.rect.d; });
  for (let level = 1; level < floors; level++) {
    const below = enclosedOn(level - 1);
    for (const c of enclosedOn(level)) {
      upperEnclosed += c.rect.w * c.rect.d;
      supportedArea += below.reduce((s, b) => s + overlap(c.rect, b.rect), 0);
    }
  }
  if (floors > 1) {
    for (const c of enclosedOn(1)) coveredArea += groundEnclosed.reduce((s, b) => s + overlap(c.rect, b.rect), 0);
  }
  let compactTotal = 0, compactFloors = 0;
  for (let level = 0; level < floors; level++) {
    const cs = enclosedOn(level);
    if (!cs.length) continue;
    const minX = Math.min(...cs.map((c) => c.rect.x)), maxX = Math.max(...cs.map((c) => c.rect.x + c.rect.w));
    const minY = Math.min(...cs.map((c) => c.rect.y)), maxY = Math.max(...cs.map((c) => c.rect.y + c.rect.d));
    const box = (maxX - minX) * (maxY - minY);
    compactTotal += box ? cs.reduce((s, c) => s + c.rect.w * c.rect.d, 0) / box : 1;
    compactFloors++;
  }
  const upperSupport = upperEnclosed ? Math.min(1, supportedArea / upperEnclosed) : 1;
  const upperCoverage = floors > 1 && groundEnclosedArea ? Math.min(1, coveredArea / groundEnclosedArea) : 1;
  const outlineCompactness = compactFloors ? compactTotal / compactFloors : 1;
  const metrics: QualityMetrics = {
    valid: report.isValid,
    errors: report.errors,
    unreachableRooms: unreachable,
    exposedBedrooms: exposed,
    bedrooms: bedCount,
    avgDoorsToBedroom: hopsToBed.length ? hopsToBed.reduce((a, b) => a + b, 0) / hopsToBed.length : 0,
    circulationShare: enclosedArea ? circArea / enclosedArea : 0,
    undersizedRooms: undersized,
    elongatedRooms: elongated,
    oversizedRooms: oversized,
    openAreaShare: enclosedArea ? openArea / enclosedArea : 0,
    wallLinesPerRoom,
    adjacencySatisfied: satisfied,
    adjacencyRequired: pairs.length,
    habitableRooms: hab.length,
    habitableWithWindow: withWindow,
    habitableBorrowingLight: borrowing,
    crossVentilated: crossVent,
    crossVentilationCandidates: cvCandidates.length,
    envelopeUtilization: buildable ? (design.footprint?.footprintAreaSqFt ?? groundArea) / buildable : 0,
    groundCoverage: groundArea / plotArea,
    envelopeViolations,
    wetClusterDistance: nearCount ? nearTotal / nearCount : 0,
    wetStacked: upperBaths.length ? stackedBaths / upperBaths.length : 1,
    structuralStacking: stackTotal ? stackOn / stackTotal : 1,
    totalBuiltUpAreaSqFt: design.totalBuiltUpAreaSqFt,
    solarLoad,
    intentSatisfaction: intentChecked ? intentScore / intentChecked : 1,
    intentChecked,
    upperSupport,
    upperCoverage,
    outlineCompactness
  };

  const parts: QualityReport['parts'] = [];
  const part = (key: string, label: string, weight: number, score: number, detail: string) => parts.push({ key, label, weight, score: clamp01(score), detail });
  part('circulation', 'Circulation & privacy', 26,
    1 - clamp01(unreachable * 0.4) - clamp01(exposed / Math.max(1, bedCount)) * 0.25 - clamp01((metrics.avgDoorsToBedroom - 3) / 5) * 0.25 - clamp01(Math.max(0, metrics.circulationShare - 0.12) / 0.15) * 0.25,
    `${unreachable} unreachable, ${exposed}/${bedCount} bedrooms entered off public rooms, ${metrics.avgDoorsToBedroom.toFixed(1)} doors to a bedroom, ${(metrics.circulationShare * 100).toFixed(0)}% passage area`);
  part('rooms', 'Room size & shape', 20, 1 - clamp01(undersized.length * 0.35) - clamp01(elongated.length * 0.15) - clamp01(oversized.length * 0.2) - clamp01(Math.max(0, metrics.openAreaShare - 0.12) / 0.3) * 0.3,
    `${undersized.length} undersized, ${elongated.length} elongated, ${oversized.length} oversized, ${(metrics.openAreaShare * 100).toFixed(0)}% of floor area is open terrace`);
  part('adjacency', 'Adjacency & zoning', 16, pairs.length ? satisfied / pairs.length : 1, `${satisfied}/${pairs.length} required adjacencies`);
  part('daylight', 'Daylight & ventilation', 14, hab.length ? (withWindow + borrowing * 0.4) / hab.length * 0.7 + (cvCandidates.length ? crossVent / cvCandidates.length : 1) * 0.3 : 1,
    `${withWindow}/${hab.length} habitable rooms windowed, ${crossVent}/${cvCandidates.length} cross-ventilated`);
  part('services', 'Plumbing & structure', 14, clamp01(1 - Math.max(0, metrics.wetClusterDistance - 10) / 25) * 0.3 + metrics.wetStacked * 0.15 + metrics.structuralStacking * 0.3 + clamp01(1 - Math.max(0, metrics.wallLinesPerRoom - 1.4) / 1.2) * 0.25,
    `wet rooms ${metrics.wetClusterDistance.toFixed(0)} ft apart, ${(metrics.wetStacked * 100).toFixed(0)}% baths stacked, ${(metrics.structuralStacking * 100).toFixed(0)}% walls stacked, ${metrics.wallLinesPerRoom.toFixed(1)} wall lines per room`);
  part('solar', 'Sun & orientation', 10, options.hot ? 1 - clamp01((metrics.solarLoad - 8) / 22) : 1, options.hot ? `heat-weighted sun-facing wall ${metrics.solarLoad.toFixed(0)} per 100 sq ft of bedrooms, living and kitchen` : 'not judged (temperate climate)');
  part('massing', 'Massing & stacking', 14,
    (floors > 1 ? clamp01((metrics.upperSupport - 0.7) / 0.28) * 0.4 + clamp01((metrics.upperCoverage - 0.4) / 0.45) * 0.35 : 0.75) + clamp01((metrics.outlineCompactness - 0.7) / 0.27) * 0.25,
    floors > 1
      ? `${Math.round(metrics.upperSupport * 100)}% of upper rooms stand on rooms below, the upper floor covers ${Math.round(metrics.upperCoverage * 100)}% of the ground footprint, outline ${Math.round(metrics.outlineCompactness * 100)}% rectangular`
      : `outline ${Math.round(metrics.outlineCompactness * 100)}% rectangular`);
  if (intentChecked > 0) part('intent', 'Your stated wishes', 12, metrics.intentSatisfaction, `${(metrics.intentSatisfaction * 100).toFixed(0)}% of the adjacency and privacy wishes from your notes are honoured`);
  const total = parts.reduce((s, p) => s + p.weight, 0);
  parts.forEach((p) => { p.weight = Math.round((p.weight / total) * 1000) / 10; });
  const raw = parts.reduce((s, p) => s + p.weight * p.score, 0) / 100;
  return { score: report.isValid ? Math.round(raw * 1000) / 10 : 0, metrics, parts };
}
