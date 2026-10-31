import { DesignConstraints, DesignProgram, RoomType } from '@/types/architectural';
import { NormalizedStyle, normalizeStyleName } from './styleNormalizer';

/**
 * How firmly a style's signature is applied to a brief.
 * 'full' = every mandate and the full sizing character; 'reduced' = the same, less the courtyard, for plots too small
 * to enclose one; 'core' = only the defining space, half-strength sizing;
 * 'none' = the user's brief untouched (used when the plot cannot hold the style's signature rooms).
 */
export type StyleLevel = 'full' | 'reduced' | 'core' | 'none';

export interface StyleBlueprint {
  style: NormalizedStyle;
  label: string;
  /** Requested-space keys (DesignRequirements.spaces) this style needs in order to read as itself. */
  spaces: string[];
  /** The one space without which the style loses its identity; kept at 'core' level. */
  signature: string[];
  /** Relative room sizing against the neutral standard. */
  areaFactor: Partial<Record<RoomType, number>>;
  /** Every bedroom gets its own bathroom; the master gets a dressing suite. */
  ensuiteAll?: boolean;
  masterDressing?: boolean;
  minParkingCars?: number;
  /** Rooms this style leaves out unless the client asks for them. */
  omit?: RoomType[];
  planningType: DesignProgram['planningType'];
  circulationType: DesignProgram['circulationType'];
  /** The tradition's own name for its courtyard, used when telling the client it was left out. */
  courtyardTerm?: string;
  /** Smallest entrance/threshold area (sq ft) that carries the style's arrival sequence. */
  minEntranceArea: number;
  /** Instructions given to the AI planner so its programme carries the style. */
  directives: string[];
}

