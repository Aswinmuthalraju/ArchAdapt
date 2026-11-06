# ARCHADAPT AI — AGENT 1 AUDIT
## Baseline Repository Inspection, Architectural Defect Analysis & Root Causes

**Date:** November 2026  
**Auditor:** Agent 1 (Principal Software Architect, AI Systems Engineer, Computational Design Engineer, 3D Graphics Engineer)  
**Target Release:** V1.4.1  
**Execution Environment:** Google Antigravity / Node 22+ / Windows  
**Git Branch:** `feature/agent-1-transformation`

---

## 1. Executive Summary & Verification Baseline

A complete, unvarnished inspection of the codebase was conducted. No claims from previous handoffs or documentation were accepted without verification.

### Command Execution Verification

| Verification Check | Exact Command Executed | Result | Details / Observations |
| :--- | :--- | :--- | :--- |
| **Unit & Integration Suite** | `npm test` | **93 / 93 PASSED** | All 93 node-test assertions passed in 859 ms. Included failover tests, courtyard checks, room program parsing. |
| **TypeScript Type Check** | `npx tsc --noEmit` | **0 ERRORS (Clean)** | Strict typing passes without type suppression flags. |
| **ESLint Quality Check** | `npm run lint` | **0 WARNINGS / 0 ERRORS** | Next.js 16 / React 19 lint rules pass cleanly. |
| **Production Build** | `npm run build` | **SUCCESS** | Webpack production compilation succeeded in 5.0s. All 25 static & SSG routes rendered. |
| **Architectural Sweep** | `npm run sweep` | **216 / 224 FEASIBLE** | 8 intentional declines on over-constrained 30x40 plots (e.g., 4BR + 2 car parking). 100% stair reachability. |
| **Playwright E2E Baseline** | `node scripts/capture-baseline.mjs` | **SUCCESS** | Captured desktop (1440x900), tablet (768x1024), and mobile (390x844) viewport and full-page screenshots of the landing page and routes. |

---

## 2. Landing Page Protection Protocol

Per strict mission rules, the landing page must NOT be redesigned, broken, or regressed.

1. **Entry Point Identified:** `src/app/page.tsx` rendering `components/marketing/home/Home.tsx` inside `components/marketing/site/MotionPage.tsx`.
2. **Shared Components Identified:**
   - `src/components/canvas/PlanSvg.tsx` (used in server-side `showcaseDesign` hero drawing).
   - `src/components/marketing/ArchitecturalShowcase.tsx`.
   - `src/components/marketing/CourtyardScene.tsx`.
   - `src/components/marketing/home/Petals.tsx`.
   - `src/components/marketing/home/Preloader.tsx`.
   - `src/components/marketing/site/SiteHeader.tsx` & `SiteFooter.tsx`.
3. **Baseline Screenshots Captured:**
   - Desktop: `docs/screenshots/baseline/landing-desktop-viewport.png` & `landing-desktop-full.png`
   - Tablet: `docs/screenshots/baseline/landing-tablet-viewport.png` & `landing-tablet-full.png`
   - Mobile: `docs/screenshots/baseline/landing-mobile-viewport.png` & `landing-mobile-full.png`
   - Additional Routes: `onboarding-desktop.png`, `styles-desktop.png`
