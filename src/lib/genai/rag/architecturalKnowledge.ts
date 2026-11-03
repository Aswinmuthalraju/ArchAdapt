import { NormalizedStyle, normalizeStyleName } from '@/lib/design/styleNormalizer';
import { STYLE_KNOWLEDGE } from './styleKnowledge';

export interface ArchitecturalKnowledgeItem {
  id: string;
  topic: string;
  category: 'style' | 'climate' | 'lifestage' | 'budget' | 'renovation' | 'circulation' | 'planning';
  /** Style-specific knowledge is only ever retrieved for these styles, so traditions never leak into each other. */
  styles?: NormalizedStyle[];
  /** Words in the client's brief that make this item relevant. */
  keywords: string[];
  guidelines: string[];
  /** Things this tradition does not do; given to the planner so styles stay distinct. */
  avoid?: string[];
}

const CORE_KNOWLEDGE: ArchitecturalKnowledgeItem[] = [
  // ---------------- Kerala Traditional ----------------
  {
    id: 'kerala-plan', topic: 'Kerala Traditional: Nalukettu planning', category: 'style', styles: ['kerala_traditional'],
    keywords: ['nalukettu', 'nadumuttam', 'kerala', 'courtyard', 'tharavad'],
    guidelines: [
      'The plan is a Nalukettu: four blocks (kettu) face an open-to-sky Nadumuttam, so the courtyard is enclosed by rooms on all four sides and sits at the centre of the house, never against an outside wall.',
      'A Nadumuttam is only built when it can be a real court: at least about 9 ft x 9 ft of open sky with rooms around it. On a narrow or shallow plot it is left out rather than shrunk into a slot.',
      'The verandah around the court (the inner Chuttu-varanda) is the circulation; rooms open onto it instead of onto corridors.',
      'Arrival is the Poomukham, a deep open sit-out with a raised Charupadi seat, leading into the formal living room.'
    ],
    avoid: ['Courtyards pushed to the side of the plan or used as leftover space', 'Open-plan glazed living areas', 'Flat roofs and cantilevers']
  },
  {
    id: 'kerala-elements', topic: 'Kerala Traditional: rooms and their placement', category: 'style', styles: ['kerala_traditional'],
    keywords: ['puja', 'pooja', 'prayer', 'store', 'ara', 'kitchen', 'vastu'],
    guidelines: [
      'A Puja room (prayer room) in the quiet north-east, away from the kitchen and bathrooms.',
      'An Ara (store) for grain and household goods, next to the kitchen.',
      'The kitchen (Adukkala) sits in the south-east, on the service side, venting into the court or the rear yard.',
      'Bedrooms in the rear and upper blocks, entered from the verandah, each with a window to the outside.'
    ]
  },
  {
    id: 'kerala-envelope', topic: 'Kerala Traditional: roof, walls and materials', category: 'style', styles: ['kerala_traditional'],
    keywords: ['roof', 'tile', 'laterite', 'timber', 'eaves'],
    guidelines: [
      'Steep hipped and gabled roofs with clay Mangalore tiles and deep eaves (3 ft or more) shed monsoon rain and shade the walls.',
      'Laterite or plastered masonry walls on a raised plinth; teak or jack-wood columns, doors and wooden grille (azhi) screens.',
      'Small, deeply shaded windows; daylight and air come mostly from the courtyard and the verandahs.'
    ]
  },

  // ---------------- Traditional Indian ----------------
  {
    id: 'traditional-plan', topic: 'Traditional Indian: haveli / chowk planning', category: 'style', styles: ['traditional_indian'],
    keywords: ['haveli', 'chowk', 'aangan', 'courtyard', 'vastu', 'traditional'],
    guidelines: [
      'Rooms form a ring around a central Chowk (Aangan), the family\'s open-to-sky social space; the Chowk is enclosed by rooms on all sides.',
      'A formal Baithak (living room) next to the entrance receives guests, with a separate guest room so visitors never enter the family zone.',
      'Vastu orientation: the Ishan (north-east) corner stays light and holds the puja room; the kitchen is in the south-east (Agni) corner; the master bedroom in the south-west.',
      'The entrance is a verandah (otla) with jali screens that filter light and give privacy from the street.'
    ],
    avoid: ['Elements borrowed from other regional traditions', 'Open-plan merging of the Baithak with the family rooms', 'Large unshaded glass walls']
  },
  {
    id: 'traditional-envelope', topic: 'Traditional Indian: materials and details', category: 'style', styles: ['traditional_indian'],
    keywords: ['jali', 'stone', 'jharokha', 'arch'],
    guidelines: [
      'Load-bearing stone or brick with lime plaster, carved timber doors and stone or terracotta jali screens.',
      'Jharokha-style projecting windows on the street front; arched openings onto the Chowk.',
      'Thick walls and small outer openings keep the interior cool; the Chowk provides daylight.'
    ]
  },

  // ---------------- Colonial ----------------
  {
    id: 'colonial-plan', topic: 'Colonial: formal symmetrical planning', category: 'style', styles: ['colonial'],
    keywords: ['colonial', 'portico', 'symmetry', 'bungalow', 'formal'],
    guidelines: [
      'A symmetrical front: a colonnaded portico on the central axis opens to a formal drawing room, with the dining room directly beyond on the same axis.',
      'Rooms are distinct and enclosed, each with its own door, arranged as balanced wings either side of the central hall.',
      'A separate study or library near the front, a veranda along the front or rear, and generous high-ceilinged rooms.'
    ],
    avoid: ['Courtyard-centred planning', 'Open-plan living-dining-kitchen', 'Asymmetric, stepped massing']
  },
  {
    id: 'colonial-envelope', topic: 'Colonial: elevation and materials', category: 'style', styles: ['colonial'],
    keywords: ['columns', 'pediment', 'shutters', 'hip roof'],
    guidelines: [
      'Classical columns or square piers at the portico, a hipped roof with a modest overhang, and a pediment or parapet over the entrance.',
      'Tall vertical windows in regular bays with louvred shutters and transom ventilators above doors.',
      'Lime-washed or painted plaster walls, a raised plinth with front steps.'
    ]
  },

  // ---------------- Tropical ----------------
  {
    id: 'tropical-plan', topic: 'Tropical: open, ventilated planning', category: 'style', styles: ['tropical'],
    keywords: ['tropical', 'breeze', 'ventilation', 'garden', 'courtyard', 'verandah'],
    guidelines: [
      'Rooms one room deep wherever possible so every habitable room has openings on two sides for cross-ventilation.',
      'An open-to-sky court enclosed by rooms (or, on a narrow plot, garden and verandah edges instead) brings light and air into the middle of the plan.',
      'Wide shaded verandahs and a breeze porch at arrival extend the living spaces outdoors.'
    ],
    avoid: ['Deep windowless middle rooms', 'Sealed glass boxes', 'Heavy classical ornament']
  },
  {
    id: 'tropical-envelope', topic: 'Tropical: roof and shading', category: 'style', styles: ['tropical'],
    keywords: ['louvre', 'eaves', 'timber', 'shade'],
    guidelines: [
      'A floating, low-pitched roof with very deep eaves; operable timber louvres and screens instead of solid walls where privacy allows.',
      'Raised floors and permeable materials; planting close to the house to cool incoming air.'
    ]
  },

  // ---------------- Minimalist ----------------
  {
    id: 'minimalist-plan', topic: 'Minimalist: compact, quiet planning', category: 'style', styles: ['minimalist'],
    keywords: ['minimal', 'minimalist', 'simple', 'clean', 'storage', 'compact'],
    guidelines: [
      'A compact plan with a single clear spine; living, dining and kitchen form one uninterrupted space.',
      'Built-in, concealed storage (a store room and full-height joinery) keeps every room free of clutter.',
      'Every room is sized for what it needs and no more; no rooms the client did not ask for.'
    ],
    avoid: ['Courtyards, puja rooms, guest rooms or ornamental rooms that were not requested', 'Decorative mouldings and pitched tile roofs', 'Many small windows']
  },
  {
    id: 'minimalist-envelope', topic: 'Minimalist: form and materials', category: 'style', styles: ['minimalist'],
    keywords: ['white', 'concrete', 'flat roof', 'frameless'],
    guidelines: [
      'A pure rectilinear volume with a thin flat roof slab and no overhangs.',
      'A restrained palette: white or grey render, exposed concrete, light timber; frameless openings placed with intent.'
    ]
  },

  // ---------------- Modern ----------------
  {
    id: 'modern-plan', topic: 'Modern: open orthogonal planning', category: 'style', styles: ['modern'],
    keywords: ['modern', 'open plan', 'glass'],
    guidelines: [
      'Open-plan living, dining and kitchen along a straight circulation spine; the living room is the largest room.',
      'A compact entrance; area goes to the shared living spaces and to large openings toward the garden.'
    ],
    avoid: ['Traditional courtyards and ritual rooms unless requested', 'Pitched tile roofs and ornament']
  },
  {
    id: 'modern-envelope', topic: 'Modern: massing and materials', category: 'style', styles: ['modern'],
    keywords: ['cantilever', 'parapet', 'glass'],
    guidelines: [
      'Flat roofs with parapets, a cantilevered upper volume and floor-to-ceiling sliding glass onto the garden.',
      'Plaster, concrete and aluminium in a calm palette.'
    ]
  },

  // ---------------- Contemporary ----------------
  {
    id: 'contemporary-plan', topic: 'Contemporary: asymmetric, stepped planning', category: 'style', styles: ['contemporary'],
    keywords: ['contemporary', 'asymmetric', 'terrace', 'home office', 'study'],
    guidelines: [
      'An L-shaped or stepped plan; upper floors are offset from the ground floor to create terraces and a sculpted mass.',
      'A home office or study, and a generous balcony or terrace that extends the main living space.',
      'Flexible, multi-use rooms such as an upper family lounge that doubles as a workspace.'
    ],
    avoid: ['Strict symmetry', 'Courtyard-ring planning', 'Heritage ornament']
  },
  {
    id: 'contemporary-envelope', topic: 'Contemporary: envelope', category: 'style', styles: ['contemporary'],
    keywords: ['louvre', 'cladding', 'stone'],
    guidelines: [
      'Mixed cladding (stone, timber, metal), vertical solar fins or louvres on hot faces, and deep reveals.',
      'Large openings to the terraces, smaller ones on the street front.'
    ]
  },

  // ---------------- Modern Luxury ----------------
  {
    id: 'luxury-plan', topic: 'Modern Luxury: zoned, private planning', category: 'style', styles: ['modern_luxury'],
    keywords: ['luxury', 'premium', 'villa', 'ensuite', 'dressing'],
    guidelines: [
      'Public and private wings are clearly separated; a grand entrance leads to a very large living room (260 sq ft or more).',
      'Every bedroom has its own attached bathroom; the master suite adds a dressing room between the bedroom and its bath.',
      'A study, a guest suite, a large terrace and parking for at least two cars.'
    ],
    avoid: ['Small cellular rooms', 'Shared bathrooms for bedrooms', 'Rooms added only to raise the count']
  },
  {
    id: 'luxury-envelope', topic: 'Modern Luxury: envelope', category: 'style', styles: ['modern_luxury'],
    keywords: ['double height', 'stone', 'bronze'],
    guidelines: [
      'A double-height living volume, deep cantilevered terrace slabs and large-format stone with metal accents.'
    ]
  },

  // ---------------- Style-neutral knowledge ----------------
  {
    id: 'climate-warm-humid', topic: 'Climate-adaptive design (warm & humid)', category: 'climate',
    keywords: ['climate', 'hot', 'humid', 'monsoon', 'ventilation', 'heat'],
    guidelines: [
      'Put living rooms and bedrooms on the north and east; service rooms, parking and the stair buffer the west and south-west.',
      'Give habitable rooms openings on two walls for cross-ventilation; let hot air escape high up (clerestories, a stair shaft or a light well).',
      'Shade windows with overhangs and narrow any west-facing glazing.'
    ]
  },
  {
    id: 'lifestage', topic: 'Life-stage adaptability and ageing in place', category: 'lifestage',
    keywords: ['elderly', 'parents', 'accessible', 'wheelchair', 'aging', 'senior'],
    guidelines: [
      'At least one bedroom with an attached accessible bathroom on the ground floor (Aging in Place).',
      'Step-free entrance and 3.5 ft doors and 4.5 ft passages for wheelchair or walker use.',
      'A flexible room near the entrance that can become a bedroom later.'
    ]
  },
  {
    id: 'budget', topic: 'Budget-first optimisation', category: 'budget',
    keywords: ['budget', 'cheap', 'affordable', 'cost', 'economy'],
    guidelines: [
      'A compact rectangular footprint with few corners keeps wall and roof area down.',
      'Wet rooms back-to-back and stacked vertically to shorten plumbing runs.',
      'No rooms that were not asked for; passages only where a room would otherwise be reached through another room.'
    ]
  },
  {
    id: 'renovation', topic: 'Renovation of an existing house', category: 'renovation',
    keywords: ['renovation', 'existing', 'extension', 'remodel'],
    guidelines: [
      'Keep new walls on the existing structural lines and stack rooms over load-bearing walls below.',
      'Without a survey, state which walls are assumed to be retained.'
    ]
  },
  {
    id: 'circulation', topic: 'Doors, stairs and circulation', category: 'circulation',
    keywords: ['stair', 'door', 'passage', 'corridor', 'entrance'],
    guidelines: [
      'Every room is reached without walking through a bedroom or bathroom; the main door opens from the entrance porch into the living room.',
      'The stair is entered at its foot landing from a living space or lobby, with clear headroom and a guarded well on the upper floor.',
      'Doors sit near a room corner so furniture can use the long walls; windows sit on outside walls or face a courtyard.'
    ]
  },
  {
    id: 'vastu-principles', topic: 'Vastu Shastra: spatial orientation and zonation', category: 'planning',
    keywords: ['vastu', 'orientation', 'puja', 'pooja', 'prayer', 'ishan', 'agni', 'nairuti', 'brahmasthan', 'kitchen'],
    guidelines: [
      'Puja room (prayer space) placed in the North-East (Ishan) corner for spiritual calm; keep away from shared bathroom walls.',
      'Kitchen located in the South-East (Agni) quadrant with cooking platform oriented East.',
      'Master bedroom placed in the South-West (Nairuti) corner for stability and privacy.',
      'Central zone (Brahmasthan) kept light and uncluttered (courtyard, light well, or central circulation lobby).',
      'Water elements and main entrances preferred in North/East; heavy storage and stairs placed in South or West.'
    ]
  },
  {
    id: 'climate-composite', topic: 'Regional Climate Adaptations: composite and hot-dry climates', category: 'climate',
    keywords: ['composite', 'hot dry', 'arid', 'summer', 'winter', 'thermal mass', 'shading', 'jali'],
    guidelines: [
      'In hot-dry and composite climates, use thick thermal mass walls and shaded courtyards for diurnal cooling.',
      'Minimize exposed glazing on West and South-West orientations; provide deep vertical fins or jali screens.',
      'Courtyard stack effect purges daytime heat during cool evenings.'
    ]
  },
  {
    id: 'climate-cold-hilly', topic: 'Regional Climate Adaptations: cold and hilly climates', category: 'climate',
    keywords: ['cold', 'hilly', 'mountain', 'insulation', 'solar gain', 'snow', 'roof'],
    guidelines: [
      'Maximize South-facing glazing for passive solar heat gain throughout winter.',
      'Compact building envelope to minimize perimeter heat loss; buffer unheated spaces on North faces.',
      'Steep sloping roofs for snow and rain runoff with insulated ceilings.'
    ]
  },
  {
    id: 'plot-growth-rule', topic: 'Plot-Size Programme Growth and Ground Coverage Rules', category: 'planning',
    keywords: ['plot', 'large plot', 'growth', 'coverage', 'foyer', 'lounge', 'utility', 'garden', 'driveway'],
    guidelines: [
      'On large plots (>= 5,000 sq ft up to 30,000 sq ft), expand the architectural programme into dedicated functional spaces rather than merely enlarging room dimensions.',
      'Add an entrance foyer, separate formal living and family lounge, dedicated dining room, kitchen utility yard, and attached studies/pooja.',
      'Maintain sensible ground coverage between 20% and 45% for large plots, providing generous garden zones, driveways, and setback buffers.',
      'Upper floor rooms should stack over ground-floor load-bearing walls where possible, stepping in with purposeful private terraces rather than large filler hatched blocks.'
    ]
  }
];

