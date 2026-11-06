import {
  DesignConstraints, DesignProgram, ProgramRoom, RoomType, SiteInfo, StructuredDesignJSON
} from '@/types/architectural';
import { PlacedRoom, WorkRoom, LayoutFailure, assembleDesign } from '@/lib/design/layoutEngine';
import { ROOM_TYPE_SPECS, floorName, isBedroomType } from '@/lib/design/roomTypes';
import { Rect, planCompass, sharedEdge } from '@/lib/geometry/planGeometry';
import { Envelope, computeEnvelope } from './envelope';
import { validateFloorPlan } from '@/lib/design/validateFloorPlan';
import { HARD_TERMS, layoutEnergy } from './energy';
import { ARCHETYPES, ArchId, Archetype, EnergyCtx, FixedCell, PRoom, PairSpec } from './model';
import { Rng, SNode, Sizing, isLeaf, leafIds, mulberry32, mutate, realize, seedTree, subtractRects } from './slicing';

export interface DesignIntent {
  /** Pairs of room types (or ids) that should share a wall, with a weight 1-10, from the AI brief. */
  adjacency?: { a: string; b: string; weight: number; kind?: 'adj' | 'near' | 'avoid' }[];
  /** Archetypes the brief favours, best first. */
  preferredArchetypes?: ArchId[];
  /** Plain-language reasons shown to the user. */
  reasons?: string[];
}

export interface OptimizeOptions {
  hot?: boolean;
  intent?: DesignIntent;
  /** Archetypes to try. Defaults to all that suit the brief. */
  archetypes?: ArchId[];
  /** Added to every random seed, so a regeneration explores different plans. */
  seedOffset?: number;
  /** Scales iteration counts (tests use less). */
  effort?: number;
  /** Stop retrying once this much time has passed (ms). The first attempt of every archetype always runs. */
  budgetMs?: number;
}

export interface PlanCandidate {
  archetype: Archetype;
  design: StructuredDesignJSON;
  notes: string[];
  energy: number;
  /** Per-floor energy terms of the ground floor, for explanations. */
  terms: Record<string, number>;
  compression: number;
  footprint: Rect;
  unreachable: string[];
}

export type OptimizeResult = { ok: true; candidates: PlanCandidate[]; rejected: string[] } | (LayoutFailure & { rejected?: string[] });

const MAX_ASPECT: Partial<Record<RoomType, number>> = {
  living: 1.6, dining: 1.6, kitchen: 1.7, master_bedroom: 1.55, bedroom: 1.6, guest_room: 1.7, study: 2.1, lounge: 2.2, bathroom: 2.4,
  parking: 2.4, courtyard: 1.6, entrance: 9, balcony: 7, terrace: 6, store: 2.6, puja: 2.2, utility: 3.2, dressing: 3, stair: 2.8, passage: 40
};
const GROW_EXPONENT = (type: RoomType): number => (['living', 'dining', 'kitchen', 'master_bedroom', 'bedroom', 'guest_room', 'study', 'lounge', 'courtyard'].includes(type) ? 1 : ['balcony', 'terrace', 'parking', 'stair', 'passage'].includes(type) ? 0 : 0.5);
const GROW_CAP: Partial<Record<RoomType, number>> = {
  living: 380, dining: 250, kitchen: 205, master_bedroom: 310, bedroom: 225, guest_room: 205, lounge: 260, study: 180,
  entrance: 120, puja: 60, store: 60, utility: 80, bathroom: 60, dressing: 70, courtyard: 220
};
const COVERAGE = (plot: number) => (plot <= 1500 ? 0.65 : plot <= 2500 ? 0.55 : plot <= 5000 ? 0.44 : plot <= 8000 ? 0.38 : plot <= 15000 ? 0.32 : 0.28);
const snap = (v: number) => Math.round(v * 2) / 2;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const STAIR_TARGET = 84;
const LOBBY_TARGET = 64;

function toPRoom(room: ProgramRoom, scale: number): PRoom {
  const spec = ROOM_TYPE_SPECS[room.type];
  const hintY = room.band === 'front' ? 0.2 : room.band === 'rear' ? 0.8 : undefined;
  const hintX = room.side === 'left' ? 0.2 : room.side === 'right' ? 0.8 : undefined;
  return {
    id: room.id, name: room.name, type: room.type, floor: room.floor,
    target: Math.max(spec.minArea, room.areaSqFt * scale), minArea: spec.minArea, minSide: spec.minSide, maxAspect: MAX_ASPECT[room.type] ?? 2.4,
    attachedTo: room.attachedTo, relationships: room.relationships, derived: false, required: room.required, hintY, hintX, ref: room
  };
}

function derived(id: string, name: string, type: RoomType, floor: number, target: number, extra: Partial<PRoom> = {}): PRoom {
  const spec = ROOM_TYPE_SPECS[type];
  return {
    id, name, type, floor, target, minArea: Math.min(spec.minArea, target), minSide: spec.minSide, maxAspect: MAX_ASPECT[type] ?? 3,
    relationships: [], derived: true, required: false, ...extra
  };
}

