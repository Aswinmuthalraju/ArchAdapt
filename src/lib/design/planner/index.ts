import { DesignConstraints, DesignProgram, PlannerAlternative, SiteInfo, StructuredDesignJSON } from '@/types/architectural';
import { LayoutResult, LayoutSuccess, layoutProgram } from '@/lib/design/layoutEngine';
import { QualityReport, evaluateDesign } from '@/lib/design/quality';
import { computeEnvelope, validatePolygon } from './envelope';
import { DesignIntent, OptimizeOptions, PlanCandidate, optimizeLayouts } from './optimizer';

export type { DesignIntent } from './optimizer';

export interface PlanLayoutOptions extends OptimizeOptions {
  /** Skip the optimiser and use the band solver only (feasibility probes). */
  fast?: boolean;
  /** Take this archetype as the selected layout if it is valid (used by "show me a different concept"). */
  avoid?: string[];
}

export interface RankedPlan {
  id: string;
  label: string;
  summary: string;
  engine: 'spatial-optimizer' | 'band-solver';
  success: LayoutSuccess;
  quality: QualityReport;
}

export interface PlanLayoutResult {
  result: LayoutResult;
  ranked: RankedPlan[];
  /** Why the optimiser found nothing, when it did not. */
  optimizerNote?: string;
  /** Arrangements that were generated and then rejected, with the reason. */
  rejected: string[];
}

function tradeoff(selected: RankedPlan, other: RankedPlan): string {
  const a = selected.quality.metrics;
  const b = other.quality.metrics;
  const bits: string[] = [];
  const diff = (x: number, y: number, tol: number) => Math.abs(x - y) > tol;
  if (diff(a.circulationShare, b.circulationShare, 0.025)) bits.push(b.circulationShare < a.circulationShare ? `${Math.round((a.circulationShare - b.circulationShare) * 100)}% less corridor area` : `${Math.round((b.circulationShare - a.circulationShare) * 100)}% more corridor area`);
  if (b.exposedBedrooms !== a.exposedBedrooms) bits.push(b.exposedBedrooms < a.exposedBedrooms ? 'bedrooms better screened from public rooms' : 'more bedrooms opening off public rooms');
  if (diff(a.avgDoorsToBedroom, b.avgDoorsToBedroom, 0.4)) bits.push(b.avgDoorsToBedroom < a.avgDoorsToBedroom ? 'shorter walk to the bedrooms' : 'longer walk to the bedrooms');
  const winA = a.habitableWithWindow / Math.max(1, a.habitableRooms);
  const winB = b.habitableWithWindow / Math.max(1, b.habitableRooms);
  if (diff(winA, winB, 0.08)) bits.push(winB > winA ? 'more rooms with their own window' : 'fewer rooms with their own window');
  if (b.crossVentilated !== a.crossVentilated) bits.push(b.crossVentilated > a.crossVentilated ? 'better cross-ventilation' : 'less cross-ventilation');
  if (diff(a.structuralStacking, b.structuralStacking, 0.1)) bits.push(b.structuralStacking > a.structuralStacking ? 'walls stack more cleanly' : 'walls stack less cleanly');
  if (diff(a.envelopeUtilization, b.envelopeUtilization, 0.06)) bits.push(b.envelopeUtilization > a.envelopeUtilization ? 'uses more of the buildable area' : 'leaves more of the plot open');
  return bits.length ? bits.slice(0, 3).join('; ') : 'comparable overall, arranged differently';
}

/**
 * Generates every credible arrangement of one room programme, scores each with the same measures,
 * and returns them best first. The first entry is the plan to use; the rest are genuine alternatives.
 */
