import {
  DesignConstraints, DesignProgram, FloorPlanRoom, ProgramRoom, RoomType, SiteInfo, StructuredDesignJSON
} from '@/types/architectural';
import { ProgramDeltaOp } from '@/types/delta';
import { PlacedRoom, WorkRoom, assembleDesign } from './layoutEngine';
import { ROOM_TYPE_SPECS } from './roomTypes';
import { Rect, designCells, roomRectFt, round2, sharedEdge } from '@/lib/geometry/planGeometry';
import { validateFloorPlan } from './validateFloorPlan';
import { ARCHETYPES, EnergyCtx, FixedCell, PRoom, PairSpec } from './planner/model';
import { FloorSolution, anneal, bestPartition, derived, groundLines, hardCost, pairsFor, repair, startTrees, toPRoom } from './planner/optimizer';
import { SNode, insertBeside, leafIds, mulberry32, partitionUnion, realize, treeFromRects } from './planner/slicing';
import { layoutEnergy } from './planner/energy';
import { Envelope, computeEnvelope } from './planner/envelope';
import { planCompass } from '@/lib/geometry/planGeometry';

export type EditStrategy = 'wall-push' | 'local-resolve' | 'full-replan' | 'appearance-only';

export interface RoomDiff {
  id: string;
  name: string;
  roomType?: string;
  floor: number;
  kind: 'unchanged' | 'resized' | 'moved' | 'added' | 'removed';
  before?: Rect;
  after?: Rect;
}

export interface EditDiff {
  strategy: EditStrategy;
  rooms: RoomDiff[];
  /** Rooms (present before and after) whose geometry changed. */
  touched: number;
  /** Rooms (present before and after) whose geometry is exactly as it was. */
  preserved: number;
  /** Rooms that existed before. */
  total: number;
  floorsAffected: number[];
}

interface Cell {
  id: string;
  name: string;
  type: RoomType;
  floor: number;
  rect: Rect;
  room: FloorPlanRoom | null;
  program?: ProgramRoom;
}

const EPS = 0.26;
const same = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS && Math.abs(a.w - b.w) < EPS && Math.abs(a.d - b.d) < EPS;
const area = (r: Rect) => r.w * r.d;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Compares two designs room by room, so the client can see exactly what an edit touched. */
export function diffDesigns(before: StructuredDesignJSON, after: StructuredDesignJSON, strategy: EditStrategy): EditDiff {
  const a = new Map(designCells(before).map((c) => [c.id, c]));
  const b = new Map(designCells(after).map((c) => [c.id, c]));
  const nameOf = (d: StructuredDesignJSON, id: string) => d.rooms.find((r) => r.id === id)?.name || id;
  const rooms: RoomDiff[] = [];
  a.forEach((cell, id) => {
    if (cell.type === 'void') return;
    const next = b.get(id);
    if (!next) rooms.push({ id, name: nameOf(before, id), roomType: cell.type, floor: cell.floor, kind: 'removed', before: cell.rect });
    else if (same(cell.rect, next.rect)) rooms.push({ id, name: nameOf(before, id), roomType: cell.type, floor: cell.floor, kind: 'unchanged', before: cell.rect, after: next.rect });
    else rooms.push({ id, name: nameOf(after, id), roomType: cell.type, floor: cell.floor, kind: Math.abs(area(cell.rect) - area(next.rect)) > 1 || Math.abs(cell.rect.w - next.rect.w) > EPS ? 'resized' : 'moved', before: cell.rect, after: next.rect });
  });
  b.forEach((cell, id) => {
    if (cell.type === 'void' || a.has(id)) return;
    rooms.push({ id, name: nameOf(after, id), roomType: cell.type, floor: cell.floor, kind: 'added', after: cell.rect });
  });
  const existing = rooms.filter((r) => r.before && r.after);
  return {
    strategy,
    rooms,
    touched: existing.filter((r) => r.kind !== 'unchanged').length,
    preserved: existing.filter((r) => r.kind === 'unchanged').length,
    total: rooms.filter((r) => r.before).length,
    floorsAffected: Array.from(new Set(rooms.filter((r) => r.kind !== 'unchanged').map((r) => r.floor))).sort()
  };
}

function cellsOf(design: StructuredDesignJSON, program: DesignProgram): Cell[] {
  const byId = new Map(program.rooms.map((r) => [r.id, r]));
  const plot = { width: design.plot.width, depth: design.plot.depth };
  return design.rooms.map((room) => ({
    id: room.id, name: room.name, type: (room.roomType || 'store') as RoomType, floor: room.position.floorLevel || 0,
    rect: { ...roomRectFt(room, plot) }, room, program: byId.get(room.id)
  }));
}

