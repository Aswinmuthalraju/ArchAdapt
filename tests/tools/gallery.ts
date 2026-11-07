import { buildLocalProgram } from '../../src/lib/genai/localPlanner';
import { buildConstraints } from '../../src/lib/design/program';
import { location } from './cases';
import { planLayout } from '../../src/lib/design/planner';
import { renderDesigns } from './render';
import type { DesignRequirements, SiteInfo } from '../../src/types/architectural';

/** Developer gallery: renders the selected plan for a spread of everyday briefs (small to large, G to G+2). */
interface G { id: string; w: number; d: number; beds: number; floors: number; o?: SiteInfo['orientation']; style?: string; study?: boolean; balcony?: boolean }
export const GALLERY: G[] = [
  { id: '30x40-2BR-G1', w: 30, d: 40, beds: 2, floors: 2 },
  { id: '30x40-3BR-G1', w: 30, d: 40, beds: 3, floors: 2 },
  { id: '30x50-3BR-G1', w: 30, d: 50, beds: 3, floors: 2 },
  { id: '40x60-3BR-G1', w: 40, d: 60, beds: 3, floors: 2 },
  { id: '40x60-4BR-G1', w: 40, d: 60, beds: 4, floors: 2, balcony: true },
  { id: '30x60-2BR-G', w: 30, d: 60, beds: 2, floors: 1 },
  { id: '50x80-4BR-G1', w: 50, d: 80, beds: 4, floors: 2, study: true },
  { id: '25x50-3BR-G2', w: 25, d: 50, beds: 3, floors: 3 },
  { id: '40x60-2BR-G1-N', w: 40, d: 60, beds: 2, floors: 2, o: 'N' },
];

export function briefOf(g: G) {
  const req: DesignRequirements = {
    familySize: 4, bedrooms: g.beds, bathrooms: Math.max(2, g.beds), floors: g.floors, budgetRange: 'Moderate',
    spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: !!g.balcony, studyWorkspace: !!g.study, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false }
  };
  return buildConstraints(req, { modes: [], primaryStyle: (g.style || 'Modern') as never });
}

async function main() {
  const out = process.argv[2] || '/tmp/gallery.png';
  const only = process.argv[3];
  const items = [];
  for (const g of GALLERY.filter((x) => !only || only.split(',').includes(x.id))) {
    const site: SiteInfo = { plotWidth: g.w, plotDepth: g.d, totalArea: g.w * g.d, orientation: g.o || 'E' };
    const c = briefOf(g);
    const program = buildLocalProgram(site, location, c, '', 0);
    const r = planLayout(program, site, c, { hot: true });
    if (!r.result.ok) { console.log(g.id, 'FAILED', r.result.reason.slice(0, 160)); continue; }
    const best = r.ranked[0];
    console.log(g.id, best ? `${best.id} ${best.quality.score.toFixed(1)}` : 'unranked', r.ranked.map((x) => `${x.id}:${x.quality.score.toFixed(0)}`).join(' '));
    items.push({ title: `${g.id}: ${best?.label ?? 'band'} ${best?.quality.score.toFixed(1) ?? ''}`, design: r.result.design });
  }
  await renderDesigns(items, out, 7);
}
main();
