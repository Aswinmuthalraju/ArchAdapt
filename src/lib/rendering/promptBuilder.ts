/**
 * Builds render prompts from the design's real geometry (room size, which walls carry windows and doors, floors,
 * plot) so the image model is told what the plan actually contains. Server-safe, no I/O.
 */
import type { FloorPlanOpening, FloorPlanRoom, StructuredDesignJSON } from '@/types/architectural';
import { inferRoomType } from '@/lib/design/roomTypes';

export const INTERIOR_STYLES = {
  'Modern Luxury': 'modern luxury interior, warm neutral palette, marble and smoked oak, brushed brass details, layered indirect lighting',
  Minimalist: 'minimalist interior, white and pale oak, clean lines, hidden storage, very little decoration',
  'Kerala Traditional': 'Kerala traditional interior, teak timber, lime-washed walls, brass lamps, red oxide floors, carved wood details',
  Contemporary: 'contemporary interior, textured plaster, mixed materials, statement lighting, soft colour accents'
} as const;
export type InteriorStyle = keyof typeof INTERIOR_STYLES;

export const LIGHTING = {
  daylight: 'bright natural morning daylight through the windows',
  golden_hour: 'low warm golden-hour sunlight entering through the windows, long soft shadows',
  evening_mood: 'evening, warm 2700K interior lighting with cove and pendant lights, dusk visible in the windows'
} as const;
export type LightingMode = keyof typeof LIGHTING;

export const EXTERIOR_VIEWS = {
  front_elevation: 'straight-on front elevation, camera at eye level facing the road-side facade, minimal perspective distortion',
  isometric_3d: 'elevated three-quarter aerial view from a front corner, showing the roof and two facades',
  street_view: 'street-level perspective from the road, slightly off-axis, with the entrance and gate in view',
  twilight_sunset: 'three-quarter street view at twilight, warm lit windows, deep blue sky'
} as const;
export type ExteriorView = keyof typeof EXTERIOR_VIEWS;

export const EXTERIOR_STYLES = {
  'Modern Luxury': 'modern luxury villa: off-white mineral plaster, travertine cladding, timber battens, bronze-framed glazing, flat roof with slim parapet',
  'Kerala Traditional': 'Kerala traditional house: sloped terracotta tile roof with deep timber eaves, laterite and plaster walls, pillared sit-out',
  Minimalist: 'minimalist house: plain white volumes, recessed openings, concrete accents, flat roof',
  Contemporary: 'contemporary house: mixed plaster, stone and timber, large glazed openings, low-pitch or flat roof'
} as const;
export type ExteriorStyle = keyof typeof EXTERIOR_STYLES;

export const pick = <T extends Record<string, string>>(table: T, key: unknown, fallback: keyof T): keyof T =>
  typeof key === 'string' && Object.hasOwn(table, key) ? (key as keyof T) : fallback;

const TOL = 0.75; // ft: an opening this close to a room edge belongs to that wall

type Side = 'top' | 'bottom' | 'left' | 'right';

/** Which wall of the room (in plan: top = small y) each opening of the given type sits in. */
function openingsBySide(room: FloorPlanRoom, openings: FloorPlanOpening[], types: FloorPlanOpening['type'][]): Record<Side, number> {
  const { x, y, width, height, floorLevel } = room.position;
  const out: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const o of openings) {
    if (!types.includes(o.type)) continue;
    if ((o.floorLevel ?? 0) !== (floorLevel || 0)) continue;
    const inX = o.x >= x - TOL && o.x <= x + width + TOL;
    const inY = o.y >= y - TOL && o.y <= y + height + TOL;
    if (!inX || !inY) continue;
    if (Math.abs(o.y - y) <= TOL) out.top++;
    else if (Math.abs(o.y - (y + height)) <= TOL) out.bottom++;
    else if (Math.abs(o.x - x) <= TOL) out.left++;
    else if (Math.abs(o.x - (x + width)) <= TOL) out.right++;
  }
  return out;
}

const describeSides = (counts: Record<Side, number>, noun: string) => {
  const parts = (Object.keys(counts) as Side[]).filter((s) => counts[s] > 0).map((s) => `${counts[s]} on the ${s} wall`);
  return parts.length ? `${noun}: ${parts.join(', ')}` : `no ${noun}`;
};

export function buildInteriorPrompt(design: StructuredDesignJSON, room: FloorPlanRoom, style: InteriorStyle, lighting: LightingMode, extra: string): string {
  const { width, height, floorLevel } = room.position;
  const type = inferRoomType(room).replace(/_/g, ' ');
  const windows = describeSides(openingsBySide(room, design.openings, ['window', 'sliding_glass']), 'windows');
  const doors = describeSides(openingsBySide(room, design.openings, ['door', 'archway']), 'doors');
  return [
    `Photorealistic architectural interior photograph of a ${type}, as if shot for Architectural Digest. Wide-angle lens, camera at 1.4 m height in one corner looking across the room.`,
    `The room is exactly ${width.toFixed(1)} ft by ${height.toFixed(1)} ft (${Math.round(room.areaSqFt)} sq ft) on floor ${floorLevel || 0} of a ${design.floorsCount}-storey house with a ceiling around 10 ft high.`,
    `Layout constraints from the floor plan, do not contradict them: ${windows}; ${doors}. Do not add windows or doors anywhere else. Plan features: ${room.features.join(', ') || 'none specified'}.`,
    `Style: ${INTERIOR_STYLES[style]}. Lighting: ${LIGHTING[lighting]}.`,
    'Furnish it realistically for its use and its size; leave circulation space. Realistic materials, correct perspective and scale, no text, no people, no watermark.',
    extra ? `Extra direction from the client: ${extra.slice(0, 300)}` : ''
  ].filter(Boolean).join('\n');
}

export function buildExteriorPrompt(design: StructuredDesignJSON, style: ExteriorStyle, view: ExteriorView, hasReference: boolean): string {
  const ground = design.rooms.filter((r) => (r.position.floorLevel || 0) === 0);
  const fp = ground.length
    ? { w: Math.max(...ground.map((r) => r.position.x + r.position.width)) - Math.min(...ground.map((r) => r.position.x)), d: Math.max(...ground.map((r) => r.position.y + r.position.height)) - Math.min(...ground.map((r) => r.position.y)) }
    : { w: design.plot.width, d: design.plot.depth };
  const windows = design.openings.filter((o) => o.isExterior && (o.type === 'window' || o.type === 'sliding_glass')).length;
  return [
    `Photorealistic architectural exterior photograph of a residential building. View: ${EXTERIOR_VIEWS[view]}.`,
    `The building has ${design.floorsCount} storey${design.floorsCount === 1 ? '' : 's'}, a ground-floor footprint of about ${fp.w.toFixed(0)} ft by ${fp.d.toFixed(0)} ft on a ${design.plot.width} ft by ${design.plot.depth} ft plot, road on the ${design.plot.roadSide} side, entrance facing ${design.entranceDirection}. It has about ${windows} exterior windows. Do not add extra storeys.`,
    `Style: ${EXTERIOR_STYLES[style]}. Landscaping appropriate to a plot of this size, a compound wall and gate on the road side, realistic materials and sky.`,
    hasReference ? 'The attached image is a 3D massing of this exact building. Keep its proportions, number of storeys, roof shape and window positions; only add materials, light and surroundings.' : '',
    'No text, no people, no watermark, no floating or impossible structures.'
  ].filter(Boolean).join('\n');
}
