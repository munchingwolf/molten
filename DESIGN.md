---
# gstack: design-md-format=spec
name: Spatial
description: Night studio. Dark graphite ground where live 3D component previews are the brightest, most vivid things on the page; the site steps aside.
colors:
  bg: "#0B0C10"
  bg-2: "#101218"
  surface: "#15171E"
  border: "#242833"
  border-2: "#323745"
  text: "#EEF0F4"
  text-muted: "#9AA0AD"
  text-faint: "#6B7180"
  accent: "#9FE7D2"
  on-accent: "#06221B"
  stage: "#0D0F14"
  warm: "#F2B48A"
typography:
  display:
    fontFamily: Familjen Grotesk
    fontWeight: 700
    fontSize: clamp(2.6rem, 5.4vw, 4.6rem)
    letterSpacing: -0.04em
  heading:
    fontFamily: Familjen Grotesk
    fontWeight: 700
    fontSize: clamp(2rem, 3.6vw, 3rem)
    letterSpacing: -0.035em
  accent-word:
    fontFamily: Instrument Serif
    fontStyle: italic
    fontWeight: 400
  body:
    fontFamily: Hanken Grotesk
    fontSize: 1rem
    lineHeight: 1.55
  mono:
    fontFamily: JetBrains Mono
    fontSize: 0.8rem
rounded:
  sm: 6px
  md: 9px
  lg: 14px
  xl: 18px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  section: 104px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
  card-stage:
    backgroundColor: "{colors.stage}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
  code-block:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text-muted}"
---

# Spatial

## Overview

**Creative North Star:** Night studio. The page is a dark room and every component preview is a lit object in it, so the one thing a visitor remembers is the sentence below.
**The check every design choice must pass:** "These XR components look incredible, and I can drop one into my project with one paste." (It also serves the judging criterion "clear in seconds".)
**Product context:** Marketplace for XR/spatial UI components (21st.dev for WebXR + React Three Fiber), plus the Spatial Studio and an MCP server. Peers: 21st.dev, Aceternity UI, Magic UI, Spline Community.
**Mode per surface:** Home: Persuade, then Operate (browse). Browse: Operate. Component page: Operate (evaluate, copy). Studio / apps: Evan's tool screens, out of scope here.
**Reference sites:** https://21st.dev, https://ui.aceternity.com, https://community.spline.design, https://magicui.design
**Key characteristics:**
- Live 3D previews on dark stages; they are the highest-contrast thing on screen.
- A faint perspective floor grid behind the hero and the CTA band: the site already feels like a headset.
- One accent, mint, only where the user acts.
- 21st.dev structure: hero, preview strips with tabs, agent cards, FAQ, footer.

## Colors

**Strategy:** Restrained. Graphite neutrals carry the page; mint `accent` appears only on the primary action (Copy prompt, Browse components, Open Studio), the active filter or style, focus rings, and the hero accent word.
**Light or dark:** Dark, single theme. The use scene is laptops, a demo video and the Quest browser, where previews read best as lit objects on a dark ground. Projectors lift near-black: keep borders at `border-2` where an edge must survive a projector or recording.
All colors live as role tokens in `web/app/globals.css` (`bg`, `surface`, `border`, `text`, `muted`, `faint`, `accent`...). Components never use raw hex; a restyle is a values-only change there. In-headset UI uses the same values via `web/components/studio/xr-theme.ts`.

## Typography

Familjen Grotesk 700 (Google Fonts) is the display voice: hero, section headings, component names. Hanken Grotesk 400/500/600 for body and UI. Instrument Serif italic for **one accent word, in the hero only**. JetBrains Mono for code, prompts, install lines and small technical labels (LIVE 3D, XR). All loaded with `next/font/google` in `web/app/layout.tsx`.

## Layout

Max width 1240px, 20px gutters. Strips: section count + tabs + "View all" on one line, then a card grid (3-up for sections, 4-up for components; 2-up under 1000px, 1-up on phones). Sections are separated by ~104px of space, not by rules.

## Elevation & Depth

Depth comes from the 3D content itself (perspective, floating panels) and from value steps (bg → bg-2 → surface → stage). Flat chrome: no drop shadows on site UI, no glow halos.

## Shapes

Radii: 6 (chips, tags), 9 (buttons, inputs), 14 (preview stages), 18 (big tiles). Nothing pill-shaped except status dots.

## Components

- **Preview card:** stage (`stage-bg`, 4:3), `LIVE 3D` mono tag when ready, name + price/XR badge, one muted description line. Hover: border lifts to `border-2`. "Coming soon" cards render at 70% opacity with a mono placeholder and are not links.
- **Primary button:** mint fill, `on-accent` text. Secondary: surface fill, `border-2` edge.
- **Code / prompt blocks:** `bg` fill, mono, horizontal scroll, never wrap.
- **Component page:** title, description, tags, actions (Copy prompt primary), style switcher (active = accent), framed live preview with Preview/Code tabs and **View in headset** (only where WebXR VR is supported).
- **States:** empty search names the query; coming soon; missing preview shows a mono placeholder; reduced motion shows still 3D (no drift).

## Do's and Don'ts

- Do keep previews the brightest, most saturated thing on screen.
- Do use mint only where the user acts.
- Do use role tokens only; no new hex in components.
- Do design empty, loading, coming-soon and reduced-motion states.
- Don't repeat the serif accent word outside the hero (once is a signature, five times is a template).
- Don't add glows, gradient text, avatar walls, fake stats or logo strips.
- Don't rely on hover alone: Quest hands have no hover, so every hover affordance needs a visible default.

## Motion

- **Approach:** intentional. One orchestrated page-load moment (hero text staggers in), then quiet.
- **3D:** hero panels drift slowly (`useFrame`), honoring `prefers-reduced-motion`.
- **Easing:** enter ease-out, exit ease-in. Durations 150–400ms.
- **The one authored moment:** the hero load: headline, then the three live panels settle into place.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-17 | Initial "Grey Card Stage" system | /design-consultation (superseded below) |
| 2026-10-17 | Switched to night studio | Approved homepage mockup; replicates 21st.dev's structure with a dark, 3D-first look |
| 2026-10-17 | Display font Familjen Grotesk | Picked from a 4-way comparison (Bricolage, Schibsted, Familjen, Onest) |
| 2026-10-17 | Serif accent word on the hero only | Evan's DESIGN-PIPELINE.md: repeating it reads as templated |
