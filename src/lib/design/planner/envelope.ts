import { SiteInfo, SiteSetbacks } from '@/types/architectural';
import { Rect } from '@/lib/geometry/planGeometry';
import { defaultSetbacks } from '@/lib/design/layoutEngine';

export interface Pt { x: number; y: number }

/** Grid resolution (ft) used to decide which parts of an irregular plot may be built on. */
const GRID = 0.5;

export interface Envelope {
  /** Plot outline, road along y = 0. */
  plot: Pt[];
  rectangular: boolean;
  setbacks: SiteSetbacks;
  /** Per plot edge: the setback applied to it (ft). */
  edgeSetbacks: number[];
  /** Bounding box of the plot. */
  bbox: Rect;
  /** Area of the region that may be built on (after setbacks), sq ft. */
  buildableArea: number;
  /** Largest axis-aligned rectangle that fits in the buildable region. */
  largest: Rect;
  /** True when (x, y, w, d) lies entirely in the buildable region. */
  fits(rect: Rect): boolean;
  /** Finds a w x d rectangle in the buildable region, preferring the road side and the middle of the plot. */
  place(w: number, d: number, prefer?: 'front' | 'center'): Rect | null;
  /** Distance (ft) from a point to the nearest road edge. */
  roadDistance(x: number, y: number): number;
  allowPorchInSetback: boolean;
}

export const polygonArea = (poly: Pt[]) => Math.abs(poly.reduce((sum, p, i) => {
  const q = poly[(i + 1) % poly.length];
  return sum + (p.x * q.y - q.x * p.y);
}, 0)) / 2;

export function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Validates a user-drawn outline: at least 3 points, finite, not self-intersecting, positive area. */
export function validatePolygon(poly: Pt[] | undefined): string | null {
  if (!poly) return null;
  if (!Array.isArray(poly) || poly.length < 3) return 'A plot outline needs at least three corners.';
  if (!poly.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))) return 'The plot outline has a corner that is not a number.';
  const n = poly.length;
  const ccw = (a: Pt, b: Pt, c: Pt) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = poly[i], b = poly[(i + 1) % n], c = poly[j], d = poly[(j + 1) % n];
      if (ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d)) return 'The plot outline crosses itself.';
    }
  }
  if (polygonArea(poly) < 200) return 'The plot outline encloses less than 200 sq ft.';
  return null;
}

/** Which setback applies to an edge, judged by which way the edge faces. */
function classifyEdge(a: Pt, b: Pt, poly: Pt[], center: Pt): 'front' | 'rear' | 'left' | 'right' {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let nx = b.y - a.y;
  let ny = a.x - b.x;
  // Make the normal point out of the plot.
  if (pointInPolygon({ x: mid.x + nx * 1e-3, y: mid.y + ny * 1e-3 }, poly)) { nx = -nx; ny = -ny; }
  const len = Math.hypot(nx, ny) || 1;
  nx /= len; ny /= len;
  if (Math.abs(ny) >= Math.abs(nx)) return ny < 0 ? 'front' : 'rear';
  return mid.x < center.x ? 'left' : 'right';
}

