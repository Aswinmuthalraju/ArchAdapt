def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        assert old in s, (path, old[:70])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8', newline='').write(s)

# ---- types ----
edit('src/types/architectural.ts', [
("export interface PlannerAlternative {", """/** What the client's words mean for the plan: weighted adjacency, a preferred planning idea and the reasons for both. */
export interface DesignIntent {
  /** Pairs of room ids or room types. weight 1-10: 8+ must touch, 1-4 mild preference. */
  adjacency?: { a: string; b: string; weight: number; kind?: 'adj' | 'near' | 'avoid' }[];
  preferredArchetypes?: string[];
  priorities?: string[];
  reasons?: string[];
}

/** What was understood from the client's notes, shown back to them. */
export interface BriefReading {
  understood: string[];
  conflicts: string[];
  reasons: string[];
  /** 'ai' when Gemini contributed intent, 'rules' when only the built-in reader did. */
  source: 'ai+rules' | 'rules';
}

export interface PlannerAlternative {"""),
("  generationMetadata?: DesignGenerationMetadata;\n  /** How the plan", "  generationMetadata?: DesignGenerationMetadata;\n  briefReading?: BriefReading;\n  /** How the plan"),
("  appearance?: HouseAppearance;\n}\n\nexport interface FloorPlanRoom", "  appearance?: HouseAppearance;\n  /** What the AI (or the rule reader) concluded about the client's priorities. */\n  intent?: DesignIntent;\n}\n\nexport interface FloorPlanRoom") if False else ("export interface DesignProgram {\n  rooms: ProgramRoom[];", "export interface DesignProgram {\n  /** What the client's words mean for the plan (adjacency weights, preferred planning idea). */\n  intent?: DesignIntent;\n  rooms: ProgramRoom[];"),
])

# ---- planner uses the shared type ----
edit('src/lib/design/planner/optimizer.ts', [
("""export interface DesignIntent {
  /** Pairs of room types (or ids) that should share a wall, with a weight 1-10, from the AI brief. */
  adjacency?: { a: string; b: string; weight: number; kind?: 'adj' | 'near' | 'avoid' }[];
  /** Archetypes the brief favours, best first. */
  preferredArchetypes?: ArchId[];
  /** Plain-language reasons shown to the user. */
  reasons?: string[];
}
""", ""),
("import {\n  DesignConstraints, DesignProgram, ProgramRoom, RoomType, SiteInfo, StructuredDesignJSON\n} from '@/types/architectural';", "import {\n  DesignConstraints, DesignIntent, DesignProgram, ProgramRoom, RoomType, SiteInfo, StructuredDesignJSON\n} from '@/types/architectural';"),
])
edit('src/lib/design/planner/index.ts', [
("export type { DesignIntent } from './optimizer';\n", "export type { DesignIntent } from '@/types/architectural';\n"),
("import { DesignConstraints, DesignProgram, PlannerAlternative, SiteInfo, StructuredDesignJSON } from '@/types/architectural';", "import { DesignConstraints, DesignProgram, PlannerAlternative, SiteInfo, StructuredDesignJSON } from '@/types/architectural';\nimport { ARCHETYPES } from './model';"),
("  const avoid = new Set(options.avoid || []);\n  ranked.sort((a, b) => (avoid.has(a.id) ? 1 : 0) - (avoid.has(b.id) ? 1 : 0) || b.quality.score - a.quality.score);", """  const avoid = new Set(options.avoid || []);
  // An archetype the client's words point to gets a small, disclosed head start (never enough to beat an invalid or clearly worse plan).
  const favoured = new Set((options.intent?.preferredArchetypes || []).filter((id) => id in ARCHETYPES));
  const FAVOUR = 2.5;
  const rankScore = (r: RankedPlan) => r.quality.score + (favoured.has(r.id) ? FAVOUR : 0);
  ranked.sort((a, b) => (avoid.has(a.id) ? 1 : 0) - (avoid.has(b.id) ? 1 : 0) || rankScore(b) - rankScore(a));"""),
("  const weakest = [...best.quality.parts]", "  if (favoured.has(best.id)) rationale.push(`${best.label} also matches what your notes asked for, which counted for ${FAVOUR} points.`);\n  const weakest = [...best.quality.parts]"),
])
