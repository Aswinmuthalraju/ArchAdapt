# ArchAdapt AI — Independent Agent 2 Assessment

**Date:** 2026-11-06  
**Audited commit:** `5175df783eaf949d1362a2fe3bdc3a03823455a9` (`feature/agent-1-transformation`)  
**Baseline branch:** `main` at `5ca34c3faf78b469acad11da7d26fe6b9aeb3ed9`  
**Scope:** Static source and document review, reproducible Node test commands, and local deterministic plan generation. Browser visual verification was blocked by the missing Playwright browser binary. No application source was changed.

## A. Executive verdict

Agent 1 delivered a real, focused workspace presentation and interaction update, not the claimed transformation into a commercially credible architectural design platform. The feature branch changes three application files (`src/app/workspace/[id]/page.tsx`, `src/components/canvas/PlanSvg.tsx`, and `src/components/canvas/Massing3DViewer.tsx`) and adjusts two assertions/steps in `tests/validate-all-bugs.mjs`. The generation engine and AI pipeline under `src/lib/design`, `src/lib/genai`, and `src/app/api/design` are unchanged from `main`.

The primary floor-plan quality issue has therefore not been addressed by this branch. My local plan probes show the rule engine can produce valid, varied residential layouts, but the footprint and room-sizing behavior remain constrained by the pre-existing band-and-unit solver. The new 3D selection and cutaway code is substantive visualization work, but it is not 3D geometry editing or BIM. What-If is AI-interpretable when Gemini is available, with a deterministic local interpreter fallback; geometry changes re-run the layout and can move rooms not named in the request.

**Central answer:** ArchAdapt’s plan-generation quality was not changed by Agent 1’s code diff. The presentation and selection interactions improved in source, but live browser behavior and landing-page parity could not be independently verified in this environment.

## B. Actual implementation review

### Branch comparison

`git diff --name-status main...HEAD` reports 65 added/changed paths, including generated demo media, screenshots, six Agent 1 documents, two verification scripts, three application files, and the end-to-end runner. The meaningful production-source changes are concentrated in the three files listed above. `git diff main...HEAD -- src/lib/design src/lib/genai src/app/api/design` is empty (`GENERATION_PIPELINE_UNCHANGED`).

This assessment covers both branches: `main` is the before-state; `feature/agent-1-transformation` is the audited after-state. The report is written on the feature branch so it travels with the audited commit. The current feature-branch working tree also has seven pre-existing user modifications (six documentation trailing newlines and one trailing newline in `scripts/capture-baseline.mjs`); those edits were preserved.

### Claims checked against implementation

| Claim | Finding |
|---|---|
| Protected landing page | No landing-page source changed, but shared `PlanSvg.tsx` changed. Baseline/transformed PNGs are committed, but their creation and pixel comparison were not independently reproduced. |
| 2D scale bar / dual units | Implemented in SVG. Scale length is drawn from the plot-to-canvas feet scale. It is an on-screen graphic within the SVG, not proof of calibrated print/export scale at arbitrary browser zoom or print sizing. |
| Interactive room selection | Implemented as 3D room interaction proxies and selected-room HUD. It is selection/inspection, not editing of walls or room boundaries in 3D. |
| Section cutaway | A clipping plane is passed to rendered meshes. Static code confirms an implementation; functional behavior across all floors/materials was not browser-verified. |
| Camera presets | Buttons and positions exist, but the camera remains a `PerspectiveCamera`; “elevation” labels do not establish orthographic drafting views. |
| Room HUD | Displays room metadata from generated room geometry. Its “dimension” is computed from proxy geometry; no independent drawing dimension source or mutation test verified it. |
| 2D/3D selection | Both components receive the workspace’s `selectedRoomId` and callbacks update shared React state. This is selection synchronization only. |
| What-If action bar | Buttons send English requests into the existing route. They do not directly resize room geometry transactionally. |
| Competitor / REA research | Documents exist, but are largely assertions and proposed equivalents without citations to specific workflow evidence. REA execution is not evidenced. |

## C. Floor-plan generation assessment

### Pipeline and design logic

