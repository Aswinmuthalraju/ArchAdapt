# ArchadaptAI V1.4 — Architectural Generation Engine & Spatial System Guide

**Document ID:** `docs/01_ARCHITECTURAL_GENERATION_ENGINE.md`  
**Version:** V_1.4  
**Status:** Verified, Tested & In Production  

---

## 1. Architectural Philosophy & Engine Foundations

ArchadaptAI generates structurally valid, livable residential architecture. It rejects unconstrained coordinate hallucination, box-packing heuristics, and slow autonomous agent loops in favour of a two-stage hybrid architecture:

1. **High-Level Spatial Reasoning (AI Planner / Built-in Solver):** Derives an architectural room programme—which spaces exist, their target areas, depth zoning (front, middle, rear), transverse side (left, center, right), and inter-room spatial relationships (adjacency, attachments, connectivity, acoustic privacy).
2. **Deterministic Geometric Realisation & Validation:** A pure mathematical layout engine transforms the abstract room programme into exact coordinates, aligned load-bearing wall lines, door openings with swing arcs, orientation-sensitive windows, dog-legged stair wells, and stepped terraces.

Nothing reaches a renderer (2D or 3D) unless it passes 100% of architectural validation checks.

```
User Brief & Site Input (Plot W x D, Orientation, Setbacks, Rooms, Style, Modes)
                                  ↓
      Deterministic Feasibility Pre-Check (buildable envelope & min sizes)
                                  ↓
       RAG Architectural Knowledge Retrieval (Isolated per 8 styles, Vastu, Climate)
                                  ↓
        AI Spatial Planner (Gemini 2.5 Flash → 2.5 Pro with Multi-Key Failover)
               [or Built-in Deterministic Rule Engine Fallback]
                                  ↓
                 Room Programme Validation & Style Conformance
                                  ↓
             Deterministic 2D Layout Engine (layoutProgram)
        - Depth zoning: Front (public), Middle (service/stair), Rear (private)
        - Aspect ratio capping (habitable <= 1.8:1)
        - Large plot programme growth (20-45% ground coverage)
        - Small plot setback porch integration (<= 1500 sq ft)
        - Structural wall line alignment and purposeful upper floor terraces
                                  ↓
               Openings & Circulation Synthesis (openings.ts)
        - Road-facing main entry door
        - Foot-landing stair doors
        - Direct passage-based access (no bedroom crossed)
                                  ↓
              Pure Validation Check (validateFloorPlan.ts)
                                  ↓
     Canonical StructuredDesignJSON (Schema Version 2, Single Source of Truth)
               ↓                                              ↓
  Professional 2D SVG Canvas                   Deterministic 3D Massing Viewer
 (Pan/Zoom, Plot Context, Toggles)          (Merged Geometries, Demand Render, Walkthrough)
```

---

## 2. Spatial Zoning & Circulation Rules

### 2.1 Depth Zones (Bands)
Every floor is divided into three depth zones relative to the road frontage:
- **Front Zone:** Hosts public arrival (Entrance Porch, Foyer, Living Room). Oriented directly towards road access and primary daylight.
- **Middle Zone:** Vertical circulation spine (Dog-legged staircase well), dining room, and service hubs (Kitchen, Utility, Courtyard / Nadumuttam / Chowk). Buffers formal reception from private suites.
- **Rear Zone:** Acoustic and visual sanctuary housing master suites, secondary bedrooms, and quiet family spaces away from street noise.
- **Upper Floors:** Stepped footprint with private bedroom suites opening onto a central family lounge, sharing ground-floor load-bearing wall alignments and stepping back into purposeful private terraces.

### 2.2 Circulation & Accessibility Guarantees
- **Private Room Isolation:** Every room must be reachable from circulation corridors or public lobbies without crossing through any bedroom or bathroom.
- **Staircase Entry:** Doors and archways may only open onto the stair at its foot landing, never across active riser flights.
- **Stair Connectivity:** Every floor level has direct, unblocked access to the vertical circulation staircase.
- **Main Entry Orientation:** Main entry door is visibly oriented toward the road side.

---

## 3. Plot Sizing & Growth Rules

### 3.1 Large Plots (>= 5,000 sq ft up to 30,000 sq ft)
- **Programme Expansion:** Rather than over-stretching individual rooms into oversized boxes, large plots grow the programme into dedicated functional spaces:
  - Entrance Foyer / Vestibule
  - Separate Formal Living and Family Lounge
  - Dedicated Dining Room independent of the Kitchen
  - Utility Yard and Service Porch
  - Study / Home Office and Pooja Room per style mandate
- **Coverage Benchmarks:** Ground coverage is maintained between **20% and 45%**, preserving generous perimeter garden zones, vehicle driveways, and landscaped setback buffers.
- **Aspect Ratio Capping:** All habitable rooms observe a strict aspect ratio cap ($\le 1.8:1$) to guarantee natural daylight penetration and natural furniture layout proportions.

