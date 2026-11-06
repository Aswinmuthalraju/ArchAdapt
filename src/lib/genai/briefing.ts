import { DesignConstraints } from '@/types/architectural';
import type { ArchId } from '@/lib/design/planner/model';
import type { DesignIntent } from '@/lib/design/planner';

/**
 * Stage 1 of generation: turn the client's own words into verified facts and planning pressure.
 * This is deterministic on purpose. It never invents hard requirements (those come from the form),
 * it only reads what the client wrote, flags contradictions with the form, and converts what is left
 * into soft adjacency/privacy weights and a preferred planning idea that the optimiser can act on.
 */
export interface ExtractedFacts {
  /** Lower-cased, whitespace-normalised text the facts were read from. */
  text: string;
  household: { elders: boolean; children: boolean; remoteWork: boolean; entertains: boolean; pets: boolean; accessibility: boolean };
  /** Spaces named in the notes that the form did not switch on. Offered to the planner as optional, never forced. */
  extraSpaces: { space: string; evidence: string }[];
  /** Planning preferences read from the notes. */
  preferences: { openPlan: boolean; separateKitchen: boolean; privacy: boolean; courtyard: boolean; cross: boolean; compact: boolean };
  vastu: boolean;
  /** Contradictions between the notes and the form, stated plainly. The form wins. */
  conflicts: string[];
  /** One line per fact, for showing the client what was understood. */
  understood: string[];
}

const has = (text: string, re: RegExp) => re.test(text);
const first = (text: string, re: RegExp) => text.match(re)?.[0] ?? '';

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const toNumber = (token: string) => (NUMBER_WORDS[token] ?? Number(token));

