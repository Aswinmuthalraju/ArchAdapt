import { buildLocalProgram } from '../../src/lib/genai/localPlanner';
import { CASES, briefFor, location } from './cases';
import { planLayout } from '../../src/lib/design/planner';
import { describe } from './ascii';
import { renderDesigns } from './render';
import { join } from 'node:path';


const only = process.argv[2];
const show = process.argv[3] === 'show';
const pngDir = process.env.PLAN_PNG_DIR;
async function main() {
for (const c of CASES.filter((x) => !only || only.split(',').includes(x.id))) {
  const constraints = briefFor(c);
  const program = buildLocalProgram(c.site, location, constraints, '', 0);
  const t0 = Date.now();
  const out = planLayout(program, c.site, constraints, { hot: true });
  const ms = Date.now() - t0;
  console.log(`\n### ${c.id} ${c.label}  (${ms} ms)`);
  if (!out.result.ok) { console.log('  FAILED:', out.result.reason.slice(0, 200)); if (out.optimizerNote) console.log('  optimizer:', out.optimizerNote.slice(0, 200)); continue; }
  for (const r of out.ranked) {
    const m = r.quality.metrics;
    console.log(`  ${r === out.ranked[0] ? '*' : ' '} ${r.id.padEnd(9)} score ${r.quality.score.toFixed(1).padStart(5)} | unreach ${m.unreachableRooms} exposedBeds ${m.exposedBedrooms}/${m.bedrooms} doors→bed ${m.avgDoorsToBedroom.toFixed(1)} circ ${(m.circulationShare * 100).toFixed(0)}% | undersized ${m.undersizedRooms.length} elong ${m.elongatedRooms.length} | adj ${m.adjacencySatisfied}/${m.adjacencyRequired} | win ${m.habitableWithWindow}/${m.habitableRooms} xvent ${m.crossVentilated}/${m.crossVentilationCandidates} | util ${(m.envelopeUtilization * 100).toFixed(0)}% cov ${(m.groundCoverage * 100).toFixed(0)}% | stack ${(m.structuralStacking * 100).toFixed(0)}%`);
  }
  if (out.optimizerNote) console.log('  optimizer note:', out.optimizerNote.slice(0, 160));
  out.rejected.forEach((r) => console.log('  rejected:', r.slice(0, 220)));
  if (pngDir) await renderDesigns(out.ranked.slice(0, 3).map((r) => ({ title: `${c.id} ${c.label}: ${r.id} score ${r.quality.score.toFixed(1)}`, design: r.success.design })), join(pngDir, `${c.id}.png`));
  if (show && out.result.ok) console.log(describe(out.result.design));
}
}
main();
