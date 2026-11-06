import { DesignConstraints, DesignProgram, LocationInfo, SiteInfo } from '@/types/architectural';
import { buildableEnvelope } from '@/lib/design/layoutEngine';
import { planCompass } from '@/lib/geometry/planGeometry';
import { ROOM_TYPE_SPECS } from '@/lib/design/roomTypes';
import { styleDirectiveBlock } from '@/lib/design/styleBlueprints';
import { factsBlock, ExtractedFacts } from './briefing';

const AUTHORABLE_TYPES = ['entrance', 'living', 'dining', 'kitchen', 'utility', 'master_bedroom', 'bedroom', 'guest_room', 'bathroom', 'study', 'store', 'puja', 'parking', 'balcony', 'courtyard', 'lounge', 'dressing', 'terrace'] as const;

export const SYSTEM_ARCHITECTURAL_PROMPT = `
You are ArchAdapt AI, a senior residential architect. You do the architectural reasoning; a deterministic
layout engine then turns your room programme into exact geometry, doors, windows and a staircase.

You therefore do NOT output coordinates. You output a ROOM PROGRAMME: which rooms exist, how large they
are, which floor and zone each sits in, and how rooms relate to each other. Every decision you make
changes the resulting plan, so reason from this site, this family and these modes, not from a stock layout.

HOW THE PLAN IS MADE
- A spatial optimiser searches many arrangements of your rooms inside the real buildable outline (it may be
  irregular) and keeps the one that best satisfies what you declare; a geometry stage then draws walls, doors,
  windows and the stair. So think in RELATIONSHIPS and PRIORITIES, not positions.
- The optimiser enforces and trades off: "attachedTo" (shares a wall and a door), CONNECTED_TO / ADJACENT_TO
  (must touch), NEAR (should be close), PRIVATE_FROM (kept apart), plus daylight, privacy, plumbing and circulation.
  Your "intent" block below states, with weights, which relationships matter most for THIS household.
- "band" and "side" are only weak position hints (front = toward the road, rear = away from it; left/right as seen
  from the road; compass directions are given to you). Use them for statements like "quiet rooms at the back",
  never as a layout.
- The road is always the plan FRONT. The engine adds stairs, passages, landings and roof terraces itself.
  Never output rooms of type stair, passage or void.

HARD RULES
- Hard requirements must be met exactly. Never reduce the bedroom count, bathroom count or floor count,
  and never omit a requested space.
- If the hard requirements genuinely cannot fit the buildable envelope, do not shrink the brief. Return
  {"status":"INFEASIBLE","reason":"...","violatedConstraints":["..."]} instead.
- Output a single JSON object and nothing else.
`.trim();

export interface ProgramPromptInput {
  site: SiteInfo;
  location: LocationInfo;
  constraints: DesignConstraints;
  customRequirements?: string;
  secondaryStyle?: string;
  ragContext: string;
  /** Facts read from the client's own notes by the rule-based reader. */
  facts?: ExtractedFacts;
}

function siteBlock({ site, location, constraints }: ProgramPromptInput): string {
  const envelope = buildableEnvelope(site);
  const compass = planCompass(site.orientation);
  return `SITE
- Plot: ${site.plotWidth} ft wide x ${site.plotDepth} ft deep, facing ${site.orientation} (the road is on the ${site.orientation} side).
- Setbacks: front ${envelope.setbacks.front} ft, rear ${envelope.setbacks.rear} ft, sides ${envelope.setbacks.left} ft / ${envelope.setbacks.right} ft.
- Buildable envelope: ${envelope.width} ft wide x ${envelope.depth} ft deep = ${Math.round(envelope.width * envelope.depth)} sq ft per floor. Rooms on one floor, plus about 15% for the stair, passages and walls, must fit in this.
- Plan directions: front = ${compass.front}, rear = ${compass.rear}, left = ${compass.left}, right = ${compass.right}.
- Location: ${location.city || location.name}, ${location.country}${location.climateZone ? `; climate: ${location.climateZone}` : ''}.
- Floors: ${constraints.floors} (floor levels 0 to ${constraints.floors - 1}).`;
}

