exec(open('tests/tools/_p13.py', encoding='utf-8').read().split('# ---- types ----')[0])  # reuse edit()
exec(open('tests/tools/_p13.py', encoding='utf-8').read().split('# ---- types ----')[1].join(['# ---- types ----', '']))

# ---- prompts ----
edit('src/lib/genai/prompts.ts', [
("import { styleDirectiveBlock } from '@/lib/design/styleBlueprints';", "import { styleDirectiveBlock } from '@/lib/design/styleBlueprints';\nimport { factsBlock, ExtractedFacts } from './briefing';"),
("""HOW THE PLAN IS ORGANISED
- The road is always the plan FRONT. Each floor is divided into three zones by depth from the road:
  "front" (arrival and public rooms), "middle" (the circulation zone, which also holds the staircase)
  and "rear" (quiet rooms).
- Within a zone, rooms sit side by side. "side" says where: "left", "center" or "right" as seen on the
  plan with the road at the top. The compass direction of each side is given to you.
- A room with "attachedTo" shares a wall and a door with that room. Bathrooms, dressing rooms and stores
  attached to a room are stacked beside it; an entrance/verandah, balcony or utility attached to a room
  sits in the same column on its outward side.
- The staircase is added by the engine at the "stairSide" end of the middle zone. Put the kitchen at the
  OTHER end of the middle zone and a living/dining/lounge room next to the stair.
- The engine adds stairs, passages and roof terraces itself. Never output rooms of type stair, passage or void.""", """HOW THE PLAN IS MADE
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
  Never output rooms of type stair, passage or void."""),
("  ragContext: string;\n}", "  ragContext: string;\n  /** Facts read from the client's own notes by the rule-based reader. */\n  facts?: ExtractedFacts;\n}"),
("""  "architecturalBrief": {
    "planningIntent": "", "siteResponse": "", "orientationStrategy": "", "publicPrivateStrategy": "", "serviceStrategy": "",
    "circulationStrategy": "", "climateStrategy": "", "accessibilityStrategy": "", "styleStrategy": ""
  },""", """  "intent": {
    "priorities": ["up to 5 short phrases in the client's terms, most important first"],
    "adjacency": [{ "a": "room id or room type", "b": "room id or room type", "weight": 7, "kind": "adj | near | avoid" }],
    "preferredArchetypes": ["spine | hub | wings | courtyard | compact"],
    "reasons": ["one sentence each, linking something the client said or the site demands to a planning decision"]
  },
  "architecturalBrief": {
    "planningIntent": "", "siteResponse": "", "orientationStrategy": "", "publicPrivateStrategy": "", "serviceStrategy": "",
    "circulationStrategy": "", "climateStrategy": "", "accessibilityStrategy": "", "styleStrategy": ""
  },"""),
("- Use relationships to state the reasoning the geometry must honour; do not list relationships you do not need.`;", """- Use relationships to state the reasoning the geometry must honour; do not list relationships you do not need.
- INTENT: at most 12 adjacency entries, only for relationships that matter for THIS household. Weight 8-10 = must touch, 5-7 = strongly preferred, 1-4 = mild. kind "avoid" keeps two rooms apart (a bedroom from the street-facing living room). preferredArchetypes: spine = a passage separates public rooms from bedrooms; hub = bedrooms open off a family lounge; wings = public wing and private wing; courtyard = rooms around an open court; compact = living-dining-kitchen as one open space. Choose at most two, and say why in "reasons".
- Never invent a hard requirement the client did not state. Spaces the client mentioned in their notes but did not switch on in the form may be added as rooms with "required": false.`;"""),
("""    siteBlock(input),
    requirementsBlock(input),""", """    siteBlock(input),
    requirementsBlock(input),
    input.facts ? factsBlock(input.facts) : '',"""),
])

