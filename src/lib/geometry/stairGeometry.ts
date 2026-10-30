import { Rect, SharedEdge, sharedEdge } from './planGeometry';

export type StairFoot = 'front' | 'rear';

/** Flat landing at the foot of the stair where people step on and off. Doors and archways open only here. */
export const STAIR_FOOT_ZONE = 3.5;
/** Number of risers between two floors, split evenly over the two flights. */
export const STAIR_RISERS = 16;

export interface StairPlan {
  foot: StairFoot;
  /** Depth of the flat foot landing (ft). */
  footDepth: number;
  /** Depth of the mid-level landing at the far end (ft). */
  landingDepth: number;
  /** Tread depth of each step (ft). */
  tread: number;
  /** Treads on each flight. */
  perFlight: number;
}

export function planStair(rect: Rect, foot: StairFoot = 'rear'): StairPlan {
  const footDepth = Math.min(STAIR_FOOT_ZONE, rect.d * 0.28);
  const landingDepth = Math.min(rect.w / 2 + 0.25, rect.d * 0.28);
  const perFlight = STAIR_RISERS / 2;
  return { foot, footDepth, landingDepth, tread: (rect.d - footDepth - landingDepth) / perFlight, perFlight };
}

/** Plan-space y of a point `s` feet from the foot edge of the stair cell. */
export const stairY = (rect: Rect, foot: StairFoot, s: number) => (foot === 'front' ? rect.y + s : rect.y + rect.d - s);

/**
 * The part of a wall shared with the stair cell through which the stair may be entered:
 * anywhere along the foot-end wall, or along a side wall within the foot landing.
 */
export function stairMouthEdge(stair: Rect, other: Rect, foot: StairFoot): SharedEdge | null {
  const edge = sharedEdge(stair, other);
  if (!edge) return null;
  if (edge.orientation === 'horizontal') {
    const footAt = foot === 'front' ? stair.y : stair.y + stair.d;
    return Math.abs(edge.at - footAt) < 0.1 ? edge : null;
  }
  const lo = foot === 'front' ? stair.y : stair.y + stair.d - STAIR_FOOT_ZONE;
  const hi = lo + STAIR_FOOT_ZONE;
  const start = Math.max(edge.start, lo);
  const end = Math.min(edge.end, hi);
  if (end - start < 2.5) return null;
  return { ...edge, start, end, length: end - start, midY: (start + end) / 2 };
}

/** True when an opening centred at (x, y) on `orientation` wall lies in the stair's mouth. */
export function isInStairMouth(stair: Rect, foot: StairFoot, orientation: 'horizontal' | 'vertical', x: number, y: number): boolean {
  if (orientation === 'horizontal') {
    const footAt = foot === 'front' ? stair.y : stair.y + stair.d;
    return Math.abs(y - footAt) < 0.1;
  }
  const lo = foot === 'front' ? stair.y : stair.y + stair.d - STAIR_FOOT_ZONE;
  return y >= lo - 0.1 && y <= lo + STAIR_FOOT_ZONE + 0.1;
}