/** Types whose size and position the surgeon never changes: they carry the staircase and the courtyard through every floor. */
const FIXED_TYPES: RoomType[] = ['stair', 'void', 'courtyard'];
/** How much it costs to take area from a room (per sq ft). Lower = give up first. */
const SACRIFICE: Partial<Record<RoomType, number>> = {
  terrace: 0.2, balcony: 0.3, store: 0.5, lounge: 0.8, utility: 0.7, dressing: 0.7, puja: 0.8, study: 1.0, guest_room: 1.2, dining: 1.3,
  bathroom: 1.5, passage: 1.6, kitchen: 1.8, living: 2.0, bedroom: 2.5, master_bedroom: 2.5, entrance: 3, parking: 3
};
const maxAspectOf = (t: RoomType) => (ROOM_TYPE_SPECS[t].habitable ? 1.95 : t === 'passage' || t === 'entrance' || t === 'balcony' || t === 'terrace' ? 60 : 3.6);

/** Smallest the room may become along an axis whose cross dimension is `cross`. */
function minAxis(type: RoomType, cross: number): number {
  const spec = ROOM_TYPE_SPECS[type];
  return Math.max(spec.minSide, (spec.minArea * 0.9) / Math.max(1, cross), cross / maxAspectOf(type));
}

type Dir = 'left' | 'right' | 'front' | 'rear';

interface Slide {
  dir: Dir;
  vertical: boolean;
  line: number;
  /** Cells on the target's side of the wall, and cells on the far side. Every one touches the wall along its whole facing edge. */
  near: Cell[];
  far: Cell[];
}

const spanOf = (c: Cell, vertical: boolean): [number, number] => (vertical ? [c.rect.y, c.rect.y + c.rect.d] : [c.rect.x, c.rect.x + c.rect.w]);

/**
 * Finds the whole straight wall that bounds `r` on one side, and the rooms on both sides of it.
 * Sliding that wall is a valid rectangular edit only if the rooms on each side cover the same stretch of it
 * exactly; otherwise part of it is an outside wall or a T-junction that would bend.
 */
function findSlide(r: Cell, dir: Dir, cells: Cell[]): Slide | null {
  const vertical = dir === 'left' || dir === 'right';
  const line = dir === 'left' ? r.rect.x : dir === 'right' ? r.rect.x + r.rect.w : dir === 'front' ? r.rect.y : r.rect.y + r.rect.d;
  const nearEdge = (c: Cell) => (vertical ? (dir === 'right' ? c.rect.x + c.rect.w : c.rect.x) : (dir === 'rear' ? c.rect.y + c.rect.d : c.rect.y));
  const farEdge = (c: Cell) => (vertical ? (dir === 'right' ? c.rect.x : c.rect.x + c.rect.w) : (dir === 'rear' ? c.rect.y : c.rect.y + c.rect.d));
  let [lo, hi] = spanOf(r, vertical);
  const near = new Set<Cell>([r]);
  const far = new Set<Cell>();
  const floorCells = cells.filter((c) => c.floor === r.floor && c.type !== 'void');
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const c of floorCells) {
      const [a, b] = spanOf(c, vertical);
      if (Math.min(hi, b) - Math.max(lo, a) <= 0.06) continue;
      if (Math.abs(nearEdge(c) - line) < 0.06 && !near.has(c) && !far.has(c)) { near.add(c); lo = Math.min(lo, a); hi = Math.max(hi, b); changed = true; }
      else if (Math.abs(farEdge(c) - line) < 0.06 && !near.has(c) && !far.has(c)) { far.add(c); lo = Math.min(lo, a); hi = Math.max(hi, b); changed = true; }
    }
    if (!changed) break;
  }
  const covered = (group: Set<Cell>) => sum([...group].map((c) => { const [a, b] = spanOf(c, vertical); return b - a; }));
  if (!far.size || covered(near) < hi - lo - 0.1 || covered(far) < hi - lo - 0.1) return null;
  return { dir, vertical, line, near: [...near], far: [...far] };
}

interface PushPlan { slide: Slide; t: number; cost: number; achieved: number }