export function preprocessBrief(custom: string | undefined, constraints: DesignConstraints): ExtractedFacts {
  const text = (custom || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const understood: string[] = [];
  const conflicts: string[] = [];
  const extraSpaces: ExtractedFacts['extraSpaces'] = [];
  const addFact = (line: string) => { if (!understood.includes(line)) understood.push(line); };

  const household = {
    elders: has(text, /\b(elder|elderly|grand ?(parent|mother|father|ma|pa)|senior|old (parents|age)|aged|parents? (live|stay)|wheel ?chair|walker|knee|mobility)\b/),
    children: has(text, /\b(kid|kids|child|children|toddler|baby|school)\b/),
    remoteWork: has(text, /\b(work from home|wfh|home office|remote work|work ?space|study|office room|zoom|meetings?)\b/),
    entertains: has(text, /\b(entertain|guests?|parties|party|gatherings?|festival|relatives|visitors|hosting)\b/),
    pets: has(text, /\b(dog|dogs|cat|cats|pet|pets)\b/),
    accessibility: has(text, /\b(wheel ?chair|accessible|no stairs|step[- ]free|ramp|barrier[- ]free|ground floor bedroom)\b/)
  };
  if (household.elders) addFact('Elderly family members: a ground-floor bedroom with an attached bathroom and a short, level route to it.');
  if (household.accessibility) addFact('Accessibility requested: step-free ground floor sleeping, generous door clearances.');
  if (household.children) addFact('Children in the household: bedrooms grouped close together, and a family lounge near them.');
  if (household.remoteWork) addFact('Working from home: a quiet workspace away from the kitchen and the bedrooms.');
  if (household.entertains) addFact('Entertaining: living and dining kept together near the entrance, with the kitchen right beside the dining room.');
  if (household.pets) addFact('Pets: a utility or sit-out with a direct way to the outside.');

  const preferences = {
    openPlan: has(text, /\b(open[- ]plan|open kitchen|open concept|flow(ing)? (living|space)|airy|connected (living|spaces))\b/),
    separateKitchen: has(text, /\b(separate kitchen|closed kitchen|enclosed kitchen|smell|cooking smell|heavy cooking|indian cooking)\b/),
    privacy: has(text, /\b(privacy|private|screened|away from (the )?(road|street|guests)|quiet bedrooms?)\b/),
    courtyard: has(text, /\b(courtyard|nadumuttam|chowk|aangan|atrium|inner (court|garden)|light ?well)\b/),
    cross: has(text, /\b(cross[- ]?ventilation|breeze|airflow|natural (light|ventilation)|bright|well[- ]lit)\b/),
    compact: has(text, /\b(compact|efficient|no wasted|minimal circulation|budget|low[- ]cost|economical)\b/)
  };
  if (preferences.openPlan) addFact('Open plan preferred: living, dining and kitchen run together with minimal walls.');
  if (preferences.separateKitchen) addFact('A closed kitchen with its own exterior wall for ventilation.');
  if (preferences.privacy) addFact('Privacy is a priority: bedrooms screened from public rooms and the street.');
  if (preferences.courtyard) addFact('An internal courtyard is wanted for light and air.');
  if (preferences.cross) addFact('Natural light and cross-ventilation matter: rooms with windows on two walls.');
  if (preferences.compact) addFact('Compactness and low circulation area matter.');
  const vastu = has(text, /\b(vastu|vaastu|vasthu|ishan|north[- ]east puja)\b/);
  if (vastu) addFact('Vastu-minded: the puja room toward the north-east, the kitchen toward the south-east, bedrooms toward the south-west where the plot allows.');

  const extra = (space: string, re: RegExp, on: boolean) => {
    if (on) return;
    const evidence = first(text, re);
    if (evidence) { extraSpaces.push({ space, evidence }); addFact(`"${evidence}" was mentioned but is not switched on in the form: offered as an optional space, not required.`); }
  };
  extra('prayerRoom', /\b(puja|pooja|prayer|mandir)( room)?\b/, constraints.requiredSpaces.includes('prayerRoom'));
  extra('studyWorkspace', /\b(study|home office|work ?space|office room)\b/, constraints.requiredSpaces.includes('studyWorkspace'));
  extra('guestRoom', /\b(guest (room|bedroom)|spare room)\b/, constraints.requiredSpaces.includes('guestRoom'));
  extra('balcony', /\b(balcony|terrace|sit[- ]?out)\b/, constraints.requiredSpaces.includes('balcony'));
  extra('storage', /\b(store ?room|storage|pantry)\b/, constraints.requiredSpaces.includes('storage'));

  // Contradictions between the notes and the form. The form is authoritative; the client is told.
  const bedroomClaim = text.match(/\b(one|two|three|four|five|six|\d)[- ]?(bed ?room|bhk|br)\b/);
  if (bedroomClaim) {
    const n = toNumber(bedroomClaim[1]);
    if (Number.isFinite(n) && n !== constraints.bedrooms) conflicts.push(`Your notes say ${n} bedrooms but the form says ${constraints.bedrooms}. The form value (${constraints.bedrooms}) is used.`);
  }
  const floorClaim = text.match(/\b(single[- ]storey|single[- ]story|one[- ]floor|double[- ]storey|double[- ]story|two[- ]floor|g\+1|g\+2|ground plus (one|two))\b/);
  if (floorClaim) {
    const claimed = /single|one[- ]floor/.test(floorClaim[1]) ? 1 : /g\+2|plus two/.test(floorClaim[1]) ? 3 : 2;
    if (claimed !== constraints.floors) conflicts.push(`Your notes suggest ${claimed} floor(s) but the form says ${constraints.floors}. The form value is used.`);
  }
  if (household.accessibility && constraints.floors > 1 && !constraints.modes.includes('life_stage')) {
    conflicts.push('You asked for step-free living on a multi-storey plan. Switch on Life-Stage mode to guarantee a ground-floor bedroom and bathroom.');
  }
  if (preferences.openPlan && preferences.separateKitchen) conflicts.push('Your notes ask for both an open plan and a closed kitchen. The kitchen is kept enclosed with a wide opening to the dining room.');
  if (preferences.compact && preferences.courtyard && constraints.budgetRange === 'Economy') conflicts.push('A courtyard adds floor area; with an Economy budget it will be kept as small as is usable.');

  return { text, household, extraSpaces, preferences, vastu, conflicts, understood };
}

/** Converts understood facts into pressure the optimiser can act on. */
export function intentFromFacts(facts: ExtractedFacts, constraints: DesignConstraints): DesignIntent {
  const adjacency: NonNullable<DesignIntent['adjacency']> = [];
  const reasons: string[] = [];
  const archetypes: ArchId[] = [];
  const link = (a: string, b: string, weight: number, kind: 'adj' | 'near' | 'avoid' = 'adj') => adjacency.push({ a, b, weight, kind });

  if (facts.household.entertains) {
    link('living', 'dining', 9); link('kitchen', 'dining', 9); link('living', 'entrance', 8);
    reasons.push('You entertain: living, dining and kitchen are kept together and close to the entrance.');
    archetypes.push('compact');
  }
  if (facts.preferences.openPlan) {
    link('living', 'dining', 9); link('kitchen', 'dining', 9);
    reasons.push('Open plan: living and dining share a wall with the kitchen beside the dining room.');
    archetypes.push('compact');
  }
  if (facts.preferences.separateKitchen) link('kitchen', 'bedroom', 6, 'avoid');
  if (facts.household.remoteWork) {
    link('study', 'entrance', 3, 'near'); link('study', 'kitchen', 4, 'avoid'); link('study', 'bedroom', 3, 'avoid');
    reasons.push('Working from home: the study is kept near the entrance and away from the kitchen and bedrooms.');
  }
  if (facts.preferences.privacy || facts.household.elders) {
    link('bedroom', 'living', 5, 'avoid'); link('master_bedroom', 'living', 5, 'avoid'); link('master_bedroom', 'entrance', 5, 'avoid');
    reasons.push('Privacy: bedrooms are kept apart from the living room and the entrance.');
    archetypes.push('spine', 'wings');
  }
  if (facts.household.children) {
    link('bedroom', 'lounge', 3, 'near'); link('bedroom', 'bedroom', 2, 'near');
    reasons.push('Children: bedrooms are grouped and the family lounge is placed near them.');
    archetypes.push('hub');
  }
  if (facts.household.elders || facts.household.accessibility) {
    link('master_bedroom', 'bathroom', 9);
    reasons.push('Elderly or step-free needs: the ground-floor bedroom keeps its bathroom directly attached.');
  }
  if (facts.vastu) {
    link('puja', 'entrance', 3, 'near'); link('puja', 'living', 3, 'near'); link('puja', 'bathroom', 6, 'avoid');
    reasons.push('Vastu: the puja room is kept near the entrance and away from bathrooms.');
  }
  if (facts.preferences.courtyard || constraints.requiredSpaces.includes('courtyard')) archetypes.push('courtyard');
  if (facts.preferences.compact || constraints.modes.includes('budget_first')) {
    archetypes.push('compact', 'hub');
    reasons.push('Compact and economical: layouts with the least corridor area are favoured.');
  }
  if (facts.preferences.cross) reasons.push('Natural light and cross-ventilation: rooms on two exterior walls are favoured.');
  return { adjacency, preferredArchetypes: Array.from(new Set(archetypes)), reasons };
}

/** Merges the AI's reading of the brief with the deterministic one. Where both speak, the stronger weight wins. */
export function mergeIntent(ai: DesignIntent | undefined, rule: DesignIntent): DesignIntent {
  if (!ai) return rule;
  const key = (l: { a: string; b: string; kind?: string }) => `${[l.a, l.b].sort().join('|')}|${l.kind || 'adj'}`;
  const merged = new Map<string, NonNullable<DesignIntent['adjacency']>[number]>();
  for (const l of [...(rule.adjacency || []), ...(ai.adjacency || [])]) {
    const k = key(l);
    const prior = merged.get(k);
    if (!prior || l.weight > prior.weight) merged.set(k, l);
  }
  return {
    adjacency: [...merged.values()],
    preferredArchetypes: Array.from(new Set([...(ai.preferredArchetypes || []), ...(rule.preferredArchetypes || [])])),
    reasons: [...(ai.reasons || []).map((r) => `AI: ${r}`), ...(rule.reasons || [])]
  };
}

/** Facts as a block for the AI prompt. The AI is told these were verified from the client's text, so it does not re-guess them. */
export function factsBlock(facts: ExtractedFacts): string {
  if (!facts.text) return 'CLIENT NOTES: none were written. Do not invent preferences the client did not state.';
  const lines = [
    `CLIENT NOTES (verbatim): "${facts.text.replace(/"/g, "'").slice(0, 700)}"`,
    facts.understood.length ? `WHAT WAS UNDERSTOOD (verified by rule, treat as given):\n${facts.understood.map((l) => `- ${l}`).join('\n')}` : 'No specific preference could be read from the notes.',
    facts.conflicts.length ? `CONFLICTS (the form wins; mention them in your reasoning):\n${facts.conflicts.map((l) => `- ${l}`).join('\n')}` : ''
  ].filter(Boolean);
  return lines.join('\n');
}
