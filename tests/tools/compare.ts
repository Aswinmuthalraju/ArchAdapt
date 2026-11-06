import { buildLocalProgram } from '../../src/lib/genai/localPlanner';
import { CASES, briefFor, location } from './cases';
import { planLayout } from '../../src/lib/design/planner';
import { evaluateDesign } from '../../src/lib/design/quality';
import { renderDesigns } from './render';
import { join } from 'node:path';

/** Before = the band solver alone (what main shipped). After = the full pipeline's selected plan. Same program, same scorer. */
async function main() {
  const dir = process.env.PLAN_PNG_DIR;
  console.log('| Case | Before (band solver) | After (selected) | After engine | Before ms | After ms |');
  console.log('|---|---|---|---|---|---|');
  for (const c of CASES) {
    const constraints = briefFor(c);
    const program = buildLocalProgram(c.site, location, constraints, '', 0);
    const t0 = Date.now();
    const before = planLayout(program, c.site, constraints, { hot: true, fast: true });
    const t1 = Date.now();
    const after = planLayout(program, c.site, constraints, { hot: true });
    const t2 = Date.now();
    const fmt = (r: ReturnType<typeof planLayout>) => {
      if (!r.result.ok || !r.ranked.length) return `INFEASIBLE or invalid for this outline`;
      const q = r.ranked[0].quality; const m = q.metrics;
      return `score ${q.score.toFixed(1)}; circ ${(m.circulationShare * 100).toFixed(0)}%; undersized ${m.undersizedRooms.length}; oversized ${m.oversizedRooms.length}; open terrace ${(m.openAreaShare * 100).toFixed(0)}%; exposed beds ${m.exposedBedrooms}/${m.bedrooms}`;
    };
    console.log(`| ${c.id} ${c.label} | ${fmt(before)} | ${fmt(after)} | ${after.ranked[0]?.label ?? '-'} (${after.ranked.length} valid) | ${t1 - t0} | ${t2 - t1} |`);
    if (dir && after.result.ok) {
      const items = [];
      if (before.ranked[0]) items.push({ title: `BEFORE ${c.id}: ${before.ranked[0].label}`, design: before.ranked[0].success.design });
      items.push({ title: `AFTER ${c.id}: ${after.ranked[0].label} (${after.ranked[0].quality.score.toFixed(1)})`, design: after.ranked[0].success.design });
      await renderDesigns(items, join(dir, `compare-${c.id}.png`), 8);
    }
  }
}
main();