const BLUEPRINTS: Record<NormalizedStyle, StyleBlueprint> = {
  kerala_traditional: {
    style: 'kerala_traditional',
    label: 'Kerala Traditional',
    spaces: ['courtyard', 'prayerRoom', 'storage'],
    signature: ['courtyard'],
    areaFactor: { entrance: 1.9, living: 1.1, courtyard: 1.35, puja: 1.5, kitchen: 1.1, store: 1.3 },
    planningType: 'courtyard_centered',
    circulationType: 'central',
    courtyardTerm: 'Nadumuttam',
    minEntranceArea: 60,
    directives: [
      'Arrival is a deep Poomukham (sit-out) verandah: the "entrance" room must be generous (at least 60 sq ft) and attached to the living room.',
      'A Nadumuttam open-to-sky "courtyard" on floor 0 is the heart of the plan; rooms address it rather than a corridor. Use planningType "courtyard_centered" and circulationType "central".',
      'Include a "puja" room and a "store" (the traditional Aara). The kitchen sits on the hotter side, away from the puja.',
      'Prefer a compact, rectangular, load-bearing footprint with deep eaves; avoid cantilevers and open-plan glazing.'
    ]
  },
  traditional_indian: {
    style: 'traditional_indian',
    label: 'Traditional Indian',
    spaces: ['courtyard', 'prayerRoom', 'guestRoom'],
    signature: ['courtyard'],
    areaFactor: { entrance: 1.5, living: 1.15, courtyard: 1.3, puja: 1.5, guest_room: 1.1, dining: 1.1 },
    planningType: 'courtyard_centered',
    circulationType: 'central',
    courtyardTerm: 'Chowk',
    minEntranceArea: 50,
    directives: [
      'Organise the house around a central "courtyard" (the Chowk/Aangan) on floor 0; the rooms form a ring around it. Use planningType "courtyard_centered".',
      'The "living" room is the Baithak: formal, near the entrance, with a separate "guest_room" so visitors never enter the family zone.',
      'Include a "puja" room placed away from the kitchen and bathrooms.',
      'Use a verandah-style "entrance" with a jali screen, at least 50 sq ft.'
    ]
  },
  colonial: {
    style: 'colonial',
    label: 'Colonial',
    spaces: ['dining', 'studyWorkspace', 'balcony'],
    signature: ['dining'],
    areaFactor: { entrance: 2.1, living: 1.25, dining: 1.3, master_bedroom: 1.15, bedroom: 1.1, study: 1.3, balcony: 1.3 },
    planningType: 'zoned_wings',
    circulationType: 'central',
    minEntranceArea: 75,
    directives: [
      'Formal symmetrical planning: a colonnaded portico ("entrance", at least 75 sq ft) opens to a grand "living" room, with "dining" directly beyond. Use planningType "zoned_wings".',
      'A separate "study" serves as the library/office; a veranda "balcony" on the upper floor (or a rear sit-out on a single storey) completes the colonnade.',
      'Rooms are generous and high-ceilinged: size living, dining and bedrooms toward the top of their ranges.',
      'No open-plan merging of living, dining and kitchen; each is a distinct room with its own door.'
    ]
  },
  tropical: {
    style: 'tropical',
    label: 'Tropical',
    spaces: ['courtyard', 'balcony', 'outdoorGarden'],
    signature: ['courtyard'],
    areaFactor: { entrance: 1.7, living: 1.15, courtyard: 1.25, balcony: 1.6, dining: 1.1 },
    planningType: 'courtyard_centered',
    circulationType: 'peripheral',
    courtyardTerm: 'open-to-sky court',
    minEntranceArea: 55,
    directives: [
      'Indoor and outdoor must interlock: include an open-to-sky "courtyard" on floor 0, a generous "balcony"/veranda (at least 70 sq ft) and leave open garden area on the plot. Use circulationType "peripheral" so passages run along open edges.',
      'Rooms are one room deep wherever possible so every habitable room gets cross-ventilation; avoid deep, windowless middle rooms.',
      'The "entrance" is a wide shaded breeze porch of at least 55 sq ft.'
    ]
  },
  minimalist: {
    style: 'minimalist',
    label: 'Minimalist',
    spaces: ['storage'],
    signature: ['storage'],
    areaFactor: { entrance: 0.75, living: 0.95, dining: 0.9, bedroom: 0.9, master_bedroom: 0.92, kitchen: 0.9, bathroom: 0.9, store: 1.2 },
    omit: ['utility'],
    planningType: 'compact_core',
    circulationType: 'spine',
    minEntranceArea: 28,
    directives: [
      'Compact, efficient and quiet: use planningType "compact_core" and circulationType "spine". Keep every room at the lower-to-middle end of its range.',
      'Provide a "store" for concealed storage so the other rooms stay uncluttered. Do not add a separate utility room, courtyard, prayer room, guest room or any room the client did not ask for.',
      'A small recessed "entrance" (28-40 sq ft) is enough; the living, dining and kitchen form one continuous, uninterrupted sequence.'
    ]
  },
  modern: {
    style: 'modern',
    label: 'Modern',
    spaces: [],
    signature: [],
    areaFactor: { living: 1.15, kitchen: 1.05, dining: 1.05, entrance: 0.9 },
    planningType: 'linear_circulation',
    circulationType: 'spine',
    minEntranceArea: 28,
    directives: [
      'Open and orthogonal: use planningType "linear_circulation" and circulationType "spine". Make the living room the largest room, with dining and kitchen flowing from it.',
      'Keep the entrance compact; spend the area on the living and kitchen spaces.'
    ]
  },
  contemporary: {
    style: 'contemporary',
    label: 'Contemporary',
    spaces: ['balcony', 'studyWorkspace'],
    signature: ['balcony'],
    areaFactor: { living: 1.2, lounge: 1.2, balcony: 1.5, study: 1.2, entrance: 1.0 },
    planningType: 'l_shaped',
    circulationType: 'peripheral',
    minEntranceArea: 35,
    directives: [
      'Asymmetric, sculptural planning: use planningType "l_shaped" and circulationType "peripheral". Stagger the upper-floor rooms relative to the ground floor so the massing steps.',
      'Include a "study" (home office) and a generous "balcony" (at least 60 sq ft) that extends the main living area outdoors.',
      'Give the upper-floor "lounge" extra area as a double-use family and work space.'
    ]
  },
  modern_luxury: {
    style: 'modern_luxury',
    label: 'Modern Luxury',
    spaces: ['studyWorkspace', 'balcony', 'guestRoom'],
    signature: ['balcony'],
    areaFactor: { living: 1.5, dining: 1.3, kitchen: 1.3, master_bedroom: 1.4, bedroom: 1.2, bathroom: 1.3, dressing: 1.5, entrance: 1.5, balcony: 1.6, study: 1.3, lounge: 1.3, guest_room: 1.15 },
    ensuiteAll: true,
    masterDressing: true,
    minParkingCars: 2,
    planningType: 'zoned_wings',
    circulationType: 'central',
    minEntranceArea: 80,
    directives: [
      'Generous, private and ceremonial: use planningType "zoned_wings". A grand "entrance" (at least 80 sq ft) leads to a very large "living" room (260+ sq ft).',
      'EVERY bedroom has its own attached bathroom (attachedTo the bedroom), and the master bedroom has a "dressing" room attachedTo it.',
      'Include a "study", a "guest_room", a large "balcony"/terrace (at least 80 sq ft), and parking for at least two cars.',
      'Size every room toward the top of its range; luxury here means space and privacy, not extra rooms of little use.'
    ]
  }
};

export const styleBlueprint = (styleName?: string): StyleBlueprint => BLUEPRINTS[normalizeStyleName(styleName)];

export const STYLE_BLUEPRINTS = BLUEPRINTS;

/** 1 at 'full' and 'reduced', halfway at 'core', neutral at 'none'. */
const strength = (level: StyleLevel | undefined) => (level === 'none' ? 0 : level === 'core' ? 0.5 : 1);

