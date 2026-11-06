# ARCHADAPT AI — COMPETITOR RESEARCH
## Deep Architectural Software Workflows, Comparative Analysis & Opportunity Matrix

**Date:** November 2026  
**Auditor:** Agent 1  
**Scope:** Advanced Architectural Design, Computational Planning, BIM, and AI-Powered Generative Platforms.

---

## 1. Executive Summary

Architectural software has bifurcated into two polar extremes:
1. **Heavyweight Desktop BIM/CAD (Revit, AutoCAD, Archicad, Fusion):** Unrivaled precision, parametric constraints, and drawing sheet coordination, but burdened by steep learning curves, expensive licenses, rigid setup requirements, and total inaccessibility to homeowners.
2. **Early-Stage Algorithmic & AI Explorers (Autodesk Forma, TestFit, Finch 3D, Maket):** Rapid site feasibility, volumetric generative exploration, and graph-based layout generation, but often confined to multi-family/commercial shells or lacking accessible, interactive consumer workflows.

**ArchAdapt AI's Core Opportunity:** Bridge this chasm. Provide an AI-first residential design platform where natural-language requirements and site parameters generate authoritative, professional 2D drawings and synchronized 3D models—with accessible conversational editing for homeowners and deep, parametric control for architects.

---

## 2. Comprehensive Tool-by-Tool Workflow Analysis

### 2.1 Autodesk Forma (formerly Spacemaker)
* **Relevant Workflows:** Site boundary definition, microclimate analysis (sun, daylight hours, wind, noise), early massing, and the experimental **Building Layout Explorer**.
* **Observed Functionality:**
  - Cloud-native web platform allowing direct import of georeferenced GIS terrain, road networks, and 3D surrounding buildings.
  - Generative exploration of building envelopes evaluated against real-time solar irradiation and CFD wind comfort.
  - Automatic floor-plate interior subdivision (primarily for multi-family unit distribution and office lease spans).
  - Bidirectional synchronization with Revit via the Forma Connected Client.
* **What Makes It Useful:** Real-time feedback loops between geometry modifications and environmental analytics without manual mesh meshing.
* **What Is Difficult for Ordinary Users:** Dense analytical graphs, abstract volumetric blocks with no interior furniture or residential warmth, commercial multi-family focus, high enterprise pricing.
* **What an Architect Benefits From:** Defensible data for zoning board reviews, daylight compliance certificates, and fast site massing options.
* **ArchAdapt Equivalent:**
  - AI-driven climate intelligence that evaluates orientation, prevailing breezes, and solar exposure for residential plots.
  - Real-time environmental rationale explained in plain English for homeowners and technical notes for architects.
