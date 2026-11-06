import { RoomType } from '@/types/architectural';
import { Rect } from '@/lib/geometry/planGeometry';
import { EnergyCtx, PRoom } from './model';

const TOL = 0.06;
const BED = new Set<RoomType>(['master_bedroom', 'bedroom', 'guest_room']);
const OWN_WINDOW = new Set<RoomType>(['living', 'kitchen', 'master_bedroom', 'bedroom', 'guest_room', 'study']);
const BORROWS = new Set<RoomType>(['dining', 'lounge']);
const TRANSIT = new Set<RoomType>(['entrance', 'living', 'dining', 'lounge', 'passage', 'stair', 'courtyard']);
const OPEN_AIR = new Set<RoomType>(['courtyard', 'void', 'terrace', 'balcony', 'entrance']);
const PRIVATE_OFF_BED = new Set<RoomType>(['bathroom', 'dressing', 'balcony', 'terrace']);
const WET = new Set<RoomType>(['kitchen', 'bathroom', 'utility']);
const SMALL = new Set<RoomType>(['bathroom', 'dressing', 'store', 'puja', 'utility']);
const HEAT: Record<string, number> = { N: 0, NE: 0, E: 1, NW: 2, SE: 2, S: 3, W: 5, SW: 5 };
/** Sides, in the order used for per-side exterior bookkeeping. */
const FRONT = 0, REAR = 1, LEFT = 2, RIGHT = 3;
const SIDE_NAME = ['front', 'rear', 'left', 'right'] as const;

const COMFORT_SIDE: Partial<Record<RoomType, number>> = { master_bedroom: 11, bedroom: 10, living: 12, dining: 9, kitchen: 8, lounge: 7, study: 7 };
const AREA_WEIGHT: Partial<Record<RoomType, number>> = {
  living: 1.6, dining: 1.0, kitchen: 1.5, master_bedroom: 1.6, bedroom: 1.5, guest_room: 1.0, study: 0.8, lounge: 0.6,
  bathroom: 0.9, stair: 0.7, parking: 0.9, courtyard: 1.0, entrance: 0.5, store: 0.4, puja: 0.4, utility: 0.5, dressing: 0.4, balcony: 0.3, terrace: 0.08, passage: 0
};

/** Terms that describe rules a plan must not break (as opposed to qualities it should have). */
export const HARD_TERMS = new Set(['minSide', 'minArea', 'reach', 'courtyard', 'front', 'stair', 'baths']);

export interface EnergyBreakdown { [term: string]: number }

interface Prepared {
  rooms: PRoom[];
  N: number;
  pairs: { ia: number; ib: number; w: number; kind: 'adj' | 'near' | 'avoid' }[];
  S: Float64Array;
  ext: Float64Array;
  solidSide: Float64Array;
  transitSide: Float64Array;
  openLight: Float64Array;
  reached: Uint8Array;
  hops: Int16Array;
}
const cache = new WeakMap<EnergyCtx, Prepared>();
function prepare(ctx: EnergyCtx): Prepared {
  let p = cache.get(ctx);
  if (p) return p;
  const rooms: PRoom[] = ctx.rooms.concat(ctx.fixed.map((f) => f.room));
  const N = rooms.length;
  const index = new Map<string, number>();
  rooms.forEach((r, i) => index.set(r.id, i));
  const pairs: Prepared['pairs'] = [];
  for (const pr of ctx.pairs) {
    const ia = index.get(pr.a);
    const ib = index.get(pr.b);
    if (ia !== undefined && ib !== undefined) pairs.push({ ia, ib, w: pr.w, kind: pr.kind });
  }
  p = {
    rooms, N, pairs, S: new Float64Array(N * N), ext: new Float64Array(N * 4), solidSide: new Float64Array(N * 4),
    transitSide: new Float64Array(N * 4), openLight: new Float64Array(N), reached: new Uint8Array(N), hops: new Int16Array(N)
  };
  cache.set(ctx, p);
  return p;
}

