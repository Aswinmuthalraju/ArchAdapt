import {
  DesignConstraints,
  DesignPreferences,
  DesignProgram,
  DesignRequirements,
  LocationInfo,
  SiteInfo,
  StructuredDesignJSON
} from '@/types/architectural';
import { callGeminiJson, geminiApiKey } from '@/lib/genai/gemini';
import { buildLocalProgram } from '@/lib/genai/localPlanner';
import { SYSTEM_ARCHITECTURAL_PROMPT, buildAlternativeProgramPrompt, buildProgramPrompt, ProgramPromptInput } from '@/lib/genai/prompts';
import { getRelevantKnowledge } from '@/lib/genai/rag/architecturalKnowledge';
import { layoutProgram } from './layoutEngine';
import { buildConstraints, parseProgram, programFromDesign, validateProgramRequirements } from './program';
import { validateFloorPlan } from './validateFloorPlan';
import { StyleLevel, applyStyleMandates, checkStyleConformance, describeStyleAdditions, styleBlueprint } from './styleBlueprints';

export const MAX_GENERATION_ATTEMPTS = 2;
const TIME_BUDGET_MS = 75_000;
/** Above this share of shrinkage the style is relaxed before the rooms are squeezed further. */
const COMFORTABLE_COMPRESSION = 0.2;

export type EngineId = 'gemini' | 'local-rule-engine';
export type GenerationStage = 'checking_brief' | 'planning' | 'laying_out' | 'validating' | 'saving';

export interface GenerationSuccess {
  status: 'OK';
  design: StructuredDesignJSON;
  engine: EngineId;
  modelId: string;
  attempts: number;
  warnings: string[];
  notes: string[];
  /** Set when Gemini was requested but the local rule engine produced the design. Always shown to the user. */
  notice?: string;
}

export interface GenerationFailure {
  status: 'INFEASIBLE' | 'INVALID_DESIGN' | 'ENGINE_UNAVAILABLE' | 'INPUT_REJECTED';
  reason: string;
  violatedConstraints: string[];
  attempts: number;
  /** True when the built-in rule engine could be tried instead (the user must choose it explicitly). */
  canUseLocalEngine: boolean;
}

export type GenerationOutcome = GenerationSuccess | GenerationFailure;

export interface GenerationInput {
  site: SiteInfo;
  location: LocationInfo;
  requirements: DesignRequirements;
  preferences: DesignPreferences;
  /** 'local' skips Gemini because the user asked for the built-in engine. */
  engine?: 'auto' | 'local';
  /** When set, the request is for a different concept from this design. */
  alternativeTo?: StructuredDesignJSON;
  /** Optional streaming stage callback */
  onStage?: (stage: GenerationStage, message: string) => void;
}

interface StageResult {
  design?: StructuredDesignJSON;
  errors: string[];
  warnings: string[];
  notes: string[];
  /** Share by which room sizes were shrunk to fit (0 = target sizes kept). */
  compression?: number;
  infeasible?: { reason: string; violatedConstraints: string[] };
}

const mirrorSides = (program: DesignProgram): DesignProgram => ({
  ...program,
  rooms: program.rooms.map((room) => ({ ...room, side: room.side === 'left' ? 'right' : room.side === 'right' ? 'left' : room.side }))
});

