import { FloorPlanOpening, RoomRelationship, RoomType, SpecialMode } from '@/types/architectural';
import { ExteriorSegment, PlanCell, SharedEdge, exteriorSegments, planCompass, round2, sharedEdge } from '@/lib/geometry/planGeometry';
import { StairFoot, stairMouthEdge } from '@/lib/geometry/stairGeometry';
import { ROOM_TYPE_SPECS, isBedroomType } from './roomTypes';

export interface OpeningCell extends PlanCell {
  name: string;
  attachedTo?: string;
  relationships?: RoomRelationship[];
}

export interface SolvedOpening {
  id: string;
  type: FloorPlanOpening['type'];
  xFt: number;
  yFt: number;
  widthFt: number;
  orientation: 'horizontal' | 'vertical';
  floorLevel: number;
  connects: string[];
  label: string;
  swingDirection?: FloorPlanOpening['swingDirection'];
  hinge?: 'start' | 'end';
  swingSide?: 1 | -1;
  isExterior: boolean;
}

export interface OpeningSolution {
  openings: SolvedOpening[];
  connections: Map<string, Set<string>>;
  features: Map<string, string[]>;
  unreachable: string[];
  notes: string[];
  /** The end of the stair cell where the stair is entered; shared by 2D, 3D and the door solver. */
  stairFoot: StairFoot;
}

/** Rooms a bedroom may give private access to. */
const PRIVATE_OFF_BEDROOM: RoomType[] = ['bathroom', 'dressing', 'balcony', 'terrace'];
/** Never part of the walking graph. */
const NOT_ROOMS: RoomType[] = ['void', 'parking'];
const OPEN_PLAN_PAIRS: [RoomType, RoomType][] = [
  ['living', 'dining'], ['living', 'lounge'], ['lounge', 'stair'], ['living', 'stair'], ['dining', 'stair'],
  ['passage', 'living'], ['passage', 'dining'], ['passage', 'lounge'], ['passage', 'stair'], ['passage', 'passage']
];
const OUTDOOR: RoomType[] = ['courtyard', 'terrace', 'balcony'];
/** Compass preference for openings in warm climates: lower is cooler / better. */
const COMPASS_HEAT: Record<string, number> = { N: 0, NE: 0, E: 1, NW: 2, SE: 2, S: 3, W: 5, SW: 5 };

/** How naturally a room receives a door leaf: higher swings into it. The entry porch, outdoors and the stair never do. */
const RECEIVES_SWING: Partial<Record<RoomType, number>> = {
  entrance: -1, courtyard: -2, terrace: -2, balcony: -2, parking: -2, stair: -2, passage: 0,
  living: 1, lounge: 1, dining: 1, kitchen: 2, utility: 3, store: 3, puja: 3, study: 3,
  master_bedroom: 4, bedroom: 4, guest_room: 4, dressing: 5, bathroom: 5
};
/** Wall clearance kept between neighbouring openings and from room corners (ft). */
const OPENING_GAP = 0.4;
const CORNER_CLEARANCE = 0.5;

const hubPriority = (type: RoomType) => ROOM_TYPE_SPECS[type].hubPriority;

/**
 * Picks the end of the stair cell where it is stepped on. Doors can only open into that landing, so the
 * end whose neighbours are living space (rather than bedrooms or bathrooms) on every floor wins.
 */
function chooseStairFoot(cells: OpeningCell[]): StairFoot {
  const stairs = cells.filter((cell) => cell.type === 'stair');
  const costOf = (type: RoomType) => (hubPriority(type) ? (type === 'kitchen' ? 9 : hubPriority(type)!) : isBedroomType(type) || type === 'guest_room' ? 12 : 30);
  let best: StairFoot = 'front';
  let bestCost = Infinity;
  for (const foot of ['front', 'rear'] as StairFoot[]) {
    let total = 0;
    for (const stair of stairs) {
      let floorBest = 40;
      for (const other of cells) {
        if (other.floor !== stair.floor || other.id === stair.id || NOT_ROOMS.includes(other.type) || OUTDOOR.includes(other.type)) continue;
        if (stairMouthEdge(stair.rect, other.rect, foot)) floorBest = Math.min(floorBest, costOf(other.type));
      }
      total += floorBest;
    }
    if (total < bestCost - 1e-9) {
      bestCost = total;
      best = foot;
    }
  }
  return best;
}
const pairIs = (a: RoomType, b: RoomType, list: [RoomType, RoomType][]) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/**
 * Derives doors, openings and windows from the placed rooms.
 * Doors follow the declared relationships first, then a reachability pass guarantees every room can
 * be walked to from the entrance (or the stair, on upper floors) without crossing a bedroom or bathroom.
 */
