import { generateDesign } from '../../src/lib/design/pipeline';
import { attemptSurgery, diffDesigns } from '../../src/lib/design/surgery';
import { programFromDesign, constraintsFromDesign } from '../../src/lib/design/program';
import { siteFromDesign } from '../../src/lib/design/whatIf';
import { validateFloorPlan } from '../../src/lib/design/validateFloorPlan';
import { location } from './cases';

async function main() {
  const gen = await generateDesign({ site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' }, location,
    requirements: { familySize: 4, bedrooms: 3, bathrooms: 2, floors: 2, budgetRange: 'Moderate', spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false } },
    preferences: { modes: [], primaryStyle: 'Modern' }, engine: 'local' });
  if (gen.status !== 'OK') return;
  const design = gen.design;
  const program = programFromDesign(design);
  const base = { design, program, before: program, constraints: constraintsFromDesign(design), site: siteFromDesign(design) };
  // identity round trip: a resize of nothing should reproduce the plan
  const living = program.rooms.find((r) => r.type === 'living')!;
  const out = attemptSurgery({ ...base, ops: [{ op: 'resize_room', target: living.id, areaSqFt: living.areaSqFt + 40 }] });
  console.log('resize living +40:', out.ok ? out.notes : out.reason);
  if (out.ok) {
    const diff = diffDesigns(design, out.design, 'wall-push');
    console.log(diff.touched, diff.preserved, diff.total, validateFloorPlan(out.design).errors);
  }
  const sameDesign = attemptSurgery({ ...base, ops: [{ op: 'resize_room', target: program.rooms.find((r) => r.type === 'kitchen')!.id, areaSqFt: program.rooms.find((r) => r.type === 'kitchen')!.areaSqFt + 25 }] });
  console.log('kitchen +25:', sameDesign.ok ? sameDesign.notes : sameDesign.reason);
}
main();
import { roundTrip } from '../../src/lib/design/surgery';
async function rt() {
  const gen = await generateDesign({ site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' }, location,
    requirements: { familySize: 4, bedrooms: 3, bathrooms: 2, floors: 2, budgetRange: 'Moderate', spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false } },
    preferences: { modes: [], primaryStyle: 'Modern' }, engine: 'local' });
  if (gen.status !== 'OK') return;
  const design = gen.design;
  const program = programFromDesign(design);
  const again = roundTrip({ design, program, before: program, constraints: constraintsFromDesign(design), site: siteFromDesign(design), ops: [] })!;
  console.log('roundtrip valid:', validateFloorPlan(again).errors, 'doors', design.openings.length, again.openings.length);
  const ids = (d: typeof design) => d.openings.filter((o) => (o.connects || []).length === 2).map((o) => (o.connects || []).sort().join('~')).sort();
  const a = ids(design), b = ids(again);
  console.log('missing door links:', a.filter((x) => !b.includes(x)), 'new:', b.filter((x) => !a.includes(x)));
}
rt();
