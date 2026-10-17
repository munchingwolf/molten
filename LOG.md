# Team Log

Shared status log so both teammates (and their Claude sessions) know what's going on.

## Rules (both of us + our Claudes)

- **Read this file before starting work.** `git pull` first.
- **Add an entry after anything the other person should know:** a decision, a finished task, a blocker, a change to a shared format.
- Newest entries go **at the top** of the Log section. Format:
  `### HH:MM: <name>: <one-line summary>` then a few bullets max.
- Commit and push right after adding an entry (`git pull --rebase && git commit -am "log: ..." && git push`).
- Changing something the other person depends on (registry format, file layout, URLs)? Log it **before** pushing the change.

## Log

### 1:15: Person 1: voice CUT for now
- Components are all **premade**. Studio = grab/place + tap chips to restyle (Default/Glass/Horizon), resize, delete, Save. Hands only.
- Voice may come back at the end if there's time (2+ body inputs = judging bonus).

### 1:05: Person 1: PLAN UPDATED: SPEC.md §41 (read it)
- Product = XR component library with 3 ways in: **Website**, **MCP** (any MCP tool can pull/edit components), **Studio** (build in headset with hands + voice; Claude turns the layout into code).
- **Person 2:** scaffold first (2.1), then **finished sections** (settings, media player, dock, wrist menu, toast, profile, dialog, dashboard) × Default/Glass/Horizon styles, then the site.
- Person 1: Studio, voice, layout save API, MCP.
- New shared format: `registry/index.json` fields + Layout shape (see §41). Components = default-export .tsx in `components/spatial/`.

### 12:27: Person 2: 2.1 done: Next.js app scaffolded in `/web`
- **The app lives in `web/`**, so contract paths are `web/lib/settings.ts`, `web/lib/registry.ts`, `web/components/spatial/`. `cd web && npm i && npm run dev`.
- Next 15 (App Router, TS, Tailwind v4, Turbopack). Installed: three, @react-three/fiber, xr, handle, uikit (+ default, apfel, horizon, lucide), zustand. Tone.js left out (audio deferred per your 12:55 note).
- DESIGN.md tokens are wired into Tailwind: `bg-ground`, `bg-bench`, `text-ink`, `text-ink-2`, `bg-tape`, `bg-letterbox`, `bg-key`, `font-display`, `font-mono`. Square corners by default.
- `npm run build` passes. Next for me: 2.2 skins (Default / Glass=apfel / Horizon), then 2.3 home.

### 12:55: Person 1: FOCUS CHANGE: general design components first, music later
- **No audio engine / music app for now.** Product focus = a 21st.dev-style library of general XR UI components.
- Music/DAW components (incl. a **Kaedim-generated 3D drum pad**, since Kaedim is a sponsor and a judge) = **later phase**.
- Ready-made building blocks (all MIT): `uikit-default` has 25 shadcn primitives (accordion, alert, dialog, avatar, badge, button, card, checkbox, input, menubar, pagination, progress, radio, slider, switch, tabs, textarea, toggle, tooltip, video…). `uikit-apfel` has a Vision Pro look. `uikit-horizon` has a Meta Quest look.
- Pending (Person 1 deciding): pitch = "build your XR interface in the air with hands + voice, Claude ships it as code"; headset Studio + MCP `get_layout`.

### 12:35: Person 1: SHORTCUTS FOUND: don't hand-build the skins
- **pmndrs/uikit ships 3 ready-made kits (all MIT, verified):** `@react-three/uikit-default` (shadcn look), `@react-three/uikit-apfel` (Vision Pro glass look), `@react-three/uikit-horizon` (Meta Quest / Reality Labs look). Each has panel, slider, toggle, button, etc. **Settings skins = Default / Glass (apfel) / Horizon**, each ~30 min to assemble. A custom "Cyber" skin is optional, 4th.
- Icons: `@react-three/uikit-lucide`. Hand-grab/drag in VR: `@react-three/handle` (same team as @react-three/xr).
- **Voice: ElevenLabs** (sponsor, free credits + "Best Use of ElevenLabs" prize). `@elevenlabs/react` has `useScribe` (realtime speech-to-text in the browser). Needs a tiny Next.js API route to mint a token. Avoids the "does Web Speech work in Quest browser?" risk.
- Audio: Tone.js synth drums (no samples needed).
- Website: use shadcn/ui + Tailwind (and v0 / 21st.dev if you want) for the 2D site.

### 12:20: Person 1: PIVOT CONFIRMED → WebXR. New task split in SPEC.md §41
- Unity is out. One Next.js app = catalog site + VR experience (R3F + @react-three/xr + uikit).
- **Person 2: start with 2.1 (Next.js + Tailwind scaffold), push ASAP.** Then the 3 settings skins (2.2), which are the demo's centerpiece.
- Person 1: settings store, registry, audio, /xr scene, voice swap.
- Lock the shared contract (SPEC §41) together before splitting off.

### 12:15: Person 2: design system done → DESIGN.md
- Website look is "Grey Card Stage": mid-grey studio ground (#B4B5AF), edge-to-edge preview tiles, tape-strip labels, chroma-key green (#1FB54A) only on install/active. Fonts: Cabinet Grotesk, Switzer, JetBrains Mono.
- CLAUDE.md now also points at DESIGN.md for any UI work. That includes in-headset uikit panels if we pivot.
- Thanks for W0. Reading the pivot proposal now; /web is on hold until we decide Unity vs WebXR.

### 12:15: Person 1: license check done → SOURCES.md
- Person 2's task W0 is done, so skip it. See SOURCES.md.
- pmndrs/uikit is MIT, so it's OK to copy into our registry (supports the WebXR pivot).
- Don't copy Meta UI Set or Unity XRI samples. Music controls: we build our own.

### 12:10: Person 1: event facts + proposed pivot (needs Person 2 sign-off)
- MOLTEN is **today**. Hacking ends **6:30 PM** (submit form + demo video, no slides or the video is disqualified). Hardware must be committed by **1:00 PM**.
- Venue has **one** Quest 3S for ~90 people (open slots ~3:00–4:30 PM). We need a headset or the project fails "works in space".
- Judging (equal weight): works live in headset · 2+ body inputs (hands, voice…) · new way to create · worth using again · clear in seconds. Business/market NOT scored. Full brief: https://moltenhack.com/agents.md
- **Proposed pivot (not final):** drop Unity → **WebXR** (Next.js + React Three Fiber + @react-three/xr + pmndrs/uikit). Same app is the laptop catalog site and the in-headset experience. Demo: grab a component from a floating catalog in VR (hands), say "make it cyber" to swap live (voice). Navigate track. MCP becomes stretch.
- SPEC.md §41 task split is **outdated** until we confirm the pivot.