/** Sizing multiplier for a room type under the active style. */
export function styleAreaFactor(constraints: Pick<DesignConstraints, 'style' | 'styleLevel'>, type: RoomType): number {
  const factor = styleBlueprint(constraints.style).areaFactor[type] ?? 1;
  return 1 + (factor - 1) * strength(constraints.styleLevel);
}

/**
 * Returns the brief with the style's signature spaces switched on. Nothing the client chose is ever switched off.
 */
export function applyStyleMandates(base: DesignConstraints, level: StyleLevel): DesignConstraints {
  const blueprint = styleBlueprint(base.style);
  if (level === 'none') return { ...base, styleLevel: 'none' };
  const wanted = level === 'full' ? blueprint.spaces : level === 'reduced' ? blueprint.spaces.filter((space) => space !== 'courtyard') : blueprint.signature;
  const requiredSpaces = Array.from(new Set([...base.requiredSpaces, ...wanted]));
  const next: DesignConstraints = { ...base, requiredSpaces, styleLevel: level };
  if (level === 'full' || level === 'reduced') {
    if (blueprint.ensuiteAll) next.bathrooms = Math.max(base.bathrooms, base.bedrooms);
    if (blueprint.minParkingCars) next.parkingCars = Math.max(base.parkingCars, blueprint.minParkingCars);
  }
  return next;
}

/** Plain-language description of what the style added to the client's brief. */
export function describeStyleAdditions(base: DesignConstraints, applied: DesignConstraints): string[] {
  const blueprint = styleBlueprint(base.style);
  const labels: Record<string, string> = {
    courtyard: 'a courtyard', prayerRoom: 'a puja room', storage: 'a store', guestRoom: 'a guest room', dining: 'a dining room',
    studyWorkspace: 'a study', balcony: 'a balcony or terrace', outdoorGarden: 'open garden area'
  };
  const added = applied.requiredSpaces.filter((space) => !base.requiredSpaces.includes(space)).map((space) => labels[space] || space);
  const notes: string[] = [];
  if (added.length) notes.push(`${blueprint.label} style added ${added.join(', ')} to the brief.`);
  if (applied.bathrooms > base.bathrooms) notes.push(`${blueprint.label} style gives every bedroom its own bathroom (${applied.bathrooms} in total).`);
  if (applied.parkingCars > base.parkingCars) notes.push(`${blueprint.label} style provides parking for ${applied.parkingCars} cars.`);
  return notes;
}

/** Prompt text that tells the AI planner what this style demands of the programme. */
export function styleDirectiveBlock(constraints: DesignConstraints): string {
  if (constraints.styleLevel === 'none') return '';
  const blueprint = styleBlueprint(constraints.style);
  const lines = blueprint.directives.filter((line) => constraints.styleLevel !== 'reduced' || !/courtyard/i.test(line)).map((line) => `- ${line}`);
  if (constraints.styleLevel === 'reduced') {
    lines.push('- This plot is too small for a courtyard enclosed by rooms: do NOT include a "courtyard". Carry the style through the other rooms and their proportions instead.');
  }
  return `STYLE MANDATE: ${blueprint.label}. The programme must read as this style in its plan, not only in its names.\n${lines.join('\n')}`;
}

/**
 * Checks that a planner's programme carries the style. Returns problems phrased as instructions
 * so they can be fed straight back to the planner.
 */
export function checkStyleConformance(program: DesignProgram, constraints: DesignConstraints): string[] {
  if (constraints.styleLevel === 'none') return [];
  const blueprint = styleBlueprint(constraints.style);
  const errors: string[] = [];
  const rooms = program.rooms;
  const entrance = rooms.filter((room) => room.type === 'entrance').reduce((total, room) => total + room.areaSqFt, 0);
  const needed = Math.round(blueprint.minEntranceArea * (strength(constraints.styleLevel) === 1 ? 1 : 0.8));
  if (blueprint.minEntranceArea > 40 && entrance < needed) {
    errors.push(`${blueprint.label} style needs a substantial arrival space: make the "entrance" at least ${needed} sq ft.`);
  }
  if (constraints.styleLevel === 'full' || constraints.styleLevel === 'reduced') {
    if (blueprint.masterDressing && !rooms.some((room) => room.type === 'dressing')) {
      errors.push(`${blueprint.label} style requires a "dressing" room attachedTo the master bedroom.`);
    }
    if (blueprint.ensuiteAll) {
      const attached = new Set(rooms.filter((room) => room.type === 'bathroom' && room.attachedTo).map((room) => room.attachedTo));
      const bare = rooms.filter((room) => (room.type === 'bedroom' || room.type === 'master_bedroom') && !attached.has(room.id));
      if (bare.length) errors.push(`${blueprint.label} style requires an attached bathroom for every bedroom; missing for: ${bare.map((room) => room.name).join(', ')}.`);
    }
  }
  return errors;
}
