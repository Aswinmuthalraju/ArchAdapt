import { DesignRequirements, SiteInfo } from '@/types/architectural';
import { buildableEnvelope } from './layoutEngine';

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