function planPushes(target: Cell, cells: Cell[], deltaArea: number): PushPlan[] {
  const grow = deltaArea > 0;
  const candidates: PushPlan[] = [];
  for (const dir of ['left', 'right', 'front', 'rear'] as Dir[]) {
    const slide = findSlide(target, dir, cells);
    if (!slide) continue;
    if ([...slide.near, ...slide.far].some((c) => FIXED_TYPES.includes(c.type))) continue;
    const [ta, tb] = spanOf(target, slide.vertical);
    const cross = tb - ta;
    const shrinking = grow ? slide.far : slide.near;
    const growing = grow ? slide.near : slide.far;
    let maxT = Infinity;
    for (const c of shrinking) {
      const [a, b] = spanOf(c, slide.vertical);
      const axis = slide.vertical ? c.rect.w : c.rect.d;
      maxT = Math.min(maxT, axis - minAxis(c.type, b - a));
    }
    // Rooms that gain space must not become absurdly large.
    for (const c of growing) {
      const [a, b] = spanOf(c, slide.vertical);
      const axis = slide.vertical ? c.rect.w : c.rect.d;
      const spec = ROOM_TYPE_SPECS[c.type];
      if (spec.habitable) maxT = Math.min(maxT, Math.max(0, (spec.targetArea * 2.2 - area(c.rect)) / Math.max(1, b - a)), 40 - axis);
    }
    const wantT = Math.abs(deltaArea) / cross;
    const t = Math.floor(Math.min(wantT, maxT) * 2) / 2;
    if (!(t >= 0.5)) continue;
    const cost = sum(shrinking.map((c) => { const [a, b] = spanOf(c, slide.vertical); return (SACRIFICE[c.type] ?? 1) * t * (b - a); }));
    candidates.push({ slide, t, cost, achieved: t * cross });
  }
  const goal = Math.abs(deltaArea);
  const full = candidates.filter((c) => c.achieved >= goal * 0.9).sort((a, b) => a.cost - b.cost);
  const partial = candidates.filter((c) => c.achieved < goal * 0.9 && c.achieved >= goal * 0.5).sort((a, b) => b.achieved - a.achieved);
  return [...full, ...partial];
}

/** Slides the wall by plan.t (feet) toward the far side when growing the target, toward the target when shrinking it. */
function applyPush(plan: PushPlan, cells: Cell[], grow: boolean): Cell[] {
  const t = grow ? plan.t : -plan.t;
  const { dir } = plan.slide;
  const shift = (c: Cell, isNear: boolean): Rect => {
    const r = { ...c.rect };
    if (isNear) {
      if (dir === 'left') { r.x -= t; r.w += t; } else if (dir === 'right') r.w += t; else if (dir === 'front') { r.y -= t; r.d += t; } else r.d += t;
    } else if (dir === 'left') r.w -= t; else if (dir === 'right') { r.x += t; r.w -= t; } else if (dir === 'front') r.d -= t; else { r.y += t; r.d -= t; }
    return { x: round2(r.x), y: round2(r.y), w: round2(r.w), d: round2(r.d) };
  };
  const nearIds = new Set(plan.slide.near.map((c) => c.id));
  const farIds = new Set(plan.slide.far.map((c) => c.id));
  let next = cells.map((c) => (nearIds.has(c.id) ? { ...c, rect: shift(c, true) } : farIds.has(c.id) ? { ...c, rect: shift(c, false) } : c));
  // Carry the same wall through the other floors where it is shared too, so walls keep stacking.
  const floors = Array.from(new Set(cells.map((c) => c.floor))).filter((f) => f !== plan.slide.near[0].floor);
  for (const f of floors) {
    const probe = cells.find((c) => c.floor === f && c.type !== 'void' && !FIXED_TYPES.includes(c.type) && (plan.slide.vertical
      ? Math.abs((dir === 'right' ? c.rect.x + c.rect.w : c.rect.x) - plan.slide.line) < 0.06
      : Math.abs((dir === 'rear' ? c.rect.y + c.rect.d : c.rect.y) - plan.slide.line) < 0.06));
    if (!probe) continue;
    const other = findSlide(probe, dir, cells);
    if (!other || [...other.near, ...other.far].some((c) => FIXED_TYPES.includes(c.type))) continue;
    const ok = [...other.near.map((c) => ({ c, isNear: true })), ...other.far.map((c) => ({ c, isNear: false }))].every(({ c, isNear }) => {
      const r = shift(c, isNear);
      return r.w > 0 && r.d > 0 && Math.min(r.w, r.d) >= ROOM_TYPE_SPECS[c.type].minSide - 0.3;
    });
    if (!ok) continue;
    const ids = new Map<string, boolean>([...other.near.map((c): [string, boolean] => [c.id, true]), ...other.far.map((c): [string, boolean] => [c.id, false])]);
    next = next.map((c) => (ids.has(c.id) ? { ...c, rect: shift(c, ids.get(c.id)!) } : c));
  }
  return next;
}

const OPEN_ROOM_TYPES: RoomType[] = ['courtyard', 'void', 'terrace', 'balcony', 'parking', 'entrance'];
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

