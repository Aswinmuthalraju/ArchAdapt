# ARCHADAPT AI — AGENT 1 ARCHITECTURE
## Unified Architectural Pipeline, Authoritative Geometric Model & Interactive System Design

**Date:** November 2026  
**Architect:** Agent 1  
**Version:** V1.5.0-Architecture  
**Status:** Approved for Engineering Execution

---

## 1. System Architecture Overview

ArchAdapt AI operates on an **authoritative single-source-of-truth model**. The core architectural design is stored as a canonical `StructuredDesignJSON` data structure. All representations—2D architectural drawings, 3D interactive models, code validation checks, professional area schedules, and export files (DXF, OBJ, SVG, CSV, JSON)—derive deterministically from this single schema.

```
                  ┌──────────────────────────────────────────────┐
                  │              USER INTENT / BRIEF             │
                  │   (Natural Language / Onboarding / What-If)   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │           1. AI REASONING LAYER              │
                  │    • Gemini 3.8 Flash / Local Rule Engine    │
                  │    • Architectural Knowledge RAG (8 Styles)  │
                  │    • DesignProgram & Constraints Synthesis   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │       2. SPATIAL OPTIMIZATION LAYER          │
                  │    • Setback & Buildable Envelope Solver     │
                  │    • Plot Dimension & Orientation Balancing │
                  │    • Room Adjacency & Circulation Graph      │
                  │    • Door & Window Opening Placement         │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │    3. AUTHORITATIVE DESIGN REPRESENTATION    │
                  │          `StructuredDesignJSON`              │
                  │   (Rooms, Walls, Openings, Stairs, Plot)     │
                  └───────┬──────────────┬──────────────┬────────┘
                          │              │              │
           ┌──────────────┴──────┐       │       ┌──────┴──────────────┐
           ▼                     ▼       ▼       ▼                     ▼
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ 2D BLUEPRINT VIEW  │ │ 3D INTERACTIVE CAD │ │ PROFESSIONAL BIM   │ │ CAD / BIM EXPORTS  │
│ • Graphic Scale    │ │ • Room Raycasting  │ │ • Area Schedules   │ │ • Layered DXF      │
│ • Dimension Lines  │ │ • Section Cutaway  │ │ • Code Compliance  │ │ • Wavefront OBJ    │
│ • Dual Unit Tags   │ │ • Elevation Views  │ │ • FSI/FAR Auditing │ │ • Printable Sheets │
│ • Synchronized Sel │ │ • Synchronized Sel │ │ • Cost Pro-Forma   │ │ • Canonical JSON   │
└────────────────────┘ └────────────────────┘ └────────────────────┘ └────────────────────┘
```

---

## 2. Interactive 3D CAD & Visualization Architecture

### 2.1 The Two-Tier Mesh Architecture
Previous versions suffered from a binary trade-off: merging all boxes into a single mesh offered 60fps rendering but eliminated interactivity; unmerged boxes added hundreds of draw calls.

ArchAdapt V1.5 solves this via a **Two-Tier Architecture**:
1. **Visual Tier (Merged Batches):** Structural walls, ceilings, frames, steps, and railings remain merged into single geometry draw calls per material for optimal WebGL performance.
2. **Interactive Selection Tier (Invisible/Highlighted Room Proxies):** Each room generates a dedicated interaction bounding volume (`mesh` with transparent hit area or subtle hover/selection highlight border). Clicking a room in 3D fires raycast intersection, sets `selectedRoomId`, and highlights the room with a glowing gold boundary and floating 3D HUD label.

### 2.2 Hardware Clipping Plane (3D Cutaway Mode)
Rather than destructively modifying 3D geometry vertices when cutting away roofs or upper floors, the engine introduces **WebGL Hardware Section Clipping**:
- A global `THREE.Plane(new THREE.Vector3(0, -1, 0), cutHeight)` is supplied to `gl.localClippingEnabled = true`.
- When Cutaway Mode is activated, a smooth slider allows slicing the building at any elevation ($1.2\text{m}$ to roof height), visually cutting open walls to reveal interior arrangements in true 3D perspective.

