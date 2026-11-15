/**
 * Area, cost and code-check figures for a design, computed from its geometry. Pure and shared by the workspace HUD
 * and the plan explanation, so the two can never disagree. Nothing here is a stored claim: a check passes only
 * when the numbers say so, and every assumption is a named constant.
 */
import type { FloorPlanOpening, FloorPlanRoom, StructuredDesignJSON } from '@/types/architectural';
import { ROOM_TYPE_SPECS, inferRoomType } from './roomTypes';
import { validateFloorPlan } from './validateFloorPlan';

/** Not floor area a person can use: circulation, parking and open-to-sky space. */
const NOT_CARPET = new Set(['passage', 'stair', 'parking', 'void', 'balcony', 'courtyard', 'terrace']);
/** Budgetary construction rates, INR per sq ft of built-up area. Indicative only: they vary by city and year. */
export const COST_RATES = { standard: 2200, premium: 3400 } as const;
/** Assumed sill-to-head height of a window when only its width is modelled. */
export const WINDOW_HEIGHT_FT = 4;
/** Glazed area as a share of floor area for habitable rooms. A design target: confirm the figure in your local bylaw. */
export const DAYLIGHT_TARGET = 0.1;
export const MIN_HABITABLE_WIDTH_FT = 7.87; // 2.4 m
export const MIN_PASSAGE_WIDTH_FT = 3; // 0.9 m
const EDGE_TOL = 0.75;

export type CheckStatus = 'pass' | 'fail';
export interface CodeCheck { id: string; label: string; status: CheckStatus; detail: string }

export interface DesignMetrics {
  plotAreaSqFt: number;
  footprintSqFt: number;
  builtUpSqFt: number;
  carpetSqFt: number;
  carpetPct: number;
  coveragePct: number;
  fsi: number;
  costLakhs: { standard: number; premium: number };
  setbacks: { front: number; rear: number; left: number; right: number } | null;
  checks: CodeCheck[];
}

/** Glazed area (sq ft) of windows sitting on the room's walls on its own floor. */
export function glazedAreaSqFt(room: FloorPlanRoom, openings: FloorPlanOpening[]): number {
  const { x, y, width, height, floorLevel } = room.position;
  let total = 0;
  for (const o of openings) {
    if (o.type !== 'window' && o.type !== 'sliding_glass') continue;
    if ((o.floorLevel ?? 0) !== (floorLevel || 0)) continue;
    const inX = o.x >= x - EDGE_TOL && o.x <= x + width + EDGE_TOL;
    const inY = o.y >= y - EDGE_TOL && o.y <= y + height + EDGE_TOL;
    if (!inX || !inY) continue;
    const onEdge = [Math.abs(o.y - y), Math.abs(o.y - (y + height)), Math.abs(o.x - x), Math.abs(o.x - (x + width))].some((d) => d <= EDGE_TOL);
    if (onEdge) total += o.width * WINDOW_HEIGHT_FT;
  }
  return total;
}

const names = (rooms: string[]) => (rooms.length > 3 ? `${rooms.slice(0, 3).join(', ')} +${rooms.length - 3} more` : rooms.join(', '));

export function computeMetrics(design: StructuredDesignJSON): DesignMetrics {
  const plotAreaSqFt = Math.round((design.plot?.totalArea || design.plot.width * design.plot.depth) || 0);
  const ground = design.rooms.filter((r) => (r.position.floorLevel || 0) === 0);
  const footprintSqFt = Math.round(design.footprint?.footprintAreaSqFt || ground.reduce((s, r) => s + r.areaSqFt, 0));
  const builtUpSqFt = Math.round(design.totalBuiltUpAreaSqFt || design.rooms.reduce((s, r) => s + r.areaSqFt, 0));
  const carpetSqFt = Math.round(design.rooms.filter((r) => !NOT_CARPET.has(inferRoomType(r))).reduce((s, r) => s + r.areaSqFt, 0));
  const per = (n: number, d: number) => (d > 0 ? n / d : 0);

  const habitable = design.rooms.filter((r) => ROOM_TYPE_SPECS[inferRoomType(r)]?.habitable);
  const narrow = habitable.filter((r) => Math.min(r.position.width, r.position.height) < MIN_HABITABLE_WIDTH_FT);
  const passages = design.rooms.filter((r) => inferRoomType(r) === 'passage');
  const narrowPassages = passages.filter((r) => Math.min(r.position.width, r.position.height) < MIN_PASSAGE_WIDTH_FT);
  const dark = habitable.filter((r) => glazedAreaSqFt(r, design.openings) < r.areaSqFt * DAYLIGHT_TARGET);
  const report = validateFloorPlan(design);

  const checks: CodeCheck[] = [
    {
      id: 'habitable-width',
      label: 'Habitable room width ≥ 2.4 m',
      status: narrow.length ? 'fail' : 'pass',
      detail: narrow.length ? `Too narrow: ${names(narrow.map((r) => r.name))}.` : `${habitable.length} habitable rooms checked.`
    },
    {
      id: 'daylight',
      label: `Daylight: glazing ≥ ${Math.round(DAYLIGHT_TARGET * 100)}% of floor area`,
      status: dark.length ? 'fail' : 'pass',
      detail: dark.length ? `Short of glazing: ${names(dark.map((r) => r.name))}.` : `Window width × ${WINDOW_HEIGHT_FT} ft assumed per window; every habitable room meets the target.`
    },
    {
      id: 'passage-width',
      label: 'Passage width ≥ 0.9 m',
      status: narrowPassages.length ? 'fail' : 'pass',
      detail: passages.length ? (narrowPassages.length ? `Too narrow: ${names(narrowPassages.map((r) => r.name))}.` : `${passages.length} passages checked.`) : 'No passages in this plan.'
    },
    {
      id: 'validator',
      label: 'Layout validator (doors, stairs, access, setbacks)',
      status: report.errors.length ? 'fail' : 'pass',
      detail: report.errors.length ? report.errors.slice(0, 2).join(' ') : `No errors${report.warnings.length ? `, ${report.warnings.length} warning(s)` : ''}.`
    }
  ];

  return {
    plotAreaSqFt,
    footprintSqFt,
    builtUpSqFt,
    carpetSqFt,
    carpetPct: Math.round(per(carpetSqFt, builtUpSqFt) * 100),
    coveragePct: Math.round(per(footprintSqFt, plotAreaSqFt) * 100),
    fsi: Number(per(builtUpSqFt, plotAreaSqFt).toFixed(2)),
    costLakhs: {
      standard: Math.round((builtUpSqFt * COST_RATES.standard) / 100_000),
      premium: Math.round((builtUpSqFt * COST_RATES.premium) / 100_000)
    },
    setbacks: design.plot.setbacks ?? null,
    checks
  };
}