function requirementsBlock({ constraints, customRequirements, secondaryStyle }: ProgramPromptInput): string {
  const modes = constraints.modes;
  const modeRules: string[] = [];
  if (modes.includes('climate_adaptive')) modeRules.push('- climate_adaptive: put living rooms and bedrooms on the cooler sides and service rooms, parking and the stair on the hotter side; prefer rooms with two external walls for cross-ventilation; use a deep shaded entrance; say in modeConsiderations which side you used for what.');
  if (modes.includes('life_stage')) modeRules.push('- life_stage: at least one bedroom with its own attached bathroom on floor 0 (HARD), mark both "accessible": true and size them generously; keep a flexible room on floor 0 that could become a bedroom.');
  if (modes.includes('budget_first')) modeRules.push('- budget_first: keep room areas near the lower end of the ranges, keep wet rooms (kitchen, utility, bathrooms) on the same side on every floor, and avoid rooms that were not asked for.');
  if (modes.includes('renovation')) modeRules.push('- renovation: no survey of the existing building is available, so keep a regular arrangement that stacks rooms on shared wall lines, and say so in modeConsiderations.');

  return `HARD REQUIREMENTS (must all be satisfied exactly)
- Bedrooms: exactly ${constraints.bedrooms} rooms of type "master_bedroom" or "bedroom" (exactly one master_bedroom).
- Bathrooms: at least ${constraints.bathrooms} rooms of type "bathroom".
- Floors: exactly ${constraints.floors}; every floor level must hold at least one habitable room.
- Parking: ${constraints.parkingCars > 0 ? `one "parking" room sized for ${constraints.parkingCars} car(s) (about 160 sq ft per car), in the front zone of floor 0` : 'none required'}.
- A "living" room, a "kitchen" and an "entrance" on floor 0.
- Requested spaces that must exist: ${constraints.requiredSpaces.filter((s) => s !== 'living' && s !== 'kitchen').join(', ') || 'none beyond the above'}.
  (dining → type "dining"; balcony → "balcony"; studyWorkspace → "study"; storage → "store"; prayerRoom → "puja"; courtyard → "courtyard" on floor 0; guestRoom → "guest_room"; outdoorGarden → leave open plot area, no room needed.)

SOFT PREFERENCES (optimise where the hard requirements allow)
- Family of ${constraints.familySize}; budget tier ${constraints.budgetRange}; style ${constraints.style}${secondaryStyle ? ` with ${secondaryStyle} influence` : ''}.
${customRequirements ? `- The client's own words: "${customRequirements.replace(/"/g, "'")}"` : '- No additional notes from the client.'}

${styleDirectiveBlock(constraints)}

ACTIVE MODES: ${modes.join(', ') || 'none'}
${modeRules.join('\n') || '- No special mode rules.'}`;
}

