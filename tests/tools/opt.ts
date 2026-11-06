import { buildLocalProgram } from '../../src/lib/genai/localPlanner';
import { buildConstraints } from '../../src/lib/design/program';
import { optimizeLayouts } from '../../src/lib/design/planner/optimizer';
import { validateFloorPlan } from '../../src/lib/design/validateFloorPlan';
import { describe } from './ascii';
import type { DesignRequirements, LocationInfo } from '../../src/types/architectural';

const location: LocationInfo = { name: 'Kochi, Kerala', city: 'Kochi', country: 'India', lat: 9.9312, lng: 76.2673, climateZone: 'Warm & Humid' };
const [w, d, b, f, style] = [Number(process.argv[2] || 40), Number(process.argv[3] || 60), Number(process.argv[4] || 3), Number(process.argv[5] || 2), process.argv[6] || 'Modern'];
const req: DesignRequirements = { familySize: 4, bedrooms: b, bathrooms: Math.max(2, b - 1), floors: f, budgetRange: 'Moderate',
  spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: process.argv[7] === 'court', guestRoom: false, outdoorGarden: false } };
const constraints = buildConstraints(req, { modes: [], primaryStyle: style as never });
const site = { plotWidth: w, plotDepth: d, totalArea: w * d, orientation: 'E' as const };
const program = buildLocalProgram(site, location, constraints, '', 0);
const t0 = Date.now();
const res = optimizeLayouts(program, site, constraints, { hot: true });
console.log('ms', Date.now() - t0);
if (!res.ok) { console.log(res); process.exit(0); }
console.log('rejected', res.rejected);
for (const c of res.candidates) {
  const v = validateFloorPlan(c.design);
  console.log(`\n===== ${c.archetype.label} energy=${c.energy.toFixed(1)} valid=${v.isValid} unreachable=${c.unreachable.join(',')}`);
  console.log('errors', v.errors.slice(0, 6));
  console.log('terms', Object.entries(c.terms).map(([k, x]) => `${k}:${x.toFixed(1)}`).join(' '));
  if (process.argv[8] !== 'quiet') console.log(describe(c.design));
}
