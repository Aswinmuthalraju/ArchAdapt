import React from 'react';
import PlanSvg from '@/components/canvas/PlanSvg';
import { buildConstraints } from '@/lib/design/program';
import { layoutProgram } from '@/lib/design/layoutEngine';
import { buildLocalProgram } from '@/lib/genai/localPlanner';

/** A real plan from the layout engine (3 bedrooms, two floors, 40' x 60' plot), drawn in gold on plum. */
function showcaseDesign() {
  const site = { plotWidth: 40, plotDepth: 60, totalArea: 2400, orientation: 'E' as const };
  const requirements = {
    familySize: 4, bedrooms: 3, bathrooms: 2, floors: 2, budgetRange: 'Moderate',
    spaces: { living: true, dining: true, kitchen: true, parkingCars: 1, balcony: false, studyWorkspace: false, storage: false, prayerRoom: false, courtyard: false, guestRoom: false, outdoorGarden: false }
  };
  const constraints = buildConstraints(requirements as never, { modes: [], primaryStyle: 'Modern' } as never);
  const location = { name: 'Kochi', city: 'Kochi', country: 'India', lat: 9.93, lng: 76.26 };
  const result = layoutProgram(buildLocalProgram(site, location as never, constraints, '', 0), site, constraints);
  return result.ok ? result.design : null;
}

export { showcaseDesign };

export default function HeroPlan() {
  const design = showcaseDesign();
  if (!design) return null;
  return (
    <figure className="relative mx-auto w-full max-w-[560px]">
      <div className="absolute -inset-6 bg-[radial-gradient(closest-side,rgba(194,30,115,0.28),transparent)]" aria-hidden="true" />
      <div className="relative border border-gold-400/40 bg-plum-850/90 p-3 shadow-lift">
        <div className="relative overflow-hidden">
          <div className="animate-scan">
            <PlanSvg design={design} floor={0} theme="plum" showSite={false} showAnnotations={false} crop className="block h-[520px] w-full" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 h-px animate-scanline bg-gold-300 shadow-[0_0_14px_2px_rgba(231,203,133,0.8)]" aria-hidden="true" />
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-stone-400">
        <span>Ground floor, drawn by the engine</span>
        <span className="text-gold-300">3 bedrooms · two floors · 40′ × 60′ plot</span>
      </figcaption>
    </figure>
  );
}