### 2.3 Cardinal Architectural Camera Projections
Architects require standard orthographic/elevation projections to evaluate building proportions. The 3D viewer includes animated camera transitions:
- **Perspective Orbit:** 360-degree free orbit around the house center.
- **Top (Plan View):** Camera at $(0, \text{dist}, 0)$ looking straight down.
- **Front Elevation:** Camera looking directly at the entrance facade ($-Z$).
- **Rear Elevation:** Camera looking from $+Z$.
- **Left Elevation:** Camera looking along $-X$.
- **Right Elevation:** Camera looking along $+X$.
- **Isometric:** Classic $45^\circ$ axonometric view.

---

## 3. Professional 2D Blueprint Architecture

The 2D rendering pipeline in `PlanSvg.tsx` and `FloorPlan2DRenderer.tsx` is upgraded to true architectural drafting standards:

1. **Graphic Scale Bar:**
   - A calibrated SVG graphic scale bar rendered directly on the drawing sheet.
   - Accurately divisions at $0'$, $5'$, $10'$, and $20'$ dynamically scaled to canvas pixels per foot.
2. **Interior & Exterior Dimension Witness Lines:**
   - Exterior overall building footprint dimension strings with architectural tick marks.
   - Room-by-room clear dimension strings showing exact span $\times$ depth.
3. **Dual-Unit Room Annotations:**
   - Room tags display room title, imperial dimensions (e.g., $14' \times 12'$), and dual area metrics:
     $$\text{Area} = 168 \text{ sq ft} \quad (15.6 \text{ m}^2)$$
4. **Monolithic Wall Poche Joinery:**
   - Exterior walls rendered with standard architectural double-line thickness ($9''$ / $230\text{mm}$).
   - Interior partitions rendered at standard thickness ($4.5''$ / $115\text{mm}$).
   - Door frames include jamb stops and swing rotation indicators.

---

## 4. Unified Bidirectional Selection & Contextual What-If

### 4.1 State Synchronization
In `WorkspacePage`, the selection state is unified:
```typescript
interface WorkspaceSelection {
  selectedRoomId?: string;
  selectedWallId?: string;
  hoveredRoomId?: string;
}
```
- Clicking a room in the 2D floor plan highlights that room in the 3D model and updates the Inspector Panel.
- Clicking a room in the 3D model highlights that room in the 2D floor plan and opens its Inspector Panel.

### 4.2 Contextual Room Inspector & Surgical Mutations
When a room is selected, an architectural Inspector Bar reveals:
- **Room Identity:** Name, Type, Floor Level, Orientation, Zoning Category.
- **Dimensional Specs:** Width, Depth, Area in sq ft and sq m, Daylight status.
- **Instant Surgical Actions:**
  - `+15% Area`: Enlarges room without scrambling other rooms.
  - `-15% Area`: Reduces room comfortably above minimum code limits.
  - `Ensuite Toggle`: Attaches/detaches dedicated bathroom where applicable.
  - `Conversational Prompting`: Prefills What-If prompt: *"Make [Selected Room] wider toward the east while keeping the bedroom unchanged."*

---

## 5. Non-Destructive Landing Page Isolation

All modifications to `PlanSvg.tsx` and 3D components are strictly backward compatible:
- When rendered on the landing page, `PlanSvg` is called with:
  ```tsx
  <PlanSvg
    design={design}
    floor={0}
    theme="paper"
    showSite={false}
    showAnnotations={false}
    crop
    className="block h-full w-full"
  />
  ```
- All new features (scale bars, interior witness dimension lines, dual unit tags, interactive room picking) are conditioned on active props (`showScaleBar = true`, `showDimensions = true`, `interactive = true`), defaulting to clean rendering when these props are omitted or disabled.
- Therefore, the landing page hero plan, style illustrations, and showcases remain completely unchanged and visually identical to the verified baseline.