const SCHEMA_BLOCK = `OUTPUT (JSON object)
{
  "status": "OK",
  "planningType": "courtyard_centered | linear_circulation | zoned_wings | compact_core | l_shaped",
  "circulationType": "central | peripheral | spine",
  "stairSide": "left | right",
  "rooms": [
    {
      "id": "room-living",
      "name": "Living Room",
      "type": "${AUTHORABLE_TYPES.join(' | ')}",
      "floor": 0,
      "areaSqFt": 200,
      "band": "front | middle | rear",
      "side": "left | center | right",
      "required": true,
      "attachedTo": "id of the room it must open from, or omit",
      "accessible": false,
      "relationships": [{ "type": "ADJACENT_TO | CONNECTED_TO | ATTACHED_TO | NEAR | PRIVATE_FROM | ACCESSIBLE_FROM", "target": "room id" }],
      "features": ["short factual notes about this room"]
    }
  ],
  "intent": {
    "priorities": ["up to 5 short phrases in the client's terms, most important first"],
    "adjacency": [{ "a": "room id or room type", "b": "room id or room type", "weight": 7, "kind": "adj | near | avoid" }],
    "preferredArchetypes": ["spine | hub | wings | courtyard | compact"],
    "reasons": ["one sentence each, linking something the client said or the site demands to a planning decision"]
  },
  "architecturalBrief": {
    "planningIntent": "", "siteResponse": "", "orientationStrategy": "", "publicPrivateStrategy": "", "serviceStrategy": "",
    "circulationStrategy": "", "climateStrategy": "", "accessibilityStrategy": "", "styleStrategy": ""
  },
  "rationale": "3-5 sentences explaining why the rooms are zoned and sized this way for THIS brief.",
  "circulationNotes": "How a person walks from the entrance to each group of rooms.",
  "styleFeatures": ["..."],
  "modeConsiderations": [{ "mode": "climate_adaptive | life_stage | budget_first | renovation", "note": "what this mode changed in the programme" }],
  "appearance": { "wallColor": "#RRGGBB", "roofColor": "#RRGGBB", "frameColor": "#RRGGBB", "accentMaterial": "wood | stone | concrete | neutral" }
}

ROOM AREA RANGES (sq ft: minimum / typical)
${AUTHORABLE_TYPES.map((type) => `${type} ${ROOM_TYPE_SPECS[type].minArea}/${ROOM_TYPE_SPECS[type].targetArea}`).join(', ')}

PROGRAMME RULES
- Give rooms their normal areas from the ranges above. Do not inflate them to fill a large plot: the layout engine enlarges every room to suit the plot, so on a generous site the house grows with it.
- PLOT GROWTH RULE (for plots >= 5,000 sq ft up to 30,000 sq ft): On large plots, the programme should grow sensibly into dedicated zones (foyer, family lounge, separate dining, utility yard, study/pooja per style) rather than merely stretching rooms. Maintain ground coverage between 20% and 45% with generous garden setbacks. Upper floors step in with purposeful private terraces rather than large filler hatched blocks.
- Each zone of a floor holds at most about (envelope width / 9) rooms side by side; spread bedrooms across the front and rear zones of upper floors instead of lining them all up in one zone.
- The entrance is attachedTo the living room. A utility is attachedTo the kitchen. An ensuite bathroom is attachedTo its bedroom; a shared bathroom has no attachedTo and belongs in the rear zone near the bedrooms.
- On every upper floor include one "lounge" (landing/family room) in the middle zone; the upper rooms open from it.
- Keep living → dining → kitchen in an unbroken sequence (use CONNECTED_TO), and keep bedrooms PRIVATE_FROM the living room. In practice: living in the front zone; dining in the middle zone on the SAME side as the living room; kitchen at the far end of the middle zone from the stair. A courtyard goes in the middle zone of floor 0 and the engine places it at the centre of that zone: it needs a walled room on each side of it (the stair counts), the living room in front and rooms behind, so it is enclosed on all four sides. It must never sit between dining and kitchen, and must be at least 81 sq ft with no side under 9 ft. If the envelope cannot enclose one, leave it out unless the client asked for it.
- Only include rooms the brief asks for, plus an entrance, one utility, and one lounge per upper floor. Do not add guest rooms, studies, prayer rooms, stores or extra bathrooms that were neither requested nor required by the STYLE MANDATE.
- Use relationships to state the reasoning the geometry must honour; do not list relationships you do not need.
- INTENT: at most 12 adjacency entries, only for relationships that matter for THIS household. Weight 8-10 = must touch, 5-7 = strongly preferred, 1-4 = mild. kind "avoid" keeps two rooms apart (a bedroom from the street-facing living room). preferredArchetypes: spine = a passage separates public rooms from bedrooms; hub = bedrooms open off a family lounge; wings = public wing and private wing; courtyard = rooms around an open court; compact = living-dining-kitchen as one open space. Choose at most two, and say why in "reasons".
- Never invent a hard requirement the client did not state. Spaces the client mentioned in their notes but did not switch on in the form may be added as rooms with "required": false.`;

