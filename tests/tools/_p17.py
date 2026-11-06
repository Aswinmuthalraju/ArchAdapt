p = 'src/lib/design/surgery.ts'
s = open(p, encoding='utf-8', newline='').read()
start = s.index("function sideNeighbours(")
end = s.index("function pRoomOf(")
new_block = """interface Slide {
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

"""
s = s[:start] + new_block + s[end:]
s = s.replace("        const trial = applyPush(cell, push, cells, delta > 0);", "        const trial = applyPush(push, cells, delta > 0);")
s = s.replace("        const names = push.neighbours.map((n) => n.name).join(', ');\n        notes.push(`${cell.name} ${delta > 0 ? 'grew' : 'shrank'} by moving its ${push.dir} wall ${push.t} ft; ${names} ${delta > 0 ? 'gave up' : 'took'} the strip. Every other room stayed where it was.`);", "        const givers = (delta > 0 ? push.slide.far : push.slide.near).filter((c) => c.id !== cell.id).map((n) => n.name).join(', ');\n        notes.push(`${cell.name} ${delta > 0 ? 'grew' : 'shrank'} by sliding its ${push.slide.dir} wall ${push.t} ft; ${givers} ${delta > 0 ? 'gave up' : 'took'} the strip. Every other room stayed where it was.`);")
open(p, 'w', encoding='utf-8', newline='').write(s)