interface Plan {
  rooms: PRoom[][]; // per floor, movable rooms
  stairId?: string;
  courtyards: PRoom[];
  scale: number;
  growth: number;
  need: number[]; // per floor target area incl. stair
  minNeed: number[];
}

/** Rooms per floor, with the pieces only the planner may add. */
function buildPlan(program: DesignProgram, constraints: DesignConstraints, arch: Archetype, lifeStage: boolean): Plan {
  const floors = constraints.floors;
  const multi = floors > 1;
  const base = program.rooms.map((r) => toPRoom(r, 1));
  const rooms: PRoom[][] = Array.from({ length: floors }, (_, f) => base.filter((r) => r.floor === f));
  const courtyards = base.filter((r) => r.type === 'courtyard' && r.floor === 0);
  if (multi) {
    rooms[0].push(derived('room-stair-0', 'Staircase', 'stair', 0, STAIR_TARGET, { minArea: 60, minSide: 6.5, maxAspect: 2.8 }));
    for (let f = 1; f < floors; f++) {
      if (!rooms[f].some((r) => r.type === 'lounge')) rooms[f].push(derived(`room-lobby-${f}`, 'Upper Lobby', 'lounge', f, LOBBY_TARGET, { minArea: 48, minSide: 5.5, maxAspect: 2.6 }));
    }
  }
  const passageT = lifeStage ? 4.5 : 3.5;
  if (arch.passage) {
    for (let f = 0; f < floors; f++) {
      const sleepers = rooms[f].filter((r) => isBedroomType(r.type) || r.type === 'guest_room').length;
      if (sleepers >= 3 || (f === 0 && sleepers >= 2 && rooms[f].length >= 9)) {
        rooms[f].push(derived(`room-passage-${f}`, 'Passage', 'passage', f, passageT * 16, { strip: passageT, minArea: 20, minSide: 3, maxAspect: 60 }));
      }
    }
  }
  return { rooms, stairId: multi ? 'room-stair-0' : undefined, courtyards, scale: 1, growth: 1, need: [], minNeed: [] };
}

/** Pairs of rooms that must or should touch, from the programme, the brief and architectural convention. */
function pairsFor(rooms: PRoom[], intent: DesignIntent | undefined, tight: boolean): PairSpec[] {
  const ids = new Set(rooms.map((r) => r.id));
  const byType = (t: string) => rooms.filter((r) => r.type === t);
  const out: PairSpec[] = [];
  const push = (a: string, b: string, w: number, kind: PairSpec['kind']) => {
    if (a !== b && ids.has(a) && ids.has(b)) out.push({ a, b, w, kind });
  };
  for (const r of rooms) {
    if (r.attachedTo) push(r.id, r.attachedTo, r.type === 'entrance' || r.type === 'bathroom' || r.type === 'dressing' ? 9 : 7, 'adj');
    for (const rel of r.relationships) {
      if (rel.type === 'ATTACHED_TO') push(r.id, rel.target, 8, 'adj');
      else if (rel.type === 'ADJACENT_TO' || rel.type === 'CONNECTED_TO') push(r.id, rel.target, 5, 'adj');
      else if (rel.type === 'ACCESSIBLE_FROM') push(r.id, rel.target, 3, 'adj');
      else if (rel.type === 'NEAR') push(r.id, rel.target, 2.5, 'near');
      else if (rel.type === 'PRIVATE_FROM') push(r.id, rel.target, 3, 'avoid');
    }
  }
  for (const k of byType('kitchen')) for (const d of byType('dining')) push(k.id, d.id, 8, 'adj');
  for (const d of byType('dining')) for (const l of byType('living')) push(d.id, l.id, tight ? 4 : 3, 'adj');
  for (const l of byType('lounge')) for (const s of byType('stair')) push(l.id, s.id, 5, 'adj');
  for (const p of byType('puja')) for (const l of byType('living')) push(p.id, l.id, 1.5, 'near');
  for (const s of byType('study')) for (const l of byType('living')) push(s.id, l.id, 1, 'near');
  for (const b of byType('balcony')) for (const l of [...byType('lounge'), ...byType('master_bedroom')]) push(b.id, l.id, 1.5, 'near');
  for (const link of intent?.adjacency || []) {
    const as = rooms.filter((r) => r.id === link.a || r.type === link.a);
    const bs = rooms.filter((r) => r.id === link.b || r.type === link.b);
    for (const a of as) for (const b of bs) push(a.id, b.id, Math.min(10, Math.max(0.5, link.weight)), link.kind || 'adj');
  }
  return out;
}

interface FloorSolution {
  rects: Rect[];
  energy: number;
  trees: SNode[];
}

function sizingFor(rooms: PRoom[]): Sizing {
  return { weight: rooms.map((r) => Math.max(8, r.target)), strip: rooms.map((r) => r.strip) };
}

