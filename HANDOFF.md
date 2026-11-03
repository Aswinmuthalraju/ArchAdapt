# ArchadaptAI V1.4 Hand-off (verified)

**Branch:** `release/v1.4` · **Version:** 1.4.0

This replaces the earlier hand-off. Every number below was re-measured on this branch, not copied from an earlier report.

## Verification (run from the repo root)

| Check | Command | Result |
| :--- | :--- | :--- |
| Unit and regression tests | `npm test` | 86 / 86 pass |
| Types | `npx tsc --noEmit` | clean |
| Lint | `npm run lint` | no warnings or errors |
| Production build | `npm run build` | succeeds |
| Browser end-to-end | `npm run test:e2e` (needs a server; starts one if none) | 5 / 5 pass |
| 224-case sweep | `npm run sweep` | 216 feasible, 8 declined, 100% stair reachability (378/378), 0 rooms reached through a private room, 34.6% mean ground coverage, about 5 ms mean local generation |

First-load JS from the build: workspace 192 kB (was 490 kB), onboarding 228 kB, home 236 kB.

## Declined briefs (8 of 224)

The engine says plainly why and what to change, rather than drawing an unusable plan.

- 30x40 plot, 4BR G+1 with two cars, in all seven non-luxury styles: the 24 ft buildable width cannot hold two cars and the required rooms.
- Modern Luxury, 30x40, 2BR G+0: the style's mandated rooms do not fit.

With every optional space ticked at once (study, courtyard, guest room, prayer room, storage, garden, balcony), 71 of 224 combinations are declined, mostly 30x40 and 50x80 where the courtyard would split dining from kitchen. That is intended behaviour for an over-full brief.

## What changed in this pass

Engine
- A courtyard that cannot be enclosed on a large envelope (3000 sq ft or more) is now drawn open on one side with a note, instead of failing the brief. Before this, a 2BR single-storey with a courtyard on a 100x150 plot returned a render error in every style. Small plots keep the strict rule.
- A bathroom stretched to fill an empty zone (a 160 sq ft "Common Bath") is split into a bathroom-sized room plus a study or store next to the circulation. When that cannot be done safely, the validator warns above 120 sq ft and rejects above 190 sq ft, which makes the AI planner retry with feedback.
- The sweep prints every declined combination with the engine's reason.

UI
- The 2D plan opens already framed on the house, so a house on a 100x150 plot is no longer a small drawing in a large plot.
- Mobile workspace: the view tabs no longer wrap or clip, and a one-line summary (bedrooms, baths, floors, built-up area) shows on screens below the sidebar breakpoint, where the sidebar is hidden.

Tests: two new tests (open courtyard on a large plot, bathroom size cap).

## Corrections to the earlier hand-off

- Its 3D screenshots were not renders of the app (a floating box over a flat slab). Real screenshots of the running app for six configurations are in `docs/screenshots/` (2D and 3D each). They use the default brief of 3 bedrooms, 2 floors, so they show the style and plot-size behaviour, not every brief.
- Its list of declined briefs described two cases with causes; the actual 8 are listed above.
- "Rooms reached via a private room = 0" is measured by counting validator error messages. A plan whose problem is worded differently would not be counted, so treat it as a proxy.
- V1.3 baselines in the earlier table (for example 120 ms, 14 violations) have no stored before-run; only the current numbers are reproducible.

## Known limits and next work

- Modern Luxury at 50x80 and 60x100 can still produce a narrow study or guest room (about 8 to 9 ft wide, 22 to 25 ft deep). Widening the minimum side for studies fixed that but broke daylight for a five-bedroom plan, so it was reverted.
- Large plots show validator warnings such as a first-floor balcony reached through a private room. They do not block a plan but should be resolved.
- The AI path was exercised with live keys only through the app (one Gemini run answered normally); forced-failure failover is covered by stubbed tests, not by live bad keys.
- No Lighthouse numbers were taken. The end-to-end suite guards several checks with `if visible`, so it can pass without exercising them.
- The optional site-plan upload is stored but not drawn.
