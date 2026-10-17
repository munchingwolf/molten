---
# gstack: design-md-format=spec
name: Spatial
description: A photographer's grey-card studio where XR components sit like lit hardware on a demo bench; the site steps aside so the previews carry the page.
colors:
  ground: "#B4B5AF"
  bench: "#A3A49D"
  text: "#0E0F0D"
  text-muted: "#3A3B37"
  tape: "#ECE9DF"
  letterbox: "#1A1B18"
  primary: "#1FB54A"
  on-primary: "#0E0F0D"
  surface: "#ECE9DF"
  accent: "#1FB54A"
typography:
  display:
    fontFamily: Cabinet Grotesk
    fontWeight: 800
    fontSize: clamp(2.6rem, 5.6vw, 4.75rem)
    letterSpacing: -0.035em
  heading:
    fontFamily: Cabinet Grotesk
    fontWeight: 800
    fontSize: 2rem
    letterSpacing: -0.025em
  body:
    fontFamily: Switzer
    fontSize: 1rem
    lineHeight: 1.5
  label:
    fontFamily: Switzer
    fontWeight: 600
    fontSize: 0.875rem
  mono:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontFeature: tnum
rounded:
  none: 0px
  sm: 2px
spacing:
  grid-gap: 2px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 72px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    borderColor: "{colors.text}"
    rounded: "{rounded.none}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.text}"
    borderColor: "{colors.text}"
    rounded: "{rounded.none}"
  chip:
    borderColor: "{colors.text}"
    rounded: "{rounded.none}"
  chip-active:
    backgroundColor: "{colors.primary}"
  input:
    backgroundColor: "{colors.tape}"
    borderColor: "{colors.text}"
    rounded: "{rounded.none}"
  tile:
    backgroundColor: "{colors.letterbox}"
    rounded: "{rounded.none}"
  tape-label:
    backgroundColor: "{colors.tape}"
    textColor: "{colors.text}"
  code-block:
    backgroundColor: "{colors.letterbox}"
    textColor: "{colors.tape}"
---

# Spatial

## Overview

**Creative North Star:** Grey Card Stage. The site is a neutral studio backdrop and every component preview is a lit piece of gear on the bench, because the one thing a visitor should remember is "these components look incredible."
**Product context:** Visual registry of XR/spatial UI components (21st.dev / shadcn for XR) for Unity + Quest developers, with an MCP install path. Peers: 21st.dev, shadcn/ui, Magic UI, Aceternity UI, Meta Horizon OS UI Set.
**Mode per surface:** Home: Persuade (hero) then Operate (search, filter, browse). Component page: Operate (evaluate, copy prompt). Docs/README: Read.
**Reference sites:** https://21st.dev , https://ui.aceternity.com , https://developers.meta.com/horizon/design/components/
**Key characteristics:**
- Mid-grey ground; dark preview tiles are the brightest, most saturated things on screen
- Contact-sheet grid: edge-to-edge tiles, 2px gaps, square corners, no card frames
- Off-white tape-strip label on each tile, the only decorative device
- One accent, chroma-key green, reserved for the install action and the active filter

## Colors

**Strategy:** Restrained. Neutrals carry the page; chroma-key green appears only where the user acts (Copy install prompt, active chip, focus rings).
**Light or dark:** Neither, deliberately mid. The use scene is a projector (lifts blacks to mud, blows out white) plus laptops. A grey-card ground keeps its value in both, and the dark in-headset preview loops stay the highest-contrast objects on screen.
Text is always `text` (9.3:1 on ground) or `text-muted` (5.5:1). Never put muted text on `bench` for body copy. Green carries ink text (7.1:1), never white. `letterbox` is only for media and code. Depth comes from value steps (ground → bench → letterbox), not shadows.

## Typography