export function computeEnvelope(site: SiteInfo): Envelope {
  const W = Number(site.plotWidth);
  const D = Number(site.plotDepth);
  const rectPoly: Pt[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }];
  const polyIn = site.polygon && !validatePolygon(site.polygon) ? site.polygon : null;
  const plot = polyIn || rectPoly;
  const xs = plot.map((p) => p.x);
  const ys = plot.map((p) => p.y);
  const bbox: Rect = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
  const area = polygonArea(plot);
  const setbacks = site.setbacks || defaultSetbacks(bbox.w, bbox.d);
  const allowPorchInSetback = site.allowPorchInSetback ?? (area <= 2000);
  const center = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.d / 2 };
  const roadEdges = new Set(site.roadEdges || []);

  const edgeSetbacks = plot.map((a, i) => {
    const b = plot[(i + 1) % plot.length];
    if (roadEdges.has(i)) return setbacks.front;
    return setbacks[classifyEdge(a, b, plot, center)];
  });

  const rectangular = !polyIn;
  const cols = Math.ceil(bbox.w / GRID);
  const rows = Math.ceil(bbox.d / GRID);

  // Rectangular plots keep the exact analytic envelope; irregular ones are rasterised.
  let inside: Uint8Array | null = null;
  let prefix: Int32Array | null = null;
  const stride = cols + 1;
  if (!rectangular) {
    inside = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = { x: bbox.x + (c + 0.5) * GRID, y: bbox.y + (r + 0.5) * GRID };
        if (!pointInPolygon(p, plot)) continue;
        let ok = true;
        for (let i = 0; i < plot.length && ok; i++) {
          if (distToSegment(p, plot[i], plot[(i + 1) % plot.length]) < edgeSetbacks[i] - 1e-6) ok = false;
        }
        inside[r * cols + c] = ok ? 1 : 0;
      }
    }
    prefix = new Int32Array((cols + 1) * (rows + 1));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        prefix[(r + 1) * stride + c + 1] = inside[r * cols + c] + prefix[r * stride + c + 1] + prefix[(r + 1) * stride + c] - prefix[r * stride + c];
      }
    }
  }
  const envRect: Rect = { x: setbacks.left, y: setbacks.front, w: bbox.w - setbacks.left - setbacks.right, d: bbox.d - setbacks.front - setbacks.rear };

  const filled = (c0: number, r0: number, c1: number, r1: number) => {
    // number of buildable cells in [c0,c1) x [r0,r1)
    return prefix![r1 * stride + c1] - prefix![r0 * stride + c1] - prefix![r1 * stride + c0] + prefix![r0 * stride + c0];
  };
  const fits = (rect: Rect): boolean => {
    if (rectangular) {
      return rect.x >= envRect.x - 1e-6 && rect.y >= envRect.y - 1e-6 && rect.x + rect.w <= envRect.x + envRect.w + 1e-6 && rect.y + rect.d <= envRect.y + envRect.d + 1e-6;
    }
    const c0 = Math.floor((rect.x - bbox.x) / GRID + 1e-6);
    const r0 = Math.floor((rect.y - bbox.y) / GRID + 1e-6);
    const c1 = Math.ceil((rect.x + rect.w - bbox.x) / GRID - 1e-6);
    const r1 = Math.ceil((rect.y + rect.d - bbox.y) / GRID - 1e-6);
    if (c0 < 0 || r0 < 0 || c1 > cols || r1 > rows) return false;
    return filled(c0, r0, c1, r1) === (c1 - c0) * (r1 - r0);
  };

  const buildableArea = rectangular ? Math.max(0, envRect.w) * Math.max(0, envRect.d) : (prefix![rows * stride + cols] * GRID * GRID);

  const place = (w: number, d: number, prefer: 'front' | 'center' = 'front'): Rect | null => {
    if (w <= 0 || d <= 0) return null;
    if (rectangular) {
      if (w > envRect.w + 1e-6 || d > envRect.d + 1e-6) return null;
      return { x: round(envRect.x + (envRect.w - w) / 2), y: round(prefer === 'front' ? envRect.y : envRect.y + (envRect.d - d) / 2), w, d };
    }
    let best: { rect: Rect; score: number } | null = null;
    const step = 1;
    for (let y = bbox.y; y + d <= bbox.y + bbox.d + 1e-6; y += step) {
      for (let x = bbox.x; x + w <= bbox.x + bbox.w + 1e-6; x += step) {
        const rect = { x, y, w, d };
        if (!fits(rect)) continue;
        // Prefer the road side (small y) and the middle of the plot across its width.
        const score = (prefer === 'front' ? y * 1.0 : Math.abs(y + d / 2 - center.y) * 0.6) + Math.abs(x + w / 2 - center.x) * 0.35;
        if (!best || score < best.score) best = { rect, score };
      }
    }
    return best ? best.rect : null;
  };

  // Largest rectangle: scan candidate widths, grow depth while it fits.
  let largest: Rect = rectangular ? envRect : { x: 0, y: 0, w: 0, d: 0 };
  if (!rectangular) {
    for (let w = 10; w <= bbox.w; w += 2) {
      let lo = 8;
      let hi = bbox.d;
      let found: Rect | null = null;
      if (!place(w, lo)) continue;
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2;
        const p = place(w, mid);
        if (p) { found = p; lo = mid; } else hi = mid;
      }
      const cand = found || place(w, lo);
      if (cand && cand.w * cand.d > largest.w * largest.d) largest = cand;
    }
  }

  const roadSegs = (site.roadEdges && site.roadEdges.length ? site.roadEdges : plot.map((_, i) => i).filter((i) => {
    const a = plot[i], b = plot[(i + 1) % plot.length];
    return Math.abs(a.y - bbox.y) < 1e-6 && Math.abs(b.y - bbox.y) < 1e-6;
  })).map((i) => [plot[i], plot[(i + 1) % plot.length]] as [Pt, Pt]);

  return {
    plot, rectangular, setbacks, edgeSetbacks, bbox, buildableArea, largest, fits, place, allowPorchInSetback,
    roadDistance: (x, y) => (roadSegs.length ? Math.min(...roadSegs.map(([a, b]) => distToSegment({ x, y }, a, b))) : y - bbox.y)
  };
}

const round = (v: number) => Math.round(v * 2) / 2;
