import { NextResponse } from 'next/server';
import { generateImage, parseDataUrl } from '@/lib/genai/media';
import { EXTERIOR_STYLES, EXTERIOR_VIEWS, buildExteriorPrompt, pick } from '@/lib/rendering/promptBuilder';
import { asDesign, fail, mediaFailure, rateLimited } from '@/lib/rendering/routeUtils';

export const maxDuration = 120;

/** Renders the building facade from the design's real floor count, footprint and openings (and a 3D capture when sent). */
export async function POST(req: Request) {
  if (rateLimited(req, 'render-exterior', 6)) return fail(429, 'Too many render requests. Wait a minute and try again.');
  let body: any;
  try { body = await req.json(); } catch { return fail(400, 'Request body must be JSON.'); }

  const design = asDesign(body?.design);
  if (!design) return fail(400, 'A valid design is required.');

  const style = pick(EXTERIOR_STYLES, body?.style, 'Modern Luxury');
  const view = pick(EXTERIOR_VIEWS, body?.viewAngle, 'front_elevation');
  const reference = parseDataUrl(body?.reference, /^image\/(png|jpeg|webp)$/, 4_000_000);
  const prompt = buildExteriorPrompt(design, style, view, !!reference);

  const result = await generateImage(prompt, reference ? [reference] : [], Date.now() + 100_000);
  if (!result.ok) return mediaFailure(result);

  return NextResponse.json({
    success: true,
    imageUrl: `data:${result.value.mimeType};base64,${result.value.data}`,
    model: result.modelId,
    style,
    viewAngle: view,
    anchoredTo3D: !!reference,
    basis: { floors: design.floorsCount, plot: `${design.plot.width} × ${design.plot.depth} ft` }
  });
}
