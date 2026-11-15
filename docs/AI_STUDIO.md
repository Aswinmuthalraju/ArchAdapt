# AI Studio: what is real

| Feature | Route | How it works | Needs |
|---|---|---|---|
| Room render | `POST /api/render/interior` | Gemini image model. Prompt built from the room's real size, windows and doors (`src/lib/rendering/promptBuilder.ts`). | `GENAI_API_KEY` |
| Facade render | `POST /api/render/exterior` | Same, using floor count, footprint and plot. When the 3D tab is open, a capture of the live model is sent as a conditioning image (`viewportCapture.ts`) and the response says `anchoredTo3D: true`. | `GENAI_API_KEY` |
| Plan reading | `POST /api/ingest/blueprint` | Vision model reads an uploaded image/PDF (10 MB max). Unreadable values come back `null`. Read-out only; it does not modify a design. | `GENAI_API_KEY` |
| Area / cost / checks | `src/lib/design/metrics.ts` | Computed from geometry. A check passes only when the numbers pass. Assumptions are named constants. | none |

Without a key the routes answer 503. They never return stock media. Renders are rate-limited per client (6 per minute).
AI imagery is an illustration, not a drawing: it can still differ from the plan in detail.

Not built: video walkthroughs (needs a video-generation backend), and importing a read plan as an editable design.