/**
 * Cost of a floor layout. Lower is better. Every term is a statement an architect would make about a plan:
 * rooms the right size and shape, with daylight, a sensible way in, wet rooms together, bedrooms private.
 * `rects` holds the movable rooms in ctx.rooms order; ctx.fixed cells (stair, voids) follow them.
 */
export function layoutEnergy(ctx: EnergyCtx, rects: Rect[], parts?: EnergyBreakdown): number {
  const m = ctx.rooms.length;
  const prep = prepare(ctx);
  const N = prep.N;
  const rooms = prep.rooms;
  const R: Rect[] = rects.concat(ctx.fixed.map((f) => f.rect));
  let E = 0;
  const boost = ctx.hardBoost ?? 1;
  const add = (term: string, v: number) => {
    const value = boost !== 1 && HARD_TERMS.has(term) ? v * boost : v;
    E += value;
    if (parts) parts[term] = (parts[term] || 0) + v;
  };

  // ---- Shared walls and exterior exposure ----
  const S = prep.S.fill(0);
  const ext = prep.ext.fill(0);
  const solidSide = prep.solidSide.fill(0); // length of each side closed by a walled neighbour
  const transitSide = prep.transitSide.fill(0);
  const openLight = prep.openLight.fill(0);
  for (let i = 0; i < N; i++) {
    const r = R[i];
    ext[i * 4 + FRONT] = r.w; ext[i * 4 + REAR] = r.w; ext[i * 4 + LEFT] = r.d; ext[i * 4 + RIGHT] = r.d;
  }
  for (let i = 0; i < N; i++) {
    const a = R[i];
    for (let j = i + 1; j < N; j++) {
      const b = R[j];
      let len = 0;
      let sa = -1;
      let sb = -1;
      if (Math.abs(a.x + a.w - b.x) <= TOL) { len = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y); sa = RIGHT; sb = LEFT; }
      else if (Math.abs(b.x + b.w - a.x) <= TOL) { len = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y); sa = LEFT; sb = RIGHT; }
      else if (Math.abs(a.y + a.d - b.y) <= TOL) { len = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x); sa = REAR; sb = FRONT; }
      else if (Math.abs(b.y + b.d - a.y) <= TOL) { len = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x); sa = FRONT; sb = REAR; }
      if (len <= TOL) continue;
      S[i * N + j] = len; S[j * N + i] = len;
      ext[i * 4 + sa] -= len; ext[j * 4 + sb] -= len;
      const ti = rooms[i].type;
      const tj = rooms[j].type;
      if (OPEN_AIR.has(tj)) openLight[i] += len; else solidSide[i * 4 + sa] += len;
      if (OPEN_AIR.has(ti)) openLight[j] += len; else solidSide[j * 4 + sb] += len;
      if (TRANSIT.has(tj)) transitSide[i * 4 + sa] += len;
      if (TRANSIT.has(ti)) transitSide[j * 4 + sb] += len;
    }
  }
  const light = (i: number) => Math.max(0, ext[i * 4]) + Math.max(0, ext[i * 4 + 1]) + Math.max(0, ext[i * 4 + 2]) + Math.max(0, ext[i * 4 + 3]) + openLight[i];
  const cx = (i: number) => R[i].x + R[i].w / 2;
  const cy = (i: number) => R[i].y + R[i].d / 2;
  const fp = ctx.footprint;
  const fw = Math.max(1, fp.w);
  const fd = Math.max(1, fp.d);
  const doorable = (i: number, j: number) => S[i * N + j] >= (SMALL.has(rooms[i].type) || SMALL.has(rooms[j].type) ? 3 : 3.8);

  // ---- Per room: size, shape, daylight ----
  let movableArea = 0;
  let passageArea = 0;
  for (let i = 0; i < m; i++) {
    const room = rooms[i];
    const r = R[i];
    const area = r.w * r.d;
    movableArea += area;
    if (room.type === 'passage') passageArea += area;
    const short = Math.min(r.w, r.d);
    const long = Math.max(r.w, r.d);

    if (!room.strip) {
      const ratio = area / room.target;
      const w = AREA_WEIGHT[room.type] ?? 0.6;
      add('area', Math.log(ratio) ** 2 * (ratio < 1 ? 2.4 : 2.4) * w * 2.2);
      if (ratio > 1.5 && w >= 0.8) add('area', (ratio - 1.5) ** 2 * 6 * w);
      const comfort = COMFORT_SIDE[room.type];
      if (comfort && short < comfort) add('comfort', (comfort - short) * 0.7);
      if (area < room.minArea) add('minArea', ((room.minArea - area) / room.minArea) * 40);
    }
    if (short < room.minSide) add('minSide', (room.minSide - short) * 14);
    if (room.type === 'parking' && long < 15.2) add('minSide', (15.2 - long) * 10);
    if (room.type !== 'passage' && room.type !== 'stair' && long / short > room.maxAspect) add('aspect', (long / short - room.maxAspect) * 9 + (long / short - room.maxAspect) ** 2 * 6);
    if (room.type === 'stair') {
      if (r.w > r.d) add('stair', 6);
      add('stair', Math.max(0, 6.5 - r.w) * 6 + Math.max(0, r.w - 9) * 3 + Math.max(0, 10.5 - r.d) * 6 + Math.max(0, r.d - 16) * 2);
    }
    if (room.type === 'bathroom' && area > 110) add('area', (area - 110) * 0.05);
    if ((room.type === 'terrace' || room.type === 'balcony') && room.derived && area > 110) add('area', (area - 110) * 0.04);

    const own = light(i);
    if (OWN_WINDOW.has(room.type)) {
      if (own < 3.5) add('daylight', room.type === 'study' ? 5 : 11);
      else if (BED.has(room.type) && (ext[i * 4] > 3 ? 1 : 0) + (ext[i * 4 + 1] > 3 ? 1 : 0) + (ext[i * 4 + 2] > 3 ? 1 : 0) + (ext[i * 4 + 3] > 3 ? 1 : 0) >= 2) add('daylight', -0.4);
    } else if (BORROWS.has(room.type)) {
      if (own < 3.5) {
        let borrow = false;
        for (let j = 0; j < N && !borrow; j++) if (j !== i && doorable(i, j) && S[i * N + j] >= 4 && light(j) >= 3.5 && (rooms[j].type === 'living' || rooms[j].type === 'lounge' || rooms[j].type === 'passage' || rooms[j].type === 'dining')) borrow = true;
        add('daylight', borrow ? 1.6 : 9);
      }
    } else if (room.type === 'bathroom' && own < 1.5) add('daylight', 0.8);
    else if ((room.type === 'balcony' || room.type === 'terrace') && ext[i * 4] + ext[i * 4 + 1] + ext[i * 4 + 2] + ext[i * 4 + 3] < 4) add('daylight', 5);

    // Hot climate: avoid long west/south-west/south exposure for bedrooms, living and kitchen.
    if (ctx.hot && (BED.has(room.type) || room.type === 'living' || room.type === 'kitchen')) {
      let heat = 0;
      for (let s = 0; s < 4; s++) heat += Math.max(0, ext[i * 4 + s]) * (HEAT[ctx.compass[SIDE_NAME[s]]] ?? 2);
      add('orientation', heat * (room.type === 'kitchen' ? 0.06 : room.type === 'living' ? 0.03 : 0.05));
    }

    // Courtyard: closed by rooms on all four sides.
    if (room.type === 'courtyard') {
      const need = [r.w, r.w, r.d, r.d];
      for (let s = 0; s < 4; s++) {
        const share = solidSide[i * 4 + s] / need[s];
        if (share < 0.85) add('courtyard', (0.85 - share) * 14);
      }
    }
    // Front-of-house rooms touch the road side of the building.
    if (room.type === 'entrance' || room.type === 'parking') {
      if (r.y > ctx.frontY + 0.1) add('front', 6 + (r.y - ctx.frontY) * 0.5);
    }
    // Zoning along the depth of the plot.
    const fy = (cy(i) - fp.y) / fd;
    const fx = (cx(i) - fp.x) / fw;
    if (ctx.floor === 0) {
      if (room.type === 'living') add('zoning', fy * 3.2);
      if (room.type === 'master_bedroom') add('zoning', (1 - fy) * 2.6);
      else if (room.type === 'bedroom' || room.type === 'guest_room') add('zoning', (1 - fy) * 2.0);
      else if (room.type === 'bathroom') add('zoning', (1 - fy) * 0.3);
      else if (room.type === 'kitchen') add('zoning', (1 - fy) * 0.4);
      // Nobody sleeps on the road: a bedroom whose wall faces the street loses privacy.
      if (BED.has(room.type) && ext[i * 4 + FRONT] > 3 && r.y <= ctx.frontY + 0.1) add('privacy', 7);
    }
    if (room.type === 'entrance' && (r.d > r.w || r.d > 6.5)) add('shape', 4 + Math.max(0, r.d - r.w) * 0.5 + Math.max(0, r.d - 6.5) * 0.6);
    if (room.hintY !== undefined) add('hint', Math.abs(fy - room.hintY) * 0.4);
    if (room.hintX !== undefined) add('hint', Math.abs(fx - room.hintX) * 0.25);
    if (room.type === 'passage' && room.strip) {
      const len = long;
      if (len > 26) add('circulation', (len - 26) * 0.4);
    }
    if ((room.type === 'balcony' || room.type === 'terrace') && !room.derived) {
      let hab = false;
      for (let j = 0; j < N; j++) if (j !== i && doorable(i, j) && (BED.has(rooms[j].type) || rooms[j].type === 'lounge' || rooms[j].type === 'living' || rooms[j].type === 'dining')) hab = true;
      if (!hab) add('adjacency', 4);
    }
  }

  // ---- Adjacency requirements from the programme and the brief ----
  for (const p of prep.pairs) {
    const ia = p.ia;
    const ib = p.ib;
    const len = S[ia * N + ib];
    const need = SMALL.has(rooms[ia].type) || SMALL.has(rooms[ib].type) ? 2.5 : 3;
    const dist = Math.hypot(cx(ia) - cx(ib), cy(ia) - cy(ib));
    if (p.kind === 'adj') {
      if (rooms[ia].type === 'entrance' && rooms[ib].type === 'living' && len >= need) {
        const frontage = len / Math.max(1, Math.min(R[ia].w, R[ib].w));
        if (frontage < 0.8) add('shape', (0.8 - frontage) * 9);
        continue;
      }
      if (len >= need) continue;
      add('adjacency', p.w * (len > 0 ? 0.6 * (1 - len / need) : 1 + Math.min(1, dist / 25)));
    } else if (p.kind === 'near') {
      if (len > 0) continue;
      add('near', p.w * Math.min(1, dist / 25) * 0.6);
    } else if (len >= 2) add('privacy', p.w);
  }

  // ---- Circulation: can every room be reached without crossing a bedroom? ----
  let entry = -1;
  if (ctx.floor === 0) {
    entry = rooms.findIndex((r, i) => r.type === 'entrance' && i < N);
    if (entry < 0) entry = rooms.findIndex((r) => r.type === 'living');
  } else entry = rooms.findIndex((r) => r.type === 'stair');
  if (entry >= 0) {
    const reached = prep.reached.fill(0);
    const hops = prep.hops.fill(0);
    reached[entry] = 1;
    const queue = [entry];
    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      const tu = rooms[u].type;
      for (let v = 0; v < N; v++) {
        if (reached[v] || !doorable(u, v)) continue;
        const tv = rooms[v].type;
        if (tv === 'parking' || tv === 'void') continue;
        const ok = TRANSIT.has(tu)
          || (BED.has(tu) && PRIVATE_OFF_BED.has(tv))
          || (tu === 'kitchen' && (tv === 'utility' || tv === 'store' || tv === 'balcony' || tv === 'terrace' || tv === 'puja'))
          || (tu === 'dressing' && tv === 'bathroom')
          || (tu === 'dining' && tv === 'kitchen');
        if (!ok) continue;
        reached[v] = 1; hops[v] = hops[u] + 1; queue.push(v);
      }
    }
    // Bedrooms may sit off the living room on tight plots; elsewhere they should open off a passage or landing.
    for (let i = 0; i < m; i++) {
      const t = rooms[i].type;
      if (t === 'parking' || t === 'void') continue;
      if (!reached[i]) { add('reach', t === 'terrace' || t === 'balcony' ? 3 : 14); continue; }
      if (BED.has(t)) {
        add('hops', Math.max(0, hops[i] - 3) * 0.5);
        let protectedAccess = false;
        let exposed = false;
        for (let j = 0; j < N; j++) {
          if (!reached[j] || !doorable(i, j)) continue;
          const tj = rooms[j].type;
          if (tj === 'lounge' || tj === 'passage' || tj === 'stair') protectedAccess = true;
          else if (tj === 'living' || tj === 'dining' || tj === 'entrance') exposed = true;
        }
        if (!protectedAccess && exposed) add('privacy', ctx.tight ? 0.8 : ctx.arch.passage || ctx.arch.hub ? 3.2 : 1.6);
      }
    }
    for (let i = 0; i < m; i++) {
      if (rooms[i].type !== 'passage') continue;
      let hubSide = false;
      let priv = 0;
      for (let j = 0; j < N; j++) {
        if (j === i || !doorable(i, j) || !reached[j]) continue;
        const tj = rooms[j].type;
        if (BED.has(tj) || tj === 'bathroom') priv++;
        else if (tj === 'living' || tj === 'dining' || tj === 'stair' || tj === 'lounge' || tj === 'courtyard') hubSide = true;
      }
      add('circulation', (hubSide ? 0 : 4) + (priv >= 2 ? 0 : priv === 1 ? 2.5 : 5));
    }
    // The stair must open onto living space at one of its ends.
    for (let i = 0; i < N; i++) {
      if (rooms[i].type !== 'stair') continue;
      const best = Math.max(transitSide[i * 4 + FRONT], transitSide[i * 4 + REAR]);
      if (best < 3.5) add('stair', 7);
      if (ctx.floor === 0 && i < m) add('stair', Math.hypot((cx(i) - fp.x) / fw - 0.5, (cy(i) - fp.y) / fd - 0.5) * 1.2);
    }
    // Hub plans: every bedroom touches a lounge or the stair landing.
    if (ctx.arch.hub) {
      for (let i = 0; i < m; i++) {
        if (!BED.has(rooms[i].type)) continue;
        let hub = false;
        for (let j = 0; j < N; j++) if (doorable(i, j) && (rooms[j].type === 'lounge' || rooms[j].type === 'stair' || rooms[j].type === 'passage')) hub = true;
        if (!hub) add('hub', 2.5);
      }
    }
  }
  if (movableArea > 0 && passageArea > 0) {
    const share = passageArea / movableArea;
    add('circulation', Math.max(0, share - 0.1) ** 2 * 80);
  }

  // ---- Privacy: bedrooms away from noisy rooms ----
  for (let i = 0; i < m; i++) {
    if (!BED.has(rooms[i].type)) continue;
    for (let j = 0; j < N; j++) {
      if (j === i || S[i * N + j] < 2) continue;
      const tj = rooms[j].type;
      if (tj === 'kitchen') add('privacy', 1.2);
      else if (tj === 'parking') add('privacy', 0.8);
      else if (tj === 'living' || tj === 'entrance') add('privacy', ctx.tight ? 0.3 : 0.9);
      else if (tj === 'dining') add('privacy', ctx.tight ? 0.2 : 0.6);
    }
  }
  // A shared bathroom is entered from a bedroom, passage, lounge or the stair, not off the kitchen or dining room.
  for (let i = 0; i < m; i++) {
    if (rooms[i].type !== 'bathroom' || rooms[i].attachedTo) continue;
    let good = false;
    let bad = false;
    for (let j = 0; j < N; j++) {
      if (j === i || S[i * N + j] < 2.5) continue;
      const tj = rooms[j].type;
      if (BED.has(tj) || tj === 'passage' || tj === 'lounge' || tj === 'stair' || tj === 'dressing') good = true;
      else if (tj === 'dining' || tj === 'kitchen' || tj === 'living' || tj === 'entrance') bad = true;
    }
    if (!good) add('baths', bad ? 4 : 5);
  }
  if (ctx.arch.wings) {
    let px = 0, pn = 0, qx = 0, qn = 0;
    for (let i = 0; i < m; i++) {
      const t = rooms[i].type;
      if (t === 'living' || t === 'dining' || t === 'kitchen' || t === 'entrance') { px += cx(i); pn++; }
      else if (BED.has(t)) { qx += cx(i); qn++; }
    }
    if (pn && qn) add('wings', -Math.min(1, Math.abs(px / pn - qx / qn) / (fw * 0.45)) * 5);
  }

  // ---- Plumbing: wet rooms share walls and stack ----
  const wet: number[] = [];
  for (let i = 0; i < N; i++) if (WET.has(rooms[i].type) && !(i >= m)) wet.push(i);
  if (wet.length > 1) {
    let total = 0;
    for (const i of wet) {
      let nearest = Infinity;
      for (const j of wet) if (j !== i) nearest = Math.min(nearest, Math.hypot(cx(i) - cx(j), cy(i) - cy(j)));
      total += nearest;
    }
    add('plumbing', total * 0.03);
  }
  if (ctx.groundLines) {
    const g = ctx.groundLines;
    for (let i = 0; i < m; i++) {
      const r = R[i];
      if (rooms[i].type === 'bathroom') {
        let best = 0;
        for (const w of g.wet) {
          const ox = Math.min(r.x + r.w, w.x + w.w) - Math.max(r.x, w.x);
          const oy = Math.min(r.y + r.d, w.y + w.d) - Math.max(r.y, w.y);
          if (ox > 0 && oy > 0) best = Math.max(best, (ox * oy) / (r.w * r.d));
        }
        add('plumbing', (1 - best) * 1.1);
      }
      const near = (v: number, lines: number[]) => lines.reduce((b, l) => Math.min(b, Math.abs(l - v)), 3);
      const edgeX = [r.x, r.x + r.w].filter((v) => Math.abs(v - fp.x) > 0.2 && Math.abs(v - (fp.x + fp.w)) > 0.2);
      const edgeY = [r.y, r.y + r.d].filter((v) => Math.abs(v - fp.y) > 0.2 && Math.abs(v - (fp.y + fp.d)) > 0.2);
      for (const v of edgeX) add('stacking', Math.min(1.5, near(v, g.xs)) * 0.35);
      for (const v of edgeY) add('stacking', Math.min(1.5, near(v, g.ys)) * 0.35);
    }
  }
  // ---- Regularity: fewer distinct wall lines read as a calmer, more buildable plan ----
  {
    const xs = new Set<number>();
    const ys = new Set<number>();
    for (let i = 0; i < N; i++) {
      const r = R[i];
      if (rooms[i].type === 'void') continue;
      for (const v of [r.x, r.x + r.w]) if (v > fp.x + 0.2 && v < fp.x + fp.w - 0.2) xs.add(Math.round(v * 2));
      for (const v of [r.y, r.y + r.d]) if (v > fp.y + 0.2 && v < fp.y + fp.d - 0.2) ys.add(Math.round(v * 2));
    }
    add('lines', Math.max(0, xs.size + ys.size - (N + 1)) * 0.3);
  }
  return E;
}

/** Number of habitable rooms with no usable daylight (exterior wall or open-air neighbour of at least 3.5 ft). Used in reports. */
export function describeEnergy(ctx: EnergyCtx, rects: Rect[]): EnergyBreakdown {
  const parts: EnergyBreakdown = {};
  layoutEnergy(ctx, rects, parts);
  return parts;
}
