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

### 2:20: Evan: **GLB import → editable object**, Lock works, environment picker, sound after Launch, Pix mascot, 115 components
- **Import 3D** (Studio top bar) or **drop a .glb/.gltf anywhere** on the Studio → `POST /api/assets` (stored in repo-root `.data/assets/`, shortcut: laptop disk, not Vercel) → placed as component **`gltf-model`** (centred, auto-sized, tagged `surface` so components snap onto it). Tested with a 2.9 MB glb.
- **Lock is enforced**: locked items keep click-select but lose the gizmo + grab, so an imported app stays put while you build on it.
- **Environment picker** in the laptop top bar ("No landscape" = dark studio on laptop / your real room in AR).
- **Quest opens what you built on the laptop:** `/studio?layout=latest` (or an id). Save on the laptop first.
- **Sound after Launch:** `lib/unlock-audio.ts` runs `Tone.start()` inside the Enter AR/VR click and on the first tap in `/apps/<id>`, so piano keys, drum pads etc. play on the laptop and in the headset.
- **Pix** (voxel mascot) shows in the laptop assistant panel; 3D Pix (`components/spatial/mascot.tsx`) is ready to mount on `VRAssistant mascot={…}`.
- Library: app kit (22) + game kit (19) + mascot merged → **115 ready**. Motion + room/hardware agents still running.

### 2:16: Evan: **DANNY: START HERE → `VR-UX-SPEC.md`** (complete VR UI/UX build spec, 16 sections, acceptance checks per section)
- Build order is §14 (demo-critical first, time-boxed to 5:15 PM). Architecture/status table is §13. Top decisions: `vr-workspace.tsx` is the one dock (`vr-dock.tsx` = parts only, its PropControl already extracted to `prop-controls.tsx`); dock + assistant share one lazy-follow anchor; Edit keeps components live (grab pointer only moves), Play = `editable={false}`; VR Launch = Save + Play in place; push-to-talk goes through `useAssistant`.
- The banner at the top lists what landed after it was written. Code wins over the doc; log conflicts here.

### 2:15: Evan: **Blender-style live editing in VR**: properties + tilt in Danny's in-headset inspector
- Goal (Evan): "make the components work and look good… Blender, but editing live in VR": select → gizmo transform → tweak properties live.
- `web/components/studio/prop-controls.tsx` (new): `<PropControls item={item} />` renders live controls from the component's registry `props` (colour swatches, enum chips, number steppers, on/off). Calls `update(id, { props })`; `bindingProps` passes them to the component.
- **Danny, heads-up: I edited `vr-workspace.tsx`** (2 small additions in `Inspector()`): a **Tilt** row (rotation X, ±15°) and `<PropControls item={item} />` under Anchor. Restyle freely.
- Mounted: assistant panel (laptop, right of canvas) + VR assistant, `<VoiceButton />` in the top bar (voice now logs in the assistant), `useGestureKeys()`.
- ⚠️ Danny: your VR inspector (RIGHT_POS) and the VR assistant are both on the right. The spec will settle positions; for now the assistant can move.

### 2:09: Evan: DESIGN-PIPELINE.md status updated. **Danny: re-run `/impeccable document` when the HUD rebrand lands**
- Step 1 (DESIGN.md for night studio) is marked done, thanks. Ship the HUD rebrand and the DESIGN.md update in the same commit, or Claude sessions will pull the site back to night studio. Audit (step 2) after that, on the new look.

### 2:12: Danny: **VR UI overlap, let's pick one.** My `vr-workspace.tsx` is mounted (scene.tsx) and live
- Mine: fixed cockpit. Toolbar ahead (undo/redo/duplicate/frame/delete/grid/snap/X-ray), inspector + layers on the right (nudge XYZ 5 cm, scale, turn 15°, anchor world/head/wrist, hide/lock, tap multi-select), shelf on the left.
- Your agent's `vr-dock.tsx` (tabbed, follows the head, prop swatches) isn't mounted yet. It's good; the follow + prop editing is better than my fixed panels. Proposal: when your VR-UX-SPEC lands, I merge the best of both into ONE dock (your follow logic + tabs, my toolbar row + nudges) and delete the other. Don't mount both or the headset gets two inspectors.
- Rebrand in progress for the site (holographic HUD palette + mascot); 5 components being built now, will go through `registry/incoming/*.json` + `merge-registry.mjs` as you said.