Cabinet Grotesk 800 (Fontshare, ITF Free Font License) is the display voice: hero line, section headings, component names on tape strips and the detail page. Tight negative tracking, never above 4.75rem. Switzer (Fontshare) handles body and UI at 400/500/600. JetBrains Mono (Google Fonts, OFL) is only for commands, prompts and code, set at body-ish size, never as tiny tracked labels.
Loading: `https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&f[]=switzer@400,500,600&display=swap` and `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap` (or self-host via next/font/local).
Scale: display clamp(2.6rem, 5.6vw, 4.75rem) / heading 2rem / detail title 2.6rem / tape name 1.15rem / body 1rem / label 0.875rem.

## Layout

Max content width 1320px, page gutters 40px (16px under 640px). Hero and text left-aligned. The preview grid breaks the gutter: it sits on a full-width `bench` strip, 3 columns ≥960px, 2 columns ≥600px, 1 column below, 16:10 tiles, 2px gaps. Roomy page margins against a tight grid is intentional. Detail page: 1.5fr preview / 1fr spec column, stacking under 900px.

## Elevation & Depth

No drop shadows and no glows. Depth is value: ground, recessed bench, dark letterbox. The tape strip sits at a -0.6deg rotation to read as a physical label; that is the only "lift."

## Shapes

Square corners everywhere (0px). 2px radius allowed only for keyboard hint `kbd` if needed. Borders are 1.5-2px solid ink on interactive controls.

## Components

- **Tile:** letterbox background, `<video muted loop playsinline preload="metadata">` with poster image; plays on hover/focus, pauses on leave. Tape label bottom-left: name in Cabinet Grotesk 800, meta line (platform · device · inputs) in Switzer 500 muted. Hover: tape straightens and lifts 2px. Focus-visible: 3px green outline, 2px offset. Missing preview: letterbox with mono "preview pending" text, never a gray placeholder pretending to be content.
- **Chip:** 1.5px ink border, transparent. Hover: tape fill. Active (`aria-pressed=true`): green fill. Disabled: 45% opacity, not-allowed cursor.
- **Search:** tape fill, 2px ink border, `/` keyboard hint. Focus: green outline on the wrapper.
- **Primary button (Copy install prompt):** green fill, ink text, 2px ink border, full width in the spec column. On click: ink wipes left-to-right over 200ms and the label becomes "Copied. Paste into Claude Code" in green, reverting after ~2s.
- **Secondary button:** transparent with ink border; hover tape fill.
- **Code block:** letterbox background, tape text, green `$` prompt, horizontal scroll, never wraps.
- **Patch bay (compatibility):** table, rows = input types (Hands, Controller, Ray, Poke), columns = Unity, OpenXR, Quest 3, Quest 3S. Cells are 12px square jacks: filled ink = supported, hollow = not supported. Always show the legend under it.
- **Empty state:** dashed muted border, plain sentence naming the query, a suggestion to try a category or ask Claude via the MCP.

## Do's and Don'ts

- Do keep green only on the install action, active filter and focus rings.
- Do let previews run edge to edge in the grid; the tape strip is the only thing on top of them.
- Do left-align hero and section text.
- Do design the empty, loading (poster frame) and missing-preview states.
- Don't add rounded cards, drop shadows, glows, gradients or frosted panels to site chrome. Glass belongs to the components, not the site.
- Don't go dark mode "because it's a dev tool"; the grey ground is the decision.
- Don't put white text on green or muted text on bench.
- Don't add feature grids, testimonial rows, logo strips or stat counters to the home page.

## Motion

- **Approach:** minimal-functional
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)
- **The one authored moment:** the Copy install prompt ink wipe (200ms ease-out). Video play-on-hover is the only other motion; respect `prefers-reduced-motion` by showing posters and disabling autoplay.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-17 | Initial design system created | Created by /design-consultation from SPEC.md, web research (21st.dev, shadcn ecosystem, Meta UI Set) and an independent Claude subagent proposal that converged on the same grey-studio + chroma-green direction |
| 2026-10-17 | Ground lightened from #9C9D97 to #B4B5AF | Muted text on #9C9D97 only reached 3.2:1; #B4B5AF gives 9.3:1 ink and 5.5:1 muted |
