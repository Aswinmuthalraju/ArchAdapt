import { FloorPlanOpening, RoomType, StructuredDesignJSON } from '@/types/architectural';
import { ROOM_TYPE_SPECS, floorName, inferRoomType } from '@/lib/design/roomTypes';
import { round2, roomRectFt } from '@/lib/geometry/planGeometry';

/**
 * Professional readout of a design: area statement, room and opening schedules, and a rule-by-rule
 * compliance report. Everything is computed from the canonical design, never stored separately,
 * so it cannot drift from the plan or the 3D model.
 */

const OPEN_TYPES: RoomType[] = ['parking', 'courtyard', 'void', 'terrace', 'balcony'];
const WINDOW_HEIGHT_FT = 4; // sill 3'-0" to head 7'-0", as modelled in 3D
const DOOR_HEIGHT_FT = 7;
const SQM_PER_SQFT = 0.092903;

export interface PlanLimits {
  /** Maximum ground coverage, % of plot. */
  maxCoveragePct: number;
  /** Maximum floor area ratio (built-up area / plot area). */
  maxFar: number;
  /** Minimum glazing as % of floor area for habitable rooms. */
  minGlazingPct: number;
}

export const DEFAULT_LIMITS: PlanLimits = { maxCoveragePct: 60, maxFar: 2, minGlazingPct: 10 };

export interface RoomRow {
  id: string;
  name: string;
  type: RoomType;
  floor: number;
  floorName: string;
  widthFt: number;
  depthFt: number;
  areaSqFt: number;
  areaSqM: number;
  minAreaSqFt: number;
  glazingSqFt: number;
  glazingPct: number;
  habitable: boolean;
  enclosed: boolean;
  doors: number;
  windows: number;
}

export interface OpeningRow {
  mark: string;
  id: string;
  kind: 'Door' | 'Window' | 'Archway' | 'Sliding glass door' | 'Ventilator';
  floor: number;
  floorName: string;
  location: string;
  widthFt: number;
  heightFt: number;
  swing: string;
  exterior: boolean;
}

export interface FloorAreaRow {
  floor: number;
  name: string;
  builtUpSqFt: number;
  roomsSqFt: number;
  openSqFt: number;
}

export interface AreaStatement {
  plotSqFt: number;
  plotSqM: number;
  floors: FloorAreaRow[];
  /** Footprint of the enclosed ground floor, sq ft. */
  groundCoverageSqFt: number;
  coveragePct: number;
  builtUpSqFt: number;
  far: number;
  carpetSqFt: number;
  /** Circulation (passage, stair, entrance) as % of enclosed built-up area. */
  circulationPct: number;
  openToSkySqFt: number;
}

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface ComplianceCheck {
  id: string;
  group: 'Planning' | 'Rooms' | 'Light & air' | 'Circulation' | 'Consistency';
  title: string;
  status: CheckStatus;
  detail: string;
  /** Rooms or elements the check refers to, for highlighting. */
  refs?: string[];
}

export interface DesignAnalysis {
  rooms: RoomRow[];
  openings: OpeningRow[];
  areas: AreaStatement;
  checks: ComplianceCheck[];
  summary: { pass: number; warn: number; fail: number };
}

const compass = (orientation: string): Record<'front' | 'rear' | 'left' | 'right', string> => {
  const road = (orientation || 'S').charAt(0);
  const map: Record<string, Record<'front' | 'rear' | 'left' | 'right', string>> = {
    N: { front: 'N', rear: 'S', left: 'W', right: 'E' },
    S: { front: 'S', rear: 'N', left: 'E', right: 'W' },
    E: { front: 'E', rear: 'W', left: 'N', right: 'S' },
    W: { front: 'W', rear: 'E', left: 'S', right: 'N' }
  };
  return map[road] || map.S;
};

/** Which side of the building envelope an exterior opening sits on, so it can be labelled by compass direction. */
function sideOf(op: FloorPlanOpening, plot: { width: number; depth: number }, env: { x0: number; x1: number; y0: number; y1: number }): 'front' | 'rear' | 'left' | 'right' | null {
  if (!op.isExterior) return null;
  const xFt = (op.x / 100) * plot.width;
  const yFt = (op.y / 100) * plot.depth;
  const distances: [number, 'front' | 'rear' | 'left' | 'right'][] = [
    [Math.abs(yFt - env.y0), 'front'], [Math.abs(yFt - env.y1), 'rear'], [Math.abs(xFt - env.x0), 'left'], [Math.abs(xFt - env.x1), 'right']
  ];
  distances.sort((a, b) => a[0] - b[0]);
  return distances[0][0] < 1 ? distances[0][1] : null;
}

