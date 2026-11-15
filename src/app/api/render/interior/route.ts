import { NextResponse } from 'next/server';
import { generateImage } from '@/lib/genai/media';
import { INTERIOR_STYLES, LIGHTING, buildInteriorPrompt, pick } from '@/lib/rendering/promptBuilder';
import { asDesign, fail, mediaFailure, rateLimited } from '@/lib/rendering/routeUtils';

export const maxDuration = 120;

/** Renders one room of the user's own design. The prompt is built from that room's real dimensions, windows and doors. */
export async function POST(req: Request) {
  if (rateLimited(req, 'render-interior', 6)) return fail(429, 'Too many render requests. Wait a minute and try again.');
  let body: any;
  try { body = await req.json(); } catch { return fail(400, 'Request body must be JSON.'); }

  const design = asDesign(body?.design);
  if (!design) return fail(400, 'A valid design is required.');
  const room = design.rooms.find((r) => r.id === body?.roomId);
  if (!room) return fail(404, 'That room is not part of this design.');

  const style = pick(INTERIOR_STYLES, body?.style, 'Modern Luxury');
  const lighting = pick(LIGHTING, body?.lightingMode, 'daylight');
  const prompt = buildInteriorPrompt(design, room, style, lighting, typeof body?.customPrompt === 'string' ? body.customPrompt : '');

  const result = await generateImage(prompt, [], Date.now() + 100_000);
  if (!result.ok) return mediaFailure(result);

  return NextResponse.json({
    success: true,
    imageUrl: `data:${result.value.mimeType};base64,${result.value.data}`,
    model: result.modelId,
    roomId: room.id,
    roomName: room.name,
    style,
    lightingMode: lighting,
    // Shown to the user so the render can be checked against the plan.
    basis: { dimensions: room.dimensions, areaSqFt: Math.round(room.areaSqFt), floor: room.position.floorLevel || 0 }
  });
}
