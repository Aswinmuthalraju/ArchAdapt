import { DesignRequirements, SiteInfo } from '@/types/architectural';
import { buildableEnvelope } from './layoutEngine';
import { computeEnvelope, validatePolygon } from './planner/envelope';
import { normalizeSite } from './plotShapes';

const ORIENTATIONS = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];

const inRange = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/**
 * The one place that decides whether a brief is well-formed. Used by the form (to explain problems as the user types),
 * the pre-check route and the generation route, so the three can never disagree.
 * Returns plain-language problems; an empty list means the input can be planned.
 */
export function validateBriefInput(site: SiteInfo, requirements: DesignRequirements): string[] {
  const problems: string[] = [];
  if (!inRange(Number(site?.plotWidth), 10, 1000) || !inRange(Number(site?.plotDepth), 10, 1000)) problems.push('Plot width and depth must each be between 10 and 1000 ft.');
  if (!ORIENTATIONS.includes(site?.orientation)) problems.push('Choose which side of the plot the road is on.');
  if (!inRange(Number(requirements?.bedrooms), 1, 12)) problems.push('Bedrooms must be between 1 and 12.');
  if (!inRange(Number(requirements?.bathrooms), 1, 12)) problems.push('Bathrooms must be between 1 and 12.');
  if (!inRange(Number(requirements?.floors), 1, 4)) problems.push('Floors must be between 1 and 4.');
  if (!requirements?.spaces || typeof requirements.spaces !== 'object') problems.push('Requested spaces are missing.');
  if (problems.length) return problems;

  if (site.polygon) {
    const bad = validatePolygon(site.polygon);
    if (bad) return [bad];
    if (site.polygon.length > 24) return ['A plot outline may have at most 24 corners.'];
    if (site.roadEdges && !site.roadEdges.every((i) => Number.isInteger(i) && i >= 0 && i < site.polygon!.length)) return ['A road edge refers to a boundary that does not exist.'];
    const clean = normalizeSite(site);
    if (!inRange(clean.plotWidth, 10, 1000) || !inRange(clean.plotDepth, 10, 1000)) return ['The plot outline must be between 10 and 1000 ft in each direction.'];
    const env = computeEnvelope(clean);
    if (Math.min(env.largest.w, env.largest.d) < 14 || env.largest.w * env.largest.d < 330) return [`After setbacks the largest buildable rectangle on this outline is only ${Math.round(env.largest.w)} x ${Math.round(env.largest.d)} ft, which is too small for a house.`];
    return [];
  }

  const sb = site.setbacks;
  if (sb) {
    const sides = [sb.front, sb.rear, sb.left, sb.right];
    if (!sides.every((value) => inRange(Number(value), 0, 100))) problems.push('Setbacks must each be between 0 and 100 ft.');
    else {
      const env = buildableEnvelope({ ...site, plotWidth: Number(site.plotWidth), plotDepth: Number(site.plotDepth) });
      if (env.width < 16 || env.depth < 20) problems.push(`These setbacks leave a buildable area of only ${Math.round(env.width)} x ${Math.round(env.depth)} ft, which is too small for a house.`);
    }
  }
  return problems;
}
