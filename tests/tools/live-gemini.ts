import { generateDesign } from '../../src/lib/design/pipeline';
import { location } from './cases';

const notes = process.argv[2] || 'My elderly parents live with us and we both work from home. We host relatives often. Privacy for the bedrooms matters, and I want a puja room.';
const t0 = Date.now();
generateDesign({
  site: { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' }, location,
  requirements: { familySize: 5, bedrooms: 3, bathrooms: 3, floors: 2, budgetRange: 'Moderate', customRequirements: notes,
    spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: true, studyWorkspace: true, storage: false, prayerRoom: true, courtyard: false, guestRoom: false, outdoorGarden: false } },
  preferences: { modes: [], primaryStyle: 'Modern' }, onStage: (s, m) => console.log(' stage:', s, m.slice(0, 70))
}).then((o) => {
  console.log('ms', Date.now() - t0, 'status', o.status);
  if (o.status !== 'OK') return console.log(o);
  console.log('engine', o.engine, 'model', o.modelId, 'attempts', o.attempts, 'notice', o.notice);
  console.log('briefReading', JSON.stringify(o.design.briefReading, null, 1));
  console.log('planner', o.design.planner?.label, o.design.planner?.score, o.design.planner?.rationale);
  console.log('intent', JSON.stringify(o.design.program?.intent));
  console.log('alts', o.alternatives?.map((a) => `${a.planner?.label}:${a.planner?.score}`));
});