export function planLayout(program: DesignProgram, site: SiteInfo, constraints: DesignConstraints, options: PlanLayoutOptions = {}): PlanLayoutResult {
  const bandResult = layoutProgram(program, site, constraints);
  const ranked: RankedPlan[] = [];
  let optimizerNote: string | undefined;
  let failure: LayoutResult | null = bandResult.ok ? null : bandResult;

  const rejected: string[] = [];
  const consider = (id: string, label: string, summary: string, engine: RankedPlan['engine'], success: LayoutSuccess) => {
    const quality = evaluateDesign(success.design, { hot: options.hot });
    if (!quality.metrics.valid) { rejected.push(`${label}: ${quality.metrics.errors.slice(0, 2).join(' | ')}`); return; }
    if (success.unreachable.length) { rejected.push(`${label}: rooms the door solver could not reach (${success.unreachable.join(', ')})`); return; }
    ranked.push({ id, label, summary, engine, success, quality });
  };

  if (bandResult.ok && site.polygon && !validatePolygon(site.polygon)) {
    // The band solver plans in a rectangle. Judge it against the real outline so it can never claim to fit a site it does not.
    const env = computeEnvelope(site);
    bandResult.design.plot.polygon = env.plot;
    bandResult.design.plot.roadEdges = site.roadEdges;
    bandResult.design.buildableAreaSqFt = Math.round(env.buildableArea);
  }
  if (bandResult.ok) {
    consider('band', 'Zoned bands', 'Living at the road, a circulation band in the middle with the stair, bedrooms behind. Reliable and economical.', 'band-solver', bandResult);
  }
  if (!options.fast) {
    const opt = optimizeLayouts(program, site, constraints, options);
    if (opt.ok) {
      for (const c of opt.candidates as PlanCandidate[]) {
        const success: LayoutSuccess = { ok: true, design: c.design, notes: c.notes, unreachable: c.unreachable, compression: c.compression };
        consider(c.archetype.id, c.archetype.label, c.archetype.summary, 'spatial-optimizer', success);
      }
      if (!ranked.some((r) => r.engine === 'spatial-optimizer')) optimizerNote = `The spatial optimiser produced ${opt.candidates.length} arrangement(s) but none passed every check.`;
    } else {
      optimizerNote = opt.reason;
      if (!failure) failure = null;
      else if (!bandResult.ok) failure = bandResult.reason.length >= opt.reason.length ? bandResult : opt;
    }
  }
  if (!ranked.length) {
    if (bandResult.ok) return { result: bandResult, ranked, optimizerNote, rejected };
    return { result: failure || bandResult, ranked, optimizerNote, rejected };
  }
  // Prefer concepts that were not just shown to the user when a different one is requested.
  const avoid = new Set(options.avoid || []);
  ranked.sort((a, b) => (avoid.has(a.id) ? 1 : 0) - (avoid.has(b.id) ? 1 : 0) || b.quality.score - a.quality.score);
  const best = ranked[0];
  const alternatives: PlannerAlternative[] = ranked.map((r, i) => ({
    id: r.id, label: r.label, summary: r.summary, engine: r.engine, score: r.quality.score, selected: i === 0,
    tradeoff: i === 0 ? 'Selected' : tradeoff(best, r)
  }));
  const rationale: string[] = [];
  rationale.push(`${best.label} scored ${best.quality.score.toFixed(1)} of 100 on circulation, room shape, adjacency, daylight and services${ranked.length > 1 ? `, ahead of ${ranked.slice(1).map((r) => `${r.label} (${r.quality.score.toFixed(1)})`).join(', ')}` : ''}.`);
  const weakest = [...best.quality.parts].sort((a, b) => a.score - b.score)[0];
  if (weakest && weakest.score < 0.85) rationale.push(`Its weakest area is ${weakest.label.toLowerCase()}: ${weakest.detail}.`);
  if (optimizerNote && !ranked.some((r) => r.engine === 'spatial-optimizer')) rationale.push(`The spatial optimiser could not improve on this brief: ${optimizerNote}`);
  best.success.design.planner = {
    engine: best.engine, archetype: best.id, label: best.label, summary: best.summary, score: best.quality.score,
    scoreParts: best.quality.parts, alternatives, rationale
  };
  if (best.engine === 'spatial-optimizer') {
    best.success.notes.unshift(`${best.label}: ${best.summary}`);
    best.success.design.layoutNotes = best.success.notes;
    best.success.design.designSignature && (best.success.design.designSignature.planningType = planningTypeOf(best.id) || best.success.design.designSignature.planningType);
  }
  return { result: best.success, ranked, optimizerNote, rejected };
}

function planningTypeOf(id: string): NonNullable<StructuredDesignJSON['designSignature']>['planningType'] | null {
  switch (id) {
    case 'courtyard': return 'courtyard_centered';
    case 'wings': return 'zoned_wings';
    case 'hub':
    case 'compact': return 'compact_core';
    case 'spine': return 'linear_circulation';
    default: return null;
  }
}
