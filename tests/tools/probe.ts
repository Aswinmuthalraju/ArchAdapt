import { generateDesign } from '../../src/lib/design/pipeline';
import { describe } from './ascii';
import type { DesignRequirements, LocationInfo } from '../../src/types/architectural';

const location: LocationInfo = { name: 'Kochi, Kerala', city: 'Kochi', country: 'India', lat: 9.9312, lng: 76.2673, climateZone: 'Warm & Humid' };
const req = (bedrooms: number, floors: number, extra: Partial<DesignRequirements['spaces']> = {}): DesignRequirements => ({
  familySize: 4, bedrooms, bathrooms: Math.max(2, bedrooms - 1), floors, budgetRange: 'Moderate',
  spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false, ...extra }
});
const [w, d, b, f, style] = [Number(process.argv[2] || 40), Number(process.argv[3] || 60), Number(process.argv[4] || 3), Number(process.argv[5] || 2), process.argv[6] || 'Modern'];
generateDesign({ site: { plotWidth: w, plotDepth: d, totalArea: w * d, orientation: 'E' }, location, requirements: req(b, f, process.argv[7] === 'court' ? { courtyard: true } : {}), preferences: { modes: [], primaryStyle: style as never }, engine: 'local' }).then((o) => {
  if (o.status !== 'OK') return console.log(o);
  console.log(describe(o.design));
  console.log(o.design.layoutNotes?.join('\n'));
});