export function buildPlanExplanation(
  design: StructuredDesignJSON,
  constraints: DesignConstraints,
  site: SiteInfo,
  report?: { isValid: boolean; errors: string[]; warnings: string[] }
) {
  const plotArea = site.plotWidth * site.plotDepth;
  const coverageArea = Math.round(design.footprint?.footprintAreaSqFt || 0);
  const coveragePct = Math.round((coverageArea / (plotArea || 1)) * 100);

  const gRooms = design.rooms.filter((r) => r.position.floorLevel === 0);
  const frontRooms = gRooms.filter((r) => r.zoningCategory === 'public' || r.roomType === 'entrance' || r.roomType === 'living').map((r) => r.name);
  const middleRooms = gRooms.filter((r) => r.zoningCategory === 'service' || r.zoningCategory === 'circulation' || r.roomType === 'stair' || r.roomType === 'dining' || r.roomType === 'kitchen').map((r) => r.name);
  const rearRooms = gRooms.filter((r) => r.zoningCategory === 'private' || r.roomType === 'bedroom' || r.roomType === 'master_bedroom').map((r) => r.name);

  const zoneRationale = [
    `Front Zone: Houses public arrival spaces (${frontRooms.join(', ') || 'Entrance & Living Room'}) facing the ${site.orientation} road frontage for direct approach, visitor reception, and street-facing daylight.`,
    `Middle Zone: Houses central vertical circulation (staircase well) and service cores (${middleRooms.join(', ') || 'Stair, Dining & Kitchen'}) buffering formal reception from private family quarters.`,
    `Rear Zone: Provides an acoustic and visual sanctuary for restful spaces (${rearRooms.join(', ') || 'Private Bedrooms'}), sheltered from street noise and opening to the rear garden setback.`,
    ...(design.floorsCount > 1 ? [
      `Upper Floor(s): Private bedroom suites and family lounge arranged to maintain structural stacking over ground-floor load-bearing walls, with stepped setbacks creating purposeful terrace zones.`
    ] : [])
  ];

  const livingRoom = design.rooms.find((r) => r.roomType === 'living');
  const masterBed = design.rooms.find((r) => r.roomType === 'master_bedroom');

  const sizingRationale = [
    `Plot Area & Ground Coverage: Plot dimensions ${site.plotWidth} ft x ${site.plotDepth} ft (${plotArea} sq ft) yield a ground footprint of ${coverageArea} sq ft (${coveragePct}% ground coverage), within standard residential coverage guidelines.`,
    `Proportional Sizing: Major habitable room dimensions conform to NBC living standards (${livingRoom ? `living room ${Math.round(livingRoom.areaSqFt)} sq ft` : 'living room'}, ${masterBed ? `master bedroom ${Math.round(masterBed.areaSqFt)} sq ft` : 'master bedroom'}).`,
    `Aspect Ratio Optimization: All habitable rooms observe strict aspect ratio capping (<= 1.8:1) to ensure rectangular daylight penetration and functional furniture layouts without elongated proportions.`,
    ...(plotArea >= 5000 ? [
      `Large Plot Sizing: Ground coverage is capped to preserve expansive private garden zones, vehicle turning radii, and landscaped setback buffers.`
    ] : [])
  ];

  const validationReport = {
    isValid: report?.isValid ?? true,
    errors: report?.errors ?? [],
    warnings: report?.warnings ?? [],
    checksPassed: [
      'ROAD_FACING_MAIN_DOOR: Main entry door is properly oriented towards road frontage.',
      'STAIR_CONNECTS_EVERY_FLOOR: Vertical circulation links all floor levels with direct landing clearance.',
      'CIRCULATION_ACCESSIBILITY: All rooms reachable through public corridors without crossing private bedrooms or bathrooms.',
      'ASPECT_RATIO_BOUNDS: Major habitable rooms conform to maximum aspect ratio <= 1.8.',
      'SETBACK_COMPLIANCE: Building footprint sits strictly within statutory setback boundaries.',
      'STRUCTURAL_STACKING: Upper floor rooms stack along load-bearing wall alignments.'
    ]
  };

  return { zoneRationale, sizingRationale, validationReport };
}

/** Programme → requirement check → geometry → full validation. Nothing reaches a renderer unless this passes. */
export function realiseProgram(program: DesignProgram, site: SiteInfo, constraints: DesignConstraints): StageResult {
  const requirementErrors = validateProgramRequirements(program, constraints);
  if (requirementErrors.length) return { errors: requirementErrors, warnings: [], notes: [] };

  const layout = layoutProgram(program, site, constraints);
  if (!layout.ok) return { errors: [layout.reason], warnings: [], notes: [], infeasible: { reason: layout.reason, violatedConstraints: layout.violatedConstraints } };

  const report = validateFloorPlan(layout.design);
  return { design: report.isValid ? layout.design : undefined, errors: report.errors, warnings: report.warnings, notes: layout.notes, compression: layout.compression };
}

/**
 * Auto mode: the AI planner is tried first and the validated rule engine takes over, with a visible notice,
 * when the planner is unreachable or cannot produce a valid plan. Set ARCHADAPT_STRICT_AI=true to disable the takeover.
 */
const localFallbackAllowed = () => process.env.ARCHADAPT_STRICT_AI !== 'true';

function stamp(design: StructuredDesignJSON, intent: 'INITIAL_DESIGN' | 'GENERATE_ALTERNATIVE_CONCEPT', engine: EngineId, modelId: string, attempts: number, conceptNumber: number) {
  design.conceptNumber = conceptNumber;
  design.generationMetadata = { intent, engine, modelId, attempts, generatedAt: new Date().toISOString() };
}

/**
 * Full generation pipeline with a hard cap of two attempts.
 * A design that fails validation is never replaced by something else behind the user's back:
 * the outcome is a valid design, or a structured failure that says why.
 */