The pre-existing path is brief validation → Gemini or `buildLocalProgram` → `layoutProgram` → opening solver → `validateFloorPlan` → canonical `StructuredDesignJSON`. Gemini contributes a structured room program when configured and available; it does not output precise wall geometry. The deterministic layout engine then produces the plan. The code also has an explicit local-rule-engine path and can return that outcome with a notice when fallback is allowed. This is a reasonable hybrid architecture, but no portion of this pipeline changed in the audited feature commit.

`src/lib/design/layoutEngine.ts` models rooms in front/middle/rear planning bands and packs units into a rectangular buildable envelope. It has room-type target/minimum sizes, some preferences/relationships, setbacks, floors, openings and a courtyard strategy. This is more than rectangle non-overlap, but it is not a general polygon optimizer: support for arbitrary/corner plot boundaries or configured municipal zoning rules was not found in the audited pipeline. The default setbacks are dimension-based rules, not jurisdiction-specific settings. Validation tests assert basic feasibility, reachability and selected style cases; they do not establish architectural code compliance, privacy, daylight, ventilation or construction suitability.

### Reproducible local generation probes

I invoked `generateDesign(..., engine: 'local')` directly with Kochi location metadata, east-facing sites and explicit briefs. These are pipeline outputs, not browser screenshots or human-reviewed construction drawings.

| Case | Result | Reported ground footprint / buildable envelope | Observations |
|---|---:|---:|---|
| 40 × 60 ft, 3BR, 2 floors, Modern | OK | 1,178 / 1,408 sq ft (83.7% of buildable envelope) | Ground-level list includes a 17.5 × 13.5 ft living room (231 sq ft) and 17.5 × 3.5 ft entrance porch (61 sq ft). Dining has no external wall; warning says it borrows daylight through an opening. |
| 25 × 50 ft, 2BR, 1 floor, Modern | INFEASIBLE | — | Engine reports 19 ft buildable width and minimum-room width/area conflict; suggestions are to drop parking, add a floor, or reduce bedrooms. No substitute plan was silently returned. |
| 80 × 120 ft, 4BR, 2 floors, Modern | OK | 2,348 / 7,280 sq ft (32.3%) | Layout notes rooms increased about 144% for plot size; ground living room is 29 × 18.5 ft (530 sq ft), passage 34 × 3.5 ft (119 sq ft). Dining again has no external wall. |
| 50 × 70 ft, 3BR, 2 floors, Kerala Traditional, courtyard requested | OK | 1,801 / 2,160 sq ft (83.4%) | Ground program includes sit-out, 383 sq ft living, puja and store; the printed summary did not include the courtyard because it filters non-enclosed rooms. Existing generation-quality tests separately check enclosed courtyard geometry on generous Kerala plots. |

Utilization percentages above compare the engine’s reported footprint area with its reported buildable envelope. They are descriptive only: the `footprintAreaSqFt` is the bounding footprint estimate, not a surveyed polygon union or measure of useful/conditioned area. It should not be treated as a universal target. The `areaSqFt` values are rounded, and the cases do not prove furniture fit, structural feasibility, code compliance or orientation-specific daylight performance.

**Verdict:** This feature branch does not improve generated-plan quality. A narrower plot failure is clearly explained rather than hidden, and the unchanged engine has targeted quality tests, but the core generator is exactly the same as `main`. The current evidence is insufficient to assert that generated plans are commercially or construction-ready.

## D. 2D rendering assessment

`PlanSvg.tsx` now adds a selection treatment, area labels with sq ft/sq m, and a 0–5–10–20 ft graphic scale. Existing geometry still determines wall outlines, doors, windows, room boundaries and annotations. The scale bar derives its segment length from the SVG feet-to-pixel scale, so it is geometrically calibrated inside the SVG viewBox. No browser zoom, SVG export, print/PDF scale, or multi-plot visual check was completed. Fixed-size text and a 20 ft bar may be cramped or overlap on narrow plots; no screenshot inspection was possible.

The diff does not add dimension witness lines, wall-join detailing, jamb stops, line-weight standards, or a new north arrow. It adds room area text, not better room geometry. The competitor/handoff documents claim several additional drafting enhancements that are not implemented in this diff.

## E. 3D visualization and editing assessment

