import { NextResponse } from 'next/server';
import { DesignPreferences, DesignRequirements, LocationInfo, SiteInfo } from '@/types/architectural';
import { generateDesign } from '@/lib/design/pipeline';
import { validateBriefInput } from '@/lib/design/inputValidation';
import { buildableEnvelope } from '@/lib/design/layoutEngine';
import { computeEnvelope } from '@/lib/design/planner/envelope';
import { normalizeSite } from '@/lib/design/plotShapes';

/**
 * Fast feasibility check that never calls the AI. It runs the same deterministic layout and validation the real
 * generation uses, so "fits" here means a valid plan exists for this brief and "does not fit" explains why.
 */
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, problems: ['Request body is not valid JSON.'] }, { status: 400 });
  }
  const { site, location, requirements, preferences } = body as { site: SiteInfo; location?: LocationInfo; requirements: DesignRequirements; preferences?: DesignPreferences };
  if (!site || !requirements) return NextResponse.json({ ok: false, problems: ['Missing site or requirements.'] }, { status: 400 });

  const problems = validateBriefInput(site, requirements);
  if (problems.length) return NextResponse.json({ ok: false, feasible: false, problems });

  const cleanSite = normalizeSite(site);
  const envelope = buildableEnvelope(cleanSite);
  const irregular = cleanSite.polygon ? computeEnvelope(cleanSite) : null;
  try {
    const outcome = await generateDesign({
      site: cleanSite,
      location: location || { name: 'Site', city: 'Site', country: 'India', lat: 0, lng: 0 },
      requirements,
      preferences: { modes: preferences?.modes || [], primaryStyle: preferences?.primaryStyle || 'Modern' },
      engine: 'local',
      effort: 0.45
    });
    const envelopeInfo = irregular
      ? { width: Math.round(irregular.largest.w * 10) / 10, depth: Math.round(irregular.largest.d * 10) / 10, areaSqFt: Math.round(irregular.buildableArea), setbacks: irregular.setbacks }
      : { width: Math.round(envelope.width * 10) / 10, depth: Math.round(envelope.depth * 10) / 10, areaSqFt: Math.round(envelope.width * envelope.depth), setbacks: envelope.setbacks };
    if (outcome.status !== 'OK') {
      return NextResponse.json({ ok: true, feasible: false, problems: [], reason: outcome.reason, violatedConstraints: outcome.violatedConstraints, envelope: envelopeInfo });
    }
    const { design } = outcome;
    return NextResponse.json({
      ok: true,
      feasible: true,
      problems: [],
      envelope: envelopeInfo,
      summary: {
        footprintWidth: design.footprint?.boundingWidth,
        footprintDepth: design.footprint?.boundingDepth,
        builtUpAreaSqFt: design.totalBuiltUpAreaSqFt,
        rooms: design.rooms.length
      },
      notes: [...outcome.warnings, ...outcome.notes].slice(0, 6)
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, problems: [err?.message || 'The pre-check failed.'] }, { status: 500 });
  }
}
