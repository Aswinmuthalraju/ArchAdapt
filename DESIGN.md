# ArchAdapt visual identity

## Direction
An editorial, Awwwards-style marketing site: huge condensed serif type, generous negative space, one idea per screen, scroll-choreographed reveals and full-bleed colour blocks. The scroll choreography and pacing take after ERA Residence's design language. We use none of its logo, photography, copy or fonts. Photography is the project's own stock (`public/images/*.jpg`) plus floor plans drawn live by the layout engine. The bougainvillea branches in `public/blossom/` are original vector artwork, generated procedurally.

## Palette (CSS variables on `:root`, mirrored in Tailwind)
- Ivory `#F4F1EA`: page background, never pure white
- Ink `#1B1B1F`: text
- Plum `#3B0A26`: dark sections, the footer and the workspace surfaces
- Sky `#B9D3E6`: "breathing" colour blocks
- Blossom `#E0218A` / soft `#F6B8D6`: decorative pops only. Use `magenta-500` (`#B8126F`) for small text on ivory.
- Gold `#C9A227`, light `#E8CF7A`, deep `#8C6A12`, with metallic gradient `--gold-metal`. Keep gold under 5% of the screen: emblem, hairlines, counters, hover wipes, focus rings, the footer sweep. Use deep gold on light backgrounds and light gold on dark ones.

## Typography (Google Fonts through `next/font`)
- Display: Bodoni Moda, uppercase, line-height ~0.9, `scaleY(1.15)` per line to read tall and condensed (`.display`, `.display--md`, `.display--sm`)
- Script accent: Pinyon Script, laid over one word of the hero and drawn on with a clip wipe
- Labels and UI: Jost, 11px, uppercase, 0.2em tracking (`.label`)
- Body: Jost, 15px, line-height 1.7, narrow columns (`.body`)

## Motion
GSAP + ScrollTrigger, with Lenis smooth scroll on marketing pages only (never in the workspace). Animate transform and opacity. The exceptions are deliberate: the clip-path curtains and the short blur on stretched headings. Shared reveals are driven by data attributes; see `src/components/motion/reveals.ts`. `prefers-reduced-motion` turns off Lenis, scrubbing, the preloader counter, the cursor and the looping animations, leaving simple fades. Below 900px the horizontal gallery becomes a swipe carousel and scrubbed effects play once.

## Marketing page anatomy
Wrap a page in `MotionPage`. It provides the header, footer, cursor, smooth scroll, colour stage and section rail. Tag sections with:
- `data-section="Name"` for the left rail counter
- `data-bg="ivory|sky|plum"` for the crossfading backdrop
- `data-header="ink|ivory"` for header and rail colour over that section
Headings use `<SplitText>` with `data-stretch`. Images use `data-curtain` / `data-curtain-img`. Blossoms go on at most one corner per section and never under the fixed header or nav.

## Plan and model conventions
Preserve canonical 2D/3D geometry and validation. Walls use filled poché; doors show hinge, leaf and swing. Stairs retain foot and intermediate landings. The road remains at the top and the compass follows plot orientation.