function realizeAll(trees: SNode[], pieces: Rect[], sizing: Sizing, out: Rect[]): void {
  for (let i = 0; i < trees.length; i++) realize(trees[i], pieces[i], sizing, out);
}

function anneal(
  ctx: EnergyCtx, pieces: Rect[], start: SNode[], iters: number, rng: Rng, t0 = 7, t1 = 0.06
): FloorSolution {
  const sizing = sizingFor(ctx.rooms);
  const idx = new Map(ctx.rooms.map((r, i) => [r.id, i]));
  const links: [number, number][] = [];
  for (const p of ctx.pairs) {
    const a = idx.get(p.a);
    const b = idx.get(p.b);
    if (p.kind === 'adj' && p.w >= 7 && a !== undefined && b !== undefined) links.push([a, b]);
  }
  const rects: Rect[] = new Array(ctx.rooms.length);
  realizeAll(start, pieces, sizing, rects);
  let trees = start;
  let current = layoutEnergy(ctx, rects);
  let best = { trees, energy: current, rects: rects.slice() };
  const cand: Rect[] = new Array(ctx.rooms.length);
  const cool = Math.pow(t1 / t0, 1 / Math.max(1, iters));
  let T = t0;
  for (let it = 0; it < iters; it++, T *= cool) {
    const next = mutate(trees, rng, links);
    if (!next) continue;
    realizeAll(next, pieces, sizing, cand);
    const e = layoutEnergy(ctx, cand);
    const d = e - current;
    if (d <= 0 || rng() < Math.exp(-d / T)) {
      trees = next; current = e;
      if (e < best.energy) best = { trees: next, energy: e, rects: cand.slice() };
    }
  }
  return { rects: best.rects, energy: best.energy, trees: best.trees };
}

function hardCost(ctx: EnergyCtx, rects: Rect[]): number {
  const parts: Record<string, number> = {};
  layoutEnergy(ctx, rects, parts);
  let total = 0;
  HARD_TERMS.forEach((k) => { total += parts[k] || 0; });
  return total;
}

/** If a plan still breaks a hard rule, anneal again with those rules weighted more heavily. */
function repair(ctx: EnergyCtx, pieces: Rect[], sol: FloorSolution, iters: number, rng: Rng): FloorSolution {
  let best = sol;
  let bestHard = hardCost(ctx, sol.rects);
  for (let k = 0; k < 3 && bestHard > 0.25; k++) {
    const boosted = anneal({ ...ctx, hardBoost: 3 + 3 * k }, pieces, best.trees, iters, rng, 2.8, 0.05);
    const h = hardCost(ctx, boosted.rects);
    const e = layoutEnergy(ctx, boosted.rects);
    if (h < bestHard - 1e-6 || (Math.abs(h - bestHard) < 1e-6 && e < best.energy)) {
      best = { rects: boosted.rects, trees: boosted.trees, energy: e };
      bestHard = h;
    }
  }
  return best;
}

/** Starting arrangement: rooms ordered from the road to the rear and split by weight. */
function startTrees(rooms: PRoom[], pieces: Rect[], rng: Rng, arch: Archetype, floor: number): SNode[] {
  const rank = (r: PRoom): number => {
    const t = r.type;
    if (floor === 0) {
      if (t === 'entrance') return 0;
      if (t === 'parking') return 0.05;
      if (t === 'living') return 0.18;
      if (t === 'dining') return 0.38;
      if (t === 'kitchen') return 0.52;
      if (t === 'stair') return 0.4;
      if (t === 'courtyard') return 0.45;
      if (t === 'passage') return 0.6;
      if (t === 'study' || t === 'puja' || t === 'store' || t === 'utility') return 0.55;
      if (t === 'master_bedroom' || t === 'bedroom' || t === 'guest_room') return 0.8;
      if (t === 'bathroom' || t === 'dressing') return 0.85;
      return 0.6;
    }
    if (t === 'balcony' || t === 'terrace') return 0.05;
    if (t === 'lounge') return 0.45;
    if (t === 'passage') return 0.5;
    if (t === 'master_bedroom') return 0.9;
    if (t === 'bedroom' || t === 'guest_room') return 0.7;
    if (t === 'bathroom' || t === 'dressing') return 0.8;
    return 0.6;
  };
  const weight = (id: number) => rooms[id].target;
  if (pieces.length === 1) {
    return [seedTree(rooms.map((_, i) => i), (id) => rank(rooms[id]) + (arch.wings && ['master_bedroom', 'bedroom', 'guest_room', 'bathroom', 'dressing'].includes(rooms[id].type) ? 0.3 : 0), weight, pieces[0], rng)];
  }
  // Several pieces: share rooms out in proportion to each piece's area, keeping the order.
  const order = rooms.map((_, i) => i).sort((a, b) => rank(rooms[a]) - rank(rooms[b]) + (rng() - 0.5) * 0.2);
  const areas = pieces.map((p) => p.w * p.d);
  const total = sum(areas);
  const need = sum(rooms.map((r) => r.target));
  const bins: number[][] = pieces.map(() => []);
  const load = pieces.map(() => 0);
  // Largest first into the piece with the most spare room.
  [...order].sort((a, b) => rooms[b].target - rooms[a].target).forEach((id) => {
    let bestPiece = 0;
    let bestSpare = -Infinity;
    pieces.forEach((_, p) => {
      const spare = (areas[p] / total) * need - load[p];
      if (spare > bestSpare) { bestSpare = spare; bestPiece = p; }
    });
    bins[bestPiece].push(id);
    load[bestPiece] += rooms[id].target;
  });
  // A piece may not be empty: take the smallest room from the fullest piece.
  bins.forEach((bin, p) => {
    if (bin.length) return;
    const donor = bins.reduce((best, b, i) => (b.length > bins[best].length ? i : best), 0);
    if (bins[donor].length > 1) bin.push(bins[donor].pop()!);
  });
  return bins.map((bin, p) => (bin.length ? seedTree(bin, (id) => rank(rooms[id]), weight, pieces[p], rng) : { l: -1 } as SNode));
}