### 2:04: Evan: **integration landed** (environments, gestures, frames, X-ray, generated registry). Danny: full VR UI/UX spec coming next as `VR-UX-SPEC.md`
- **Component map is now GENERATED**: `node web/scripts/merge-registry.mjs` merges `web/registry/incoming/*.json` into `index.json` and writes `web/lib/components.generated.ts` (lazy imports). Don't hand-edit the map in `lib/registry.ts`; run the script after adding a component. Entry type now has `props` (PropSpec: color/string/number/boolean/enum) and kinds object/environment/layout.
- 5 environments (`env-studio-loft`, `env-space`, `env-forest`, `env-concert-stage`, `env-gallery`): `useStudio().setEnvironment(name)`; hidden in AR passthrough.
- Gestures (`layout-renderer.tsx`, `GESTURES.md`): grab bar/grab-anywhere move, 2nd hand = scale + yaw, PivotHandles gizmo on the selected item (move/pitch/yaw/roll/scale), snap 2.5 cm / 15° / 0.05 (Shift bypass), drop onto desks/stages seats exactly (`lib/snap.ts`). Hook `useGestureKeys()` (`components/studio/use-gesture-keys.ts`) still needs mounting in studio-app.
- Frames render their children with auto-layout; hidden items are skipped; **X-ray mode** (`viewMode: "xray"`): outlines, labels, frame bounds, value cables, translucent components (`components/studio/xray.tsx`).
- npm i was needed after the `motion` dep landed. 53 lib tests pass.

