# ARCHADAPT AI — REVERSE ENGINEERING RESEARCH
## Assessment of "Reverse Engineer Anything" (REA), Advanced Architectural Interaction Patterns & Legal Technical Findings

**Date:** November 2026  
**Auditor:** Agent 1  
**Target Repository:** `morluto/rea` (Reverse Engineer Anything)  
**Reference Source:** [GitHub: morluto/rea](https://github.com/morluto/rea)  
**License:** MIT License

---

## 1. Deep Technical Evaluation of "Reverse Engineer Anything" (REA)

### 1.1 Source & Identity Verification
- **Official Repository:** `https://github.com/morluto/rea`
- **Package / CLI:** `npx rea-agents setup`
- **Primary Purpose:** An open-source MCP (Model Context Protocol) server and inspection toolkit that connects AI coding agents (Claude Code, Cursor, Codex, Gemini CLI) to local reverse-engineering tools.
- **Underlying Engines:** Bridges local agents to disassemblers (Ghidra, Hopper), decompilers (JADX for Android APKs), unpackers (Electron ASAR archives), and JavaScript AST parsers/deobfuscators.

### 1.2 Technical Architecture & Operation
REA functions as an MCP JSON-RPC server running locally. When an agent queries an application:
1. It unpackages target containers (e.g., extracting source chunks from Electron apps or unpacking `.apk`/`.asar`).
2. It executes localized AST parsing and symbol graph extraction.
3. It emits structured evidence trails (recovered call trees, API interfaces, schema contracts) and lists the limitations/unknowns behind each conclusion.

### 1.3 Legal & Technical Boundaries
- **Permissible Scope:** Deconstructing open-source toolkits, analyzing publicly distributed client bundles, inspecting observable WebGL canvas state and public REST/GraphQL schemas.
- **Prohibited Scope:** Circumventing authentication, bypassing DRM, extracting proprietary server-side logic from closed SaaS platforms (such as Autodesk Cloud or TestFit enterprise servers), or decompiling proprietary desktop binaries without authorization.
- **Evaluation Verdict for ArchAdapt AI:**
  - **Do NOT integrate REA into ArchAdapt's production runtime.** REA is an agentic development tool, not an architectural software runtime. Embedding it into ArchAdapt would introduce unnecessary binary bloat, security vulnerabilities, and deployment baggage.
  - **Use REA strictly as an offline research methodology** to inspect publicly observable frontend interaction patterns and WebGL state structures in web-based design tools.

---

## 2. Reverse-Engineered Architectural Interaction Patterns

By studying observable frontend behavior in leading CAD, WebGL, and BIM platforms (Autodesk Forma web client, SketchUp Web, Tinkercad, Archicad, and open-source CAD tools like Web-IFC-Three and OpenCascade.js), we identified the core interaction patterns that make professional 3D tools feel responsive and precise:

### 2.1 The Raycasting & Element Selection Pipeline
* **Observed Pattern:** Professional tools do NOT merge all objects into an undifferentiated buffer if users need to click them. Instead, they use one of two architectures:
  1. **Hierarchical Object3D Trees with Layer Masks:** Each interactable room/element has an invisible or dedicated bounding proxy mesh registered with a Three.js raycaster.
  2. **GPU Color Picking / Instanced Buffers:** Each element has an integer ID encoded into an off-screen render buffer or instance attribute. Clicking reads the pixel ID instantly.
* **ArchAdapt Application:** For residential models (typically 10 to 40 rooms), individual room floor plates and wall proxies can be maintained with fast raycasting and hover outlines. Monolithic merged geometry is retained for structural massing and shadows, while interactive proxy planes handle user clicks with zero latency.

### 2.2 3D Horizontal Cutting Planes (Section Cutaways)
* **Observed Pattern (Archicad / Revit / Forma):** Slicing a building open does not require chopping 3D geometry vertices. Modern WebGL engines use **Hardware Clipping Planes** (`THREE.Plane` with `renderer.clippingPlanes`).
* **Implementation:** A horizontal clipping plane placed at eye-level ($Y = \text{floorBase} + 1.2\text{m}$) instantly cuts away ceilings and upper walls, exposing the furnished interior in true 3D perspective without modifying the mesh buffer.

### 2.3 Orthographic Camera Views & Architectural Elevations
* **Observed Pattern (AutoCAD / Revit):** True architectural elevations require an orthographic camera (no perspective foreshortening) aligned precisely along the cardinal axes:
  - **Plan (Top):** Looking down from $+Y$.
  - **Front Elevation:** Looking from $-Z$ toward the entrance.
  - **Rear Elevation:** Looking from $+Z$.
  - **Left / Right Elevations:** Looking along $\pm X$.
  - **Axonometric / Isometric:** Fixed $45^\circ / 35.264^\circ$ angle.
* **ArchAdapt Application:** Provide one-click camera elevation buttons (Front, Rear, Left, Right, Top, Iso) so users can view true architectural elevations directly in the 3D viewport.

### 2.4 Synchronized 2D $\leftrightarrow$ 3D Selection State
* **Observed Pattern (Forma / Revit):** Selecting an entity in the 2D floor plan highlights its corresponding 3D volume in real time, and vice versa. Hovering over a room in 2D shows a subtle glow in 3D.
* **ArchAdapt Application:** A centralized selection state (`selectedRoomId`, `hoveredRoomId`, `selectedWallId`) shared seamlessly across the 2D SVG canvas and the 3D Three.js canvas.

### 2.5 Dynamic Dimensioning & Snapping
* **Observed Pattern (AutoCAD):** When an element is selected, dynamic dimension lines appear between its bounding edges and adjacent walls. Clicking a dimension value allows typing an exact replacement (e.g., changing $12' \rightarrow 14'$).
* **ArchAdapt Application:** In both 2D and 3D, selecting a room displays its length, width, area (sq ft and sq m), and provides quick contextual action buttons ("Widen by 2 ft", "Deepen by 2 ft", "Make ensuite", "Change material").

---

## 3. Legally Reusable Open-Source Components & Licensing Matrix

| Library / Component | License | Capabilities Leveraged in ArchAdapt |
| :--- | :--- | :--- |
| **Three.js** | MIT | Core 3D scene graph, WebGL rendering, lighting, hardware clipping planes, orbit controls. |
| **@react-three/fiber & @react-three/drei** | MIT | Declarative React Three bindings, OrbitControls, Environment, Lightformer, ContactShadows. |
| **Lucide React** | ISC | Modern architectural, UI, and navigation icons. |
| **Tailwind CSS & Tailwind Merge** | MIT | Responsive styling, architectural color tokens, typography. |
| **Clipper2 / Polygon Geometry Concept** | BSL-1.0 / MIT | Polygon offsetting, clipping, and setback union operations. |

---

## 4. Key Recommendations for ArchAdapt AI Transformation

1. **Keep Geometry Clean & Single-Source:** Never build separate 2D and 3D geometric models. Both must derive directly from `StructuredDesignJSON`.
2. **Elevate 3D to an Interactive CAD Experience:** Add interactive room selection, hover tooltips, hardware section cutaways, and camera presets.
3. **Elevate 2D to an Architectural Blue-Print Standard:** Add graphic scale bars, room dimension strings, wall poche fills, and dual-unit room tags.
4. **Make What-If Contextual & Surgical:** When a user selects a room and says "Expand this by 20%", apply localized geometric scaling that preserves unaffected rooms.