function bestPartition(region: Rect, blocks: Rect[]): Rect[] {
  if (!blocks.length) return [region];
  const a = subtractRects(region, blocks, true);
  const b = subtractRects(region, blocks, false);
  const score = (ps: Rect[]) => Math.min(...ps.map((p) => Math.min(p.w, p.d))) * 10 - ps.length;
  return score(a) >= score(b) ? a : b;
}

/** Rectangles inside the ground footprint that could carry an upper floor of the given area and still contain the stair. */
function upperBoxes(fp: Rect, stair: Rect | null, area: number): Rect[] {
  if (area >= fp.w * fp.d * 0.9) return [fp];
  const out: Rect[] = [fp];
  const containsStair = (r: Rect) => !stair || (r.x <= stair.x + 0.01 && r.y <= stair.y + 0.01 && r.x + r.w >= stair.x + stair.w - 0.01 && r.y + r.d >= stair.y + stair.d - 0.01);
  const push = (r: Rect) => {
    const box = { x: snap(r.x), y: snap(r.y), w: snap(r.w), d: snap(r.d) };
    if (box.w < 14 || box.d < 14 || !containsStair(box)) return;
    if (!out.some((o) => Math.abs(o.x - box.x) < 0.1 && Math.abs(o.y - box.y) < 0.1 && Math.abs(o.w - box.w) < 0.1 && Math.abs(o.d - box.d) < 0.1)) out.push(box);
  };
  const wFull = Math.min(fp.w, area / fp.d);
  push({ x: fp.x, y: fp.y, w: wFull, d: fp.d });
  push({ x: fp.x + fp.w - wFull, y: fp.y, w: wFull, d: fp.d });
  const dFull = Math.min(fp.d, area / fp.w);
  push({ x: fp.x, y: fp.y, w: fp.w, d: dFull });
  push({ x: fp.x, y: fp.y + fp.d - dFull, w: fp.w, d: dFull });
  const wc = Math.min(fp.w, Math.sqrt((area * fp.w) / fp.d));
  const dc = Math.min(fp.d, area / wc);
  push({ x: fp.x, y: fp.y, w: wc, d: dc });
  push({ x: fp.x + fp.w - wc, y: fp.y, w: wc, d: dc });
  push({ x: fp.x, y: fp.y + fp.d - dc, w: wc, d: dc });
  push({ x: fp.x + fp.w - wc, y: fp.y + fp.d - dc, w: wc, d: dc });
  return out;
}

function groundLines(rects: Rect[], rooms: PRoom[]) {
  const xs = new Set<number>(), ys = new Set<number>();
  const wet: Rect[] = [];
  rects.forEach((r, i) => {
    xs.add(r.x); xs.add(r.x + r.w); ys.add(r.y); ys.add(r.y + r.d);
    if (['kitchen', 'bathroom', 'utility'].includes(rooms[i].type)) wet.push(r);
  });
  return { xs: [...xs], ys: [...ys], wet };
}

interface Footprint { rect: Rect; label: string }

function footprintCandidates(env: Envelope, area: number): Footprint[] {
  const out: Footprint[] = [];
  const tryAspect = (r: number, label: string) => {
    const w = snap(Math.sqrt(area * r));
    const d = snap(area / w);
    const rect = env.place(w, d, 'front');
    if (rect && !out.some((o) => Math.abs(o.rect.w - rect.w) < 2 && Math.abs(o.rect.d - rect.d) < 2)) out.push({ rect, label });
  };
  tryAspect(1.0, 'balanced');
  tryAspect(1.45, 'wide');
  tryAspect(0.7, 'deep');
  if (!out.length) {
    // Fill the available width, or the available depth, whichever the plot offers.
    const L = env.largest;
    if (L.w * L.d >= area * 0.98) {
      const wFull = snap(L.w);
      const d = snap(area / wFull);
      const r1 = env.place(wFull, Math.min(d, snap(L.d)), 'front');
      if (r1) out.push({ rect: r1, label: 'full width' });
      const dFull = snap(L.d);
      const w2 = snap(area / dFull);
      const r2 = env.place(Math.min(w2, snap(L.w)), dFull, 'front');
      if (r2 && !out.some((o) => Math.abs(o.rect.w - r2.w) < 2)) out.push({ rect: r2, label: 'full depth' });
    }
  }
  return out;
}

