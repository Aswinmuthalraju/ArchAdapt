import type { ArchitecturalKnowledgeItem } from './architecturalKnowledge';

/**
 * Deeper per-style knowledge for all eight styles. Every style has the same three lenses so retrieval is even:
 *  - programme: which rooms, how big, how they relate (what the planner must output)
 *  - site: orientation, climate and plot-size response (what the planner must adapt to)
 *  - checklist: tests a finished plan must pass to read as this style (what the validator and client will check)
 * Items are only returned for their own style, so traditions never leak into each other.
 */
export const STYLE_KNOWLEDGE: ArchitecturalKnowledgeItem[] = [
  // ---------------- Kerala Traditional ----------------
  {
    id: 'kerala-programme', topic: 'Kerala Traditional: programme and proportions', category: 'style', styles: ['kerala_traditional'],
    keywords: ['room', 'size', 'bedroom', 'living', 'verandah', 'poomukham', 'ara', 'adukkala'],
    guidelines: [
      'Sequence of arrival: Poomukham (deep sit-out, 60+ sq ft) -> Charupadi seat -> formal living (Ambalam/Charupadi hall) -> Nadumuttam court -> dining (Oottupura) -> Adukkala kitchen.',
      'Rooms are modest and cellular, entered from the inner verandah; bedrooms are 110-150 sq ft with one window to the outside; the master bedroom (Ara/Padippura side) is on the ground floor for elders.',
      'Kitchen and Ara (store) form a service pair on the south or south-east; the Puja room is a small room (30-45 sq ft) on the quiet north-east, never next to a bathroom.',
      'Upper floors, where required, are bedrooms around the court void with a Thekkini-style lounge that overlooks the Nadumuttam through a railing.'
    ],
    avoid: ['Bedrooms opening directly into the living room', 'Attached bathrooms facing the court or entrance', 'A courtyard smaller than 9 ft x 9 ft']
  },
  {
    id: 'kerala-site', topic: 'Kerala Traditional: orientation and monsoon response', category: 'style', styles: ['kerala_traditional'],
    keywords: ['orientation', 'east', 'west', 'monsoon', 'humid', 'vastu', 'plot', 'site'],
    guidelines: [
      'Main entrance faces east or north (Thachu Shastra); on an east road the Poomukham leads the plan and the Nadumuttam sits on the central axis behind it.',
      'Warm-humid monsoon climate: deep eaves (3-4 ft), raised plinth, through-ventilation across the court, and no west-facing openings in main rooms.',
      'The court funnels rain and hot air out; the plan therefore keeps rooms one-room deep around it so every room borrows light from the court.',
      'On plots narrower than about 38 ft (buildable) a full Nalukettu cannot be enclosed; fall back to an Ekasala/linear plan with a front verandah and an open side garden rather than a slot courtyard.'
    ]
  },
  {
    id: 'kerala-checklist', topic: 'Kerala Traditional: plan checklist', category: 'style', styles: ['kerala_traditional'],
    keywords: ['check', 'validate', 'roof', 'plan', 'elevation'],
    guidelines: [
      'The Nadumuttam is on floor 0, open to sky, at the centre, with walled rooms on all four sides; upper floors show a void over it.',
      'There is a Poomukham attached to the living room, a Puja room, a store, and a kitchen on the hotter side.',
      'The roof is a hipped/gabled sloping roof with deep overhangs; no flat parapet, no cantilevered box.',
      'Windows are small and shaded; the facade reads as solid with deep verandah shadow.'
    ]
  },

  // ---------------- Traditional Indian ----------------
  {
    id: 'traditional-programme', topic: 'Traditional Indian: programme and proportions', category: 'style', styles: ['traditional_indian'],
    keywords: ['room', 'size', 'baithak', 'puja', 'guest', 'bedroom', 'kitchen'],
    guidelines: [
      'Public-to-private sequence: otla/verandah -> Baithak (formal living, 150-220 sq ft) -> Chowk (open court) -> family rooms; guests are served in the Baithak and guest room without crossing the Chowk.',
      'Rooms form a ring around the Chowk; each opens onto its covered edge (dalan). Bedrooms are 110-160 sq ft, kitchens 90-130 sq ft with a separate store.',
      'The puja room (35-50 sq ft) is a quiet, light room in the north-east; bathrooms are kept away from it and from the kitchen wall.',
      'Multi-generational living: a ground-floor elders\' room and a separate family lounge upstairs.'
    ],
    avoid: ['Open-plan merging of Baithak and family spaces', 'A single huge living room', 'Bathrooms opening onto the Chowk']
  },
  {
    id: 'traditional-site', topic: 'Traditional Indian: orientation, Vastu and climate', category: 'style', styles: ['traditional_indian'],
    keywords: ['vastu', 'orientation', 'north', 'east', 'climate', 'hot', 'plot', 'site'],
    guidelines: [
      'Vastu: Ishan (north-east) light and open with puja; Agni (south-east) kitchen; Nairuti (south-west) master bedroom and heavy store; Vayavya (north-west) guest room.',
      'Hot-dry and composite climates: thick walls, small outer openings, shaded verandah, and a Chowk that cools by stack effect and evening shade.',
      'The street facade is mostly solid with a jharokha or jali; privacy is more important than views.',
      'The Chowk needs about 100-150 sq ft with rooms on all sides; on narrow plots keep the verandah and jali and drop the court.'
    ]
  },
  {
    id: 'traditional-checklist', topic: 'Traditional Indian: plan checklist', category: 'style', styles: ['traditional_indian'],
    keywords: ['check', 'validate', 'plan'],
    guidelines: [
      'A central Chowk enclosed by rooms exists on floor 0 (or the style is relaxed and the client is told).',
      'A Baithak, a guest room and a puja room are present and the puja is not adjacent to a bathroom.',
      'The entrance is a verandah of 50+ sq ft with a screen; the main door does not open straight into a bedroom.',
      'Roof: tiled hip or flat roof with parapet and chhatri-style shade; no glass facades.'
    ]
  },

  // ---------------- Colonial ----------------
  {
    id: 'colonial-programme', topic: 'Colonial: programme and proportions', category: 'style', styles: ['colonial'],
    keywords: ['room', 'size', 'portico', 'drawing', 'dining', 'study', 'library', 'bedroom'],
    guidelines: [
      'Axial sequence: portico (75+ sq ft) -> central hall or drawing room (250+ sq ft) -> formal dining on the same axis; the plan is bilaterally balanced about that axis.',
      'Large cellular rooms: bedrooms 150-200 sq ft with their own door and a window on each of two walls; dressing alcoves and attached baths behind them.',
      'A study/library of 100+ sq ft near the front; a veranda along the front or rear that is part of the circulation.',
      'Kitchen and service rooms are in a rear wing, separate from the formal rooms, entered via a servery or back passage.'
    ],
    avoid: ['Open kitchen onto the dining room', 'Asymmetric room placement about the axis', 'Courtyard-ring planning']
  },
  {
    id: 'colonial-site', topic: 'Colonial: site and climate response', category: 'style', styles: ['colonial'],
    keywords: ['orientation', 'site', 'plot', 'climate', 'veranda', 'garden'],
    guidelines: [
      'The house is centred on the plot width and set back behind a lawn; the portico faces the road on the central axis.',
      'Tall ceilings, transoms and verandas on the sun-facing sides handle heat; windows on opposite walls give cross-ventilation.',
      'Wide plots (55 ft+ buildable) suit wings either side of the hall; narrow plots take a single-file arrangement along a side hall.',
      'A raised plinth with front steps separates the house from the garden.'
    ]
  },
  {
    id: 'colonial-checklist', topic: 'Colonial: plan checklist', category: 'style', styles: ['colonial'],
    keywords: ['check', 'validate', 'plan'],
    guidelines: [
      'Entrance portico, drawing room and dining room are in a line; each is a separate walled room with its own door.',
      'A study exists; the upper floor has a veranda/balcony continuing the portico colonnade.',
      'Bedroom doors open from a hall or landing, never from the dining room.',
      'Roof: hipped, slight overhang, symmetrical; shutters on tall windows.'
    ]
  },

  // ---------------- Tropical ----------------
  {
    id: 'tropical-programme', topic: 'Tropical: programme and proportions', category: 'style', styles: ['tropical'],
    keywords: ['room', 'size', 'veranda', 'balcony', 'garden', 'living', 'bedroom'],
    guidelines: [
      'Living and dining are semi-outdoor pavilions that open fully to a veranda or garden; bedrooms are single-banked so each has two external walls.',
      'A breeze porch (55+ sq ft) at arrival, a generous veranda or balcony (70+ sq ft), and an open court or rain garden where the plot allows.',
      'Wet rooms are open-to-sky or vented to a light well; the kitchen has a service yard.',
      'Rooms are modest (bedrooms 110-140 sq ft); the generosity is in the shaded outdoor rooms between them.'
    ],
    avoid: ['Deep windowless middle rooms', 'Sealed air-conditioned boxes', 'Rooms two deep without a court or light well']
  },
  {
    id: 'tropical-site', topic: 'Tropical: site, sun and wind', category: 'style', styles: ['tropical'],
    keywords: ['orientation', 'wind', 'sun', 'monsoon', 'garden', 'plot', 'climate', 'humid'],
    guidelines: [
      'Long axis perpendicular to the prevailing breeze (south-west in the monsoon); long walls face north and south, short walls east and west.',
      'Wide plots allow a one-room-deep plan; keep planting and water on the windward side to cool the incoming air.',
      'Roof overhangs of 3-5 ft shade every opening; raised floors keep damp out and let air move beneath.',
      'Leave at least 40-50% of the plot as garden; the plan should read as a house in a garden, not a block filling the plot.'
    ]
  },
  {
    id: 'tropical-checklist', topic: 'Tropical: plan checklist', category: 'style', styles: ['tropical'],
    keywords: ['check', 'validate', 'plan', 'roof'],
    guidelines: [
      'Every habitable room touches the outside on two sides, or the court, or borrows light from a wide veranda opening.',
      'A veranda/balcony of 70+ sq ft and a breeze-porch entrance exist; circulation is along open edges.',
      'The roof is a low-pitched, deep-eaved roof with louvred screens; materials are timber, laterite or plaster.',
      'Open land remains around the house so garden and building interlock.'
    ]
  },

  // ---------------- Minimalist ----------------
  {
    id: 'minimalist-programme', topic: 'Minimalist: programme and proportions', category: 'style', styles: ['minimalist'],
    keywords: ['room', 'size', 'storage', 'living', 'bedroom', 'compact'],
    guidelines: [
      'One continuous living-dining-kitchen volume (living 160-200 sq ft) with a concealed store; bedrooms are 100-120 sq ft with built-in wardrobes instead of dressing rooms.',
      'Entrance is a recessed threshold of 28-40 sq ft; no foyer, no formal rooms, no utility or prayer room unless asked.',
      'Bathrooms are compact (24-35 sq ft) and stacked beside bedrooms and over each other; the stair is a single straight or dog-legged run on the spine.',
      'Fewer, larger openings: one generous window per room placed deliberately, not many small ones.'
    ],
    avoid: ['Unrequested rooms', 'Corridors that exist only to connect', 'Decorative mouldings, arches or pitched tile roofs']
  },
  {
    id: 'minimalist-site', topic: 'Minimalist: site and form', category: 'style', styles: ['minimalist'],
    keywords: ['orientation', 'site', 'plot', 'form', 'compact', 'budget'],
    guidelines: [
      'A single rectangle sized to the programme, not to the plot: spare land becomes garden or court, never extra rooms.',
      'Orient the glazed living face to the best view or garden and keep the street front mostly blank for privacy.',
      'A compact footprint with few corners reduces wall and roof area; stack upper rooms exactly over lower ones.',
      'Deep reveals and a thin flat roof (no overhangs) do the shading; use a roof-top terrace as the only outdoor extra.'
    ]
  },
  {
    id: 'minimalist-checklist', topic: 'Minimalist: plan checklist', category: 'style', styles: ['minimalist'],
    keywords: ['check', 'validate', 'plan'],
    guidelines: [
      'Footprint is a clean rectangle; upper floor sits fully over the ground floor.',
      'No courtyard, puja, guest or utility room unless the client asked; a store exists.',
      'Living, dining and kitchen read as one space; only bedrooms and baths are closed rooms.',
      'Roof is a thin flat slab; palette is white, grey and light timber.'
    ]
  },

  // ---------------- Modern ----------------
  {
    id: 'modern-programme', topic: 'Modern: programme and proportions', category: 'style', styles: ['modern'],
    keywords: ['room', 'size', 'open plan', 'living', 'kitchen', 'bedroom'],
    guidelines: [
      'Living is the largest room (200-260 sq ft) and flows into dining and kitchen along a straight spine; kitchen 100-120 sq ft with an island or counter that opens toward dining.',
      'Bedrooms 120-150 sq ft with attached baths where the budget allows; an upper family lounge acts as the landing and a flexible room.',
      'A compact entrance porch; the car porch is part of the front composition.',
      'Straight stair along a party wall; wet rooms are stacked vertically.'
    ],
    avoid: ['Courtyards and ritual rooms unless requested', 'Pitched tile roofs', 'Decorative arches']
  },
  {
    id: 'modern-site', topic: 'Modern: site, sun and massing', category: 'style', styles: ['modern'],
    keywords: ['orientation', 'site', 'plot', 'sun', 'glass', 'massing'],
    guidelines: [
      'Orient large glazing to the garden side and shade it with overhangs or fins; keep west faces mostly closed.',
      'Composition of two or three offset volumes: a cantilevered upper floor over the porch, a flat roof with a parapet.',
      'On wide plots stretch the plan along the frontage; on deep plots use a linear spine.',
      'Garden and drive are laid out as part of the composition, not leftovers.'
    ]
  },
  {
    id: 'modern-checklist', topic: 'Modern: plan checklist', category: 'style', styles: ['modern'],
    keywords: ['check', 'validate', 'plan'],
    guidelines: [
      'Living-dining-kitchen is a continuous sequence; the living room is the largest room.',
      'The upper floor is offset or cantilevered; roof is flat with parapet.',
      'Entrance is compact; no courtyard or puja unless requested.',
      'Glazing is concentrated on one garden face; other faces are solid.'
    ]
  },

  // ---------------- Contemporary ----------------
  {
    id: 'contemporary-programme', topic: 'Contemporary: programme and proportions', category: 'style', styles: ['contemporary'],
    keywords: ['room', 'size', 'study', 'terrace', 'lounge', 'balcony', 'office'],
    guidelines: [
      'An L or stepped composition: a social wing (living, dining, kitchen) and a private wing (bedrooms), with a double-use upper lounge between them.',
      'A home office/study (60-90 sq ft) with its own light and a generous balcony or terrace (60+ sq ft) that extends the living area.',
      'Flexible multi-use rooms with sliding or folding partitions; bedrooms 120-150 sq ft.',
      'Upper floor offset over the ground floor so the ground roof becomes a terrace.'
    ],
    avoid: ['Strict bilateral symmetry', 'A courtyard ring', 'Heritage ornament']
  },
  {
    id: 'contemporary-site', topic: 'Contemporary: site and massing', category: 'style', styles: ['contemporary'],
    keywords: ['orientation', 'site', 'plot', 'terrace', 'massing', 'sun'],
    guidelines: [
      'Use the plot\'s corner and shape: the L embraces a garden or pool court on the quiet side.',
      'Larger openings face terraces and the garden; the street face has smaller, framed openings.',
      'Mixed cladding and vertical fins on hot faces give depth and shade; roof forms are flat or single-slope.',
      'Wider plots (50 ft+) express the L fully; narrow plots step the upper floor front-to-back.'
    ]
  },
  {
    id: 'contemporary-checklist', topic: 'Contemporary: plan checklist', category: 'style', styles: ['contemporary'],
    keywords: ['check', 'validate', 'plan'],
    guidelines: [
      'The plan is asymmetric and the upper floor is stepped, creating at least one usable terrace.',
      'A study and a balcony/terrace of 60+ sq ft are present.',
      'The upper lounge is generous and doubles as a work or family space.',
      'Palette mixes at least two materials (stone, timber, metal).'
    ]
  },

  // ---------------- Modern Luxury ----------------
  {
    id: 'luxury-programme', topic: 'Modern Luxury: programme and proportions', category: 'style', styles: ['modern_luxury'],
    keywords: ['room', 'size', 'master', 'suite', 'ensuite', 'dressing', 'study', 'guest', 'parking'],
    guidelines: [
      'A ceremonial entrance (80+ sq ft) leads to a great room (260+ sq ft), often double-height, with dining and a showpiece kitchen (130+ sq ft) opening off it.',
      'Every bedroom is a suite: bedroom 150-200 sq ft with an attached bathroom (50+ sq ft); the master adds a dressing room (45+ sq ft) between bedroom and bath.',
      'A study, a ground-floor guest suite, a large terrace/balcony (80+ sq ft) and parking for at least two cars.',
      'Public wing and private wing are separated by a gallery; a family lounge upstairs.'
    ],
    avoid: ['Shared bathrooms for bedrooms', 'Small cellular rooms', 'Rooms added only to raise the count']
  },
  {
    id: 'luxury-site', topic: 'Modern Luxury: site, privacy and views', category: 'style', styles: ['modern_luxury'],
    keywords: ['orientation', 'site', 'plot', 'privacy', 'view', 'garden', 'pool'],
    guidelines: [
      'Needs generous plots (60 ft+ frontage); on narrower plots reduce parking and drop the guest suite before shrinking bedrooms.',
      'Private garden or water court on the quiet rear side; the great room opens to it through full-height sliding glass.',
      'The street front is composed and private: a gated entry court and a solid screen with controlled openings.',
      'Master suite takes the best aspect and has direct access to a terrace.'
    ]
  },
  {
    id: 'luxury-checklist', topic: 'Modern Luxury: plan checklist', category: 'style', styles: ['modern_luxury'],
    keywords: ['check', 'validate', 'plan'],
    guidelines: [
      'Living is 260+ sq ft; every bedroom has an attached bathroom; the master has a dressing room.',
      'A study, a guest room, a large terrace and two-car parking exist.',
      'Public and private wings are clearly separate.',
      'Materials: large-format stone, bronze or black metal accents, deep cantilevered slabs.'
    ]
  }
];