/** Core items plus the deeper per-style items for all eight styles. */
export const ARCHITECTURAL_KNOWLEDGE_BASE: ArchitecturalKnowledgeItem[] = [...CORE_KNOWLEDGE, ...STYLE_KNOWLEDGE];

const MODE_CATEGORY: Record<string, ArchitecturalKnowledgeItem['category']> = {
  climate_adaptive: 'climate',
  life_stage: 'lifestage',
  budget_first: 'budget',
  renovation: 'renovation'
};

const words = (text: string) => new Set(text.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 2));

/**
 * Retrieves the knowledge relevant to one brief. Items written for a particular style are only returned for
 * that style, so each tradition reaches the planner on its own terms. The chosen style's items always come
 * first, then the active modes, then style-neutral items that the client's own words point to.
 */
export function retrieveKnowledge(query: string, modes: string[], styleName?: string, limit = 16): ArchitecturalKnowledgeItem[] {
  const style = normalizeStyleName(styleName);
  const wantedCategories = new Set(modes.map((mode) => MODE_CATEGORY[mode] || mode));
  const queryLower = query.toLowerCase();
  const queryWords = words(query);

  const scored = ARCHITECTURAL_KNOWLEDGE_BASE
    .filter((item) => !item.styles || item.styles.includes(style))
    .map((item) => {
      let keywordHits = 0;
      for (const kw of item.keywords) {
        if (queryLower.includes(kw) || kw.split(' ').every((part) => queryWords.has(part))) {
          keywordHits++;
        }
      }
      let contentHits = 0;
      const topicWords = words(item.topic);
      for (const w of Array.from(queryWords)) {
        if (topicWords.has(w)) contentHits += 2;
      }

      const isStyleItem = !!(item.styles && item.styles.includes(style));
      const styleScore = isStyleItem ? 150 : 0;
      const modeScore = wantedCategories.has(item.category) ? 60 : 0;
      const keywordScore = keywordHits * 10 + contentHits * 3;
      const baselineCategoryScore = item.category === 'circulation' ? 5 : item.category === 'planning' ? 8 : 0;

      const score = styleScore + modeScore + keywordScore + baselineCategoryScore;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ item }) => item);
}

export function formatKnowledge(items: ArchitecturalKnowledgeItem[]): string {
  return items.map((item) => [
    `${item.topic}:`,
    ...item.guidelines.map((line) => `- ${line}`),
    ...(item.avoid?.length ? [`Avoid in this style: ${item.avoid.join('; ')}.`] : [])
  ].join('\n')).join('\n\n');
}

export function getRelevantKnowledge(query: string, modes: string[], styleName?: string): string {
  return formatKnowledge(retrieveKnowledge(query, modes, styleName));
}