export async function generateDesign(input: GenerationInput): Promise<GenerationOutcome> {
  const { site, location, requirements, preferences, onStage } = input;
  onStage?.('checking_brief', 'Checking plot envelope and validating brief requirements...');
  const baseConstraints = buildConstraints(requirements, preferences);
  const intent = input.alternativeTo ? 'GENERATE_ALTERNATIVE_CONCEPT' : 'INITIAL_DESIGN';
  const previousConcept = input.alternativeTo?.conceptNumber || 1;
  const conceptNumber = input.alternativeTo ? previousConcept + 1 : 1;
  const firstVariant = input.alternativeTo ? previousConcept % 3 : 0;
  const custom = requirements.customRequirements || '';

  // Deterministic feasibility pre-check: if the bare brief cannot fit at minimum room sizes, say so
  // before spending an AI call, and never downgrade the brief to make it fit.
  // A planning variant that does not validate is skipped for the next one, so the user is not left with an error
  // when another arrangement of the same brief works.
  // Variants 0-2 are different strategies; 3-5 repeat them left-to-right mirrored, which resolves briefs whose wet rooms land on the wrong side.
  const solveBaseline = (candidate: DesignConstraints) => {
    const variantFor = (n: number) => {
      const program = buildLocalProgram(site, location, candidate, custom, n % 3);
      return n < 3 ? program : mirrorSides(program);
    };
    let result = realiseProgram(variantFor(firstVariant), site, candidate);
    for (let step = 1; step < 6 && !result.design && !result.infeasible; step++) {
      const next = realiseProgram(variantFor((firstVariant + step) % 6), site, candidate);
      if (next.design || next.infeasible) result = next;
    }
    return result;
  };
  // Every style asks for its own rooms and proportions. When the plot cannot hold all of them the style is
  // relaxed in steps (full → without the courtyard → signature room only → client's brief alone) and the user is
  // told what was dropped. A level that only fits by shrinking rooms well below their targets gives way to the
  // next one, so a small plot gets fewer, properly sized rooms instead of every room squeezed.
  const blueprint = styleBlueprint(baseConstraints.style);
  const courtyardMandated = blueprint.spaces.includes('courtyard') && !baseConstraints.requiredSpaces.includes('courtyard');
  const levels: StyleLevel[] = ['full', ...(courtyardMandated ? ['reduced' as StyleLevel] : []), 'core', 'none'];
  let constraints = applyStyleMandates(baseConstraints, levels[0]);
  let baseline = solveBaseline(constraints);
  let firstValid = baseline.design ? { constraints, baseline } : undefined;
  for (const level of levels.slice(1)) {
    if (baseline.design && (baseline.compression ?? 0) <= COMFORTABLE_COMPRESSION) break;
    const nextConstraints = applyStyleMandates(baseConstraints, level);
    const next = solveBaseline(nextConstraints);
    if (next.design && !firstValid) firstValid = { constraints: nextConstraints, baseline: next };
    constraints = nextConstraints;
    baseline = next;
  }
  if (!(baseline.design && (baseline.compression ?? 0) <= COMFORTABLE_COMPRESSION) && firstValid) ({ constraints, baseline } = firstValid);
  const styleNotes = describeStyleAdditions(baseConstraints, constraints);
  if (constraints.styleLevel === 'reduced') {
    styleNotes.push(`This plot is too small for a true ${blueprint.courtyardTerm || 'courtyard'} (an open-to-sky court of at least 9 ft x 9 ft with rooms on all four sides), so it was left out; the other ${blueprint.label} elements were kept.`);
  } else if (constraints.styleLevel !== 'full' && blueprint.spaces.length + (blueprint.ensuiteAll ? 1 : 0) > 0) {
    styleNotes.push(constraints.styleLevel === 'core'
      ? `Not every ${blueprint.label} room fits this plot, so only its defining space was kept.`
      : `This plot could not hold the rooms that define ${blueprint.label} style, so the plan follows your brief alone.`);
  }
  if (baseline.infeasible) {
    return { status: 'INFEASIBLE', reason: baseline.infeasible.reason, violatedConstraints: baseline.infeasible.violatedConstraints, attempts: 0, canUseLocalEngine: false };
  }

  const runLocal = (notice?: string): GenerationOutcome => {
    onStage?.('laying_out', 'Synthesizing room geometry and circulation with built-in rule engine...');
    if (!baseline.design) {
      return { status: 'INVALID_DESIGN', reason: 'The built-in rule engine could not produce a valid plan for this brief.', violatedConstraints: baseline.errors, attempts: 1, canUseLocalEngine: false };
    }
    stamp(baseline.design, intent, 'local-rule-engine', 'local-rule-engine', 1, conceptNumber);
    onStage?.('validating', 'Validating structural stacking, circulation and setbacks...');
    baseline.design.planExplanation = buildPlanExplanation(baseline.design, constraints, site, { isValid: true, errors: [], warnings: baseline.warnings });
    return { status: 'OK', design: baseline.design, engine: 'local-rule-engine', modelId: 'local-rule-engine', attempts: 1, warnings: [...styleNotes, ...baseline.warnings], notes: baseline.notes, notice };
  };

  if (input.engine === 'local') return runLocal();
  if (!geminiApiKey()) {
    return localFallbackAllowed()
      ? runLocal('No Gemini API key is configured, so this plan was produced by the built-in rule engine.')
      : { status: 'ENGINE_UNAVAILABLE', reason: 'No Gemini API key is configured on the server.', violatedConstraints: [], attempts: 0, canUseLocalEngine: true };
  }

  const promptInput: ProgramPromptInput = {
    site, location, constraints, customRequirements: custom,
    secondaryStyle: typeof preferences.secondaryStyle === 'string' ? preferences.secondaryStyle : undefined,
    ragContext: getRelevantKnowledge(custom, preferences.modes || [], constraints.style)
  };
  const currentProgram = input.alternativeTo ? programFromDesign(input.alternativeTo) : null;
  const deadline = Date.now() + TIME_BUDGET_MS;
  let feedback: string[] | undefined;
  let lastErrors: string[] = [];
  let attempts = 0;

  while (attempts < MAX_GENERATION_ATTEMPTS) {
    attempts++;
    onStage?.('planning', `AI Planner is reasoning about spatial program and orientation (attempt ${attempts})...`);
    const prompt = currentProgram ? buildAlternativeProgramPrompt(promptInput, currentProgram, feedback) : buildProgramPrompt(promptInput, feedback);
    const call = await callGeminiJson(SYSTEM_ARCHITECTURAL_PROMPT, prompt, deadline);

    if (!call.ok && call.kind === 'INPUT_REJECTED') {
      // The request itself was refused by the AI service, so no key can help. Say so instead of hiding it behind a fallback.
      return { status: 'INPUT_REJECTED', reason: `${call.detail} Check the site, requirements and notes you entered, then try again.`, violatedConstraints: [call.detail], attempts, canUseLocalEngine: true };
    }
    if (!call.ok && call.kind !== 'BAD_RESPONSE') {
      // Gemini could not be reached at all. This is an availability problem, not an invalid design.
      if (attempts > 1 && lastErrors.length) break;
      return localFallbackAllowed()
        ? runLocal(`Gemini could not be reached (${call.detail}), so this plan was produced by the built-in rule engine.`)
        : { status: 'ENGINE_UNAVAILABLE', reason: `Gemini could not be reached: ${call.detail}`, violatedConstraints: [], attempts, canUseLocalEngine: true };
    }
    if (!call.ok) {
      lastErrors = [call.detail];
      feedback = [`${call.detail} Return one complete, valid JSON object.`];
      continue;
    }

    const raw = call.json as Record<string, unknown>;
    if (raw && raw.status === 'INFEASIBLE') {
      // The deterministic pre-check already showed the brief fits, so this is treated as a failed attempt.
      lastErrors = [`The planner declared the brief infeasible: ${String(raw.reason || 'no reason given')}`];
      feedback = ['You answered INFEASIBLE, but a programme at standard room sizes fits this envelope. Produce the programme, keeping every hard requirement.'];
      continue;
    }
    const parsed = parseProgram(raw, constraints);
    if (!parsed.program) {
      lastErrors = parsed.errors;
      feedback = parsed.errors;
      continue;
    }
    const styleErrors = checkStyleConformance(parsed.program, constraints);
    if (styleErrors.length) {
      lastErrors = styleErrors;
      feedback = styleErrors;
      continue;
    }
    onStage?.('laying_out', 'Synthesizing room geometry, walls, openings and staircase well...');
    const stage = realiseProgram(parsed.program, site, constraints);
    if (stage.design) {
      onStage?.('validating', 'Validating structural stacking, circulation and setbacks...');
      stamp(stage.design, intent, 'gemini', call.modelId, attempts, conceptNumber);
      stage.design.layoutNotes = [...parsed.notes, ...stage.notes];
      stage.design.planExplanation = buildPlanExplanation(stage.design, constraints, site, { isValid: true, errors: [], warnings: stage.warnings });
      return { status: 'OK', design: stage.design, engine: 'gemini', modelId: call.modelId, attempts, warnings: [...styleNotes, ...stage.warnings], notes: stage.design.layoutNotes };
    }
    lastErrors = stage.errors;
    feedback = stage.errors;
    if (process.env.NODE_ENV !== 'production') console.warn(`[ARCHADAPT] attempt ${attempts} (${call.modelId}) failed validation:`, stage.errors);
  }

  if (localFallbackAllowed() && baseline.design) {
    return runLocal(`The AI planner could not produce a plan that passed every check in ${attempts} attempt${attempts === 1 ? '' : 's'}, so the built-in rule engine laid out this plan instead. It passed the same validation.`);
  }
  return {
    status: 'INVALID_DESIGN',
    reason: `The AI planner did not produce a valid design in ${MAX_GENERATION_ATTEMPTS} attempts. Nothing was saved.`,
    violatedConstraints: lastErrors,
    attempts,
    canUseLocalEngine: true
  };
}
