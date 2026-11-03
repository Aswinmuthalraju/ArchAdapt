# ArchadaptAI V1.4 Hand-off (verified)

**Branch:** `release/v1.4` · **Version:** 1.4.0

This replaces the earlier hand-off. Every number below was re-measured on this branch, not copied from an earlier report.

## Verification (run from the repo root)

| Check | Command | Result |
| :--- | :--- | :--- |
| Unit and regression tests | `npm test` | 90 / 90 pass |
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

## Product polish pass (style pages, mobile, colour)

- Each of the eight styles now has its own page, `/styles/<slug>`, with an overview, an at-a-glance table, what defines it, what changes in the plan, a four-step "how we design it", the rooms it adds, and a "Design in this style" button that opens the form already set to that style (`/onboarding?style=<slug>`). The home gallery and the styles list link there. All copy lives in `src/lib/styles/styleCatalog.ts`.
- The photographs of the eight styles are replaced by original vector illustrations (`StyleIllustration.tsx`). The Kerala photo was a worn-out house, and a clean, consistent set is lighter on phones and always matches the style. The old style photos are deleted from `public/images/styles`; credits updated.
- Added `app/error.tsx` and `app/not-found.tsx` so a visitor never sees a raw crash screen.
- Colour: the deep maroon plum (`#3B0A26`) is now a soft dusty plum (`#5D4052`); the hot pink blossom, magenta, petal canvas and the blossom branch artwork are muted roses. Tokens live in `tailwind.config.js` and `globals.css`.
- Mobile: smooth-scroll (Lenis) now runs only on mouse devices, so phones scroll natively; the petal canvas draws 7 petals instead of 18 on phones; the blur on the header and endless decorative animations are switched off on touch screens. Page headings and the callout title were overflowing at 320 to 390 px and are fixed.
- Checked at 320, 360, 390, 768, 1024, 1280 and 1920 px across ten pages: no horizontal overflow and no headline wider than the screen. Frame pacing under 4x CPU throttle in headless Chrome was a steady 60 fps on the four main marketing pages. That cannot show GPU cost on a real phone, so a test on a real phone is still worth doing.

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
