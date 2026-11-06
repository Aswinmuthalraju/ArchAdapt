import { NextResponse } from 'next/server';
import { SiteInfo, LocationInfo, DesignRequirements, DesignPreferences } from '@/types/architectural';
import { generateDesign } from '@/lib/design/pipeline';
import { countBedrooms, countRoomsOfType } from '@/lib/design/roomTypes';
import { validateBriefInput } from '@/lib/design/inputValidation';
import { normalizeSite } from '@/lib/design/plotShapes';

export const maxDuration = 180;

const DEV = process.env.NODE_ENV !== 'production';
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, status: 'BAD_REQUEST', error: 'Request body is not valid JSON.' }, { status: 400 });
  }

  try {
    const { site, location, requirements, preferences, engine, stream: shouldStream } = body as {
      site: SiteInfo;
      location: LocationInfo;
      requirements: DesignRequirements;
      preferences: DesignPreferences;
      engine?: 'auto' | 'local';
      stream?: boolean;
    };
    if (!site || !requirements || !preferences) {
      return NextResponse.json({ success: false, status: 'BAD_REQUEST', error: 'Missing required site or requirements payload.' }, { status: 400 });
    }
    const problems = validateBriefInput(site, requirements);
    if (problems.length) return NextResponse.json({ success: false, status: 'BAD_REQUEST', error: problems[0], violatedConstraints: problems }, { status: 400 });

    if (DEV) console.log(`\n[ARCHADAPT] GENERATION START — ${requirements.bedrooms} bed / ${requirements.bathrooms} bath / ${requirements.floors} floor(s), ${site.plotWidth}x${site.plotDepth} ${site.orientation}, modes: ${(preferences.modes || []).join(',') || 'none'}`);

    const isSse = shouldStream || request.headers.get('accept')?.includes('text/event-stream');

    if (isSse) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: any) => {
            try {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            } catch { /* stream closed by client */ }
          };

          try {
            const outcome = await generateDesign({
              site: normalizeSite(site),
              location: location || { name: 'Site', city: 'Site', country: 'India', lat: 0, lng: 0 },
              requirements,
              preferences: { ...preferences, modes: preferences.modes || [] },
              engine: engine === 'local' ? 'local' : 'auto',
              onStage: (stage, message) => send('stage', { stage, message })
            });

            if (outcome.status !== 'OK') {
              send('failure', {
                success: false,
                status: outcome.status,
                error: outcome.reason,
                reason: outcome.reason,
                violatedConstraints: outcome.violatedConstraints,
                attempts: outcome.attempts,
                canUseLocalEngine: outcome.canUseLocalEngine
              });
            } else {
              const { design } = outcome;
              send('complete', {
                success: true,
                status: 'OK',
                design,
                rationale: design.rationale,
                aiModel: outcome.modelId,
                engine: outcome.engine,
                fallbackUsed: outcome.engine !== 'gemini',
                notice: outcome.notice || null,
                attempts: outcome.attempts,
                validationWarnings: outcome.warnings,
                layoutNotes: outcome.notes,
                validation: {
                  passed: true,
                  requestedBedrooms: requirements.bedrooms,
                  requestedFloors: requirements.floors,
                  generatedBedrooms: countBedrooms(design),
                  generatedBathrooms: countRoomsOfType(design, 'bathroom'),
                  generatedFloors: design.floorsCount
                }
              });
            }
          } catch (err: any) {
            send('error', { success: false, status: 'INTERNAL_ERROR', error: err?.message || 'Internal generation error' });
          } finally {
            try { controller.close(); } catch { /* ignore */ }
          }
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        }
      });
    }

    const outcome = await generateDesign({
      site: normalizeSite(site),
      location: location || { name: 'Site', city: 'Site', country: 'India', lat: 0, lng: 0 },
      requirements,
      preferences: { ...preferences, modes: preferences.modes || [] },
      engine: engine === 'local' ? 'local' : 'auto'
    });

    if (outcome.status !== 'OK') {
      if (DEV) console.warn(`[ARCHADAPT] GENERATION ${outcome.status} after ${outcome.attempts} attempt(s): ${outcome.reason}`, outcome.violatedConstraints);
      return NextResponse.json(
        {
          success: false,
          status: outcome.status,
          error: outcome.reason,
          reason: outcome.reason,
          violatedConstraints: outcome.violatedConstraints,
          attempts: outcome.attempts,
          canUseLocalEngine: outcome.canUseLocalEngine
        },
        { status: outcome.status === 'ENGINE_UNAVAILABLE' ? 503 : 422 }
      );
    }

    const { design } = outcome;
    if (DEV) {
      console.log(`[ARCHADAPT] GENERATION OK — engine: ${outcome.engine} (${outcome.modelId}), attempts: ${outcome.attempts}, rooms: ${design.rooms.length}, bedrooms: ${countBedrooms(design)}, floors: ${design.floorsCount}`);
      if (outcome.warnings.length) console.log('  warnings:', outcome.warnings);
    }

    return NextResponse.json({
      success: true,
      status: 'OK',
      design,
      rationale: design.rationale,
      aiModel: outcome.modelId,
      engine: outcome.engine,
      fallbackUsed: outcome.engine !== 'gemini',
      notice: outcome.notice || null,
      attempts: outcome.attempts,
      validationWarnings: outcome.warnings,
      layoutNotes: outcome.notes,
      validation: {
        passed: true,
        requestedBedrooms: requirements.bedrooms,
        requestedFloors: requirements.floors,
        generatedBedrooms: countBedrooms(design),
        generatedBathrooms: countRoomsOfType(design, 'bathroom'),
        generatedFloors: design.floorsCount
      }
    });
  } catch (err: any) {
    console.error('[ARCHADAPT] GENERATION UNHANDLED ERROR:', err?.message || err);
    return NextResponse.json({ success: false, status: 'INTERNAL_ERROR', error: err?.message || 'Internal generation error' }, { status: 500 });
  }
}
