import { NextResponse } from 'next/server';
import { parseDataUrl, readDocumentAsJson } from '@/lib/genai/media';
import { fail, mediaFailure, rateLimited } from '@/lib/rendering/routeUtils';

export const maxDuration = 120;

const SYSTEM = `You read architectural floor plans (scans, photos, hand sketches, PDFs). Extract ONLY what is legible in the document.
Never invent rooms, dimensions or areas. If a value is not written or cannot be measured from a labelled dimension, use null.
Return JSON: {"isFloorPlan": boolean, "plot": {"widthFt": number|null, "depthFt": number|null}, "floors": number|null,
"rooms": [{"name": string, "type": "living|dining|kitchen|bedroom|master_bedroom|bathroom|study|puja|utility|store|parking|balcony|courtyard|stair|other",
"widthFt": number|null, "depthFt": number|null, "areaSqFt": number|null, "floor": number}], "notes": [string]}.
Convert metres to feet. "floor" is 0 for ground. "notes" lists anything ambiguous or unreadable.`;

const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

/** Reads an uploaded plan with a vision model and returns what it could actually read, with nulls for what it could not. */
export async function POST(req: Request) {
  if (rateLimited(req, 'ingest', 5)) return fail(429, 'Too many uploads. Wait a minute and try again.');
  let body: any;
  try { body = await req.json(); } catch { return fail(400, 'Request body must be JSON.'); }

  const file = parseDataUrl(body?.file, /^(image\/(png|jpeg|webp)|application\/pdf)$/, 10_000_000);
  if (!file) return fail(400, 'Upload a PNG, JPG, WebP or PDF under 10 MB.');

  const result = await readDocumentAsJson(SYSTEM, 'Extract the floor plan data from this document.', file, Date.now() + 100_000);
  if (!result.ok) return mediaFailure(result);

  const raw = result.value as any;
  if (!raw?.isFloorPlan) return fail(422, 'This file does not look like a floor plan or sketch of one.');

  const rooms = (Array.isArray(raw.rooms) ? raw.rooms : []).slice(0, 60).map((r: any) => {
    const widthFt = num(r?.widthFt, 2, 200);
    const depthFt = num(r?.depthFt, 2, 200);
    const stated = num(r?.areaSqFt, 10, 20000);
    return {
      name: String(r?.name || 'Room').slice(0, 60),
      type: String(r?.type || 'other'),
      floor: Math.max(0, Math.min(9, Math.round(Number(r?.floor) || 0))),
      widthFt, depthFt,
      areaSqFt: stated ?? (widthFt && depthFt ? Math.round(widthFt * depthFt) : null)
    };
  });
  if (!rooms.length) return fail(422, 'No rooms could be read from this document. Try a clearer or higher-resolution image.');

  return NextResponse.json({
    success: true,
    model: result.modelId,
    plot: { widthFt: num(raw?.plot?.widthFt, 5, 1000), depthFt: num(raw?.plot?.depthFt, 5, 1000) },
    floors: num(raw?.floors, 1, 10),
    rooms,
    notes: (Array.isArray(raw.notes) ? raw.notes : []).slice(0, 10).map((n: unknown) => String(n).slice(0, 200))
  });
}