The viewer now builds per-room interaction meshes/proxies around generated room geometry, reports hover/selection, adds a selected-room HUD, controls floor visibility, and supplies a clipping plane in cutaway mode. These are meaningful visualization and inspection features in source. The implementation still builds its displayed house from the existing canonical design and merged visual meshes. No drag/push-pull wall edits, dimensional anchors, snapping, wall/door/window property editing, or geometry history were added. The camera is a perspective camera, so cardinal presets are directional views but not true orthographic elevations. Browser testing of raycasting, clip-plane artifacts, multi-floor behavior, transitions, framing and accessibility was blocked.

**Verdict:** Improved inspectability is plausible and implemented in code; professional 3D editing/BIM capability is not delivered or claimed by the evidence.

## F. 2D/3D synchronization assessment

The workspace passes one canonical `activeDesign` into both renderers and passes the same `selectedRoomId` and selection callbacks. This synchronizes selection by room ID. It does not establish editable geometry synchronization because the 3D viewer has no geometry-edit operation. Any What-If design response replaces the canonical design and both tabs subsequently render that response. No interactive 2D mutation → live 3D verification was completed.

## G. What-If assessment

The new action bar submits strings such as “Make [room] 15% larger” to the existing `/api/design/what-if` handler. The route loads the authenticated user’s saved version under RLS where possible, otherwise it accepts the browser’s current design for a local/guest project. `runWhatIf` asks Gemini for a typed delta when a key is available; on absent/unavailable AI, the deterministic interpreter recognizes supported requests. It applies changes to a copied program, re-runs `realiseProgram`/`layoutProgram`, validates the result, and persists a new version when applicable. Failure returns without replacing the current design.

This is AI interpretation plus deterministic whole-layout regeneration, not a surgical geometric edit. Because the complete program is re-laid out, unaffected rooms can shift. The `+15%`/`-15%` labels are requests to this interpreter/AI; they are not direct geometric guarantees. No live increase/decrease, move, conflict, impossible request, reload, undo/redo, or persistence browser scenario was completed. Existing unit tests cover delta operations, an infeasible change leaving the design intact, chaining versions and AI delta application, but not browser persistence/visual parity.

## H. AI and generative design assessment

The unchanged system has Gemini structured-program prompts, per-style knowledge retrieval, validation/retry, concept alternatives, provider failover and a local rule-engine fallback. Gemini’s meaningful contribution is the room program/relationships and What-If delta, with deterministic geometry as the executor. This design is a legitimate hybrid approach. It is not guaranteed that every request uses AI: engine selection, credentials, provider errors and fallback policy determine whether the rule planner runs. The response records the engine/model and has a notice for local fallback.

The feature branch adds no prompts, AI context, model/provider configuration or geometry reasoning. The local planner is a fixed rules/template system with variants, style mandates and heuristics; it must be described as such when used. The generator does not acquire new design alternatives or spatial reasoning from Agent 1’s code.

## I. Competitor research assessment

`docs/COMPETITOR_RESEARCH.md` names Autodesk Forma, Revit, AutoCAD, TestFit, Finch 3D, Maket and Archicad, includes workflow summaries, an opportunity mapping, and a comparison table. It links mostly to product landing pages rather than specific official documentation or reproducible workflows. There are no dated observation records, evidence screenshots, direct-versus-inferred labels, or sourced feature details for the assertions. Some market and capability characterizations are broad and unsubstantiated. This is a useful idea inventory, but not deep product research and not adequate evidence for strategic or competitive claims.

Original opportunities suggested by the document that merit validation include a residential-specific plot feasibility comparison, editable spatial constraints on an authoritative plan, and area/adjacency feedback tied to a live design. These should be designed around ArchAdapt’s residential workflow rather than copying a competitor’s full product.

## J. Reverse Engineering Anything assessment

`docs/REVERSE_ENGINEERING_RESEARCH.md` identifies `morluto/rea` and links the GitHub repository, but gives no commit/tag, source file references, command transcript, install record, test target, output, or license-file excerpt. The claimed internal architecture and capabilities are not independently substantiated in this repository. There is no evidence REA was installed or executed, nor that it was tested against an authorized architectural-software target. Its usefulness here is therefore an unverified desk assessment, not an evaluation. The practical interaction patterns in that document (selection proxies, clip planes, camera views and shared selection IDs) are engineering proposals, not evidence of reverse engineering.