export function solveOpenings(
  cells: OpeningCell[],
  context: { floors: number; orientation: string; modes: SpecialMode[] }
): OpeningSolution {
  const preferred = chooseStairFoot(cells);
  const first = solveWithFoot(cells, context, preferred);
  if (!cells.some((cell) => cell.type === 'stair') || first.unreachable.length === 0) return first;
  // The stair can be entered from only one end; if that end strands a room, the other end may serve better.
  const other = solveWithFoot(cells, context, preferred === 'front' ? 'rear' : 'front');
  return other.unreachable.length < first.unreachable.length ? other : first;
}

function solveWithFoot(
  cells: OpeningCell[],
  context: { floors: number; orientation: string; modes: SpecialMode[] },
  stairFoot: StairFoot
): OpeningSolution {
  const openings: SolvedOpening[] = [];
  const connections = new Map<string, Set<string>>();
  const features = new Map<string, string[]>();
  const unreachable: string[] = [];
  const notes: string[] = [];
  const lifeStage = context.modes.includes('life_stage');
  const climate = context.modes.includes('climate_adaptive');
  const compass = planCompass(context.orientation);
  let counter = 0;

  const addFeature = (id: string, text: string) => features.set(id, [...(features.get(id) || []), text]);
  const link = (a: string, b: string) => {
    connections.set(a, (connections.get(a) || new Set()).add(b));
    connections.set(b, (connections.get(b) || new Set()).add(a));
  };

  for (let floor = 0; floor < context.floors; floor++) {
    const floorCells = cells.filter((cell) => cell.floor === floor);
    const walkable = floorCells.filter((cell) => !NOT_ROOMS.includes(cell.type));
    const byId = new Map(floorCells.map((cell) => [cell.id, cell]));
    const doorPairs = new Set<string>();
    /** Every opening placed on this floor, so no two share the same stretch of wall. */
    const spans = new Map<string, { orientation: string; at: number; from: number; to: number }>();
    const clash = (orientation: string, at: number, from: number, to: number, ignore?: string) =>
      Array.from(spans.entries()).some(([id, span]) => id !== ignore && span.orientation === orientation && Math.abs(span.at - at) < 0.15 && from < span.to + OPENING_GAP && to > span.from - OPENING_GAP);
    /** First free centre along a wall run, trying the preferred centres and then sweeping the run. */
    const slotFor = (orientation: string, at: number, start: number, end: number, width: number, prefer: number[], ignore?: string): number | null => {
      const lo = start + width / 2 + Math.min(CORNER_CLEARANCE, Math.max(0, (end - start - width) / 2));
      const hi = end - width / 2 - Math.min(CORNER_CLEARANCE, Math.max(0, (end - start - width) / 2));
      const candidates = [...prefer, ...Array.from({ length: Math.max(0, Math.floor((hi - lo) / 0.5)) + 1 }, (_, i) => lo + i * 0.5)];
      for (const c of candidates) {
        const center = Math.min(hi, Math.max(lo, c));
        if (!clash(orientation, at, center - width / 2, center + width / 2, ignore)) return center;
      }
      return null;
    };
    const reserve = (id: string, orientation: string, at: number, center: number, width: number) =>
      spans.set(id, { orientation, at, from: center - width / 2, to: center + width / 2 });
    const edgeFor = (a: OpeningCell, b: OpeningCell): SharedEdge | null => {
      const stair = a.type === 'stair' && b.type !== 'stair' ? a : b.type === 'stair' && a.type !== 'stair' ? b : null;
      if (!stair) return sharedEdge(a.rect, b.rect);
      return stairMouthEdge(stair.rect, (stair === a ? b : a).rect, stairFoot);
    };
    /** The room a door leaf swings into, and which side of the wall that is. */
    const swingInto = (a: OpeningCell, b: OpeningCell, edge: Pick<SharedEdge, 'orientation' | 'at'>): { receiver: OpeningCell; side: 1 | -1 } => {
      const score = (cell: OpeningCell) => RECEIVES_SWING[cell.type] ?? 1;
      const receiver = score(a) !== score(b) ? (score(a) > score(b) ? a : b) : a.rect.w * a.rect.d <= b.rect.w * b.rect.d ? a : b;
      const lead = edge.orientation === 'horizontal' ? receiver.rect.y : receiver.rect.x;
      return { receiver, side: lead >= edge.at - 0.05 ? 1 : -1 };
    };

    const addDoor = (a: OpeningCell, b: OpeningCell): boolean => {
      const key = [a.id, b.id].sort().join('|');
      if (doorPairs.has(key)) return true;
      const edge = edgeFor(a, b);
      if (!edge || edge.length < 2.5) return false;
      if (OUTDOOR.includes(a.type) && OUTDOOR.includes(b.type)) {
        // Two open-air spaces simply run into each other: there is no wall to put a door in.
        doorPairs.add(key);
        link(a.id, b.id);
        return true;
      }
      const outdoor = OUTDOOR.includes(a.type) || OUTDOOR.includes(b.type);
      const bath = a.type === 'bathroom' || b.type === 'bathroom';
      const type: SolvedOpening['type'] = outdoor ? 'sliding_glass' : pairIs(a.type, b.type, OPEN_PLAN_PAIRS) ? 'archway' : 'door';
      const wanted = type === 'sliding_glass' ? 5 : type === 'archway' ? 4 : bath ? (lifeStage ? 3 : 2.5) : lifeStage ? 3.5 : 3;
      const widthFt = round2(Math.min(wanted, edge.length - 0.5));
      const { receiver, side } = swingInto(a, b, edge);
      // A leaf is tucked toward the room corner it can fold back against; openings without a leaf sit mid-wall.
      const mid = (edge.start + edge.end) / 2;
      let prefer = [mid];
      if (type === 'door' && edge.length >= widthFt + 3) {
        const recStart = edge.orientation === 'horizontal' ? receiver.rect.x : receiver.rect.y;
        const recEnd = edge.orientation === 'horizontal' ? receiver.rect.x + receiver.rect.w : receiver.rect.y + receiver.rect.d;
        const tuck = CORNER_CLEARANCE + 0.4 + widthFt / 2;
        const atStart = edge.start + tuck;
        const atEnd = edge.end - tuck;
        prefer = Math.abs(edge.start - recStart) < 0.1 ? [atStart, atEnd, mid] : Math.abs(edge.end - recEnd) < 0.1 ? [atEnd, atStart, mid] : [mid, atStart, atEnd];
      }
      const id = `op-${type === 'door' ? 'door' : type === 'archway' ? 'arch' : 'slide'}-${++counter}`;
      const center = slotFor(edge.orientation, edge.at, edge.start, edge.end, widthFt, prefer);
      if (center === null) return false;
      reserve(id, edge.orientation, edge.at, center, widthFt);
      openings.push({
        id,
        type,
        xFt: round2(edge.orientation === 'horizontal' ? center : edge.at),
        yFt: round2(edge.orientation === 'horizontal' ? edge.at : center),
        widthFt,
        orientation: edge.orientation,
        floorLevel: floor,
        connects: [a.id, b.id],
        label: `${a.name} ↔ ${b.name}`,
        swingDirection: type === 'door' ? 'inward_left' : type === 'sliding_glass' ? 'sliding' : undefined,
        hinge: type === 'door' ? (center - edge.start <= edge.end - center ? 'start' : 'end') : undefined,
        swingSide: type === 'door' ? side : undefined,
        isExterior: false
      });
      doorPairs.add(key);
      link(a.id, b.id);
      return true;
    };

    // 1. Doors the programme asks for: attachments and explicit connections.
    const privateLeaf = new Set<string>();
    for (const cell of walkable) {
      const anchor = cell.attachedTo ? byId.get(cell.attachedTo) : undefined;
      if (anchor && !NOT_ROOMS.includes(anchor.type)) {
        if (addDoor(anchor, cell)) {
          if (['bathroom', 'dressing', 'utility'].includes(cell.type)) privateLeaf.add(cell.id);
        } else {
          notes.push(`"${cell.name}" does not share enough wall with "${anchor.name}" for a door.`);
        }
      }
    }
    for (const cell of walkable) {
      for (const rel of cell.relationships || []) {
        if (rel.type !== 'CONNECTED_TO' && rel.type !== 'ACCESSIBLE_FROM') continue;
        const other = byId.get(rel.target);
        if (!other || NOT_ROOMS.includes(other.type) || privateLeaf.has(cell.id) || privateLeaf.has(other.id)) continue;
        // A requested connection between two sleeping/wet rooms would break privacy; leave it to the reachability pass.
        if (!hubPriority(cell.type) && !hubPriority(other.type)) continue;
        addDoor(cell, other);
      }
    }

    // 2. Reachability: grow the walking graph from the entry point through circulation rooms only.
    const root = floor === 0
      ? walkable.find((cell) => cell.type === 'entrance') || walkable.find((cell) => cell.type === 'living') || walkable[0]
      : walkable.find((cell) => cell.type === 'stair') || walkable[0];
    const reached = new Set<string>();
    const canPassThrough = (from: OpeningCell, to: OpeningCell) =>
      !!hubPriority(from.type) || ((isBedroomType(from.type) || from.type === 'guest_room') && PRIVATE_OFF_BEDROOM.includes(to.type));
    const flood = () => {
      let grew = true;
      while (grew) {
        grew = false;
        for (const id of Array.from(reached)) {
          const from = byId.get(id)!;
          for (const nextId of Array.from(connections.get(id) || [])) {
            const next = byId.get(nextId);
            if (!next || reached.has(nextId) || !canPassThrough(from, next)) continue;
            reached.add(nextId);
            grew = true;
          }
        }
      }
    };
    if (root) {
      reached.add(root.id);
      flood();
      for (let guard = 0; guard < walkable.length * 2; guard++) {
        let best: { from: OpeningCell; to: OpeningCell; score: number } | null = null;
        for (const to of walkable) {
          if (reached.has(to.id) || privateLeaf.has(to.id)) continue; // ensuites open only off their own room
          for (const from of walkable) {
            if (!reached.has(from.id) || !canPassThrough(from, to)) continue;
            const edge = edgeFor(from, to);
            if (!edge || edge.length < 2.5) continue;
            let score = hubPriority(from.type) || 8;
            if (from.type === 'stair' && !hubPriority(to.type)) score += 6; // the stair opens onto living space where it can
            if (to.type === 'bathroom' && (from.type === 'living' || from.type === 'dining' || from.type === 'kitchen')) score += 7;
            if (from.type === 'kitchen' && to.type !== 'utility' && to.type !== 'store') score += 6; // avoid walking through the kitchen
            if (to.type === 'kitchen' && from.type === 'living') score += 2; // the kitchen opens off the dining room where it can
            if ((isBedroomType(to.type) || to.type === 'guest_room') && from.type === 'living') score += 1.5;
            if (from.type === 'entrance' && to.type !== 'living' && to.type !== 'lounge') score += 3;
            if (OUTDOOR.includes(from.type)) score += 4;
            if (hubPriority(to.type)) score -= 0.5; // open up circulation first
            if (!best || score < best.score) best = { from, to, score };
          }
        }
        if (!best) break;
        addDoor(best.from, best.to);
        reached.add(best.to.id);
        flood();
      }
    }
    walkable.filter((cell) => !reached.has(cell.id)).forEach((cell) => unreachable.push(cell.id));

    // 3. Main entrance door (ground floor): the door from the entrance porch into the house, or,
    //    without a porch, a door in the entry room's outside wall.
    if (floor === 0 && root) {
      const porchDoor = root.type === 'entrance' ? openings.find((op) => op.floorLevel === 0 && op.connects.includes(root.id) && op.connects.length === 2) : undefined;
      if (porchDoor) {
        // The porch door becomes the main entrance: wider, centred where the wall allows, swinging into the house.
        spans.delete(porchDoor.id);
        porchDoor.id = 'op-main';
        porchDoor.type = 'door';
        porchDoor.label = 'Main Entrance';
        porchDoor.isExterior = true;
        porchDoor.swingDirection = 'inward_left';
        const a = byId.get(porchDoor.connects[0])!;
        const b = byId.get(porchDoor.connects[1])!;
        const edge = edgeFor(a, b);
        const wide = round2(Math.min(lifeStage ? 4 : 3.5, (edge?.length ?? porchDoor.widthFt) - 0.5));
        const center = edge ? slotFor(edge.orientation, edge.at, edge.start, edge.end, wide, [(edge.start + edge.end) / 2]) : null;
        if (edge && center !== null) {
          porchDoor.widthFt = wide;
          if (edge.orientation === 'horizontal') porchDoor.xFt = round2(center);
          else porchDoor.yFt = round2(center);
          porchDoor.hinge = center - edge.start <= edge.end - center ? 'start' : 'end';
          reserve('op-main', edge.orientation, edge.at, center, wide);
        } else {
          reserve('op-main', porchDoor.orientation, porchDoor.orientation === 'horizontal' ? porchDoor.yFt : porchDoor.xFt, porchDoor.orientation === 'horizontal' ? porchDoor.xFt : porchDoor.yFt, porchDoor.widthFt);
        }
        if (lifeStage) addFeature(root.id, 'Step-free 4 ft wide main entrance');
      } else {
        const ext = exteriorSegments(root, floorCells).filter((seg) => !seg.facesOpenSpace && seg.length >= 3.5);
        const front = ext.filter((seg) => seg.side === 'front').sort((x, y) => y.length - x.length)[0] || ext.sort((x, y) => y.length - x.length)[0];
        const wide = lifeStage ? 4 : 3.5;
        const center = front ? slotFor(front.orientation, front.at, front.start, front.end, wide, [(front.start + front.end) / 2]) : null;
        if (front && center !== null) {
          reserve('op-main', front.orientation, front.at, center, wide);
          const lead = front.orientation === 'horizontal' ? root.rect.y : root.rect.x;
          openings.push({
            id: 'op-main', type: 'door',
            xFt: round2(front.orientation === 'horizontal' ? center : front.at),
            yFt: round2(front.orientation === 'horizontal' ? front.at : center),
            widthFt: wide, orientation: front.orientation, floorLevel: 0, connects: [root.id],
            label: 'Main Entrance', swingDirection: 'inward_left', isExterior: true,
            hinge: center - front.start <= front.end - center ? 'start' : 'end', swingSide: lead >= front.at - 0.05 ? 1 : -1
          });
          if (lifeStage) addFeature(root.id, 'Step-free 4 ft wide main entrance');
        } else {
          notes.push('The entry room has no external wall for a main door.');
        }
      }
    }

    // 4. Windows on walls that face outside air.
    for (const cell of walkable) {
      const typeSpec = ROOM_TYPE_SPECS[cell.type];
      const wantsLight = typeSpec.habitable || cell.type === 'bathroom' || cell.type === 'stair';
      if (!wantsLight) continue;
      const candidates = exteriorSegments(cell, floorCells).filter((seg) => seg.length >= 3);
      if (!candidates.length) continue; // reported by validation
      const heat = (seg: ExteriorSegment) => COMPASS_HEAT[compass[seg.side]] ?? 2;
      candidates.sort((a, b) => (climate ? heat(a) - heat(b) : 0) || b.length - a.length);
      const sidesUsed = new Set<string>();
      const wantedCount = !typeSpec.habitable ? 1 : climate || cell.type === 'living' ? 2 : 1;
      for (const seg of candidates) {
        if (sidesUsed.size >= wantedCount) break;
        if (sidesUsed.has(seg.side)) continue;
        sidesUsed.add(seg.side);
        const hot = climate && heat(seg) >= 5;
        const base = cell.type === 'bathroom' ? 2 : cell.type === 'living' ? 6 : cell.type === 'kitchen' || cell.type === 'stair' ? 3.5 : 4;
        let widthFt = round2(Math.min(hot ? Math.min(base, 2.5) : base, seg.length - 1));
        const mid = (seg.start + seg.end) / 2;
        let centre = slotFor(seg.orientation, seg.at, seg.start, seg.end, widthFt, [mid]);
        if (centre === null && widthFt > 2.5) {
          widthFt = round2(Math.max(2, widthFt * 0.7));
          centre = slotFor(seg.orientation, seg.at, seg.start, seg.end, widthFt, [mid]);
        }
        if (centre === null) {
          sidesUsed.delete(seg.side);
          continue;
        }
        const direction = compass[seg.side];
        const windowId = `op-win-${++counter}`;
        reserve(windowId, seg.orientation, seg.at, centre, widthFt);
        openings.push({
          id: windowId, type: 'window',
          xFt: round2(seg.orientation === 'horizontal' ? centre : seg.at),
          yFt: round2(seg.orientation === 'horizontal' ? seg.at : centre),
          widthFt, orientation: seg.orientation, floorLevel: floor, connects: [cell.id],
          label: cell.type === 'bathroom' ? `${cell.name} ventilator (${direction})` : `${cell.name} window (${direction}${seg.facesOpenSpace ? ', courtyard side' : ''})`,
          isExterior: true
        });
        if (hot) addFeature(cell.id, `Reduced ${direction} glazing to limit afternoon heat`);
      }
      if (climate && typeSpec.habitable) {
        addFeature(cell.id, sidesUsed.size >= 2 ? 'Cross-ventilated: openings on two sides' : 'Single-aspect room: ventilation relies on one wall');
      }
    }
  }

  return { openings, connections, features, unreachable, notes, stairFoot };
}