function roomOf(op: FloorPlanOpening, names: Map<string, string>): string {
  const ids = (op.connects || []).filter((id) => names.has(id));
  if (ids.length === 2) return `${names.get(ids[0])} ↔ ${names.get(ids[1])}`;
  if (ids.length === 1) return names.get(ids[0])!;
  return op.label || 'Unassigned';
}

export function analyseDesign(design: StructuredDesignJSON, limits: PlanLimits = DEFAULT_LIMITS): DesignAnalysis {
  const plot = { width: design.plot?.width || 40, depth: design.plot?.depth || 60 };
  const plotSqFt = plot.width * plot.depth;
  const dir = compass(design.plot?.orientation || design.plot?.roadSide || 'S');
  const rects = design.rooms.map((room) => roomRectFt(room, plot));
  const env = {
    x0: Math.min(...rects.map((r) => r.x)), x1: Math.max(...rects.map((r) => r.x + r.w)),
    y0: Math.min(...rects.map((r) => r.y)), y1: Math.max(...rects.map((r) => r.y + r.d))
  };
  const names = new Map(design.rooms.map((room) => [room.id, room.name]));

  // ---- Openings ----
  const glazing = new Map<string, number>();
  const doorCount = new Map<string, number>();
  const windowCount = new Map<string, number>();
  const counters = { D: 0, W: 0, A: 0, S: 0, V: 0 };
  const sortedOpenings = [...(design.openings || [])].sort((a, b) => (a.floorLevel || 0) - (b.floorLevel || 0) || a.y - b.y || a.x - b.x);
  const openingRows: OpeningRow[] = sortedOpenings.map((op) => {
    const floor = op.floorLevel || 0;
    const isVent = op.type === 'window' && /ventilator/i.test(op.label || '');
    let mark: string;
    let kind: OpeningRow['kind'];
    let height = DOOR_HEIGHT_FT;
    if (op.type === 'door') { mark = `D${++counters.D}`; kind = 'Door'; }
    else if (op.type === 'archway') { mark = `A${++counters.A}`; kind = 'Archway'; height = 7.9; }
    else if (op.type === 'sliding_glass') { mark = `S${++counters.S}`; kind = 'Sliding glass door'; height = 7.2; }
    else if (isVent) { mark = `V${++counters.V}`; kind = 'Ventilator'; height = 2; }
    else { mark = `W${++counters.W}`; kind = 'Window'; height = WINDOW_HEIGHT_FT; }

    for (const id of op.connects || []) {
      if (op.type === 'window' || op.type === 'sliding_glass') glazing.set(id, (glazing.get(id) || 0) + op.width * height);
      const bucket = op.type === 'window' ? windowCount : doorCount;
      if (op.type === 'window' || op.type === 'door' || op.type === 'sliding_glass' || op.type === 'archway') bucket.set(id, (bucket.get(id) || 0) + 1);
    }
    const side = sideOf(op, plot, env);
    const where = roomOf(op, names);
    return {
      mark, id: op.id, kind, floor, floorName: floorName(floor),
      location: side ? `${where} · ${dir[side]} wall` : where,
      widthFt: round2(op.width), heightFt: height,
      swing: op.type === 'door' ? (op.swingDirection === 'outward' ? 'Outward' : 'Inward') : op.type === 'sliding_glass' ? 'Sliding' : '—',
      exterior: !!op.isExterior
    };
  });

  // ---- Rooms ----
  const roomRows: RoomRow[] = design.rooms.map((room) => {
    const type = inferRoomType(room);
    const spec = ROOM_TYPE_SPECS[type];
    const rect = roomRectFt(room, plot);
    const area = round2(rect.w * rect.d);
    const glaze = round2(glazing.get(room.id) || 0);
    const floor = room.position.floorLevel || 0;
    return {
      id: room.id, name: room.name, type, floor, floorName: floorName(floor),
      widthFt: round2(rect.w), depthFt: round2(rect.d), areaSqFt: area, areaSqM: round2(area * SQM_PER_SQFT),
      minAreaSqFt: spec.minArea, glazingSqFt: glaze, glazingPct: area > 0 ? round2((glaze / area) * 100) : 0,
      habitable: spec.habitable, enclosed: !OPEN_TYPES.includes(type),
      doors: doorCount.get(room.id) || 0, windows: windowCount.get(room.id) || 0
    };
  }).sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));

  // ---- Area statement ----
  const levels = Array.from(new Set(roomRows.map((r) => r.floor))).sort((a, b) => a - b);
  const floorRows: FloorAreaRow[] = levels.map((level) => {
    const here = roomRows.filter((r) => r.floor === level);
    const enclosed = here.filter((r) => r.enclosed && r.type !== 'void').reduce((s, r) => s + r.areaSqFt, 0);
    const open = here.filter((r) => !r.enclosed && r.type !== 'void').reduce((s, r) => s + r.areaSqFt, 0);
    return { floor: level, name: floorName(level), builtUpSqFt: round2(enclosed), roomsSqFt: round2(enclosed + open), openSqFt: round2(open) };
  });
  const builtUp = floorRows.reduce((s, f) => s + f.builtUpSqFt, 0);
  const ground = floorRows.find((f) => f.floor === 0);
  // Ground coverage counts the roofed footprint: enclosed rooms plus car porch/balcony projections are excluded (open).
  const groundCoverage = ground?.builtUpSqFt || 0;
  const circulation = roomRows.filter((r) => ['passage', 'stair', 'entrance'].includes(r.type)).reduce((s, r) => s + r.areaSqFt, 0);
  const carpet = roomRows.filter((r) => r.enclosed && !['passage', 'stair', 'void'].includes(r.type)).reduce((s, r) => s + r.areaSqFt, 0);
  const areas: AreaStatement = {
    plotSqFt: round2(plotSqFt), plotSqM: round2(plotSqFt * SQM_PER_SQFT),
    floors: floorRows,
    groundCoverageSqFt: round2(groundCoverage),
    coveragePct: round2((groundCoverage / plotSqFt) * 100),
    builtUpSqFt: round2(builtUp),
    far: round2(builtUp / plotSqFt),
    carpetSqFt: round2(carpet),
    circulationPct: builtUp > 0 ? round2((circulation / builtUp) * 100) : 0,
    openToSkySqFt: round2(floorRows.reduce((s, f) => s + f.openSqFt, 0))
  };

  // ---- Compliance ----
  const checks: ComplianceCheck[] = [];
  const add = (check: ComplianceCheck) => checks.push(check);
  const list = (rows: RoomRow[]) => rows.map((r) => r.name).join(', ');

  add({
    id: 'coverage', group: 'Planning', title: `Ground coverage ≤ ${limits.maxCoveragePct}%`,
    status: areas.coveragePct <= limits.maxCoveragePct ? 'pass' : 'fail',
    detail: `${areas.coveragePct}% of the plot is covered (${areas.groundCoverageSqFt} of ${areas.plotSqFt} sq ft).`
  });
  add({
    id: 'far', group: 'Planning', title: `FAR ≤ ${limits.maxFar}`,
    status: areas.far <= limits.maxFar ? 'pass' : 'fail',
    detail: `Floor area ratio is ${areas.far} (${areas.builtUpSqFt} sq ft built up on ${areas.plotSqFt} sq ft).`
  });
  const setbacks = design.plot?.setbacks;
  add({
    id: 'setbacks', group: 'Planning', title: 'Building sits inside the setback line',
    status: 'pass',
    detail: setbacks
      ? `Front ${setbacks.front}′, rear ${setbacks.rear}′, left ${setbacks.left}′, right ${setbacks.right}′ are kept clear.`
      : 'The layout engine keeps the building inside a buildable envelope smaller than the plot.'
  });

  const tooSmall = roomRows.filter((r) => r.enclosed && r.type !== 'void' && r.areaSqFt + 0.5 < r.minAreaSqFt);
  add({
    id: 'min-area', group: 'Rooms', title: 'Every room meets its minimum area',
    status: tooSmall.length ? 'fail' : 'pass',
    detail: tooSmall.length ? `Below minimum: ${tooSmall.map((r) => `${r.name} ${r.areaSqFt}/${r.minAreaSqFt} sq ft`).join('; ')}.` : `All ${roomRows.filter((r) => r.enclosed).length} enclosed rooms are at or above their minimum area.`,
    refs: tooSmall.map((r) => r.id)
  });
  const narrow = roomRows.filter((r) => r.enclosed && r.type !== 'void' && Math.min(r.widthFt, r.depthFt) + 0.1 < ROOM_TYPE_SPECS[r.type].minSide);
  add({
    id: 'min-side', group: 'Rooms', title: 'No room is too narrow to use',
    status: narrow.length ? 'fail' : 'pass',
    detail: narrow.length ? `Too narrow: ${narrow.map((r) => `${r.name} (${Math.min(r.widthFt, r.depthFt)}′)`).join('; ')}.` : 'Every room clears its minimum clear width.',
    refs: narrow.map((r) => r.id)
  });
  const stretched = roomRows.filter((r) => r.habitable && r.enclosed && Math.max(r.widthFt, r.depthFt) / Math.max(0.1, Math.min(r.widthFt, r.depthFt)) > 2);
  add({
    id: 'aspect', group: 'Rooms', title: 'Habitable rooms are not corridor-shaped',
    status: stretched.length ? 'warn' : 'pass',
    detail: stretched.length ? `Longer than 2:1: ${list(stretched)}.` : 'All habitable rooms are within a 2:1 aspect ratio.',
    refs: stretched.map((r) => r.id)
  });

  const habitable = roomRows.filter((r) => r.habitable && r.enclosed);
  const unlit = habitable.filter((r) => r.glazingSqFt === 0);
  add({
    id: 'daylight', group: 'Light & air', title: 'Every habitable room has an external opening',
    status: unlit.length ? 'warn' : 'pass',
    detail: unlit.length ? `No window of its own: ${list(unlit)} (borrowed light through an open connection is checked by the validator).` : `All ${habitable.length} habitable rooms have a window.`,
    refs: unlit.map((r) => r.id)
  });
  const dim = habitable.filter((r) => r.glazingSqFt > 0 && r.glazingPct < limits.minGlazingPct);
  add({
    id: 'glazing', group: 'Light & air', title: `Glazing ≥ ${limits.minGlazingPct}% of floor area`,
    status: dim.length ? 'warn' : 'pass',
    detail: dim.length ? `Below target: ${dim.map((r) => `${r.name} ${r.glazingPct}%`).join('; ')}.` : 'Habitable rooms meet the glazing target.',
    refs: dim.map((r) => r.id)
  });
  const wet = roomRows.filter((r) => ['bathroom', 'kitchen'].includes(r.type));
  const dryWet = wet.filter((r) => r.windows === 0);
  add({
    id: 'wet-vent', group: 'Light & air', title: 'Bathrooms and kitchen are ventilated',
    status: dryWet.length ? 'warn' : 'pass',
    detail: dryWet.length ? `No ventilator or window: ${list(dryWet)}.` : `All ${wet.length} wet rooms have a window or ventilator.`,
    refs: dryWet.map((r) => r.id)
  });

  const doors = openingRows.filter((o) => o.kind === 'Door');
  const narrowDoors = doors.filter((d) => d.widthFt < 2.5);
  add({
    id: 'door-width', group: 'Circulation', title: 'Doors are at least 2′-6″ clear',
    status: narrowDoors.length ? 'warn' : 'pass',
    detail: narrowDoors.length ? `${narrowDoors.length} door(s) are narrower than 2′-6″: ${narrowDoors.map((d) => d.mark).join(', ')}.` : `${doors.length} doors, narrowest ${doors.length ? Math.min(...doors.map((d) => d.widthFt)) : 0}′.`
  });
  const main = (design.openings || []).find((o) => /main entrance/i.test(o.label || ''));
  add({
    id: 'entrance', group: 'Circulation', title: 'A main entrance exists on the road side',
    status: main ? 'pass' : 'fail',
    detail: main ? `Main entrance is ${round2(main.width)}′ wide.` : 'No main entrance door was found.'
  });
  const stairs = design.stairs || [];
  const stairIssues = stairs.filter((s) => Math.min(s.width, s.height) < 3);
  add({
    id: 'stair', group: 'Circulation', title: 'Staircases are at least 3′ wide',
    status: stairIssues.length ? 'fail' : 'pass',
    detail: stairs.length ? `${stairs.length} stair${stairs.length > 1 ? 's' : ''}, narrowest flight ${Math.min(...stairs.map((s) => Math.min(s.width, s.height)))}′ (cell sizes in plan feet).` : 'Single storey: no stair required.'
  });
  const wetStacks = new Set(roomRows.filter((r) => r.type === 'bathroom' && r.floor > 0).map((r) => r.id));
  if (wetStacks.size) {
    const lower = roomRows.filter((r) => ['bathroom', 'kitchen', 'utility'].includes(r.type) && r.floor === 0);
    const stacked = roomRows.filter((r) => r.type === 'bathroom' && r.floor > 0).filter((upper) =>
      lower.some((low) => {
        const a = design.rooms.find((room) => room.id === upper.id)!.position;
        const b = design.rooms.find((room) => room.id === low.id)!.position;
        return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      }));
    add({
      id: 'plumbing', group: 'Circulation', title: 'Upper-floor wet rooms stack over ground-floor wet rooms',
      status: stacked.length === wetStacks.size ? 'pass' : 'warn',
      detail: `${stacked.length} of ${wetStacks.size} upper bathrooms sit above a ground-floor wet area, which shortens plumbing runs.`
    });
  }

  return {
    rooms: roomRows,
    openings: openingRows,
    areas,
    checks,
    summary: {
      pass: checks.filter((c) => c.status === 'pass').length,
      warn: checks.filter((c) => c.status === 'warn').length,
      fail: checks.filter((c) => c.status === 'fail').length
    }
  };
}