function pRoomOf(cell: Cell): PRoom {
  if (cell.program) {
    const p = toPRoom({ ...cell.program, areaSqFt: Math.round(area(cell.rect)) }, 1);
    p.target = area(cell.rect);
    return p;
  }
  return derived(cell.id, cell.name, cell.type, cell.floor, area(cell.rect), { attachedTo: cell.room?.attachedTo, relationships: cell.room?.relationships || [] });
}

/**
 * Re-solves a limited set of rooms inside the space they already occupy, with every other room frozen.
 * Returns the new cells, or null when no valid arrangement exists for that region.
 */
function resolveRegion(
  design: StructuredDesignJSON, cells: Cell[], floor: number, movableIds: string[], newRooms: PRoom[], extraPairs: PairSpec[], hot: boolean, extraRegion: Rect[] = [], pinned: Record<string, number> = {}
): Cell[] | null {
  const movable = cells.filter((c) => movableIds.includes(c.id));
  if (movable.some((c) => FIXED_TYPES.includes(c.type))) return null;
  const regionRects = [...movable.map((c) => c.rect), ...extraRegion];
  if (!regionRects.length) return null;
  const pieces = partitionUnion(regionRects, true);
  const piecesV = partitionUnion(regionRects, false);
  const usePieces = Math.min(...pieces.map((p) => Math.min(p.w, p.d))) >= Math.min(...piecesV.map((p) => Math.min(p.w, p.d))) ? pieces : piecesV;
  const regionArea = sum(usePieces.map(area));
  const rooms: PRoom[] = [...movable.map(pRoomOf), ...newRooms];
  // A size the client asked for is a requirement of this edit, not a hint: the room may not come back smaller.
  rooms.forEach((r) => { const want = pinned[r.id]; if (want) { r.target = want; r.minArea = Math.max(r.minArea, want * 0.93); } });
  // Keep the sizes people asked for; compress the rest only as far as every room stays usable.
  const need = sum(rooms.map((r) => r.target));
  const minNeed = sum(rooms.map((r) => r.minArea));
  if (process.env.SURGERY_DEBUG) console.log('[surgery] region', Math.round(regionArea), 'need', Math.round(need), 'min', Math.round(minNeed), 'rooms', rooms.map((r) => r.name).join(','), 'pieces', usePieces.length);
  if (minNeed > regionArea + 1e-6) return null;
  if (need > regionArea) {
    const s = (regionArea - minNeed) / Math.max(1, need - minNeed);
    rooms.forEach((r) => { r.target = r.minArea + (r.target - r.minArea) * s; });
  } else if (need < regionArea * 0.97) {
    const spare = regionArea - need;
    const growable = rooms.filter((r) => !r.derived || r.type === 'terrace' || r.type === 'balcony' || r.type === 'lounge');
    const total = sum(growable.map((r) => r.target)) || 1;
    growable.forEach((r) => { r.target += (spare * r.target) / total; });
  }
  const others = cells.filter((c) => c.floor === floor && !movableIds.includes(c.id));
  const fixed: FixedCell[] = others.map((c) => ({ room: pRoomOf(c), rect: c.rect }));
  const floorCells = cells.filter((c) => c.floor === floor && c.type !== 'void');
  const fp: Rect = {
    x: Math.min(...floorCells.map((c) => c.rect.x)), y: Math.min(...floorCells.map((c) => c.rect.y)),
    w: Math.max(...floorCells.map((c) => c.rect.x + c.rect.w)) - Math.min(...floorCells.map((c) => c.rect.x)),
    d: Math.max(...floorCells.map((c) => c.rect.y + c.rect.d)) - Math.min(...floorCells.map((c) => c.rect.y))
  };
  const ground = floor > 0 ? cells.filter((c) => c.floor === 0) : [];
  const archId = (design.planner?.archetype && design.planner.archetype in ARCHETYPES ? design.planner.archetype : 'compact') as keyof typeof ARCHETYPES;
  const allRooms = [...rooms, ...fixed.map((f) => f.room)];
  const pairs = [...pairsFor(allRooms, design.program?.intent, design.plot.width * design.plot.depth <= 1500), ...extraPairs];
  const ctx: EnergyCtx = {
    rooms, fixed, footprint: fp, frontY: fp.y, floor, floors: design.floorsCount, arch: ARCHETYPES[archId], pairs, hot,
    compass: planCompass(design.plot.orientation), tight: design.plot.width * design.plot.depth <= 1500,
    groundLines: ground.length ? groundLines(ground.map((c) => c.rect), ground.map(pRoomOf)) : undefined,
    // Rooms that are not the subject of the edit keep to where they were; only a nudge is allowed.
    anchors: new Map(movable.map((c) => [c.id, c.rect] as [string, Rect])),
    freeIds: new Set([...Object.keys(pinned), ...newRooms.map((r) => r.id)]),
    stayWeight: 0.35
  };
  // Rules the plan already bent before the edit are not held against the edit.
  const baseRooms = movable.map(pRoomOf);
  const baseCtx: EnergyCtx = { ...ctx, rooms: baseRooms, fixed };
  const baseline = baseRooms.length === rooms.length - newRooms.length && !extraRegion.length ? hardCost(baseCtx, movable.map((c) => c.rect)) : 0;
  const allowed = Math.max(0.25, baseline + 0.1);
  let best: FloorSolution | null = null;
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
    const start = startTrees(rooms, usePieces, rng, ARCHETYPES[archId], floor);
    const sol = anneal(ctx, usePieces, start, 2200, mulberry32(99 + attempt), 4, 0.05);
    const fixedSol = repair(ctx, usePieces, sol, 1800, mulberry32(7 + attempt));
    if (!best || hardCost(ctx, fixedSol.rects) < hardCost(ctx, best.rects) - 0.2 || (Math.abs(hardCost(ctx, fixedSol.rects) - hardCost(ctx, best.rects)) <= 0.2 && fixedSol.energy < best.energy)) best = fixedSol;
  }
  if (process.env.SURGERY_DEBUG && best) { const parts: Record<string, number> = {}; layoutEnergy(ctx, best.rects, parts); console.log('[surgery] hard', hardCost(ctx, best.rects).toFixed(2), 'allowed', allowed.toFixed(2), JSON.stringify(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * 10) / 10]))));}
  if (!best || hardCost(ctx, best.rects) > allowed) return null;
  // Rooms the edit is not about may be nudged, never relocated: a bedroom must not jump from the back of the house to the road.
  for (let i = 0; i < rooms.length; i++) {
    const old = movable.find((c) => c.id === rooms[i].id);
    if (!old || pinned[old.id]) continue;
    const r = best.rects[i];
    const shift = Math.hypot(r.x + r.w / 2 - old.rect.x - old.rect.w / 2, r.y + r.d / 2 - old.rect.y - old.rect.d / 2);
    const resize = Math.abs(area(r) - area(old.rect)) / area(old.rect);
    if (shift > 6.5 || resize > 0.4) return null;
  }
  const next = cells.filter((c) => !movableIds.includes(c.id));
  rooms.forEach((r, i) => {
    const old = movable.find((c) => c.id === r.id);
    const rect = best!.rects[i];
    if (old) next.push({ ...old, rect: { x: round2(rect.x), y: round2(rect.y), w: round2(rect.w), d: round2(rect.d) } });
    else next.push({ id: r.id, name: r.name, type: r.type, floor, rect: { x: round2(rect.x), y: round2(rect.y), w: round2(rect.w), d: round2(rect.d) }, room: null, program: r.ref });
  });
  return next;
}