/** Brings the programme to a size the plot can hold, or says why it cannot. */
function sizeProgram(plan: Plan, env: Envelope, constraints: DesignConstraints, plotArea: number, notes: string[]): { ok: true } | { ok: false; reason: string; violated: string[] } {
  const floors = constraints.floors;
  const floorSum = (f: number, pick: (r: PRoom) => number) => sum(plan.rooms[f].map(pick));
  const reservedOnUpper = (f: number) => (f > 0 ? STAIR_TARGET + sum(plan.courtyards.map((c) => c.target)) : 0);
  const need = (scale: number) => Array.from({ length: floors }, (_, f) => floorSum(f, (r) => r.target * 1) + (f > 0 ? reservedOnUpper(f) : 0));
  void need;
  const minNeed = Array.from({ length: floors }, (_, f) => floorSum(f, (r) => (r.strip ? r.minArea : r.minArea)) + reservedOnUpper(f) * 0.75);
  const cap = env.largest.w * env.largest.d;
  const maxMin = Math.max(...minNeed);
  if (maxMin > cap + 1e-6) {
    const perFloor = Math.round(maxMin);
    const suggestions: string[] = [];
    if (constraints.parkingCars > 0) suggestions.push('Drop dedicated parking to free up ground footprint');
    if (floors < 4) suggestions.push(`Add a floor (G+${floors} instead of G+${floors - 1}) to spread rooms over more levels`);
    if (constraints.bedrooms > 1) suggestions.push(`Reduce the bedroom count (from ${constraints.bedrooms} to ${constraints.bedrooms - 1})`);
    return {
      ok: false,
      reason: `The requested rooms cannot fit on this plot. At minimum usable sizes the fullest floor needs about ${perFloor} sq ft, but the largest buildable rectangle after setbacks is ${Math.round(cap)} sq ft (${Math.round(env.largest.w)}' x ${Math.round(env.largest.d)}').${suggestions.length ? ` Suggestions: ${suggestions.map((s, i) => `${i + 1}) ${s}`).join('; ')}.` : ''}`,
      violated: [`Largest buildable rectangle ${Math.round(env.largest.w)}' x ${Math.round(env.largest.d)}' after setbacks`, `${constraints.bedrooms} bedroom(s), ${constraints.bathrooms} bathroom(s) on ${floors} floor(s)`, ...suggestions.map((s) => `Suggestion: ${s}`)]
    };
  }
  // Grow rooms on generous plots, but only as far as the house still leaves open land.
  const baseTargets = new Map(plan.rooms.flat().map((r) => [r.id, r.target]));
  const groundNeed = (g: number) => {
    plan.rooms.flat().forEach((r) => {
      const b = baseTargets.get(r.id)!;
      r.target = r.derived || r.strip ? b : Math.min(GROW_CAP[r.type] ?? 400, b * Math.pow(g, GROW_EXPONENT(r.type)));
      if (r.target < b) r.target = b;
    });
    return Math.max(...Array.from({ length: floors }, (_, f) => floorSum(f, (r) => r.target) + reservedOnUpper(f)));
  };
  const desired = Math.min(cap, plotArea * COVERAGE(plotArea) * 0.82);
  const growthLimit = plotArea <= 3000 ? 1.28 : plotArea <= 8000 ? 1.6 : 2.0;
  let g = 1;
  const baseNeed = groundNeed(1);
  if (baseNeed < desired * 0.85) {
    let lo = 1, hi = growthLimit * (constraints.budgetRange === 'Luxury' || constraints.budgetRange === 'Premium' ? 1.1 : 1);
    for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (groundNeed(mid) <= desired) lo = mid; else hi = mid; }
    g = lo;
  }
  const needNow = groundNeed(g);
  plan.growth = g;
  if (g > 1.04) notes.push(`Room sizes were increased by about ${Math.round((g - 1) * 100)}% to suit the plot while keeping ground coverage near ${Math.round((needNow / plotArea) * 100)}%.`);
  // Compress when the programme is larger than the plot offers.
  if (needNow > cap) {
    const total = needNow;
    const lowest = maxMin;
    const s = Math.max(0, Math.min(1, (cap - lowest) / Math.max(1, total - lowest)));
    plan.rooms.flat().forEach((r) => {
      if (r.strip) return;
      r.target = r.minArea + (r.target - r.minArea) * s;
    });
    plan.scale = s;
    notes.push(`Target room sizes were reduced to ${Math.round(s * 100)}% of the way between minimum and comfortable so the programme fits the ${Math.round(env.largest.w)}' x ${Math.round(env.largest.d)}' buildable area. No room is below its minimum usable size.`);
  }
  plan.need = Array.from({ length: floors }, (_, f) => floorSum(f, (r) => r.target) + reservedOnUpper(f));
  plan.minNeed = minNeed;
  return { ok: true };
}