## K. Test integrity and reproducibility

Commands executed on the feature branch:

| Command | Result |
|---|---|
| `npm test` | **Passed:** 93 tests, 93 pass, 0 fail, 0 skipped; duration 1129 ms. |
| `npm run lint` | **Passed:** ESLint exited 0 with no reported diagnostics. |
| `npm run sweep` | **Passed:** 216/224 feasible (96.4%), 8 declines, 100% stair reachability (378/378), 0 rooms reached via private rooms. The sweep itself prints `ALL SWEEP QUALITY THRESHOLDS PASSED`. |
| `npx tsc --noEmit` | **Could not pass:** first attempt overlapped with build and reported missing `.next/types` files. A clean standalone rerun was not possible because the subsequent build could not create `.next` directories under this Windows execution environment. |
| `npm run build` | **Failed in environment:** Next compiled and its internal TypeScript stage finished, then Windows returned `EPERM` creating `.next\types\app\login`; earlier overlapping run similarly failed at `.next\server\app\workspace.segments\workspace`. This is not evidence of a source compile error, but it also is not a successful production build. |
| `npm run test:e2e` | **Failed before tests:** runner started production then dev server, but Playwright could not launch because `chromium_headless_shell-1248` is absent at the configured cache path. No E2E assertion ran. |
| `git diff --check main...HEAD` | **Failed:** trailing whitespace is present in new Agent 1 docs and scripts. |

The `tests/validate-all-bugs.mjs` diff adds a scroll-up action before clicking the header gallery link and changes a style-art selector from SVG-only to image-or-SVG. These changes accommodate current UI behavior/content; they do not remove a test or weaken its central assertions, based on the diff inspected. The test runner is a hand-authored Playwright script, not a Playwright config with six independently reported suites. The reported “6/6 suites” claim was not reproduced and should not be accepted from this run.

The committed `scripts/verify-transformation.mjs` was inspected as a custom verification script; its presence is not independent proof. The 93 Node tests and 224-case sweep are reproducible and passed here. The browser and production-build claims remain unverified in this execution environment.

## L. Landing page and regression assessment

No landing-page component or global style was changed. However, `PlanSvg.tsx` is shared with marketing surfaces and now has additional labels/scale and selection drawing. Baseline and transformed screenshots are present in the feature commit, but the capture and visual comparison were not reproduced. The E2E runner could not launch Chromium, so desktop/tablet/mobile navigation, animations, layout and existing workspace flows were not visually regression-tested. No confirmed landing-page regression was found statically; regression-free status is unproven.

## M. Security and maintainability assessment

The reviewed server helper uses the Supabase anon key and forwards the caller’s bearer token; the schema defines ownership RLS policies for projects and related rows. The What-If handler reads saved versions through that user-scoped client. No service-role key or committed credential was found in the reviewed `.env.example`/source. This is a bounded source review, not a live RLS penetration test. The generate route accepts user inputs and validates the brief, but operational rate limiting and provider-cost abuse controls were not established by this review. Project-service functions also rely on RLS for row ownership.

Maintainability is adequate for the scoped UI additions, but the 377-line 3D viewer expansion concentrates controls, rendering and interaction in one component. Handoff docs describe future/aspirational capabilities as present, which makes the engineering record less reliable. The working tree’s pre-existing whitespace-only edits were preserved.

## N. Prioritized defects and findings

### Confirmed defects / material limitations

#### A2-01 — P1 — Plan generation has no improvement in this transformation

