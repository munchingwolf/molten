# Design pipeline for the Molten site

For Danny. Evan used this process to get Luminao's site looking good. Here it's cut down to fit today (hacking ends 6:30 PM) and aimed at our site. Luminao took a week; this version is about an hour, done in the gaps between components.

## Why it works

1. **Write the design down before building.** DESIGN.md is the contract. Every Claude session reads it (CLAUDE.md tells it to), so it decides what Claude builds.
2. **Pick from options instead of taking the first try.** Get 3 variants side by side and choose one.
3. **Log every pick** in DESIGN.md's Decisions Log, so the next Claude session doesn't drift back to something you already rejected.

## Setup (once, ~5 min)

- **gstack** (design consultation, variants, design QA). Needs [Bun](https://bun.sh):
  ```sh
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
  ```
  Commands are `/design-review`, `/design-shotgun`, `/design-consultation`. On Evan's machine they're prefixed: `/gstack-design-review` and so on.
- **impeccable** (critique, polish, writes DESIGN.md from shipped code): https://github.com/pbakaus/impeccable, docs at https://impeccable.style/docs/. Run it as `/impeccable <verb> <target>`.

## Where the site stands (Oct 17, 2:10 PM)

- **Step 1 is done.** At 1:40 you rewrote DESIGN.md for night studio, with Familjen Grotesk as the headline font.
- **A second rebrand is in progress** (your 2:12 log: holographic HUD palette + mascot). Update DESIGN.md in the same commit the new look lands: run `/impeccable document` again and add a Decisions Log row. Otherwise every Claude session reads night studio and pulls the site back to it. Then run the step 2 audit on the new look.
- Pages in scope: `/` (home), `/components` (browse), `/components/[name]` (live preview + Copy prompt). The Studio UI is yours now too (SPEC §42); give it its own audit after the site. Leave out `/apps/[id]`.

## The pipeline, today

### 1. Make DESIGN.md match the site (10 min, do it now)

Run `/impeccable document`. It writes DESIGN.md from the shipped code (globals.css, the fonts in layout.tsx, page.tsx). If it asks for a PRODUCT.md, let it run `/impeccable init`. The product facts are in SPEC.md §41.

Carry over from the old DESIGN.md, because these still apply:
- **North star:** the site steps aside so the component previews carry the page.
- **One accent, only where the user acts:** Copy prompt, the active filter, focus rings.
- The empty, loading, "coming soon" and missing-preview states.
- `prefers-reduced-motion`: posters instead of autoplay.

Add a Decisions Log row: `2026-10-17 | Switched to night studio | approved homepage mockup`.

Add the one sentence every design choice gets checked against. A proposal, change it if you like: **"These XR components look incredible, and I can drop one into my project with one paste."** It also lines up with the judging criterion "clear in seconds."

### 2. Audit (15 min)

With `cd web && npm run dev` running:

- `/impeccable critique /` and `/impeccable critique /components/knob`: a ranked problem list, no edits.
- `/design-review http://localhost:3000`: a designer's-eye pass that fixes what it finds and commits each fix. Pull first; the usual push rules apply.

Checks specific to us. Tell the audit about them:

- **Projector and demo video.** The old DESIGN.md went mid-grey because projectors turn near-black into mud. With the dark theme, look at the hero on the real screen or in a test recording. Borders like `#242833` on `#0B0C10` may disappear.
- **The italic serif accent word.** All 5 home headlines use it ("walk around", "Paste it", "three", "Ready", "answered"). Once is a signature; five times reads as a template, which is the "looks AI-made" problem Luminao had to fix. Consider keeping it on the hero only.
- **Previews first.** On a laptop, is a live 3D component visible on the first screen? Are the preview tiles the highest-contrast thing on the page, above the site chrome?
- **Quest browser.** Open the deployed site in the Quest 3S browser: text size, controls that only work on hover (hands have no hover), the View in headset button.

### 3. Variants, only where they matter (20 min, skip if you're behind)

Run `/design-shotgun` on the one screen that appears in the demo video, probably the home hero or a component page. You get 3 variants on a comparison board. Pick one, then log the pick in DESIGN.md.

### 4. Build

- Your components (label, press-button, slider, spring-toggle, glass-card) and the 4:00–4:45 music restyle follow DESIGN.md too. Use the same accent and the same one-action rule in the headset. Keep the props from the SPEC §41 contract.
- Use only the role tokens in globals.css and no new hex values in components, so a restyle stays a values-only change.

### 5. Verify (10 min, before ~5:30)

- Run `/design-review <deployed Vercel URL>` once more.
- Check a 1440 px laptop, a 390 px phone, the Quest browser, and reduced motion on.
- Do one bounded pass: fix everything it finds in one batch, recheck once, stop.

### Ship

Follow CLAUDE.md: add a LOG.md entry, then `git pull --rebase && git push`.

## Cheat sheet

| Step | Command | Time |
|---|---|---|
| Fix the contract | `/impeccable document` | 10 min |
| Find problems | `/impeccable critique <route>` | 5 min |
| Find and fix | `/design-review <url>` | 10 min |
| Choose a direction | `/design-shotgun` | 20 min, optional |
| Final check | `/design-review <deployed url>` | 10 min |

## Skipped from the full version (no time today)

Persona walkthroughs, accessibility and performance audits, `/plan-design-review` before building, and `/ship` + `/canary` after deploys. Worth doing if Molten keeps going after the hackathon.