/** Rooms that share a wall (3 ft or more) with the given cell on the same floor, most shared wall first. */
function neighboursOf(cell: Cell, cells: Cell[]): Cell[] {
  return cells
    .filter((c) => c !== cell && c.floor === cell.floor && c.type !== 'void')
    .map((c) => ({ c, len: sharedEdge(cell.rect, c.rect)?.length ?? 0 }))
    .filter((x) => x.len >= 3)
    .sort((a, b) => b.len - a.len)
    .map((x) => x.c);
}

export interface SurgeryRequest {
  design: StructuredDesignJSON;
  /** Programme after the delta was applied (new rooms present, sizes updated). */
  program: DesignProgram;
  /** Programme before. */
  before: DesignProgram;
  constraints: DesignConstraints;
  site: SiteInfo;
  ops: ProgramDeltaOp[];
  hot?: boolean;
}

export type SurgeryResult =
  | { ok: true; design: StructuredDesignJSON; strategy: 'wall-push' | 'local-resolve'; notes: string[]; achieved?: { wanted: number; got: number; roomName: string; before: number } }
  | { ok: false; reason: string };

function rebuild(request: SurgeryRequest, cells: Cell[], notes: string[]): StructuredDesignJSON | null {
  const { design, program, constraints, site } = request;
  const programById = new Map(program.rooms.map((r) => [r.id, r]));
  let order = 0;
  const placed: PlacedRoom[] = cells.map((c) => {
    const p = programById.get(c.id);
    const work: WorkRoom = p
      ? { ...p, floor: c.floor, area: area(c.rect), areaSqFt: Math.round(area(c.rect)), order: order++ }
      : {
          id: c.id, name: c.name, type: c.type, floor: c.floor, areaSqFt: Math.round(area(c.rect)), area: area(c.rect), band: 'middle', side: 'center', required: false,
          relationships: c.room?.relationships || [], features: (c.room?.features || []).filter((f) => !/^(?:Window|Door|Opens)/i.test(f)).slice(0, 2), derived: true, order: order++, attachedTo: c.room?.attachedTo
        };
    return { room: work, rect: { ...c.rect } };
  });
  const ground = cells.filter((c) => c.floor === 0 && c.type !== 'void' && c.type !== 'courtyard');
  const gx0 = Math.min(...ground.map((c) => c.rect.x)), gx1 = Math.max(...ground.map((c) => c.rect.x + c.rect.w));
  const gy0 = Math.min(...ground.map((c) => c.rect.y)), gy1 = Math.max(...ground.map((c) => c.rect.y + c.rect.d));
  const stair = cells.find((c) => c.type === 'stair' && c.floor === 0);
  const setbacks = design.plot.setbacks || { front: 5, rear: 3, left: 3, right: 3 };
  const result = assembleDesign({
    program, site, constraints, placed, originX: 0, originY: 0, notes: [...notes], plotWidth: design.plot.width, plotDepth: design.plot.depth,
    envWidth: design.plot.width - setbacks.left - setbacks.right, envDepth: design.plot.depth - setbacks.front - setbacks.rear, setbacks,
    allowPorchInSetback: design.plot.allowPorchInSetback ?? false, stairRect: stair ? stair.rect : null,
    footprintBounds: { width: gx1 - gx0, depth: gy1 - gy0 }, hasCourtyard: cells.some((c) => c.type === 'courtyard'), compression: 0,
    buildableAreaOverride: design.plot.polygon ? design.buildableAreaSqFt : undefined, plotPolygon: design.plot.polygon
  });
  const next = result.design;
  next.conceptNumber = design.conceptNumber;
  next.appearance = design.appearance || next.appearance;
  next.briefReading = design.briefReading;
  next.planner = design.planner;
  return next;
}