# ---- parse intent in program.ts ----
edit('src/lib/design/program.ts', [
("  ArchitecturalBrief,\n  DesignConstraints,", "  ArchitecturalBrief,\n  DesignConstraints,\n  DesignIntent,"),
("    architecturalBrief: parseBrief(raw.architecturalBrief),\n    rationale:", "    architecturalBrief: parseBrief(raw.architecturalBrief),\n    intent: parseIntent(raw.intent, rooms),\n    rationale:"),
("function parseBrief(value: unknown)", """const ARCHETYPE_IDS = ['spine', 'hub', 'wings', 'courtyard', 'compact'];

/** Validates the AI's intent block: unknown rooms, silly weights and unknown planning ideas are dropped, not trusted. */
export function parseIntent(value: unknown, rooms: ProgramRoom[]): DesignIntent | undefined {
  if (!isRecord(value)) return undefined;
  const known = (ref: string) => rooms.some((room) => room.id === ref || room.type === ref || room.id === `room-${ref}`) ? (rooms.some((room) => room.id === `room-${ref}`) ? `room-${ref}` : ref) : '';
  const adjacency = Array.isArray(value.adjacency)
    ? value.adjacency.filter(isRecord).slice(0, 12).map((link) => {
        const a = known(str(link.a));
        const b = known(str(link.b));
        const weight = Math.max(1, Math.min(10, num(link.weight) ?? 5));
        const kind = ['adj', 'near', 'avoid'].includes(str(link.kind)) ? (str(link.kind) as 'adj' | 'near' | 'avoid') : 'adj';
        return { a, b, weight, kind };
      }).filter((link) => link.a && link.b && link.a !== link.b)
    : [];
  const preferredArchetypes = strList(value.preferredArchetypes).filter((id) => ARCHETYPE_IDS.includes(id)).slice(0, 2);
  const priorities = strList(value.priorities).slice(0, 5);
  const reasons = strList(value.reasons).slice(0, 8);
  if (!adjacency.length && !preferredArchetypes.length && !priorities.length && !reasons.length) return undefined;
  return { adjacency, preferredArchetypes, priorities, reasons };
}

function parseBrief(value: unknown)"""),
])

# ---- pipeline ----
edit('src/lib/design/pipeline.ts', [
("import { callGeminiJson, geminiApiKey } from '@/lib/genai/gemini';", "import { callGeminiJson, geminiApiKey } from '@/lib/genai/gemini';\nimport { intentFromFacts, mergeIntent, preprocessBrief } from '@/lib/genai/briefing';"),
("""  const planOptions: PlanLayoutOptions = {
    hot: baseConstraintsHot(baseConstraints, climateZone),""", """  const facts = preprocessBrief(custom, constraints);
  const ruleIntent = intentFromFacts(facts, constraints);
  const planOptions: PlanLayoutOptions = {
    intent: ruleIntent,
    hot: baseConstraintsHot(baseConstraints, climateZone),"""),
("    stamp(baseline.design, intent, 'local-rule-engine', 'local-rule-engine', 1, conceptNumber);", "    stamp(baseline.design, intent, 'local-rule-engine', 'local-rule-engine', 1, conceptNumber);\n    baseline.design.briefReading = { understood: facts.understood, conflicts: facts.conflicts, reasons: ruleIntent.reasons || [], source: 'rules' };"),
("    ragContext: getRelevantKnowledge(custom, preferences.modes || [], constraints.style)\n  };", "    ragContext: getRelevantKnowledge(custom, preferences.modes || [], constraints.style),\n    facts\n  };"),
("    const stage = realiseProgram(parsed.program, site, constraints, planOptions);", "    const aiIntent = parsed.program.intent;\n    const stage = realiseProgram(parsed.program, site, constraints, { ...planOptions, intent: mergeIntent(aiIntent, ruleIntent) });"),
("      stamp(stage.design, intent, 'gemini', call.modelId, attempts, conceptNumber);", "      stamp(stage.design, intent, 'gemini', call.modelId, attempts, conceptNumber);\n      const merged = mergeIntent(aiIntent, ruleIntent);\n      stage.design.briefReading = { understood: facts.understood, conflicts: facts.conflicts, reasons: merged.reasons || [], source: aiIntent ? 'ai+rules' : 'rules' };"),
])