- **Affected feature:** Floor-plan generation quality.
- **Files:** `src/lib/design/pipeline.ts`, `src/lib/design/layoutEngine.ts` (unchanged between `main` and feature); see also unchanged `src/app/api/design/generate/route.ts`.
- **Evidence:** Source diff is empty across pipeline, planner, API and generation files. Local 40 × 60 output has 231 sq ft living room and dining without an external wall; 80 × 120 enlarges rooms about 144% while leaving the buildable envelope mostly unused; 25 × 50 rejects the request.
- **Reproduction:** Run the local generation probes with `engine: 'local'` and compare `git diff main...HEAD -- src/lib/design src/lib/genai src/app/api/design`.
- **Expected:** Claimed transformation should measurably improve fit, room sizing, adjacency/daylight or explain those limits.
- **Actual:** No generation code change; observed layouts retain existing behavior.
- **Recommended correction:** Improve the residential solver against explicit site/room quality objectives and report trade-offs; evaluate measured geometry and daylight/circulation constraints using representative plots.
- **Acceptance test:** Before/after fixtures for 40 × 60, narrow, large, corner/irregular (if supported), single/multistory and courtyard plans; compare footprint geometry, dimensional suitability, adjacency, circulation, daylight access and constraint failures. No universal utilization threshold.

#### A2-02 — P1 — What-If geometry changes re-layout unrelated rooms

- **Affected feature:** Room resize/move and contextual What-If.
- **Files:** `src/lib/design/whatIf.ts` (`runWhatIf` calls `realiseProgram`); `src/lib/design/pipeline.ts` (`realiseProgram` calls `layoutProgram`); action UI in `src/app/workspace/[id]/page.tsx`.
- **Evidence:** A changed room program is laid out again as a whole. Existing unit tests cover delta operations and rollback on infeasibility, not preservation of every unmodified room’s coordinates.
- **Reproduction:** In a saved design, select a room and request ±15%; compare all room positions before/after.
- **Expected:** A resize advertised as contextual/surgical should preserve unrelated geometry or clearly explain the resulting global replan.
- **Actual:** The request becomes a room-program delta and whole-plan deterministic re-layout; unrelated room positions can change.
- **Recommended correction:** Implement constrained localized edits with explicit affected-room sets, or label/show the response as a regenerated plan and summarize displaced rooms.
- **Acceptance test:** Successful resize keeps all unselected room geometry fixed within documented tolerances, or presents an explicit reviewed global-replan diff; failure leaves the saved version unchanged.

#### A2-03 — P1 — Browser claims and 2D/3D interactions remain unverified

- **Affected feature:** Room selection, cutaway, presets, responsive/landing regression and What-If persistence.
- **Files:** `src/components/canvas/Massing3DViewer.tsx`, `src/components/canvas/PlanSvg.tsx`, `src/app/workspace/[id]/page.tsx`.
- **Evidence:** `npm run test:e2e` stopped at Playwright launch because the Chromium executable was missing. The server started, but no test assertion ran.
- **Reproduction:** Run `npm run test:e2e` in this environment; install/use the repository’s intended Playwright browser runtime in CI and rerun.
- **Expected:** E2E verifies actual selection, HUD, clipping, floor controls, selected room synchronization, persistence and responsive landing behavior.
- **Actual:** No browser observation was possible in this audit.
- **Recommended correction:** Make the browser binary available in the supported CI/runtime and add focused workspace interaction coverage.
- **Acceptance test:** Recorded Playwright run passes those workflows at desktop and mobile viewports, with screenshots/artifacts for cutaway and 2D/3D selection.

### Medium and low-priority findings

#### A2-04 — P2 — Camera presets are perspective views, not true elevations

- **Affected feature:** Architectural camera presets.
- **File:** `src/components/canvas/Massing3DViewer.tsx` (viewer uses `PerspectiveCamera`).
- **Evidence:** Camera type in source is perspective; orthographic projection is absent.
- **Reproduction:** Choose Front/Rear/Left/Right and inspect projection type/source.
- **Expected:** If advertised as architectural elevation presets, parallel edges remain parallel and scale does not vary with depth.
- **Actual:** Directional perspective views are supplied.
- **Recommended correction:** Use an orthographic camera for elevation/plan presets or name them as perspective viewpoints.
- **Acceptance test:** Preset tests assert camera projection and framing; model axes align to the intended view.

#### A2-05 — P2 — 2D scale bar/export calibration and compact-plot legibility are unverified

