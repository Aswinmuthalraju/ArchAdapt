# Verified research (Agent 3, 6 Nov 2026)

Everything below was fetched from public pages or the public GitHub / npm APIs on the date above. Where a source did not say something, that is stated instead of filled in. This replaces nothing in Agent 1's research notes (they are unmodified); it records what could and could not be confirmed.

## 1. "Reverse Engineer Anything" (REA)

| Question | Verified answer | Source |
|---|---|---|
| Owner | GitHub user `morluto` (account type User), repo `morluto/rea`, not a fork, created 2026-04-14, last push 2026-11-06 | GitHub API `repos/morluto/rea` |
| Licence | MIT, "Copyright (c) 2026 morluto" | GitHub API `…/license`, LICENSE file |
| Official channels | github.com/morluto/rea, rea.tools, npm package `rea-agents` (6.8.0, MIT). The README warns that similarly named repos are not official. | README, npm registry |
| Install | `npx rea-agents setup`; needs Node 22.23.4+ / 24.22.1+ / 26.12.1+. Setup edits the agent's MCP configuration (with backups and an approval step). | README, npm `engines` |
| What it is | An MCP server and CLI that lets a coding agent inspect software **you supply**: native binaries (via Hopper, Ghidra, IDA, Kuna, Rizin, objdump you install), JavaScript/Electron apps, .NET assemblies, APKs, firmware, network captures (HAR/SAZ/pcap), and web pages in a Chrome-family browser (structure, scripts, network observations, screenshots). Static analysis does not run the target; runtime capture runs it with the user's permissions. | README "What you can analyze" |
| Maintenance signals | Very large star count and 1,585 open issues reported by the API; I did not review code quality or its issue tracker. | GitHub API |

**What REA is not.** It is a developer/research tool, not a design engine. It cannot tell us how an architectural product *decides* a layout: the placement logic of Forma, TestFit, Maket or Finch runs on their servers, which REA cannot and must not inspect. For desktop products (Revit, AutoCAD, Archicad) it would mean disassembling licensed binaries, which their licences generally forbid.

**Did Agent 1 use it?** There is no evidence in the repository or in `AGENT_1_HANDOFF.md` of REA being installed or run (no setup output, no captured evidence, no tool transcripts). `REVERSE_ENGINEERING_RESEARCH.md` nonetheless says patterns were found "by studying observable frontend behavior" of the Forma web client, SketchUp Web and Archicad. Those statements are unsupported and should be read as general knowledge, not findings.

**Did I use it?** No. I did not run `npx rea-agents setup`: it rewrites the agent's tool configuration, which should be your decision, and the only targets that would be legitimate (our own app, or open-source CAD libraries) do not need it for the question being asked.

**How the idea is applied legitimately.** Your instruction was to take existing architecture products as *examples*, not copies. What we can do within public information and authorised access:
1. Read each vendor's public documentation and marketing for the **workflow and outputs** (below) and design our own equivalents.
2. If you want evidence-backed study of an *open-source* design/BIM library (for example a web IFC viewer), REA can inspect those on your machine. Say which one and I will run it.
3. Do not point it at a competitor's logged-in SaaS session, their API, or their binaries.

## 2. Competitor workflows (public pages only)

| Product | What the public page confirms | What it does **not** confirm |
|---|---|---|
| **TestFit** | Generative site planning (Site Solver), parking layouts, urban massing with live yield tabulations; custom site boundaries, road layout and topography; unit-mix/zoning/parking testing; pro-forma linked to the plan; push to Revit, export to AutoCAD, SketchUp, Excel, PDF. Aimed at real-estate feasibility, not single homes. | Pricing; how its solver works; performance figures (page marketing and testimonials only). |
| **Maket.ai** | Plain-language brief (rooms, target area, house shape, priorities) or an uploaded plan; several floor-plan options side by side in about 2-3 minutes; furnished layouts and 3D renders; edit by text or on the canvas; export PDF/DXF/image; free tier (30 credits), paid from $20/month (homeowner) and $100/month (professional). | A plot or site-boundary input (the page does not mention one); how alternatives are produced. |
| **Finch 3D** | "AI-native" design platform: encode a firm's design standards, explore many options with live metrics, produce floor plans, area calculations and BIM geometry; typology tools (master plan, residential, high-rise, office) checked against compliance codes; scripting and simulation mentioned. | Parametric optimisation, graph-based design and Revit/Archicad integration were **not** stated on the fetched page, so they are not claimed here. |
| **Autodesk Forma** | Early-stage analysis on massing: daylight potential (vertical sky component), wind, microclimate (perceived temperature), noise and embodied-carbon analyses are described; live analysis on massing studies; export to Revit (RVT) or IFC. Third-party text calls the daylight analysis an early estimate, not a full simulation. The Autodesk help URL I tried returned 404; the above comes from Autodesk learning pages and third-party summaries surfaced by search. | Independent accuracy validation (none found). |
| **Revit** | Generative design grew out of Project Refinery (beta 2019, shipped in Revit 2021); users define objectives and get ranked options. Autodesk's documented examples are panel patterning, crane/duct layout and master-planning massing. | Residential floor-plan generation: none of the pages I found describe it. |
| **Archicad / AutoCAD** | **Not verified.** The searches returned nothing usable. | Everything. |

## 3. What this means for ArchAdapt

Supported by the pages above:
- **Ranked alternatives with live metrics** is the common pattern (Maket, Finch, TestFit). ArchAdapt now produces several valid layouts per brief, each scored and with a stated trade-off.
- **Site boundary and orientation as first-class inputs** is the TestFit/Forma pattern. ArchAdapt now accepts polygon plots with road edges. Maket's page does not mention a plot input, so this is a place we can be ahead on residential lots.
- **Export to DXF/PDF** is table stakes (Maket, TestFit). ArchAdapt already exports DXF and a drawing set.
- **Early-stage environmental feedback** (Forma) is estimates, not simulation. ArchAdapt's daylight and sun scores are the same class of proxy and are labelled as such.

Not supported / open: whether any competitor preserves unrelated geometry on an edit. The pages describe editing but say nothing about diffing or stability, so ArchAdapt's What-If proposal-with-diff flow is our own design, not a copy and not a verified differentiator.
