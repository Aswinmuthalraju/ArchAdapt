# Redesign plan: editorial motion pass

A visual and motion overhaul of the ArchAdapt AI marketing site. The planning engine, routes, auth, workspace and all product copy stay as they are.

## Ground rules
- Recreate the *design language* of the reference (scroll choreography, condensed editorial type, pacing, colour blocks). We use none of its logo, photography, copy or fonts.
- The previous homepage used the reference's photographs (`public/images/era/*`) and its commercial fonts (`ambroise-francois-std`, `sloop-script-three`, `maison-neue-*`). This redesign removes every reference to them. Fonts are now Google Fonts, served through `next/font`, and images are the project's own stock photos plus live floor plans drawn by the layout engine.

## Stack additions
- `gsap` + `ScrollTrigger` for all scroll motion (custom character splitter, no SplitText dependency).
- `@gsap/react` (`useGSAP`) for scoped cleanup.
- `lenis` for inertial scrolling, driven by the GSAP ticker. It is only mounted on marketing pages, so the workspace canvas pan/zoom is not affected.
- `prefers-reduced-motion`: no Lenis, no scrub, no preloader counter, simple opacity fades.

## Visual system
- Tokens on `:root` and in Tailwind: ivory `#F4F1EA`, ink `#1B1B1F`, plum `#3B0A26`, sky `#B9D3E6`, blossom `#E0218A`/`#F6B8D6`, gold `#C9A227`/`#E8CF7A`/`#8C6A12`, plus the metallic gradient.
- Type: **Bodoni Moda** (display, uppercase, scaleY 1.15 for a condensed feel), **Pinyon Script** (accent), **Jost** (labels and body).

## Homepage sections (`src/components/marketing/home/*`)
1. Preloader: gold emblem draw, 0→100 counter, curtain wipe. Shown once per session.
2. Hero: full-bleed `garden-house.jpg`, letter-rise title, script word drawn on with a gold underline, edge taglines, scroll zoom and parallax, blossom corner and capped petal canvas.
3. Statement: centred uppercase serif paragraph, words scrubbed from 15% to 100% opacity.
4. Sky colour block: pinned image curtain with the three-step process scrolling past.
5. Horizontal gallery ("Styles 06"): pinned sideways scroll of styles and real engine plans. On mobile it becomes a swipe carousel.
6. Feature list 01–03 (modes) with masked images that expand on hover.
7. Pre-footer numerals and blossom.
8. Plum footer: giant "Start your plan" with letter reveal and gold sweep, fine-print grid, back to top.
- Global: rotating circular badge logo (speeds up with scroll velocity), stacked nav top-right, vertical section counter with a progress line, custom cursor (desktop only), magnetic circular buttons, crossfaded fixed colour stage.

## Shared pieces
- `src/components/motion/*`: `SmoothScroll`, `SplitChars`, `StretchHeading`, `Cursor`, `CircleButton`, `Blossom`, `RotatingBadge`.
- `public/blossom/*.svg`: original procedurally drawn bougainvillea branches with transparent backgrounds (vector, so lighter than PNG and sharp at any DPR).
- How it works, Styles and Modes get the new type, colours, stretched headings and smooth scroll. App pages inherit the new tokens and fonts.

## Files touched
`package.json`, `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.js`, `src/app/page.tsx`, `src/app/{how-it-works,styles,modes}/page.tsx`, `src/components/navigation/Navbar.tsx`, `src/components/brand/Logo.tsx`, new `src/components/motion/*`, `src/components/marketing/home/*`, `public/blossom/*`, `DESIGN.md`. Removed: `ImmersiveHome.tsx` and its CSS.