export function optimizeLayouts(program: DesignProgram, site: SiteInfo, constraints: DesignConstraints, opts: OptimizeOptions = {}): OptimizeResult {
  const effort = opts.effort ?? 1;
  const floors = constraints.floors;
  const plotWidth = Number(site.plotWidth);
  const plotDepth = Number(site.plotDepth);
  const env = computeEnvelope(site);
  if (env.largest.w < 14 || env.largest.d < 18) {
    return { ok: false, reason: `After setbacks the buildable area is only ${Math.round(env.largest.w)}' x ${Math.round(env.largest.d)}', which is too small for a house.`, violatedConstraints: ['Buildable envelope'] };
  }
  const plotArea = env.rectangular ? plotWidth * plotDepth : Math.round(env.plot.reduce((s, p, i) => { const q = env.plot[(i + 1) % env.plot.length]; return s + (p.x * q.y - q.x * p.y); }, 0) / 2);
  const lifeStage = constraints.modes.includes('life_stage');
  const budgetFirst = constraints.modes.includes('budget_first');
  const compass = planCompass(site.orientation);
  const tight = Math.abs(plotArea) <= 1500;
  const hot = opts.hot ?? constraints.modes.includes('climate_adaptive');

  const wanted: ArchId[] = opts.archetypes
    || (() => {
      const ids: ArchId[] = ['spine', 'hub', 'compact', 'wings'];
      if (program.rooms.some((r) => r.type === 'courtyard' && r.floor === 0)) return ['courtyard' as ArchId, ...ids.filter((i) => i !== 'wings' || floors > 1)];
      return ids.filter((i) => i !== 'wings' || program.rooms.filter((r) => isBedroomType(r.type)).length >= 2);
    })();
  const archs = wanted.map((id) => ARCHETYPES[id]);

  const rejected: string[] = [];
  const candidates: PlanCandidate[] = [];
  const iterations = (n: number) => Math.max(200, Math.round(n * effort));

  const solveArch = (arch: Archetype, attempt: number): { cand?: PlanCandidate; fatal?: OptimizeResult; skip?: string } => {
    const notes: string[] = [];
    const plan = buildPlan(program, constraints, arch, lifeStage);
    const sized = sizeProgram(plan, env, constraints, Math.abs(plotArea), notes);
    if (!sized.ok) return { fatal: { ok: false, reason: sized.reason, violatedConstraints: sized.violated } };
    const seedBase = hashString(`${plotWidth}x${plotDepth}|${site.orientation}|${program.rooms.map((r) => r.id + r.areaSqFt).join(',')}|${arch.id}`) + (opts.seedOffset || 0) * 7919 + attempt * 104729;
    const rng = mulberry32(seedBase);

    // ---- Ground floor ----
    const groundRooms = plan.rooms[0];
    const groundArea = sum(groundRooms.map((r) => r.target));
    const footprints = footprintCandidates(env, groundArea);
    if (!footprints.length) return { skip: `${arch.label}: no ${Math.round(groundArea)} sq ft rectangle fits the buildable area.` };
    const pairs0 = pairsFor(groundRooms, opts.intent, tight);
    const ctxFor = (fp: Rect, rooms: PRoom[], fixed: FixedCell[], pairs: PairSpec[], floor: number, ground?: EnergyCtx['groundLines']): EnergyCtx => ({
      rooms, fixed, footprint: fp, frontY: fp.y, floor, floors, arch, pairs, hot, compass, tight, groundLines: ground
    });
    let bestGround: (FloorSolution & { fp: Footprint }) | null = null;
    for (const fp of footprints) {
      const ctx = ctxFor(fp.rect, groundRooms, [], pairs0, 0);
      const startA = startTrees(groundRooms, [fp.rect], mulberry32(seedBase ^ 0x9e37), arch, 0);
      const quick = anneal(ctx, [fp.rect], startA, iterations(1100), mulberry32(seedBase + 1));
      if (!bestGround || quick.energy < bestGround.energy) bestGround = { ...quick, fp };
    }
    const fpRect = bestGround!.fp.rect;
    const ctx0 = ctxFor(fpRect, groundRooms, [], pairs0, 0);
    const tightness = plan.scale < 0.92 || env.largest.w * env.largest.d < groundArea * 1.08 ? 2.2 : 1;
    let ground = anneal(ctx0, [fpRect], bestGround!.trees, iterations(4200 * tightness), mulberry32(seedBase + 2), 3.2, 0.04);
    const restarts = tightness > 1 ? 4 : 1;
    for (let k = 0; k < restarts; k++) {
      const again = anneal(ctx0, [fpRect], startTrees(groundRooms, [fpRect], mulberry32((seedBase ^ 0x51ed) + k * 101), arch, 0), iterations(2800 * tightness), mulberry32(seedBase + 3 + k));
      const hardA = hardCost(ctx0, again.rects);
      const hardB = hardCost(ctx0, ground.rects);
      if (hardA < hardB - 0.25 || (Math.abs(hardA - hardB) <= 0.25 && again.energy < ground.energy)) ground = again;
    }
    ground = repair(ctx0, [fpRect], ground, iterations(2500 * tightness), mulberry32(seedBase + 4));

    // ---- Upper floors ----
    const rectsByFloor: Rect[][] = [ground.rects];
    const roomsByFloor: PRoom[][] = [groundRooms];
    const energyByFloor = [ground.energy];
    const upperNotes: string[] = [];
    const stairIdx = groundRooms.findIndex((r) => r.type === 'stair');
    const stairRect = stairIdx >= 0 ? ground.rects[stairIdx] : null;
    const courtRects = groundRooms.map((r, i) => (r.type === 'courtyard' ? { room: r, rect: ground.rects[i] } : null)).filter((x): x is { room: PRoom; rect: Rect } => !!x);
    const lines = groundLines(ground.rects, groundRooms);
    let ok = true;
    const upperVoids: { name: string; rect: Rect }[][] = [];
    for (let f = 1; f < floors && ok; f++) {
      const rooms = plan.rooms[f].map((r) => ({ ...r }));
      const blocks: FixedCell[] = [];
      if (stairRect) blocks.push({ room: derived(`room-stair-${f}`, 'Stair Landing', 'stair', f, STAIR_TARGET, { minArea: 60 }), rect: stairRect });
      courtRects.forEach((c, k) => blocks.push({ room: derived(`room-void-${f}-${k + 1}`, `Open to ${c.room.name} Below`, 'void', f, 0, { minArea: 0, minSide: 0 }), rect: c.rect }));
      const roomsArea0 = sum(rooms.map((r) => r.target));
      const boxes = upperBoxes(fpRect, stairRect, (roomsArea0 + (stairRect ? stairRect.w * stairRect.d : 0)) * 1.04);
      const insideBox = (box: Rect) => blocks.filter((b) => b.rect.x >= box.x - 0.01 && b.rect.y >= box.y - 0.01 && b.rect.x + b.rect.w <= box.x + box.w + 0.01 && b.rect.y + b.rect.d <= box.y + box.d + 0.01);
      const roofCost = (box: Rect) => (fpRect.w * fpRect.d - box.w * box.d) * 0.006;
      let chosen: { sol: FloorSolution; rooms: PRoom[]; box: Rect; score: number } | null = null;
      for (const box of boxes) {
        const inBox = insideBox(box);
        const pieces = bestPartition(box, inBox.map((b) => b.rect));
        const regionArea = sum(pieces.map((p) => p.w * p.d));
        const trial = rooms.map((r) => ({ ...r }));
        const leftover = regionArea - roomsArea0;
        if (leftover > 90) trial.push(derived(`room-terrace-${f}-1`, 'Terrace', 'terrace', f, leftover * 0.96, { minArea: 12, minSide: 3, maxAspect: 8 }));
        for (let k = trial.length; k < pieces.length; k++) trial.push(derived(`room-terrace-${f}-${k + 2}`, 'Terrace', 'terrace', f, pieces[k].w * pieces[k].d * 0.5, { minArea: 12, minSide: 3, maxAspect: 8 }));
        const pairs = pairsFor([...trial, ...inBox.map((b) => b.room)], opts.intent, tight);
        const ctx = ctxFor(box, trial, inBox, pairs, f, lines);
        const start = startTrees(trial, pieces, mulberry32(seedBase + 11 * f), arch, f);
        if (start.some((t) => isLeaf(t) && t.l < 0)) continue;
        const quick = anneal(ctx, pieces, start, iterations(900), mulberry32(seedBase + 5 * f + 21));
        const score = quick.energy + roofCost(box);
        if (!chosen || score < chosen.score) chosen = { sol: quick, rooms: trial, box, score };
      }
      if (!chosen) { ok = false; rejected.push(`${arch.label}: could not share the ${floorName(f).toLowerCase()} rooms between pieces.`); break; }
      const inBox = insideBox(chosen.box);
      const pieces = bestPartition(chosen.box, inBox.map((b) => b.rect));
      const ctx = ctxFor(chosen.box, chosen.rooms, inBox, pairsFor([...chosen.rooms, ...inBox.map((b) => b.room)], opts.intent, tight), f, lines);
      let sol = anneal(ctx, pieces, chosen.sol.trees, iterations(2800), mulberry32(seedBase + 5 * f + 22), 3.2, 0.04);
      for (let attempt = 0; attempt < 2; attempt++) {
        const alt = anneal(ctx, pieces, startTrees(chosen.rooms, pieces, mulberry32(seedBase + 77 * f + attempt * 13), arch, f), iterations(2200), mulberry32(seedBase + 9 * f + 31 + attempt));
        if (alt.energy < sol.energy) sol = alt;
      }
      sol = repair(ctx, pieces, sol, iterations(2200), mulberry32(seedBase + 6 * f));
      const upperRooms = chosen.rooms;
      rectsByFloor[f] = sol.rects;
      roomsByFloor[f] = upperRooms;
      energyByFloor[f] = sol.energy;
      upperVoids[f] = inBox.filter((b) => b.room.type === 'void').map((b) => ({ name: b.room.name, rect: b.rect }));
      upperRooms.forEach((r, i) => { if (r.type === 'terrace' && r.derived && sol.rects[i].y <= chosen!.box.y + 0.1 && sol.rects[i].w >= 5) r.name = sol.rects[i].d <= 8.5 ? 'Balcony' : 'Open Terrace'; });
    }
    if (!ok) return { skip: `${arch.label}: an upper floor could not be arranged.` };

    // ---- Assemble the canonical design ----
    const placed: PlacedRoom[] = [];
    const addPlaced = (room: PRoom, rect: Rect, order: number) => {
      const spec = ROOM_TYPE_SPECS[room.type];
      const work: WorkRoom = room.ref
        ? { ...room.ref, floor: room.floor, area: rect.w * rect.d, order }
        : {
            id: room.id, name: room.name, type: room.type, floor: room.floor, areaSqFt: Math.round(rect.w * rect.d), area: rect.w * rect.d,
            band: 'middle', side: 'center', required: false, relationships: [], features: room.type === 'stair' ? ['Dog-legged stair'] : [], derived: true, order,
            attachedTo: room.attachedTo
          };
      void spec;
      placed.push({ room: work, rect: { ...rect } });
    };
    let order = 0;
    for (let f = 0; f < floors; f++) {
      roomsByFloor[f].forEach((room, i) => addPlaced(room, rectsByFloor[f][i], order++));
      if (f > 0) {
        if (stairRect) addPlaced(derived(`room-stair-${f}`, 'Stair Landing', 'stair', f, STAIR_TARGET), stairRect, order++);
        (upperVoids[f] || []).forEach((v, k) => addPlaced(derived(`room-void-${f}-${k + 1}`, v.name, 'void', f, 0), v.rect, order++));
      }
    }
    const assembled = assembleDesign({
      program, site, constraints, placed, originX: 0, originY: 0, notes: [...notes, ...upperNotes], plotWidth, plotDepth,
      envWidth: env.rectangular ? env.setbacks && plotWidth - env.setbacks.left - env.setbacks.right : env.largest.w,
      envDepth: env.rectangular ? plotDepth - env.setbacks.front - env.setbacks.rear : env.largest.d,
      setbacks: env.setbacks, allowPorchInSetback: env.allowPorchInSetback, stairRect,
      footprintBounds: { width: fpRect.w, depth: fpRect.d }, hasCourtyard: courtRects.length > 0, compression: 1 - plan.scale,
      buildableAreaOverride: env.rectangular ? undefined : Math.round(env.buildableArea),
      plotPolygon: env.rectangular ? undefined : env.plot
    });
    const terms: Record<string, number> = {};
    layoutEnergy({ ...ctx0 }, ground.rects, terms);
    void sharedEdge; void leafIds; void budgetFirst;
    return {
      cand: {
        archetype: arch, design: assembled.design, notes: assembled.notes, energy: sum(energyByFloor), terms, compression: 1 - plan.scale,
        footprint: fpRect, unreachable: assembled.unreachable
      }
    };
  };

  const deadline = Date.now() + (opts.budgetMs ?? 7000);
  // A first attempt may break a rule the geometry only reveals once doors are placed; each archetype gets up to three tries.
  for (const arch of archs) {
    let accepted: PlanCandidate | null = null;
    for (let attempt = 0; attempt < 3 && !accepted; attempt++) {
      if (attempt > 0 && Date.now() > deadline) break;
      const out = solveArch(arch, attempt);
      if (out.fatal) return out.fatal;
      if (out.skip) { rejected.push(out.skip); break; }
      if (!out.cand) continue;
      const check = validateFloorPlan(out.cand.design);
      if (check.isValid && out.cand.unreachable.length === 0) accepted = out.cand;
      else rejected.push(`${arch.label} (try ${attempt + 1}): ${check.errors[0] || `unreachable ${out.cand.unreachable.join(', ')}`}`);
    }
    if (accepted) candidates.push(accepted);
  }
  if (!candidates.length) {
    return { ok: false, reason: 'The planner could not arrange these rooms on this plot at usable sizes.', violatedConstraints: rejected, rejected };
  }
  return { ok: true, candidates, rejected };
}