* **Complexity:** Medium · **Priority:** High · **Source Links:** [Autodesk Forma Official](https://www.autodesk.com/products/forma/overview), [Forma Building Layout Explorer Docs](https://help.autodeskforma.com/)

---

### 2.2 Autodesk Revit
* **Relevant Workflows:** Full Building Information Modeling (BIM), hierarchical element relationships (Levels $\rightarrow$ Walls $\rightarrow$ Hosted Doors/Windows $\rightarrow$ Rooms $\rightarrow$ Roofs), coordinated 2D drawing sheets, live schedules, and section cutaways.
* **Observed Functionality:**
  - A single authoritative database represents the entire building. Any change in a 2D floor plan instantly updates 3D elevations, sections, and room schedules.
  - Element hosting: Windows and doors cannot float in void space; they exist as hosted sub-elements within wall assemblies.
  - Section Box and 3D Cutting Planes: Dynamic 3D clipping to inspect floor sandwich assemblies and room heights.
* **What Makes It Useful:** Absolute consistency across 2D plans, 3D models, schedules, and drawing title blocks. Zero discrepancy between plan and elevation.
* **What Is Difficult for Ordinary Users:** Thousands of nested menus, family parameters, rigid worksets, coordinate systems, and an average training time of 6 to 12 months.
* **What an Architect Benefits From:** Construction-ready drawings, precise wall layer assemblies, automated door/window/area schedules, and engineering coordination.
* **ArchAdapt Equivalent:**
  - Maintain an authoritative `StructuredDesignJSON` where room footprints, wall segments, openings, and stair geometry drive both 2D SVG plans and Three.js 3D models with 100% mathematical parity.
  - 3D horizontal section cutaways (cut plane clipping) and elevation camera projections (Front, Left, Right, Rear, Iso).
  - Live room area schedules and material schedules calculated directly from canonical geometry.
* **Complexity:** High · **Priority:** Critical · **Source Links:** [Autodesk Revit Architectural Workflows](https://www.autodesk.com/products/revit/architecture)

---

### 2.3 Autodesk AutoCAD
* **Relevant Workflows:** 2D drafting standards, layer management, orthogonal snapping, dimension witness lines, wall poche hatches, graphic scale bars, and standard line weights.
* **Observed Functionality:**
  - The global standard for architectural drafting conventions: heavy outer boundary lines, distinct interior partition weights, quarter-circle door swing arcs, dual-dimension strings, and north arrows.
  - Precise snapping to endpoints, midpoints, perpendiculars, and intersections.
* **What Makes It Useful:** Crisp, universally understood blueprints that municipal planning bodies and contractors can execute.
* **What Is Difficult for Ordinary Users:** Pure command-line drafting, absence of 3D spatial awareness, manual drafting of every repetitive wall line.
* **What an Architect Benefits From:** Total control over drafting standards, line weights, DXF/DWG layer conventions, and print sheet layouts.
* **ArchAdapt Equivalent:**
  - Upgrade `PlanSvg.tsx` to render professional drafting standards: graphic scale bar (showing 0, 5, 10, 20 ft), monolithic wall poche joins, interior dimension witness lines, door jamb stops, and room tags showing dual units (sq ft & sq m).
  - Export well-structured, layered DXF files directly compatible with AutoCAD.
* **Complexity:** Medium · **Priority:** High · **Source Links:** [AutoCAD Architecture Guide](https://www.autodesk.com/products/autocad)

---

### 2.4 Autodesk Fusion
* **Relevant Workflows:** Parametric history tree, direct push-pull solid modeling, constraint-based 2D sketching.
* **Observed Functionality:**
  - Users select any face or edge to push, pull, chamfer, or offset, while maintaining underlying sketch constraints.
  - History timeline allows rolling back to earlier modeling states or branching.
* **What Makes It Useful:** Intuitive visual manipulation with mathematical precision behind the scenes.
* **What Is Difficult for Ordinary Users:** Geometric constraint conflicts, over-constrained sketch errors, mechanical part focus.
* **What an Architect Benefits From:** Quick geometric iterations for custom joinery, facades, and massing.
* **ArchAdapt Equivalent:**
  - Direct 3D and 2D selection of rooms and walls.
  - What-If transactional rollback: Every prompt creates an immutable version node in the version history tree with undo/redo and visual diffing.
* **Complexity:** Medium · **Priority:** Medium · **Source Links:** [Autodesk Fusion Modeling](https://www.autodesk.com/products/fusion-360)

---

### 2.5 TestFit
* **Relevant Workflows:** Real-time procedural site fitting, automated unit mix optimization, parking co-location, and instant pro-forma cost calculations.
* **Observed Functionality:**
  - Algorithmic procedural geometry engine calculating thousands of building configurations in milliseconds.
  - Dynamically solves parking stalls, stair shafts, and corridor depths within irregular site boundaries.
  - Real-time area metrics (Gross Area, Net Rentable Area, Efficiency %).
* **What Makes It Useful:** In seconds, developers determine whether a property deal is financially viable before hiring an architect.
* **What Is Difficult for Ordinary Users:** Geared exclusively toward commercial multi-family developers (wrap, podium, garden apartment typologies) rather than custom residential homes.
* **What an Architect Benefits From:** Eliminates weeks of manual test-fit drafting; provides instant density and parking counts.
* **ArchAdapt Equivalent:**
  - Sub-50ms procedural layout solver that evaluates residential plot coverage, setbacks, room sizes, and parking bays.
  - Instant area efficiency analysis and room schedules for residential briefs.
* **Complexity:** High · **Priority:** High · **Source Links:** [TestFit Generative Design](https://testfit.io/)

---

### 2.6 Finch 3D
* **Relevant Workflows:** Graph-based spatial layouts, topological adjacency networks, real-time code compliance checking, bi-directional Rhino/Revit sync.
* **Observed Functionality:**
  - Models floor plans as topological graphs (rooms = nodes, doors/adjacencies = edges).
  - Solves room placements by relaxing the graph inside building footprints.
  - Live compliance rules (e.g., maximum travel distance to stairs, daylight exposure requirements, minimum room clearances).
  - Parametrically linked unit plans: modifying one room ripples across duplicate apartment stacks.
* **What Makes It Useful:** Ensures spatial logic (privacy, circulation, adjacency) is mathematically guaranteed rather than visually guessed.
* **What Is Difficult for Ordinary Users:** Requires Rhino/Revit integration; complex graph-theory parameters.
* **What an Architect Benefits From:** Code compliance validation in real time; automated corridor and egress checking.
* **ArchAdapt Equivalent:**
  - Explicit spatial graph optimization in the layout engine: room adjacency relationships (e.g., kitchen $\leftrightarrow$ dining, master bedroom $\leftrightarrow$ ensuite) verified by mathematical graph rules.
  - Instant validation alerts for missing egress, landlocked rooms, or inadequate daylight.
* **Complexity:** High · **Priority:** Critical · **Source Links:** [Finch 3D Platform](https://www.finch3d.com/)

---

### 2.7 Maket (maket.ai)
* **Relevant Workflows:** Natural-language residential plan generation, conversational floor-plan editing, custom footprint shapes, 2D-to-3D visualization.
* **Observed Functionality:**
  - Generates 2D residential floor plans from natural language prompts.
  - Users can type conversational edits ("Increase living room size by 20%", "Move bedroom next to study").
  - Exports to DXF and PDF.
* **What Makes It Useful:** The closest consumer-accessible AI architectural tool on the market today.
* **What Is Difficult for Ordinary Users:** Can produce non-standard or structurally awkward wall alignments; limited direct manipulation in 3D; 3D renders are often AI hallucinated diffusion images rather than true interactive CAD models.
* **What an Architect Benefits From:** Rapid concept mood boards and starting schematics.
* **ArchAdapt Equivalent:**
  - Superior hybrid architecture: AI interprets intent into structured deltas, but deterministic geometry solvers execute the layout, guaranteeing structural stacking, clean wall alignments, and exact dimension compliance.
  - Interactive Three.js 3D CAD model that directly reflects the 2D plan, avoiding hallucinated diffusion renders.
* **Complexity:** Medium · **Priority:** Critical · **Source Links:** [Maket AI](https://www.maket.ai/)

---

### 2.8 Archicad (Graphisoft)
* **Relevant Workflows:** Virtual Building concept, 3D cutting planes, 2D/3D bidirectional editing, Smart Cursor snapping.
* **Observed Functionality:**
  - Smooth 3D cutting planes allow slicing the building at any elevation to view interior layouts in perspective.
  - Direct 3D manipulation: clicking a wall in 3D reveals dimension anchors and parameter inputs.
* **What Makes It Useful:** More architect-friendly and intuitive UI than Revit, with superior 3D navigation and cutaways.
* **What Is Difficult for Ordinary Users:** Heavy desktop software, professional CAD pricing, complex BIM terminology.
* **ArchAdapt Equivalent:**
  - Implement 3D horizontal cutting planes (cutaway mode) to expose internal layouts while preserving wall outlines.
  - Interactive 3D room selection that displays real-time room dimensions, area, and contextual editing commands.
* **Complexity:** Medium · **Priority:** High · **Source Links:** [Graphisoft Archicad](https://graphisoft.com/solutions/archicad)

---

## 3. Comparative Matrix & Strategic Takeaways

| Feature / Workflow | Revit | AutoCAD | Forma | TestFit | Finch 3D | Maket | ArchAdapt Target |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Natural Language Briefs** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **✓ (Core USP)** |
| **Conversational What-If** | ✗ | ✗ | ✗ | ✗ | ✗ | Partial | **✓ (Surgical Deltas)** |
| **Instant Residential Solvers** | ✗ | ✗ | Partial | ✗ (Commercial) | Partial | ✓ | **✓ (<50ms Deterministic)** |
| **2D ↔ 3D Live Parity** | ✓ | ✗ | ✓ | ✓ | ✓ | Partial | **✓ (Authoritative Design JSON)** |
| **Interactive 3D Room Pick** | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | **✓ (Interactive Raycast)** |
| **3D Cutaways / Section Views** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ (Clip Planes & Elevations)** |
| **Professional 2D Drafting** | ✓ | ✓ | ✗ | Partial | Partial | Partial | **✓ (Scale Bar, Poche, Dims)** |
| **Consumer Accessibility** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **✓ (Homeowner Friendly)** |
| **Zero-Install Web App** | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | **✓ (Next.js / WebGL)** |