4. **Design Tokens & Global CSS:**
   - Colors: `plum` (#5D4052, #3B0A26, #23111D), `gold` (#CBB996, #D4AF37), `magenta` / dusty rose palette in `tailwind.config.js`.
   - Fonts: Serif display titles (`Cinzel` / `Playfair`), Sans-serif bodies (`Inter`).
   - Custom utilities: `.btn-gem`, `.scrollbar-plum`.

---

## 3. Architecture & Data Flow Audit

The end-to-end design pipeline follows this path:
```
User Requirements (Onboarding / What-If)
       │
       ▼
Gemini GenAI / Local Rule Planner (`src/lib/genai/`)
       │ (Generates DesignProgram & constraints: room types, target areas, zoning bands)
       ▼
Pipeline Orchestrator (`src/lib/design/pipeline.ts`)
       │
       ▼
Layout Engine (`src/lib/design/layoutEngine.ts`)
       │ (Calculates setbacks, band depths, unit widths, room rectangles)
       ▼
Opening & Door Solver (`src/lib/design/openings.ts`)
       │
       ▼
Canonical Design JSON (`StructuredDesignJSON` in `src/types/architectural.ts`)
       │
       ├──► 2D Plan SVG (`src/components/canvas/PlanSvg.tsx`)
       ├──► 3D House Geometry (`src/lib/geometry/buildHouseGeometry.ts`) ──► Three.js Viewer (`Massing3DViewer.tsx`)
       ├──► Professional Analysis (`src/lib/pro/analysis.ts` & `sheet.ts`)
       └──► Exporters (DXF, OBJ, CSV, SVG, JSON in `src/lib/pro/exporters.ts`)
```

---

## 4. Discovery of Core Deficiencies & Root Causes

Despite passing existing tests, serious product limitations prevent ArchAdapt from fulfilling its commercial potential as an AI residential platform.

### Root Cause 1: Rigid 3-Band Slicing in the Layout Engine
* **Symptom:** Plans often look like 3 stacked rectangular strips (`front`, `middle`, `rear`), creating uniform, boxy layouts without architectural depth, setbacks, or courtyard articulation.
* **Mechanism:** `layoutEngine.ts` sorts rooms into rigid `PlanBand` buckets and determines depth by solving a 1D optimization equation across each band. Rooms within a band are packed as vertical slices.
* **Impact:** Corner plots (two road frontages), L-shaped footprints, narrow-frontage courtyard layouts, and staggered footprints cannot be naturally expressed.

### Root Cause 2: 3D Visualization Lacks Interactivity & Selection
* **Symptom:** Users cannot click, select, inspect, or edit any individual room or wall in the 3D model.
* **Mechanism:** `Massing3DViewer.tsx` merges all room boxes, wall boxes, and openings into static monolithic meshes using `mergeGeometries` for draw-call performance. While fast, this erases element identities at the Three.js mesh level.
* **Impact:** Homeowners and architects cannot inspect room properties in 3D, nor can they drag or alter elements in 3D space.

### Root Cause 3: Disconnected 2D/3D Selection State
* **Symptom:** Selecting a room in the 2D floor plan highlights the room in 2D, but the 3D view is completely unaware of the selection.
* **Mechanism:** `selectedRoomId` is held in `WorkspacePage` state and passed only to `FloorPlan2DRenderer`, omitting `Massing3DViewer`.

### Root Cause 4: What-If Regenerates from Scratch Instead of Localized Surgical Deltas
* **Symptom:** Asking "Make the kitchen 20 sq ft larger" can unexpectedly rearrange bedrooms or shift the staircase on the upper floor.
* **Mechanism:** `runWhatIf` modifies room target areas in `DesignProgram` and calls `layoutProgram()`, which recomputes band depths and unit placements globally.
* **Impact:** Destroys user trust because unaffected parts of the house are displaced.

### Root Cause 5: 2D Floor Plan Lacks Architectural Standards
* **Symptom:** While SVG drawings have walls and doors, they lack professional architectural drafting conventions:
  - Missing graphic scale bar (showing 0, 5, 10, 20 ft).
  - Missing interior string/dimension witness lines between opposing walls.
  - Wall intersections lack proper monolithic poche fill.
  - Door openings lack door frame stops and standardized jamb thickness.
  - Room tags lack dual units (sq ft and sq m) and ceiling heights.

### Root Cause 6: Missing 3D Architectural Capabilities
* **Symptom:** The 3D view only supports Orbit / Walkthrough and Day/Evening/Night lighting.
* **Mechanism:** Missing horizontal section cutaways (cut plane clipping), floor isolation, room volume highlights, and elevation orthographic camera projections (Front, Left, Right, Rear, Isometric).

---

## 5. Audit Conclusion & Transformation Priorities

The baseline codebase has a solid TypeScript foundation, zero compilation or lint errors, and working failover logic. However, the architectural generation and 3D editing systems require a substantial, high-impact transformation:
1. **Interactive 3D System:** Retain high performance while supporting element raycasting, individual room selection, property inspection, 3D section cutting (horizontal clip plane), and elevation camera controls.
2. **Unified 2D ↔ 3D Selection & Editing State:** Bidirectional synchronization of selected rooms, contextual actions, and geometry updates.
3. **Surgical What-If Mutations:** Enabling localized geometric alterations that preserve unaffected rooms and plot alignments.
4. **Professional 2D Drafting Enhancements:** Graphic scale bar, dual-unit room tags, architectural dimension lines, door jamb details, and title block integration.
5. **Plot Geometry Flexibility:** Enhanced plot utilization supporting corner plots, L-shaped footprints, and articulated setbacks.