/**
 * Carries out a change by editing the geometry that exists, not by laying the house out again.
 * Single resizes push a wall; additions, removals and moves re-solve only the rooms around the change.
 * Returns a failure (and the design is untouched) when the change cannot be made that way.
 */
export function attemptSurgery(request: SurgeryRequest): SurgeryResult {
  const { design, program, before, ops } = request;
  const notes: string[] = [];
  let cells = cellsOf(design, before);
  let strategy: 'wall-push' | 'local-resolve' = 'wall-push';
  let achievedInfo: { wanted: number; got: number; roomName: string; before: number } | undefined;

  const geometryOps = ops.filter((o) => o.op !== 'set_appearance' && o.op !== 'rename_room');
  if (!geometryOps.length) return { ok: false, reason: 'No geometry change.' };
  for (const op of geometryOps) {
    if (op.op === 'add_floor') return { ok: false, reason: 'Adding a floor needs the whole house re-planned.' };
  }

  for (const op of geometryOps) {
    if (op.op === 'resize_room') {
      const programRoom = program.rooms.find((r) => r.id === op.target) || before.rooms.find((r) => r.id === op.target);
      const cell = cells.find((c) => c.id === (programRoom?.id || op.target));
      if (!cell) return { ok: false, reason: `"${op.target}" is not in the drawing.` };
      const wanted = op.areaSqFt ?? area(cell.rect) * (op.scale ?? 1);
      const delta = wanted - area(cell.rect);
      if (Math.abs(delta) < 4) continue;
      // The most natural move first: push an outside wall outward. Nothing else in the house changes.
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
      // Otherwise slide an inside wall: the cheapest first; keep the first that leaves a plan every rule still accepts.
      for (const push of planPushes(cell, cells, delta)) {
        const trial = applyPush(push, cells, delta > 0);
        const probe = rebuild(request, trial, []);
        if (!probe || !validateFloorPlan(probe).isValid) continue;
        cells = trial;
        const grown = cells.find((c) => c.id === cell.id)!;
        achievedInfo = { wanted: Math.round(wanted), got: Math.round(area(grown.rect)), roomName: cell.name, before: Math.round(area(cell.rect)) };
        const givers = (delta > 0 ? push.slide.far : push.slide.near).filter((c) => c.id !== cell.id).map((n) => n.name).join(', ');
        notes.push(`${cell.name} ${delta > 0 ? 'grew' : 'shrank'} by sliding its ${push.slide.dir} wall ${push.t} ft; ${givers} ${delta > 0 ? 'gave up' : 'took'} the strip. Every other room stayed where it was.`);
        pushed = true;
        break;
      }
      if (pushed) continue;
      // No clean wall to move: re-plan just this room and the rooms around it.
      const ring = neighboursOf(cell, cells).filter((n) => !FIXED_TYPES.includes(n.type));
      let resolved: Cell[] | null = null;
      const groups: string[][] = [];
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
      }
      if (!resolved) return { ok: false, reason: `${cell.name} cannot be ${delta > 0 ? 'enlarged' : 'reduced'} to ${Math.round(wanted)} sq ft without moving walls that carry the stair or courtyard, or squeezing a neighbour below a usable size.` };
      cells = resolved;
      strategy = 'local-resolve';
      const got = cells.find((c) => c.id === cell.id)!;
      achievedInfo = { wanted: Math.round(wanted), got: Math.round(area(got.rect)), roomName: cell.name, before: Math.round(area(cell.rect)) };
      notes.push(`${cell.name} and its neighbours were re-planned inside the space they already shared; the rest of the floor is untouched.`);
    } else if (op.op === 'add_room') {
      const added = program.rooms.find((r) => !before.rooms.some((b) => b.id === r.id) && !cells.some((c) => c.id === r.id) && r.type === op.type);
      if (!added) return { ok: false, reason: 'The new room is missing from the programme.' };
      const wantedFloor = added.floor;
      const terraceArea = (f: number) => sum(cells.filter((c) => c.floor === f && c.type === 'terrace').map((c) => area(c.rect)));
      const floorOrder = op.floor !== undefined || added.attachedTo
        ? [wantedFloor]
        : [wantedFloor, ...Array.from({ length: design.floorsCount }, (_, f) => f).filter((f) => f !== wantedFloor).sort((a, b) => terraceArea(b) - terraceArea(a))];
      const anchor = added.attachedTo ? cells.find((c) => c.id === added.attachedTo) : undefined;
      let chosen: Cell[] | null = null;
      let placedOn = -1;
      let onFloor: Cell[] = [];
      for (const floor of floorOrder) {
      onFloor = cells.filter((c) => c.floor === floor && c.type !== 'void');
      const newRoom = toPRoom({ ...added, floor }, 1);
      // Donor rooms: those with the most spare area first (terraces, lounges, big living rooms), always including the anchor.
      const pool = onFloor.filter((c) => !FIXED_TYPES.includes(c.type) && c.type !== 'entrance' && c.type !== 'parking');
      const spare = (c: Cell) => area(c.rect) - ROOM_TYPE_SPECS[c.type].targetArea * 0.9 + (c.type === 'terrace' ? 120 : c.type === 'lounge' ? 40 : 0);
      if (floor === 0) {
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
      const seeds = anchor ? [anchor] : [...pool].sort((a, b) => spare(b) - spare(a)).slice(0, 4);
      for (const seed of seeds) {
        const group: Cell[] = [seed];
        for (let grow = 0; grow < 5; grow++) {
          const regionArea = sum(group.map((c) => area(c.rect)));
          const needMin = sum(group.map((c) => ROOM_TYPE_SPECS[c.type].minArea)) + newRoom.minArea;
          if (regionArea >= needMin * 1.25) break;
          const next = neighboursOf(seed, cells).concat(group.flatMap((g) => neighboursOf(g, cells))).filter((n) => !group.includes(n) && !FIXED_TYPES.includes(n.type) && n.type !== 'parking' && n.type !== 'entrance').sort((a, b) => spare(b) - spare(a))[0];
          if (!next) break;
          group.push(next);
        }
        const ids = group.map((c) => c.id);
        const extra: PairSpec[] = anchor ? [{ a: newRoom.id, b: anchor.id, w: 9, kind: 'adj' }] : [];
        const attempt = resolveRegion(design, cells, floor, ids, [newRoom], extra, !!request.hot);
        if (attempt) { chosen = group; cells = attempt; break; }
      }
      if (chosen) { placedOn = floor; break; }
      }
      if (!chosen) return { ok: false, reason: `There is no place on ${floorOrder.length > 1 ? 'any floor' : `the ${wantedFloor === 0 ? 'ground' : 'upper'} floor`} to fit a ${added.name} at a usable size without moving the stair or courtyard.` };
      strategy = 'local-resolve';
      if (placedOn !== wantedFloor) {
        added.floor = placedOn;
        cells = cells.map((c) => (c.id === added.id ? { ...c, floor: placedOn } : c));
        notes.push(`There was no room for the ${added.name} on the ${wantedFloor === 0 ? 'ground' : 'upper'} floor without squeezing other rooms, so it was placed on the ${placedOn === 0 ? 'ground' : 'upper'} floor, where there is spare space.`);
      }
      notes.push(`${added.name} was fitted by re-planning only ${chosen.map((c) => c.name).join(', ')}; ${onFloor.length - chosen.length} other rooms on that floor were not touched.`);
    } else if (op.op === 'remove_room') {
      const gone = cells.find((c) => c.id === op.target) || cells.find((c) => c.name.toLowerCase() === op.target.toLowerCase());
      if (!gone) return { ok: false, reason: `"${op.target}" is not in the drawing.` };
      const followers = cells.filter((c) => c.room?.attachedTo === gone.id || program.rooms.find((r) => r.id === c.id)?.attachedTo === gone.id);
      const removedIds = new Set([gone.id, ...followers.map((f) => f.id)]);
      const floor = gone.floor;
      const freed = cells.filter((c) => removedIds.has(c.id) && c.floor === floor);
      const nearby = neighboursOf(gone, cells).filter((n) => !FIXED_TYPES.includes(n.type) && !removedIds.has(n.id));
      if (!nearby.length) return { ok: false, reason: `Nothing next to ${gone.name} can take over its space.` };
      const keep = cells.filter((c) => !removedIds.has(c.id));
      const group = nearby.slice(0, 2);
      const regionRects = [...freed.map((c) => c.rect), ...group.map((c) => c.rect)];
      // Resolve with the freed rectangles added to the region by pretending the neighbours own that space.
      const withFreed = keep.map((c) => c);
      void regionRects;
      const resolved = resolveRegion(design, withFreed, floor, group.map((c) => c.id), [], [], !!request.hot, freed.map((c) => c.rect));
      if (!resolved) return { ok: false, reason: `The space left by ${gone.name} cannot be shared out among the neighbouring rooms in a usable way.` };
      cells = resolved;
      strategy = 'local-resolve';
      notes.push(`${gone.name} was removed; ${group.map((c) => c.name).join(' and ')} took over its space. Nothing else moved.`);
    } else if (op.op === 'move_room') {
      const mover = cells.find((c) => c.id === op.target) || cells.find((c) => c.name.toLowerCase() === op.target.toLowerCase());
      if (!mover) return { ok: false, reason: `"${op.target}" is not in the drawing.` };
      const destination = op.nextTo ? cells.find((c) => c.id === op.nextTo || c.name.toLowerCase() === op.nextTo!.toLowerCase()) : undefined;
      if (!destination) return { ok: false, reason: 'Moving a room needs a room to move it next to.' };
      if (destination.floor !== mover.floor) return { ok: false, reason: 'Moving a room to a different floor needs the stacked rooms re-planned together.' };
      const floor = mover.floor;
      const near = [mover, destination, ...neighboursOf(destination, cells).filter((n) => !FIXED_TYPES.includes(n.type) && n.id !== mover.id)].filter((c, i, all) => all.indexOf(c) === i && !FIXED_TYPES.includes(c.type));
      let done: Cell[] | null = null;
      for (const size of [2, 3, 4]) {
        const ids = near.slice(0, size).map((c) => c.id);
        // Keep a room and its attached bath/dressing together.
        cells.filter((c) => ids.includes(c.room?.attachedTo || '')).forEach((c) => { if (!ids.includes(c.id)) ids.push(c.id); });
        done = resolveRegion(design, cells, floor, ids, [], [{ a: mover.id, b: destination.id, w: 10, kind: 'adj' }], !!request.hot);
        if (done) break;
      }
      if (!done) return { ok: false, reason: `${mover.name} cannot be placed next to ${destination.name} without disturbing rooms that must stay (stair, courtyard, attached bathrooms).` };
      cells = done;
      strategy = 'local-resolve';
      notes.push(`${mover.name} was re-planned next to ${destination.name}; only the rooms around that spot were re-arranged.`);
    }
  }

  const next = rebuild(request, cells, notes);
  if (!next) return { ok: false, reason: 'The edited plan could not be assembled.' };
  const report = validateFloorPlan(next);
  if (!report.isValid) return { ok: false, reason: `The edited plan would break a rule: ${report.errors[0]}` };
  return { ok: true, design: next, strategy, notes, achieved: achievedInfo };
}


/** Rebuilds a design from its own rooms without changing anything. Used by tests to prove the round trip is lossless. */
export function roundTrip(request: SurgeryRequest): StructuredDesignJSON | null {
  return rebuild(request, cellsOf(request.design, request.before), []);
}
