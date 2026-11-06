import { SiteInfo } from '@/types/architectural';
import { Pt, polygonArea, validatePolygon } from './planner/envelope';

export type PlotShape = 'rectangle' | 'tapered' | 'corner' | 'l_shape';

export const PLOT_SHAPES: { id: PlotShape; label: string; hint: string }[] = [
  { id: 'rectangle', label: 'Rectangle', hint: 'A plain rectangular plot.' },
  { id: 'tapered', label: 'Tapered (narrower at the back)', hint: 'Side boundaries lean in toward the back; the road is the wide edge.' },
  { id: 'corner', label: 'Corner plot (second road on the right)', hint: 'Roads on the front and the right side, with a cut corner where they meet.' },
  { id: 'l_shape', label: 'L-shaped', hint: 'A rectangle with a quarter missing at the back right.' }
];

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Outline and road edges for a standard plot shape, in feet with the road along y = 0. Rectangles have no outline. */
export function shapeGeometry(shape: PlotShape, width: number, depth: number): Pick<SiteInfo, 'polygon' | 'roadEdges'> {
  const W = width;
  const D = depth;
  const p = (x: number, y: number): Pt => ({ x: round1(x), y: round1(y) });
  switch (shape) {
    case 'tapered': {
      const inset = Math.min(0.16 * W, 12);
      return { polygon: [p(0, 0), p(W, 0), p(W - inset, D), p(inset, D)], roadEdges: [0] };
    }
    case 'corner': {
      const cut = Math.min(0.2 * W, 0.2 * D, 14);
      return { polygon: [p(0, 0), p(W - cut, 0), p(W, cut), p(W, D), p(0, D)], roadEdges: [0, 1, 2] };
    }
    case 'l_shape':
      return { polygon: [p(0, 0), p(W, 0), p(W, D * 0.5), p(W * 0.5, D * 0.5), p(W * 0.5, D), p(0, D)], roadEdges: [0] };
    default:
      return {};
  }
}

/**
 * Makes a site consistent: when an outline is present, the plot width, depth and area are taken from it
 * (and it is moved so its bounding box starts at the origin), so the numbers can never disagree with the drawing.
 */
export function normalizeSite(site: SiteInfo): SiteInfo {
  if (!site.polygon || validatePolygon(site.polygon)) {
    const { polygon, roadEdges, ...rest } = site;
    void polygon; void roadEdges;
    return { ...rest, plotWidth: Number(site.plotWidth), plotDepth: Number(site.plotDepth) };
  }
  const x0 = Math.min(...site.polygon.map((q) => q.x));
  const y0 = Math.min(...site.polygon.map((q) => q.y));
  const polygon = site.polygon.map((q) => ({ x: round1(q.x - x0), y: round1(q.y - y0) }));
  const plotWidth = round1(Math.max(...polygon.map((q) => q.x)));
  const plotDepth = round1(Math.max(...polygon.map((q) => q.y)));
  const edges = (site.roadEdges || []).filter((i) => Number.isInteger(i) && i >= 0 && i < polygon.length);
  return { ...site, polygon, plotWidth, plotDepth, totalArea: Math.round(polygonArea(polygon)), roadEdges: edges.length ? edges : undefined };
}
