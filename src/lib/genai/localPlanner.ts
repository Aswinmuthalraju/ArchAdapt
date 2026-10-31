import {
  DesignConstraints,
  DesignProgram,
  LocationInfo,
  PlanBand,
  PlanSide,
  ProgramRoom,
  RoomRelationship,
  RoomType,
  SiteInfo
} from '@/types/architectural';
import { normalizeStyleName } from '@/lib/design/styleNormalizer';
import { DEFAULT_APPEARANCE_BY_STYLE } from '@/lib/geometry/materials';
import { planCompass } from '@/lib/geometry/planGeometry';
import { ROOM_TYPE_SPECS, floorName } from '@/lib/design/roomTypes';
import { normalizeProgram } from '@/lib/design/program';
import { styleAreaFactor, styleBlueprint } from '@/lib/design/styleBlueprints';

const TIER_SCALE: Record<DesignConstraints['budgetRange'], number> = { Economy: 0.85, Moderate: 1, Premium: 1.15, Luxury: 1.3 };
const COMPASS_HEAT: Record<string, number> = { N: 0, NE: 0, E: 1, NW: 2, SE: 2, S: 3, W: 5, SW: 5 };
type Edge = 'left' | 'right';
const opposite = (side: Edge): Edge => (side === 'left' ? 'right' : 'left');

interface StyleProfile {
  entranceName: string;
  livingName: string;
  courtyardName: string;
  styleStrategy: string;
  styleFeatures: string[];
}

function getStyleProfile(normStyle: string, style: string): StyleProfile {
  switch (normStyle) {
    case 'kerala_traditional':
      return {
        entranceName: 'Poomukham (Sit-out)',
        livingName: 'Formal Living (Charupadi)',
        courtyardName: 'Nadumuttam Courtyard',
        styleStrategy: 'Kerala Traditional: Vernacular monsoon architecture with Poomukham verandah, sloped terracotta rooflines with deep eaves, and central Nadumuttam stack ventilation.',
        styleFeatures: [
          'Kerala Traditional',
          'Nadumuttam central courtyard stack ventilation',
          'Sloped terracotta hipped roof with deep monsoon eaves',
          'Teak-timber framed Poomukham / Sit-out verandah'
        ]
      };
    case 'traditional_indian':
      return {
        entranceName: 'Verandah with Jali Screen',
        livingName: 'Baithak / Formal Living',
        courtyardName: 'Central Chowk (Family Aangan)',
        styleStrategy: 'Traditional Indian: Central Chowk social core, auspicious Ishan Kon sacred orientation, carved stone accents, and Mangalore tile hip roof.',
        styleFeatures: [
          'Traditional Indian',
          'Central Chowk (Family Aangan) social core',
          'Auspicious Ishan Kon sacred orientation',
          'Carved timber & terracotta jali shading',
          'Heritage Mangalore tile hip roof'
        ]
      };
    case 'colonial':
      return {
        entranceName: 'Colonnaded Grand Portico',
        livingName: 'Formal Reception Drawing Room',
        courtyardName: 'Colonial Internal Courtyard',
        styleStrategy: 'Colonial Classical: Colonnaded entrance portico with classical order piers, formal symmetrical zoning, high-ceiling transom ventilation, and hipped mansard roofline.',
        styleFeatures: [
          'Colonial Classical',
          'Colonnaded grand portico entrance',
          'Formal reception drawing room and symmetrical zoning',
          'High-ceiling transom ventilation and colonial hip'
        ]
      };
    case 'tropical':
      return {
        entranceName: 'Louvered Tropical Breeze Porch',
        livingName: 'Open-Air Garden Living Pavilion',
        courtyardName: 'Lush Rain Courtyard & Light Shaft',
        styleStrategy: 'Tropical Vernacular: Floating pavilion canopy with wide solar shading eaves, cross-ventilation breeze corridors, and seamless garden integration.',
        styleFeatures: [
          'Tropical Vernacular',
          'Floating pavilion canopy with wide solar shading eaves',
          'Cross-ventilation breeze corridors',
          'Indoor-outdoor garden courtyard integration'
        ]
      };
    case 'minimalist':
      return {
        entranceName: 'Recessed Architectural Foyer',
        livingName: 'Open Living Gallery',
        courtyardName: 'Zen Light Court',
        styleStrategy: 'Minimalist Monolithic: Razor-thin flush monolithic roof slab, concealed linear core, and frameless apertures with restrained materiality.',
        styleFeatures: [
          'Minimalist Monolithic',
          'Razor-thin flush monolithic roof slab without overhangs',
          'Compact high-efficiency core & concealed storage',
          'Frameless glazed openings with monochrome palette'
        ]
      };
    case 'modern_luxury':
      return {
        entranceName: 'Double-Height Grand Entrance Vestibule',
        livingName: 'Grand Great Room (Double-Height Void)',
        courtyardName: 'Landscape Water Court / Terrace Deck',
        styleStrategy: 'Modern Luxury: Dramatic double-height living void, deep floating cantilevered terrace slabs, and private ensuite sanctuary zoning.',
        styleFeatures: [
          'Modern Luxury',
          'Double-height grand great room void with clerestory light shafts',
          'Deep floating cantilevered terrace slabs with bronze reveal',
          'Private ensuite master sanctuary with dressing suite'
        ]
      };
    case 'contemporary':
      return {
        entranceName: 'Sculptural Pivot Foyer',
        livingName: 'Split-Level Social Lounge',
        courtyardName: 'Sculptural Courtyard Void',
        styleStrategy: 'Contemporary Dynamic: Asymmetrical stepped volume massing, integrated solar louvers, and flexible indoor-outdoor social terraces.',
        styleFeatures: [
          'Contemporary Dynamic',
          'Asymmetrical stepped volume massing and split-level social zones',
          'High-performance solar louvers & integrated outdoor terraces',
          'Sculptural entry pivot and mixed travertine-metal cladding'
        ]
      };
    case 'modern':
    default:
      return {
        entranceName: 'Entrance Porch',
        livingName: 'Living Room',
        courtyardName: 'Courtyard',
        styleStrategy: 'Modern Balanced: Cantilevered upper massing, horizontal parapet roofline, fluid open-plan spine, and floor-to-ceiling glass connections.',
        styleFeatures: [
          'Modern Balanced',
          'Cantilevered upper massing and horizontal parapet roofline',
          'Fluid open-plan living-dining-kitchen spine',
          'Expansive floor-to-ceiling sliding glass apertures'
        ]
      };
  }
}