export function buildProgramPrompt(input: ProgramPromptInput, feedback?: string[]): string {
  return [
    'DESIGN A ROOM PROGRAMME FOR THIS HOUSE.',
    siteBlock(input),
    requirementsBlock(input),
    input.facts ? factsBlock(input.facts) : '',
    `STYLE AND DESIGN KNOWLEDGE (retrieved for this ${input.constraints.style} brief; the style items define how this house must differ from other styles)\n${input.ragContext}`,
    SCHEMA_BLOCK,
    feedback?.length
      ? `YOUR PREVIOUS PROGRAMME FAILED VALIDATION BECAUSE:\n${feedback.map((line) => `- ${line}`).join('\n')}\nReturn a corrected programme that fixes every point above while still meeting all hard requirements.`
      : ''
  ].filter(Boolean).join('\n\n');
}

function programSummary(program: DesignProgram) {
  return {
    planningType: program.planningType,
    stairSide: program.stairSide,
    rooms: program.rooms.map((room) => ({ id: room.id, name: room.name, type: room.type, floor: room.floor, areaSqFt: room.areaSqFt, band: room.band, side: room.side, attachedTo: room.attachedTo }))
  };
}

export function buildAlternativeProgramPrompt(input: ProgramPromptInput, current: DesignProgram, feedback?: string[]): string {
  return `${buildProgramPrompt(input, feedback)}

THIS IS AN ALTERNATIVE CONCEPT. The client already has the programme below and wants a genuinely different
spatial organisation for the same site and the same hard requirements. Change the planning strategy: which
zone and side the main rooms take, how bedrooms are distributed between floors and zones, where the stair
and any courtyard sit. Do not return the same arrangement with different names or areas.

CURRENT PROGRAMME (for contrast only):
${JSON.stringify(programSummary(current))}`;
}

export function buildWhatIfDeltaPrompt(input: {
  site: SiteInfo;
  constraints: DesignConstraints;
  program: DesignProgram;
  message: string;
  feedback?: string[];
}): string {
  const envelope = buildableEnvelope(input.site);
  return `MODIFY AN EXISTING HOUSE DESIGN. Return only the CHANGES, not a new design.

CURRENT PROGRAMME:
${JSON.stringify(programSummary(input.program))}

SITE: buildable envelope ${envelope.width} ft x ${envelope.depth} ft (${Math.round(envelope.width * envelope.depth)} sq ft per floor), ${input.constraints.floors} floor(s), plot faces ${input.site.orientation}.
CURRENT HARD REQUIREMENTS: ${input.constraints.bedrooms} bedrooms, ${input.constraints.bathrooms} bathrooms, ${input.constraints.floors} floors.

THE CLIENT ASKS: "${input.message.replace(/"/g, "'")}"

Return a JSON object:
{
  "understood": true,
  "summary": "one sentence describing the change",
  "tradeOffs": ["consequences the client should know about"],
  "ops": [
    { "op": "add_room", "type": "${AUTHORABLE_TYPES.join(' | ')}", "name": "optional", "floor": 0, "areaSqFt": 130, "band": "front | middle | rear", "side": "left | center | right", "attachedTo": "room id or omit" },
    { "op": "remove_room", "target": "room id" },
    { "op": "resize_room", "target": "room id", "areaSqFt": 150 },
    { "op": "move_room", "target": "room id", "floor": 0, "band": "front | middle | rear", "side": "left | center | right", "nextTo": "room id or omit" },
    { "op": "rename_room", "target": "room id", "name": "New Name" },
    { "op": "add_floor" },
    { "op": "set_appearance", "wallColor": "#RRGGBB", "roofColor": "#RRGGBB", "frameColor": "#RRGGBB", "accentMaterial": "wood | stone | concrete | neutral" }
  ]
}

RULES
- Use the fewest ops that carry out the request. Do not touch rooms the client did not mention.
- Refer to existing rooms by their exact "id".
- A colour or material request uses only set_appearance.
- A new ensuite bathroom needs "attachedTo" set to its bedroom's id.
- If you cannot tell what the client wants, return {"understood": false, "summary": "what is unclear", "ops": []}.
- Do not judge feasibility yourself; the layout engine will test whether the change fits.
${input.feedback?.length ? `\nYOUR PREVIOUS ANSWER COULD NOT BE APPLIED BECAUSE:\n${input.feedback.map((line) => `- ${line}`).join('\n')}\nReturn corrected ops.` : ''}`;
}
