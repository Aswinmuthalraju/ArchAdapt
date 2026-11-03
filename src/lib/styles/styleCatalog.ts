import type { ArchitecturalStyle } from '@/types/architectural';

/** Everything the gallery, the home page and each style's own page show about a style. */
export interface StyleEntry {
  slug: string;
  name: ArchitecturalStyle;
  /** One line used on cards. */
  note: string;
  tagline: string;
  /** A short paragraph that opens the style's page. */
  overview: string;
  characteristics: string[];
  /** What the layout engine changes in the plan when this style is chosen. */
  spatialImpact: string;
  /** Step-by-step: how a plan in this style is designed. */
  process: { title: string; text: string }[];
  /** Rooms and spaces this style adds or favours. */
  rooms: string[];
  facts: { label: string; value: string }[];
  bestFor: string;
  /** Soft tints used by the illustration and the page accents. */
  tint: { sky: string; wall: string; roof: string; accent: string };
}

export const STYLE_CATALOG: StyleEntry[] = [
  {
    slug: 'kerala-traditional',
    name: 'Kerala Traditional',
    note: 'Courtyards, deep eaves, monsoon roofs',
    tagline: 'Monsoon-ready heritage, drawn clean',
    overview:
      'Kerala houses are built for heavy rain and humid heat: steep tiled roofs that shed water, deep overhangs that keep walls dry, and an open courtyard that pulls air through the home. We keep those ideas and draw them with a calm, modern hand.',
    characteristics: [
      'Nadumuttam, an open-to-sky central courtyard',
      'Steep sloped roofs with deep monsoon overhangs',
      'A Poomukham sit-out verandah at the entrance',
      'Pale plaster walls, timber details and laterite plinths'
    ],
    spatialImpact: 'Adds a Nadumuttam courtyard, a puja room and a store to every brief, and opens the plan with a deep Poomukham sit-out.',
    process: [
      { title: 'Place the court', text: 'A courtyard is set near the centre of the ground floor so the rooms around it borrow light and air from it.' },
      { title: 'Open the front', text: 'A deep sit-out is drawn at the entrance, so you step from the lane into shade before you reach the door.' },
      { title: 'Zone the rooms', text: 'The puja room goes to the north-east, the kitchen to the south-east, and bedrooms keep to the quiet side.' },
      { title: 'Roof for the rain', text: 'The 3D model gets a steep, overhanging roof so what you see matches the plan beneath it.' }
    ],
    rooms: ['Nadumuttam courtyard', 'Poomukham sit-out', 'Puja room', 'Store room', 'Family hall'],
    facts: [
      { label: 'Roof', value: 'Steep, tiled, deep eaves' },
      { label: 'Climate', value: 'Hot, humid, high rainfall' },
      { label: 'Materials', value: 'Plaster, timber, laterite, clay tile' },
      { label: 'Plan shape', value: 'Rooms ringed around a court' }
    ],
    bestFor: 'Families who want a home that feels rooted and stays cool without relying on machines.',
    tint: { sky: '#DCE8EC', wall: '#F3EFE6', roof: '#A8644A', accent: '#6F8A5E' }
  },
  {
    slug: 'modern',
    name: 'Modern',
    note: 'Clean lines and open plans',
    tagline: 'Clean geometry and open living',
    overview:
      'Modern plans put one generous living space at the centre and let dining and kitchen flow out of it. Walls are plain, roofs are flat, and glass brings the garden into the room.',
    characteristics: [
      'Flat roofs, crisp parapets and a cantilevered upper floor',
      'Large glazed openings to the garden',
      'An open living, dining and kitchen spine',
      'Plain walls with a few timber or metal accents'
    ],
    spatialImpact: 'Plans a linear spine with the living room as the largest space, flowing into dining and kitchen.',
    process: [
      { title: 'Find the spine', text: 'Living, dining and kitchen are lined up as one connected run so the home reads as a single, open space.' },
      { title: 'Give living the room', text: 'The living room is sized as the largest space, with the other rooms sized around it.' },
      { title: 'Stack the floors', text: 'Bedrooms go upstairs and the stair is placed where it can be reached from the hall without crossing a bedroom.' },
      { title: 'Draw it plain', text: 'The 3D model is a flat-roofed volume with a slightly overhanging upper floor.' }
    ],
    rooms: ['Open living hall', 'Dining', 'Kitchen', 'Family lounge upstairs', 'Balcony'],
    facts: [
      { label: 'Roof', value: 'Flat with slim parapet' },
      { label: 'Climate', value: 'Works almost anywhere' },
      { label: 'Materials', value: 'Render, glass, timber, steel' },
      { label: 'Plan shape', value: 'Linear and open' }
    ],
    bestFor: 'Anyone who wants a bright, uncluttered home with easy flow between rooms.',
    tint: { sky: '#E1E9F0', wall: '#F4F2EC', roof: '#8F9AA3', accent: '#B08B5C' }
  },
  {
    slug: 'minimalist',
    name: 'Minimalist',
    note: 'Compact cores, quiet materials',
    tagline: 'Fewer rooms, better made',
    overview:
      'Minimalist homes spend the budget on proportion and light instead of extra rooms. Plumbing is gathered into one compact core, storage is hidden in the walls, and every room is sized to be used, not to impress.',
    characteristics: [
      'A compact central core for plumbing and utilities',
      'Flush walls and storage hidden in alcoves',
      'Polished cement and a single quiet palette',
      'A tight footprint that wastes little on corridors'
    ],
    spatialImpact: 'Trims every room to a compact size, adds concealed storage, and leaves out the utility room, courtyard and any extras you did not ask for.',
    process: [
      { title: 'Cut to what you need', text: 'Only the rooms in your brief are drawn. Extras you did not ask for are left out.' },
      { title: 'Gather the plumbing', text: 'Bathrooms and the kitchen share walls so the pipework stays short and the cost stays low.' },
      { title: 'Hide the storage', text: 'Cupboards are drawn into the wall thickness, so rooms stay clear.' },
      { title: 'Keep it quiet', text: 'The 3D model is a simple, pale volume with very few openings, each placed deliberately.' }
    ],
    rooms: ['Compact living', 'Efficient kitchen', 'Concealed storage', 'Shared plumbing core'],
    facts: [
      { label: 'Roof', value: 'Flat, no ornament' },
      { label: 'Climate', value: 'Temperate to warm' },
      { label: 'Materials', value: 'Cement render, stone, glass' },
      { label: 'Plan shape', value: 'Tight rectangle' }
    ],
    bestFor: 'Smaller plots and tighter budgets where every square foot should earn its place.',
    tint: { sky: '#E6EAEC', wall: '#F6F5F1', roof: '#B7B6B0', accent: '#8C8B86' }
  },
  {
    slug: 'contemporary',
    name: 'Contemporary',
    note: 'Sculpted volumes, shaded glass',
    tagline: 'Sculpted volumes that shade themselves',
    overview:
      'Contemporary homes are built from interlocking boxes at different heights. The upper floor steps out over the lower one to shade it, and louvres and planting cool the glass.',
    characteristics: [
      'Interlocking volumes and a staggered upper floor',
      'Louvres and screens that shade the glass',
      'Planted recesses and green walls',
      'Flexible spaces that can change use over time'
    ],
    spatialImpact: 'Adds a study and a generous balcony, enlarges the family lounge, and staggers the upper floor against the ground floor.',
    process: [
      { title: 'Stagger the floors', text: 'The upper floor is pushed out over part of the ground floor, which gives a shaded sit-out below it.' },
      { title: 'Add the flexible room', text: 'A study sits beside the living space so it can become a guest room or a nursery later.' },
      { title: 'Shade the glass', text: 'Balconies and deep sills are placed on the sunny sides first.' },
      { title: 'Break the mass', text: 'Different roof heights are used in the 3D model so the house reads as several pieces, not one box.' }
    ],
    rooms: ['Family lounge', 'Study', 'Large balcony', 'Shaded sit-out', 'Green recess'],
    facts: [
      { label: 'Roof', value: 'Mixed flat and low-slope' },
      { label: 'Climate', value: 'Warm, with strong sun' },
      { label: 'Materials', value: 'Render, timber slat, glass, metal' },
      { label: 'Plan shape', value: 'Offset, interlocking' }
    ],
    bestFor: 'Families who want a design with character that still stays comfortable in strong sun.',
    tint: { sky: '#DFE8EE', wall: '#F2EFE8', roof: '#7E8A92', accent: '#B8895A' }
  },
  {
    slug: 'colonial',
    name: 'Colonial',
    note: 'Symmetry, high ceilings, colonnades',
    tagline: 'Formal symmetry, shaded colonnades',
    overview:
      'Colonial houses are balanced and formal: a central entrance, columns that carry a deep portico, tall windows and high ceilings that let heat rise away from the rooms below.',
    characteristics: [
      'A symmetrical front with a central portico',
      'Tall ceilings and transom windows for airflow',
      'Colonnades and arches around the verandah',
      'A formal foyer and separate reception rooms'
    ],
    spatialImpact: 'Gives the house a grand colonnaded portico, a formal dining room, a library-style study and an upper veranda, each in its own room.',
    process: [
      { title: 'Set the axis', text: 'The plan is built on a central line: entrance, foyer and stair all sit on it.' },
      { title: 'Separate the rooms', text: 'Dining, study and living are drawn as distinct rooms with doors, not one open space.' },
      { title: 'Wrap the verandah', text: 'A colonnaded verandah is added on the entrance side and repeated upstairs.' },
      { title: 'Raise the ceilings', text: 'Floor heights are increased so the 3D model gets tall, narrow windows and a hipped roof.' }
    ],
    rooms: ['Colonnaded portico', 'Foyer', 'Formal dining', 'Library study', 'Upper veranda'],
    facts: [
      { label: 'Roof', value: 'Hipped, gently pitched' },
      { label: 'Climate', value: 'Hot, humid, coastal' },
      { label: 'Materials', value: 'Lime plaster, timber, tile' },
      { label: 'Plan shape', value: 'Symmetrical about a central axis' }
    ],
    bestFor: 'Larger plots and families who entertain, and who like a home with formal rooms.',
    tint: { sky: '#E3EAEE', wall: '#F4EFE3', roof: '#9C6B55', accent: '#6D8470' }
  },
  {
    slug: 'tropical',
    name: 'Tropical',
    note: 'Overhangs, light shafts, gardens',
    tagline: 'A house that lives in its garden',
    overview:
      'Tropical homes are open to the breeze. Wide eaves keep the sun off the glass, rooms are one room deep so air passes straight through, and the garden is treated as another room.',
    characteristics: [
      'Courtyards and outdoor spaces woven into the plan',
      'Wide eaves that shade the glass from the high sun',
      'Timber slats, bamboo and natural textures',
      'Cross-ventilation corridors from front to back'
    ],
    spatialImpact: 'Adds an open courtyard, a wide balcony or veranda and open garden area, with passages along the open edges for cross-ventilation.',
    process: [
      { title: 'Open both ends', text: 'Rooms are placed so air can enter on one side and leave on the other.' },
      { title: 'Add the outdoor rooms', text: 'A courtyard, veranda and garden are drawn as real spaces with their own sizes.' },
      { title: 'Run the passages', text: 'Passages are put along the open edges so every room has a breezy way in.' },
      { title: 'Widen the eaves', text: 'The roof in the 3D model is drawn with a deep overhang and a light, layered look.' }
    ],
    rooms: ['Open courtyard', 'Wide veranda', 'Garden room', 'Breezeway passages'],
    facts: [
      { label: 'Roof', value: 'Wide-eaved, low pitch' },
      { label: 'Climate', value: 'Hot and humid' },
      { label: 'Materials', value: 'Timber, bamboo, stone, plaster' },
      { label: 'Plan shape', value: 'Thin and open, wrapped around green' }
    ],
    bestFor: 'People who want to spend most of the day half outdoors and who have a garden to use.',
    tint: { sky: '#DDEBE8', wall: '#F1EEE4', roof: '#8C7155', accent: '#5F8B6A' }
  },
  {
    slug: 'traditional-indian',
    name: 'Traditional Indian',
    note: 'Courtyards and jali screens',
    tagline: 'Rooms gathered around a chowk',
    overview:
      'The Traditional Indian home turns inward. Rooms open onto a central chowk that gives light, air and a place for the family to gather, while jali screens and deep sit-outs soften the sun.',
    characteristics: [
      'A central family courtyard (chowk)',
      'A puja room placed in the north-east',
      'Jali screens and carved timber details',
      'Shaded terraces and a sit-out at the entrance'
    ],
    spatialImpact: 'Rings the rooms around a central Chowk courtyard, adds a puja room, and keeps a separate Baithak guest room by the entrance.',
    process: [
      { title: 'Open the chowk', text: 'A courtyard goes at the centre and every main room is planned to open onto it.' },
      { title: 'Place the sacred room', text: 'The puja room is placed in the north-east corner, away from the kitchen and bathrooms.' },
      { title: 'Keep a front room', text: 'A Baithak guest room by the entrance lets visitors be received without entering the family space.' },
      { title: 'Screen the sun', text: 'Jali screens and chhajja eaves are drawn on the outer walls in the 3D model.' }
    ],
    rooms: ['Chowk courtyard', 'Puja room', 'Baithak guest room', 'Shaded terrace', 'Sit-out'],
    facts: [
      { label: 'Roof', value: 'Flat terrace with chhajja eaves' },
      { label: 'Climate', value: 'Hot, dry to composite' },
      { label: 'Materials', value: 'Stone, brick, lime plaster, carved timber' },
      { label: 'Plan shape', value: 'Courtyard in the middle' }
    ],
    bestFor: 'Joint families and anyone who wants a private, shaded home that centres on a shared space.',
    tint: { sky: '#EADFD3', wall: '#EFE2CE', roof: '#B98C5E', accent: '#9C6A4A' }
  },
  {
    slug: 'modern-luxury',
    name: 'Modern Luxury',
    note: 'Double-height voids, private suites',
    tagline: 'Generous volume, private suites',
    overview:
      'Modern Luxury gives each person more room and more privacy: a double-height living hall, a suite for every bedroom, and covered parking. Rooms are sized generously and detailed with premium finishes.',
    characteristics: [
      'A double-height living hall with a feature void',
      'Every bedroom has its own bathroom, the master has a dressing suite',
      'Covered two-car parking and a formal entrance foyer',
      'Terraces and balconies sized for entertaining'
    ],
    spatialImpact: 'Gives every bedroom its own bathroom, adds a dressing suite to the master, a study, a guest room and two-car parking, with every room sized generously.',
    process: [
      { title: 'Make the hall', text: 'The living hall is drawn as a double-height void so the stair and first-floor landing can look into it.' },
      { title: 'Pair rooms with baths', text: 'Each bedroom is paired with its own bathroom, and the master gets a dressing room too.' },
      { title: 'Add the extras', text: 'A study, a guest room and covered parking for two cars are added to the brief.' },
      { title: 'Size generously', text: 'Rooms are drawn above the usual minimum, then checked for light and for private circulation.' }
    ],
    rooms: ['Double-height hall', 'Ensuite bedrooms', 'Master dressing suite', 'Study', 'Guest room', 'Two-car garage'],
    facts: [
      { label: 'Roof', value: 'Flat with deep cantilevers' },
      { label: 'Climate', value: 'Works with air conditioning' },
      { label: 'Materials', value: 'Stone, glass, timber, metal' },
      { label: 'Plan shape', value: 'Wide, layered, with a central void' }
    ],
    bestFor: 'Larger plots where privacy, space and entertaining matter more than keeping the footprint small.',
    tint: { sky: '#E2E8EE', wall: '#F3F1EC', roof: '#6F7A84', accent: '#B49362' }
  }
];

export const STYLE_BY_SLUG: Record<string, StyleEntry> = Object.fromEntries(STYLE_CATALOG.map((s) => [s.slug, s]));

export function styleBySlug(slug: string): StyleEntry | undefined {
  return STYLE_BY_SLUG[slug];
}

export function styleSlugForName(name: string): string | undefined {
  return STYLE_CATALOG.find((s) => s.name === name)?.slug;
}