### 3.2 Small Urban Plots (<= 1,500 sq ft)
- **Front Setback Porch Borrowing:** For compact urban plots, parking porches and front entrance steps may borrow into the front setback up to $5.5\text{ ft}$ (preserving statutory lot boundaries), allowing 30x40 2BR and 3BR G+1 briefs to fit without artificial bedroom downgrades.
- **Compact Vertical Cores:** Utilises compact dog-legged stairs ($10.5\text{ ft}$ depth) and lean balconies ($3.0\text{ ft}$ depth).
- **Infeasible Brief Handling:** If a brief truly cannot fit the envelope, the engine returns an exact shortfall in square feet and 2-3 concrete suggestions (e.g. add a floor, drop dedicated parking, reduce bedroom count).

---

## 4. AI Generation, RAG & Multi-Key Failover

### 4.1 Multi-Key & Multi-Model Failover
The Gemini client (`src/lib/genai/gemini.ts`) provides resilient failover across multiple API keys and models:
- **Key Discovery:** Priority-ordered resolution across `GENAI_API_KEY`, `GENAI_API_KEY_2`, `GENAI_API_KEY_3`, and `GENAI_API_KEYS`.
- **Model Waterfall:** Fast model first (`gemini-2.5-flash`), with fallback to strong reasoning (`gemini-2.5-pro`).
- **Failure Resilience:** Catches rate limits (HTTP 429), timeouts, 404 bad model names, network aborts, and malformed JSON, automatically transitioning to the next ready key/model.
- **Cooldown Cache:** Keys experiencing rate limits enter a temporary 60-second cooldown so consecutive calls are not stalled.
- **Local Fallback:** If AI models are unavailable or budget expires, the built-in deterministic rule engine produces a validated plan labeled with a clear user notice.

### 4.2 Retrieval-Augmented Generation (RAG)
`src/lib/genai/rag/` provides domain knowledge across 8 architectural traditions:
1. **Kerala Traditional:** Nalukettu planning, central Nadumuttam, Poomukham arrival, Charupadi seating, sloped clay tile roofs.
2. **Traditional Indian:** Chowk / Aangan courtyard, Baithak guest reception, Jali screens, Ishan/Agni Vastu alignment.
3. **Colonial:** Symmetrical axial portico, central drawing hall, formal dining, tall shuttered bays, hipped roofs.
4. **Tropical:** Cross-ventilated single-depth wings, breeze porches, timber louvres, deep eaves.
5. **Modern:** Open-plan living-dining-kitchen spine, floor-to-ceiling garden glazing, flat parapet roofs.
6. **Minimalist:** Pure rectilinear volume, concealed full-height joinery, uncluttered cellular discipline.
7. **Contemporary:** Asymmetric L-shaped massing, stepped upper terraces, home office, mixed cladding.
8. **Modern Luxury:** Grand double-height living, ensuite bathrooms for all bedrooms, master dressing suite, multi-car parking.

Each style maintains strict retrieval isolation: unit tests guarantee that requesting knowledge for one style returns that style's programme, site, and checklist rules and zero items from any other tradition.

---

## 5. Streaming Progress & Architect Explanations

### 5.1 Real-Time Stage Streaming
`/api/design/generate` supports Server-Sent Events (SSE) streaming progress stages to the client:
1. `checking_brief`: Verifying site setbacks and dimensional feasibility.
2. `planning`: Reasoning about spatial zoning and orientation.
3. `laying_out`: Synthesizing room geometry, walls, openings and stair core.
4. `validating`: Executing pure architectural and structural checks.
5. `saving`: Persisting validated design and version metadata.

### 5.2 Architect "Explain This Plan" Specification
Every generated design carries a structured `planExplanation` object detailing:
- **Spatial Zoning Rationale:** Functional reasoning behind front, middle, and rear depth zoning.
- **Room Sizing & Footprint:** Ground coverage ratio, plot utilization, and NBC guideline adherence.
- **Validator Compliance Report:** Proof of passing road-facing main door, stair connectivity, private circulation, and aspect ratio constraints.

---

## 6. Verification & Test Suite

The engine is protected by a comprehensive test suite covering 93 automated tests across:
- **Architectural Regressions:** Aspect ratios, courtyard enclosures, stair landings, openings.
- **Sweep Matrix:** 224 combinations across 8 styles $\times$ 7 plots $\times$ 4 briefs.
- **Gemini Failover:** Rate limiting, malformed response handling, timeouts, model fallback.
- **Style Isolation:** Strict zero-leakage RAG retrieval across all 8 architectural styles.
- **Export & Canvas Integrity:** SVG rendering, DXF export, OBJ 3D export, and CSV area schedules.