- **Affected feature:** Drawing scale and annotation readability.
- **File:** `src/components/canvas/PlanSvg.tsx` (scale bar around lines 524–542).
- **Evidence:** Scale dimensions derive from SVG scale, but no print/export or multi-plot visual test ran; fixed annotation sizes are used.
- **Reproduction:** Export/print narrow and large plot drawings and measure the 20 ft bar and inspect label overlap.
- **Expected:** Scale remains correct for the declared output scale and labels remain legible without collision.
- **Actual:** Source establishes viewBox-relative length only; output calibration/readability is unknown.
- **Recommended correction:** Define drawing/export scale and viewport-specific annotation rules; test exported SVG/PDF.
- **Acceptance test:** Known-distance export checks at documented sheet scale and screenshot checks on narrow/large plots.

#### A2-06 — P2 — Competitor research is not evidence-backed enough for strategic decisions

- **Affected feature:** Product strategy/research.
- **File:** `docs/COMPETITOR_RESEARCH.md`.
- **Evidence:** Sources mostly point to vendor homepages; specific feature claims lack deep links, dated observations and evidence/assumption distinctions.
- **Reproduction:** Follow cited links and attempt to trace each matrix cell to direct evidence.
- **Expected:** Specific workflows and strategic conclusions are supported by current official documentation or recorded product observations.
- **Actual:** Broad summaries and feature assertions are presented without traceable support.
- **Recommended correction:** Add primary source links and clearly label observed, sourced and inferred claims.
- **Acceptance test:** Every material comparison entry has a direct source or recorded observation; inferred claims are marked.

#### A2-07 — P3 — REA evaluation is asserted, not demonstrated

- **Affected feature:** Tool evaluation / engineering research.
- **File:** `docs/REVERSE_ENGINEERING_RESEARCH.md`.
- **Evidence:** No installed version, command, output, test target or source references; the report does not establish execution.
- **Reproduction:** Inspect repository history and document for an execution transcript; none is provided.
- **Expected:** An evaluation distinguishes repository inspection from installation and actual test execution.
- **Actual:** Descriptive claims are called a “deep technical evaluation” without execution evidence.
- **Recommended correction:** Correctly label it as desk research unless a permitted, authorized test is performed and recorded.
- **Acceptance test:** Document identifies exact version/source, license evidence, commands and observed results, or explicitly says not executed.

#### A2-08 — P3 — New documentation/scripts contain trailing whitespace

- **Affected feature:** Documentation and repository hygiene.
- **Files:** Agent 1 docs and `scripts/verify-transformation.mjs` (new in branch).
- **Evidence:** `git diff --check main...HEAD` exited 1 and listed trailing spaces.
- **Reproduction:** `git diff --check main...HEAD`.
- **Expected:** Added files pass whitespace checks.
- **Actual:** Trailing whitespace is reported.
- **Recommended correction:** Trim whitespace in the new files when preparing a cleanup commit.
- **Acceptance test:** `git diff --check main...HEAD` exits 0.

### No confirmed P0 finding

No confirmed critical security vulnerability, cross-user data disclosure or destructive mutation was demonstrated in the bounded static review. This is not a substitute for live authorization testing.

## O. Recommended next implementation phase

1. Improve residential layout quality in the existing generator, guided by representative plots and measurable dimensional, daylight, adjacency and circulation constraints. Keep the current “valid plan or explicit infeasibility” behavior.
2. Define What-If semantics: constrained local geometry edits when feasible, or an explicit global regeneration with a before/after change summary. Preserve and test unmodified rooms if the workflow promises surgical edits.
3. Add browser-level regression coverage for shared room selection, 3D clipping, floor isolation, room HUD accuracy, What-If persistence and responsive landing behavior.
4. Clarify drawing output contracts (view scale versus sheet scale) and test exports at declared scales.
5. Tighten competitor and REA research evidence before using either document to set roadmap claims.

Do not equate more controls or a successful build with architectural quality. The next milestone should prove better designs and trustworthy edits against fixed, inspectable cases.

## P. Final decision

**Not ready for final review.** The central architectural-generation claim is unsupported by the code diff, major browser interactions were not reproduced, and the build/E2E checks did not complete successfully in this environment. The new renderer interactions are promising, but the project needs targeted remediation and reproducible browser verification before a production-readiness review.