/**
 * Rule-based room programmer used when Gemini is not available. It applies ordinary residential
 * planning rules to the actual requirements, site orientation and modes — it does not pick a
 * template. Geometry is produced afterwards by the same layout engine Gemini's programmes go through.
 *
 * `variant` selects a different planning strategy (used for "alternative concept" requests):
 * 0 = public rooms to the road, private to the rear; 1 = mirrored with the dining room in the
 * front zone; 2 = bedrooms brought forward and the service core moved to the rear.
 */
export function buildLocalProgram(
  site: SiteInfo,
  location: LocationInfo,
  constraints: DesignConstraints,
  customRequirements = '',
  variant = 0
): DesignProgram {
  const { bedrooms, bathrooms, floors, parkingCars, requiredSpaces, modes, style } = constraints;
  const wants = (space: string) => requiredSpaces.includes(space);
  const climate = modes.includes('climate_adaptive');
  const lifeStage = modes.includes('life_stage');
  const budgetFirst = modes.includes('budget_first');
  const renovation = modes.includes('renovation');
  const normStyle = normalizeStyleName(style, [], '');
  const text = customRequirements.toLowerCase();

  const scale = TIER_SCALE[constraints.budgetRange] * (budgetFirst ? 0.88 : 1);
  const familyScale = constraints.familySize >= 6 ? 1.15 : constraints.familySize <= 2 ? 0.92 : 1;
  const blueprint = styleBlueprint(style);
  const area = (type: RoomType, factor = 1) => Math.round(Math.max(ROOM_TYPE_SPECS[type].minArea, ROOM_TYPE_SPECS[type].targetArea * scale * factor * styleAreaFactor(constraints, type)));

  // Which side of the plan is cooler depends on which way the plot faces.
  const compass = planCompass(site.orientation);
  const leftCooler = (COMPASS_HEAT[compass.left] ?? 2) <= (COMPASS_HEAT[compass.right] ?? 2);
  let coolSide: Edge = climate ? (leftCooler ? 'left' : 'right') : 'left';
  if (variant === 1) coolSide = opposite(coolSide);
  const hotSide = opposite(coolSide);

  const rooms: ProgramRoom[] = [];
  const add = (
    id: string, name: string, type: RoomType, floor: number, band: PlanBand, side: PlanSide, areaSqFt: number,
    extra: { attachedTo?: string; relationships?: RoomRelationship[]; features?: string[]; required?: boolean; accessible?: boolean } = {}
  ) => {
    rooms.push({ id, name, type, floor, band, side, areaSqFt, required: extra.required ?? true, attachedTo: extra.attachedTo, relationships: extra.relationships || [], features: extra.features || [], accessible: extra.accessible });
    return id;
  };

  const profile = getStyleProfile(normStyle, style);

  // ---------- Ground floor: arrival and public rooms ----------
  const largeLiving = /large living|big living|spacious living/.test(text);
  const living = add('room-living', profile.livingName, 'living', 0, 'front', coolSide, area('living', familyScale * (largeLiving ? 1.25 : 1)), {
    features: [climate ? `Placed on the cooler ${compass[coolSide]} side` : 'Faces the road'].concat(largeLiving ? ['Enlarged as requested'] : [])
  });
  add('room-entrance', profile.entranceName, 'entrance', 0, 'front', coolSide, area('entrance', climate ? 1.2 : 1), {
    attachedTo: living,
    features: climate ? ['Deep shaded threshold before the living room'] : ['Covered arrival']
  });
  if (parkingCars > 0) {
    add('room-parking', `Car Porch (${parkingCars} car${parkingCars > 1 ? 's' : ''})`, 'parking', 0, 'front', hotSide, Math.max(150, 160 * parkingCars), {
      features: climate ? [`Buffers the ${compass[hotSide]} side from afternoon sun`] : ['Direct access from the road']
    });
  }

  const hasDining = wants('dining') || !requiredSpaces.length;
  const diningBand: PlanBand = variant === 1 ? 'front' : 'middle';
  // In a single-storey courtyard house a bedroom flanks the court on the cool side, so dining sits in the centre beside it.
  const courtFlank = wants('courtyard') && floors === 1;
  const dining = hasDining
    ? add('room-dining', 'Dining', 'dining', 0, diningBand, variant === 1 || courtFlank ? 'center' : coolSide, area('dining', familyScale), { relationships: [{ type: 'CONNECTED_TO', target: living }] })
    : undefined;

  const kitchenBand: PlanBand = variant === 2 ? 'rear' : 'middle';
  const kitchen = add('room-kitchen', 'Kitchen', 'kitchen', 0, kitchenBand, hotSide, area('kitchen', familyScale), {
    relationships: dining ? [{ type: 'CONNECTED_TO', target: dining }] : [{ type: 'CONNECTED_TO', target: living }],
    features: budgetFirst ? ['Shares a plumbing wall with the utility'] : []
  });
  if ((!budgetFirst || bedrooms >= 3) && !blueprint.omit?.includes('utility')) {
    add('room-utility', 'Utility', 'utility', 0, kitchenBand, hotSide, area('utility'), { attachedTo: kitchen, required: false });
  }
  if (wants('courtyard')) {
    add('room-courtyard', profile.courtyardName, 'courtyard', 0, 'middle', 'center', area('courtyard', climate ? 1.25 : 1), {
      // At the heart of the plan: living in front, dining and kitchen either side, bedrooms behind, so it is enclosed on all four sides.
      relationships: [{ type: 'ADJACENT_TO', target: dining || living }],
      features: climate ? ['Open to sky: draws hot air up and out of the surrounding rooms'] : ['Open to sky']
    });
  }

  // ---------- Bedrooms across floors ----------
  const perFloor = Array.from({ length: floors }, () => Math.floor(bedrooms / floors));
  for (let extra = bedrooms % floors, level = floors - 1; extra > 0; extra--, level = level > 0 ? level - 1 : floors - 1) perFloor[level]++;
  if (lifeStage && perFloor[0] === 0) {
    const donor = perFloor.findIndex((count, level) => level > 0 && count > 0);
    if (donor > 0) { perFloor[donor]--; perFloor[0]++; }
  }
  const masterFloor = lifeStage ? 0 : Math.max(0, perFloor.map((count, level) => (count > 0 ? level : -1)).reduce((a, b) => Math.max(a, b), 0));

  const bedroomIds: { id: string; floor: number; master: boolean }[] = [];
  let bedNumber = 1;
  for (let floor = 0; floor < floors; floor++) {
    for (let i = 0; i < perFloor[floor]; i++) {
      const master = floor === masterFloor && !bedroomIds.some((bed) => bed.master);
      // Ground-floor bedrooms sit at the quiet rear; upper bedrooms alternate rear and front so they do not queue in one row.
      const frontFirst = variant === 2 && floor > 0;
      const band: PlanBand = floor === 0 ? (variant === 2 && i === 0 && perFloor[0] > 1 ? 'middle' : 'rear') : (i % 2 === (frontFirst ? 1 : 0) ? 'rear' : 'front');
      const side: PlanSide = i % 2 === 0 ? coolSide : hotSide;
      const id = master ? 'room-master' : `room-bedroom-${bedNumber}`;
      const groundAccessible = lifeStage && floor === 0;
      add(id, master ? (groundAccessible ? 'Accessible Master Bedroom' : 'Master Bedroom') : `Bedroom ${bedNumber}`, master ? 'master_bedroom' : 'bedroom', floor, band, side, area(master ? 'master_bedroom' : 'bedroom', groundAccessible ? 1.1 : 1), {
        relationships: [{ type: 'PRIVATE_FROM', target: living }],
        features: groundAccessible ? ['Ground floor, step-free, sized for wheelchair turning'] : climate && side === coolSide ? [`On the cooler ${compass[coolSide]} side`] : [],
        accessible: groundAccessible || undefined
      });
      bedroomIds.push({ id, floor, master });
      bedNumber++;
    }
  }

  // Nalukettu: with no stair to close the courtyard's far side, a ground-floor bedroom does, entered from the court's edge.
  if (courtFlank) {
    const flank = [...rooms].reverse().find((room) => room.floor === 0 && room.type === 'bedroom' && room.band === 'rear');
    if (flank) {
      flank.band = 'middle';
      flank.side = coolSide;
      flank.features = [...flank.features, 'Opens onto the courtyard'];
    }
  }

  // Free-standing small rooms sit in the sleeping zone so they never interrupt living → dining → kitchen.
  const smallRoomBand = (floor: number): PlanBand => (rooms.some((room) => room.floor === floor && room.band === 'rear' && ROOM_TYPE_SPECS[room.type].placement === 'major') ? 'rear' : 'middle');

  // ---------- Bathrooms: master ensuite first, then one per sleeping floor, then further ensuites ----------
  let bathsLeft = bathrooms;
  let bathNumber = 1;
  const withEnsuite = new Set<string>();
  const floorHasBath = new Set<number>();
  const addBath = (floor: number, anchor?: { id: string }, common = false) => {
    if (bathsLeft <= 0) return;
    const accessible = lifeStage && floor === 0;
    const id = `room-bath-${bathNumber}`;
    const anchorRoom = anchor ? rooms.find((room) => room.id === anchor.id) : undefined;
    const commonBand = anchorRoom?.band === 'middle' ? 'middle' : smallRoomBand(floor);
    add(id, anchor ? (anchor.id === 'room-master' ? 'Master Bath' : `Attached Bath ${bathNumber}`) : `Common Bath${floor > 0 ? ` (${floorName(floor)})` : ''}`, 'bathroom', floor, commonBand, budgetFirst ? hotSide : 'center', area('bathroom', accessible ? 1.3 : 1), {
      attachedTo: anchor?.id,
      features: accessible ? ['Accessible: wider door, level-entry shower'] : budgetFirst ? ['Stacked on the shared plumbing core'] : [],
      accessible: accessible || undefined
    });
    if (anchor) withEnsuite.add(anchor.id);
    if (common || anchor) floorHasBath.add(floor);
    bathNumber++;
    bathsLeft--;
  };
  const master = bedroomIds.find((bed) => bed.master);
  const floorsNeedingBath = perFloor.filter((count, level) => count > 0 || level === 0).length;
  if (master && bathrooms > floorsNeedingBath) addBath(master.floor, master);
  for (let floor = 0; floor < floors; floor++) {
    if (floorHasBath.has(floor) || (perFloor[floor] === 0 && floor !== 0)) continue;
    // Ensuite-for-all styles give every bedroom its own bathroom instead of a shared one.
    if (blueprint.ensuiteAll && bathsLeft <= bedroomIds.length - withEnsuite.size && perFloor[floor] > 0) continue;
    // Life-Stage: the ground-floor bathroom opens straight off the ground-floor bedroom.
    const groundBed = lifeStage && floor === 0 ? bedroomIds.find((bed) => bed.floor === 0) : undefined;
    addBath(floor, groundBed, true);
  }
  for (const bed of bedroomIds) {
    if (!withEnsuite.has(bed.id)) addBath(bed.floor, bed);
  }
  while (bathsLeft > 0) addBath(0, undefined, true);

  if (blueprint.masterDressing && master) {
    add('room-dressing', 'Dressing Suite', 'dressing', master.floor, 'rear', 'center', area('dressing'), { attachedTo: master.id, features: ['Walk-in wardrobe between the master bedroom and its bath'] });
  }

  // ---------- Other requested rooms ----------
  if (wants('storage')) add('room-store', 'Store', 'store', 0, smallRoomBand(0), 'center', area('store'), { relationships: [{ type: 'NEAR', target: kitchen }] });
  if (wants('prayerRoom')) add('room-puja', 'Puja Room', 'puja', 0, smallRoomBand(0), 'center', area('puja'));
  if (wants('guestRoom')) add('room-guest', 'Guest Room', 'guest_room', 0, variant === 2 ? 'rear' : 'middle', hotSide, area('guest_room'));
  if (wants('studyWorkspace')) {
    // Life-Stage keeps the study on the ground floor so it can later become a bedroom.
    if (lifeStage || floors === 1) {
      add('room-study', lifeStage ? 'Study / Future Bedroom' : 'Study', 'study', 0, 'middle', coolSide, area('study', lifeStage ? 1.25 : 1), {
        features: lifeStage ? ['Ground-floor flex room: sized to convert to a bedroom later'] : []
      });
    } else {
      add('room-study', 'Study', 'study', 1, 'middle', coolSide, area('study'));
    }
  }

  // ---------- Upper floors ----------
  for (let floor = 1; floor < floors; floor++) {
    const lounge = add(`room-lounge-${floor}`, 'Family Lounge', 'lounge', floor, 'middle', 'center', area('lounge', budgetFirst ? 0.75 : 1), {
      features: ['Landing that every room on this floor opens from']
    });
    if (wants('balcony') && floor === 1) {
      const frontRoom = rooms.find((room) => room.floor === floor && room.band === 'front' && ROOM_TYPE_SPECS[room.type].placement === 'major');
      add('room-balcony', 'Balcony', 'balcony', floor, 'front', frontRoom?.side || coolSide, area('balcony', frontRoom ? 1 : 1.6), {
        attachedTo: frontRoom?.id,
        relationships: frontRoom ? [] : [{ type: 'ADJACENT_TO', target: lounge }],
        features: climate ? ['Shades the wall below it'] : []
      });
    }
  }
  if (wants('balcony') && floors === 1) {
    const rearBedroom = rooms.find((room) => room.band === 'rear' && ROOM_TYPE_SPECS[room.type].placement === 'major');
    add('room-balcony', 'Rear Sit-out', 'balcony', 0, 'rear', rearBedroom?.side || coolSide, area('balcony'), { attachedTo: rearBedroom?.id });
  }

  // ---------- Narrative that states what the geometry actually does ----------
  const styled = constraints.styleLevel !== 'none';
  const stylePlanning = blueprint.planningType === 'courtyard_centered' ? 'compact_core' : blueprint.planningType;
  const planningType: DesignProgram['planningType'] = wants('courtyard') ? 'courtyard_centered' : styled && variant === 0 ? stylePlanning : budgetFirst ? 'compact_core' : variant === 1 ? 'zoned_wings' : variant === 2 ? 'l_shaped' : 'linear_circulation';
  // The stair takes the end of the circulation zone away from the kitchen, next to the dining room.
  const stairSide: Edge = coolSide;
  const modeConsiderations: DesignProgram['modeConsiderations'] = [];
  if (climate) modeConsiderations.push({ mode: 'climate_adaptive', note: `Living room and main bedrooms sit on the ${compass[coolSide]} side; the car porch and kitchen take the hotter ${compass[hotSide]} side as a buffer. Habitable rooms get windows on two sides where they have two external walls, and any west- or south-west-facing window is narrowed.` });
  if (lifeStage) modeConsiderations.push({ mode: 'life_stage', note: `A bedroom with an accessible bathroom is on the ground floor, passages are 4.5 ft wide and doors 3.5 ft.${wants('studyWorkspace') ? ' The study is on the ground floor and sized to become another bedroom.' : ''}` });
  if (budgetFirst) modeConsiderations.push({ mode: 'budget_first', note: `Room sizes are trimmed about 12%, wet rooms are grouped on the ${compass[hotSide]} side to shorten plumbing runs, and the passage is omitted where two rooms can open directly off the dining area.` });
  if (renovation) modeConsiderations.push({ mode: 'renovation', note: 'No existing-building survey was supplied, so no walls could be marked as retained. Rooms are stacked on shared wall lines so the structure stays regular.' });

  const program: DesignProgram = {
    rooms,
    stairSide,
    planningType,
    circulationType: wants('courtyard') ? 'central' : styled ? blueprint.circulationType : 'spine',
    architecturalBrief: {
      planningIntent: `${bedrooms}-bedroom, ${bathrooms}-bathroom ${style} house on ${floors} floor(s) for a family of ${constraints.familySize}.`,
      siteResponse: `${site.plotWidth} ft x ${site.plotDepth} ft plot facing ${site.orientation}; the road is the plan front.`,
      orientationStrategy: climate ? `Main rooms to the ${compass[coolSide]}, service rooms to the ${compass[hotSide]}.` : `Public rooms face the ${site.orientation} road; private rooms are at the rear.`,
      publicPrivateStrategy: floors > 1 ? `Living, dining and kitchen on the ground floor; ${bedrooms - perFloor[0]} of ${bedrooms} bedrooms upstairs.` : 'Public rooms in the front zone, bedrooms in the rear zone behind a passage.',
      serviceStrategy: 'Kitchen with attached utility; bathrooms stacked in shared wet columns beside the rooms they serve.',
      circulationStrategy: floors > 1 ? 'Entrance → living → dining; a dog-legged stair in the middle zone lands on a family lounge that every upper room opens from.' : 'Entrance → living → dining; a rear passage serves the bedrooms.',
      climateStrategy: climate ? `Shaded entrance, ${wants('courtyard') ? 'open-to-sky courtyard for stack ventilation, ' : ''}cross-ventilation and narrowed west-facing windows.` : `Standard daylighting for ${location.city || 'the site'}.`,
      accessibilityStrategy: lifeStage ? 'Ground-floor bedroom and accessible bath, wide passages and doors.' : 'Standard domestic circulation.',
      styleStrategy: profile.styleStrategy
    },
    rationale: `${style} ${bedrooms}BHK on ${floors} floor(s), planned by rule from the stated requirements: public rooms to the ${site.orientation} road, ${climate ? `main rooms on the cooler ${compass[coolSide]} side, ` : ''}${perFloor.map((count, level) => `${count} bedroom(s) on the ${floorName(level).toLowerCase()}`).join(', ')}.`,
    circulationNotes: '',
    styleFeatures: profile.styleFeatures,
    modeConsiderations,
    appearance: DEFAULT_APPEARANCE_BY_STYLE[style] || DEFAULT_APPEARANCE_BY_STYLE['Modern']
  };
  return normalizeProgram(program);
}