### 1:56: Evan: **store v2 landed. Danny, these are the actions to wire your Studio UI to** (`web/lib/studio-store.ts`, `useStudio`)
- State: `items` (active scene), `environment`, `scenes[]`, `sceneId`, `selectedId` (primary) + `selectedIds` (multi), `values`, `viewMode: "design"|"xray"`, `showGrid`, `snap`, `past`/`future`.
- Existing (unchanged): `add(component, position?, patch?)`, `update(id, patch)`, `remove(id)`, `select(id|null, additive?)` (additive = shift-click toggle), `bind(id, prop, name)`, `setValue`, `setName`, `load(layout)`, `layout()`.
- New: `undo()`, `redo()`, `duplicate(ids?)`, `copy(ids?)`, `paste()`, `removeSelected()`, `groupIntoFrame(ids?, frameProps?) → frameId`, `ungroup(frameId)`, `setParent(id, parentId|null)`, `reorder(id, index)` (layers drag), `setEnvironment(name|null)`, `addScene(name?)`, `switchScene(id)`, `renameScene(id, name)`, `removeScene(id)`, `setViewMode(mode)`, `toggleGrid()`, `toggleSnap()`. ids default to the current selection.
- Format (`lib/layout.ts`): Item gains `parentId`, `name`, `hidden`, `locked`, `anchor: "world"|"head"|"wrist"`; Layout gains `environment` and `scenes[]` (multi-scene apps: "the site is the environment"). `items`/`environment` mirror scene 1 so old readers still work.
- New component **`frame`** (`components/spatial/frame.tsx`): auto-layout container (row/column/grid/**arc** wall), copy-pasteable. Renderer nesting + X-ray mode + environment rendering land next (after the gestures agent finishes `layout-renderer.tsx`).
- Tests: 28 pass (`node --test web/lib/*.test.ts`). Working on it: 13 agents building ~150 components (buttons, containers, data/media, 3D objects, music, environments, motion design, room + hardware, app kit, game kit) + gestures + voice.

### 2:00: Danny: in-headset look started: `xr-theme.ts` + VR shelf restyled (styling only)
- New `web/components/studio/xr-theme.ts`: night-studio colors/radii/hit size for uikit. **Evan / your agents: use `xr.*` instead of hex for any new in-headset UI** (toolbar, Edit/Play, Save/Launch) and I'll polish after.
- `vr-shelf.tsx`: only styling props changed (panel, rows, + affordance). `addInFront`, `groups` and positions untouched. If your agents edit the shelf, keep the `xr.*` colors.
- Also shipped: landing motion (`motion` package), component page (real MCP install, Copy for Claude Code, author/license/price, props table from `bindable`), price badges, 12-canvas cap on browse.
- Read your §42 split: I own the Studio UI now. Starting on it next.

### 1:48: Evan: **STUDIO v2 PLAN + NEW SPLIT → SPEC.md §42. Danny, read this.**
- **Danny = user interface of the Studio**: how it looks and how people drag/drop/select/arrange (library, inspector, layers panel, toolbar, code panel, drag ghost + drop indicator + snapping guides + selection outlines, grab bars, VR shelf visuals). Plus your 5 components + the marketplace site. You own `web/app/studio/*.tsx` UI.
- **Evan (+ agents) = backend/logic**: store (undo, multi-select, frames, environment), layout format, codegen, auto-layout, drop/placement logic, gestures, voice (ElevenLabs + local Ollama), MCP, deploy, and ~40 new components + 5 environments built by agents.
- Contract: build UI on `useStudio` actions; Evan logs each new action's signature here before you need it. Don't change store/format semantics; ask in the log.
- Starting now: 8 agents (buttons/inputs, containers/nav, data/media, **3D objects with functions**, music/DAW, environments, two-hand gestures, voice).

### 1:42: Person 1: **Quest testing via cloudflared tunnel** + Studio editor ownership
- Quest opens the laptop dev server over HTTPS: `cloudflared tunnel --url http://localhost:3000` → `https://<random>.trycloudflare.com/studio`. `next.config.ts` now allows `*.trycloudflare.com` dev origins. (Font error after pulling the new Google fonts: `rm -rf web/.next` + restart dev fixes it.)
- Gotcha found on the Quest: Launch with an empty scene showed an empty world. Launch is now disabled until the scene has a component; empty apps show a message. Enter AR/VR **from the Studio** to build in the headset (shelf on your left).
- **Studio editor is owned by session ek-c8** (Evan's call): `web/app/studio/**`, `web/components/studio/**`, `web/lib/{studio-store,layout,codegen,auto-layout}.ts`. Building Figma-style v2: drag and drop, frames/auto-layout (row/column/grid/arc), layers, undo, templates, spatial placements, export formats. Added `web/lib/auto-layout.ts` (engine, not wired yet).
- ⚠️ Uncommitted edits of unknown origin sit in the working tree (`lib/layout.ts` (type error line 60), `lib/codegen.ts`, `lib/wiring.ts`, `transport.tsx`, drum-pad/piano-keys/step-sequencer/tempo-display/vu-meter). Not committed by me. Whoever owns them: commit or tell Evan.
### 1:40: Danny: DESIGN.md rewritten for night studio + font is Familjen Grotesk
- DESIGN.md now matches the live site (dark tokens, Familjen Grotesk / Hanken / Instrument Serif / JetBrains Mono, mint only where the user acts). Old Grey Card Stage is marked superseded in the Decisions Log. Thanks for DESIGN-PIPELINE.md.
- Headline font switched to **Familjen Grotesk** (`--font-display`).

### 1:29: Person 1 (Evan): **Danny: design pipeline → DESIGN-PIPELINE.md**
- The process that got Luminao's site looking good, cut down for today: fix DESIGN.md → audit → variants (optional) → build → verify. About an hour total, in your gaps.
- ⚠️ **DESIGN.md still describes the old Grey Card Stage look, not night studio.** Claude sessions that read it will fight the new look. Step 1 (`/impeccable document`, 10 min) fixes that.

### 1:24: Person 1 (Evan): registry backfilled + 4 agents building. **Danny: skip glow-button, glass-button, tabs, window, fader**
- `registry/index.json`: every entry now has `author`, `license`, `price`, `deps` (Entry type in `lib/registry.ts` too, plus `bindable?`). Added entries (status "soon" until built): label, drum-pad, step-sequencer, tempo-display, vu-meter, piano-keys, fader; transport is "ready". **`segmented-tabs` renamed to `tabs`.** `tier` now matches COMPONENTS.md Tier 1 (17).
- New optional bindable field **`range: true`**: the Studio inspector shows min/max for it (knob has it). `knob.tsx` takes `min`/`max`; `value` is in min..max units (default 0–1).
- Evan's agents (no need to coordinate, they only touch their own files): music sound (drum-pad, step-sequencer, tempo-display, vu-meter, piano-keys, transport fix); in-headset building (Edit/Play mode, item toolbar with Duplicate/Delete, **patch-cable wiring**, Save/Launch on the VR shelf); **glow-button, glass-button, tabs, window, fader** (so Danny keeps label, press-button, slider, spring-toggle, glass-card + the site); MCP end-to-end test with headless Claude Code.

### 1:16: Person 1 (Evan): **NEW SPLIT, Danny read this.** Evan = backend, Danny = frontend (SPEC §41 "Split update")
- **Evan now owns:** Vercel + Upstash deploy (was 2.6), registry data backfill (author/license/price/deps + entries for all Tier 1, so **don't do the backfill, Danny**), the sound side of the music components, Studio fixes (knob min/max for a 60–180 BPM tempo, `/studio?add=`).
- **Danny:** general components (label, press-button, slider, spring-toggle, glass-card first), restyle the music components 4:00–4:45 (keep props), site fixes (`npx spatial add` doesn't exist, show the MCP line; author/price badges; props table from `bindable`; preview canvas cap ~16). Run `npm i @react-three/drei` first and push.
- Cut to Tier 2: xy-pad, mixer-strip, waveform, wrist-menu. Kaedim: Evan is checking API access.
- Shared files: `registry/index.json` + `lib/registry.ts`. Pull right before editing, add only your own lines, push right after. Evan is editing both in the next ~20 min.

### 1:08: Person 2: site restyled to the approved "night studio" design + View in headset
- Dark theme, 21st.dev structure: live 3D hero (the 3 settings styles floating), Sections/Components strips, agent cards, "three looks", FAQ, footer. Colors are role tokens in `web/app/globals.css`.
- Fonts now via `next/font/google` (Bricolage Grotesque, Hanken Grotesk, Instrument Serif, JetBrains Mono); Fontshare link removed.
- Component pages use `XRPreview` (`components/site/preview.tsx`): normal live preview on desktop; in the Quest browser a **View in headset** button enters VR with the component at 1.2 m up / 0.6 m away. It uses its own `createXRStore`, separate from the Studio's store. Say if you'd rather it reuse yours.

### 1:04: Person 1: **Studio, Save/Launch and XR layer are live** (`/studio`, `/apps/[id]`)
- `/studio`: library (search, ready vs soon), 3D scene, **grab bar under each component** (mouse drag on laptop, pinch-grab in headset), inspector (position/turn/scale + **Controls**: name a value, components sharing a name stay in sync), live code panel (Copy/Download), Save, **Launch** → opens `/apps/<id>`. Enter AR/VR + a VR shelf to add components in the headset.
- Tested in a browser: add 3 components, drag one, bind knob `value` → "master brightness" (code panel emits `const [masterBrightness, setMasterBrightness] = useState(0.5)`), Save, open `/apps/<id>`: same scene, 0 console errors. Not yet tested on a real Quest.
- API: `POST /api/layout` → `{id}`, `GET /api/layout/<id|latest>`. Storage = Upstash Redis if `UPSTASH_REDIS_REST_URL`/`KV_REST_API_URL` env set, else in-memory (resets on restart). **Person 2 / Vercel owner: add Upstash for Redis in Vercel → Storage, it's free.**
- **Person 2, read `web/components/studio/XR-INTERACTION.md`** (gestures + interaction contract). Note: hand grab = **pinch**, not fist.
- Added contract reference components `knob.tsx` (registry entry set ready + `bindable`) and `transport.tsx` (in the `components` map, **no registry entry yet**). Both are music, so it's fine to restyle or replace them.
- Studio covers the site header (it's a full-screen tool).

### 1:03: Person 1: MCP server done (`mcp/`)
- Install: `claude mcp add spatial -- node /path/to/molten/mcp/server.mjs` (add `-e SPATIAL_URL=https://<deployed-url>` to read saved layouts from the deployed site). See `mcp/README.md` (Cursor JSON too).
- Tools: `search_components`, `get_component` (entry + source + npm deps), `add_component` (copies into `<project>/components/spatial/`), `get_layout`, `list_categories`. Re-reads `web/registry/index.json` on every call, so new components show up live.
- Tests: `cd mcp && npm test` (6 pass). Studio, API and XR layer land next.

### 1:00: Person 1: interaction split + core done
- **New split (user's call):** Person 1 owns **XR interaction** (hand tracking, poke, pinch, grab, ray, hover cursor, controllers, laptop mouse). Person 2 owns **look and feel** (animation, effects, formatting). See SPEC §41 "XR interaction layer" + **interaction contract for components** (use R3F pointer events only; buttons on `onClick`; press effects on `onPointerDown/Up`; hover on `onPointerOver/Out`; no `stopPropagation`).
- Done: `web/lib/layout.ts`, `web/lib/codegen.ts` + tests (7/7 pass, `node --test web/lib/codegen.test.ts`). tsconfig now has `allowImportingTsExtensions`.

### 12:55: Person 1: starting the Studio. **Person 2: 3 asks** (contract details)
- **Order changed (user's call): general UI components first, then music.** The product is for every XR developer; the DAW is only the demo. COMPONENTS.md + SPEC §41 updated.
- **Components must be controlled:** take `value` + `onChange(v)` (not only `defaultValue`), `onPress()` for buttons. Map uikit's `Slider value/onValueChange` and `Switch checked/onCheckedChange` onto `value`/`onChange`. Example: `settings-glass.tsx` Slider uses `defaultValue` today, so the Studio can't wire it yet.
- **Add `bindable` to `Entry` in lib/registry.ts + index.json:** `bindable: [{ prop: "value", event: "onChange", type: "number"|"boolean"|"string", min?, max?, default }]`. `event` is optional (input-only props like a display). The Studio's inspector reads this to offer "controls: <name>".
- Person 1 is adding: `/studio`, `/apps/[id]`, `/api/layout`, `lib/studio-store.ts`, `lib/layout.ts`, `lib/codegen.ts`, `components/studio/*`, `mcp/` (repo root). Two reference stubs following the contract: `components/spatial/knob.tsx`, `transport.tsx` (replace freely).
- Hosting: layouts will live in **Upstash Redis** (Vercel → Storage → Upstash for Redis, free). Whoever owns the Vercel project, please add it and tell me. Quest dev uses a cloudflared tunnel.

### 12:50: Person 2: SPEC §41 formats: added optional site fields + `web/` root
- §41 now notes that paths are relative to `web/`, plus my optional registry fields (`kind`, `style`, `aliases`, `xrOnly`).
- Next: backfill `author/license/price/deps/bindable` on registry entries, then music components (re-adding `tone`).

### 12:46: Person 2: SCAFFOLD IS ALREADY PUSHED, `git pull`. It's in `web/` (commit 406e421 + this one)
- `cd web && npm i && npm run dev`. Site, registry and 3 settings components are in. See my 12:44 entry below.
- My settings components already fit your new contract (self-contained, imports only react + uikit). I'll add `value`/`onChange` props next and move to the music components per your re-prioritised list.

### 12:45 (real time; earlier entries' times were wrong): Person 1: PLAN LOCKED → SPEC.md §41
- **Product = Spatial Studio**: drag premade 3D components into a scene (laptop or VR), wire them ("controls: tempo"), live code panel, **Launch** a real app. Demo: build a **music DAW** in 3 min, play it in the Quest.
- Website = **marketplace** (browse, copy code, Copy for Claude Code; author/license/price shown; upload/sell later).
- **Component contract (Person 2, read this):** one self-contained .tsx, default export, all props optional, `value`/`onChange`/`onPress` props, imports only react/three/r3f/drei/uikit/xr/tone. No imports from our code (must be copy-pasteable).
- **COMPONENTS.md re-prioritised:** Tier 1 = music components first, then general. Request Kaedim drum pad early.
- Person 2: please push the Next.js scaffold ASAP. Person 1 is blocked on it.

### 12:44 (my clock): Person 2: site v1 up + registry created (READ: shared format)
- **I created `web/registry/index.json`** (62 entries, generated from COMPONENTS.md) and `web/lib/registry.ts`, since 1.1 wasn't pushed yet. They're yours to edit; I just needed data. **Added fields:** `status: "ready"|"soon"`, `tier`, `xrOnly` (the ⭐). Unbuilt = `"soon"` → greyed "Coming soon" card.
- To ship a component: write `web/components/spatial/<name>.tsx`, add one line to the `components` map in `lib/registry.ts`, flip its `status` to `"ready"`. It then gets a live 3D preview + a detail page automatically.
- Built: 3 sections `settings-default / -glass / -horizon` (one category, three styles, so the style switcher works). Components use `pixelSize={0.002}` (360px ≈ 0.72 m).
- ⚠️ **`uikit-apfel` is pinned to uikit 0.8** and can't share a scene with the 1.0 kits. Build "Glass" from uikit 1.0 core (`Container` + `withOpacity`) instead; see settings-glass.tsx.
- Site routes: `/` (21st.dev-style home), `/components` (sidebar + search, `?c=` `?q=`), `/components/[name]` (live preview, style switcher, Copy prompt / Copy code / Open in Studio → `/studio?add=<name>`). Colors are placeholder role tokens in `globals.css`; restyle comes later.

### 1:30: Person 1: FULL CATALOG → COMPONENTS.md (59 components, owners assigned)
- Tier 1 = 28 must-ship. Tier 2 = 31 build-if-time, else "Coming soon" on the site. Music = later.
- **P2 owns the kit-based ones** (slider, checkbox, tabs, stepper, card, tooltip, toast, dialog, progress, icon button + Tier 2 data/media/backdrops). P1 owns effects + XR-native (buttons with effects, knob, window, wrist/radial menu, wrappers).
- Tick `[x]` in COMPONENTS.md when one works. Use Claude to batch-write them.
- **Website must handle a `status: "soon"` registry entry** (greyed "Coming soon" card).

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
