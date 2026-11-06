import { generateDesign } from '../../src/lib/design/pipeline';
import { runWhatIf } from '../../src/lib/design/whatIf';
import { location } from './cases';

async function main() {
  const [w, d, b, f] = [Number(process.argv[2] || 40), Number(process.argv[3] || 60), Number(process.argv[4] || 3), Number(process.argv[5] || 2)];
  const gen = await generateDesign({ site: { plotWidth: w, plotDepth: d, totalArea: w * d, orientation: (process.env.ORI || 'E') as 'E' }, location,
    requirements: { familySize: 4, bedrooms: b, bathrooms: 2, floors: f, budgetRange: 'Moderate', spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false } },
    preferences: { modes: [], primaryStyle: 'Modern' }, engine: 'local' });
  if (gen.status !== 'OK') return console.log(gen);
  const design = gen.design;
  console.log('base planner:', design.planner?.label, design.planner?.score);
  const requests = process.argv.slice(6).length ? process.argv.slice(6) : ['Make the kitchen 20% larger', 'Make the living room 15% larger', 'Make the master bedroom bigger', 'Add a study room', 'Add an attached bathroom to the master bedroom', 'Remove the utility room', 'Move the study next to the living room'];
  for (const req of requests) {
    const t0 = Date.now();
    const out = await runWhatIf(design, req);
    if (out.status !== 'OK') { console.log(`\n"${req}" -> ${out.status}: ${'reason' in out ? out.reason : ''}`); continue; }
    const touched = out.diff.rooms.filter((r) => r.kind !== 'unchanged');
    console.log(`\n"${req}" -> ${out.strategy} in ${Date.now() - t0}ms | preserved ${out.diff.preserved}/${out.diff.total} | quality ${out.quality?.before} -> ${out.quality?.after}`);
    console.log('  summary:', out.summary);
    touched.forEach((r) => console.log(`   ${r.kind.padEnd(8)} ${r.name} (${r.roomType}, floor ${r.floor}) ${r.before ? `${r.before.w}x${r.before.d}@${r.before.x},${r.before.y}` : ''} -> ${r.after ? `${r.after.w}x${r.after.d}@${r.after.x},${r.after.y}` : 'gone'}`));
    if (out.surgeryNote) console.log('  note:', out.surgeryNote);
  }
}
main();
