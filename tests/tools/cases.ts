import { buildConstraints } from '../../src/lib/design/program';
import type { DesignRequirements, LocationInfo, SiteInfo } from '../../src/types/architectural';

export const location: LocationInfo = { name: 'Kochi, Kerala', city: 'Kochi', country: 'India', lat: 9.9312, lng: 76.2673, climateZone: 'Warm & Humid' };

export interface Case { id: string; label: string; site: SiteInfo; bedrooms: number; floors: number; style: string; court?: boolean }
const poly = (pts: [number, number][]) => pts.map(([x, y]) => ({ x, y }));
export const CASES: Case[] = [
  { id: 'A', label: '40x60 3BR G+1 Modern', site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' }, bedrooms: 3, floors: 2, style: 'Modern' },
  { id: 'B', label: '25x50 2BR G Modern', site: { plotWidth: 25, plotDepth: 50, totalArea: 1250, orientation: 'E' }, bedrooms: 2, floors: 1, style: 'Modern' },
  { id: 'C', label: '80x120 4BR G+1 Modern', site: { plotWidth: 80, plotDepth: 120, totalArea: 9600, orientation: 'E' }, bedrooms: 4, floors: 2, style: 'Modern' },
  { id: 'D', label: '50x70 3BR G+1 Kerala courtyard', site: { plotWidth: 50, plotDepth: 70, totalArea: 3500, orientation: 'E' }, bedrooms: 3, floors: 2, style: 'Kerala Traditional', court: true },
  { id: 'E', label: '22x80 narrow-deep 3BR G+1', site: { plotWidth: 22, plotDepth: 80, totalArea: 1760, orientation: 'E' }, bedrooms: 3, floors: 2, style: 'Modern' },
  { id: 'F1', label: 'Trapezoid plot 45/30 x 65, 3BR G+1', site: { plotWidth: 45, plotDepth: 65, totalArea: 2437, orientation: 'E', polygon: poly([[0, 0], [45, 0], [37.5, 65], [7.5, 65]]) }, bedrooms: 3, floors: 2, style: 'Modern' },
  { id: 'F2', label: 'L-shaped plot 60x70 (30x35 notch), 3BR G+1', site: { plotWidth: 60, plotDepth: 70, totalArea: 3150, orientation: 'E', polygon: poly([[0, 0], [60, 0], [60, 35], [30, 35], [30, 70], [0, 70]]) }, bedrooms: 3, floors: 2, style: 'Modern' },
  { id: 'F3', label: 'Corner plot (cut corner) 50x55, 3BR G+1', site: { plotWidth: 50, plotDepth: 55, totalArea: 2650, orientation: 'E', polygon: poly([[0, 0], [50, 0], [50, 38], [33, 55], [0, 55]]), roadEdges: [0, 2] }, bedrooms: 3, floors: 2, style: 'Modern' },
  { id: 'G1', label: '40x60 3BR G+1, road faces N', site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'N' }, bedrooms: 3, floors: 2, style: 'Modern' },
  { id: 'G2', label: '40x60 3BR G+1, road faces W', site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'W' }, bedrooms: 3, floors: 2, style: 'Modern' }
];

export function briefFor(c: Case) {
  const req: DesignRequirements = {
    familySize: 4, bedrooms: c.bedrooms, bathrooms: Math.max(2, c.bedrooms - 1), floors: c.floors, budgetRange: 'Moderate',
    spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: !!c.court, guestRoom: false, outdoorGarden: false }
  };
  return buildConstraints(req, { modes: [], primaryStyle: c.style as never });
}

