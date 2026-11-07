# Planning principles the engine enforces

These are standard rules of residential design and construction. The engine now applies them as hard checks
(the plan is rejected) or as scored measures (better plans rank higher).

| Rule | Why (reference) | How it is enforced |
|---|---|---|
| **Every upper room stands on the floor below.** It sits over rooms or a columned porch, never over open air, a courtyard, or an open balcony/terrace. | Loads go straight down through walls and columns to the foundation. Walls and columns stack floor over floor (F. D. K. Ching, *Building Construction Illustrated*, ch. 4–5; IS 456 / NBC 2016 Part 6, Structural Design). | Hard check `UNSUPPORTED_UPPER_ROOM` in `validateFloorPlan`. The band solver builds an upper zone only over supported stretches, and checks every arrangement before using it. |
| **A balcony may cantilever up to about 4 ft (1.2 m); a terrace or room may not.** | Typical RCC cantilever balcony depth for houses is 0.9–1.5 m without extra beams. | Same check, with a 4 ft allowance for balconies only. |
| **The upper floor uses the footprint it is built on.** No small box of rooms floating in one corner of the roof slab. | A G+1 house reads as one building mass. The upper floor normally covers the ground floor, and the car-porch / entrance-porch roof becomes the balcony or sit-out (the common Indian G+1 pattern). | Optimiser plans upper floors on the full ground footprint. Rooms grow first, and any leftover becomes one road-side terrace. Porch roofs are reserved as balconies. A compact box inside the footprint is only a fallback. |
| **Simple, rectangular outline.** | Fewer corners mean less wall, roof edge and leakage, and a simpler structural grid (Ching, *Architecture: Form, Space and Order*; Neufert, *Architects' Data*, Houses). | New quality part **Massing & stacking**: upper support, upper coverage and outline rectangularity. |
| **Rooms keep usable proportions** (habitable rooms ≤ about 1:2). | NBC 2016 Part 3 minimum room width and area; Neufert room proportions. | A first try that stretches an upper room into a strip is rejected and re-planned. |
| **Climate-Adaptive puts the living room on the cooler side.** | Passive design for warm climates (NBC 2016 Part 8, Building Services / ventilation; ECBC-R). | The ranking penalises plans that break this when the mode is on. |

Developer tools: `npx tsx tests/tools/gallery.ts out.png` renders the selected plan for a spread of everyday briefs.
`tests/tools/benchmark.ts` compares every candidate. Set `CHROMIUM_PATH` if Playwright's bundled browser is missing.
