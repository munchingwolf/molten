# UI-PLAN: how people build in Spatial (Oct 17, 2:50 PM)

For Danny and ek-c8. Four planning agents fed this: in-headset editing, laptop editor + templates, spatial-editor research, and developer-segment research. It **builds on VR-UX-SPEC.md**; where they disagree, the decisions below win. Danny owns the UI calls marked "Danny decides".

**Evan's goal:** "a virtual Minecraft" whose blocks are very well-made working components, from knobs to complete tools, so people build workspaces, 3D websites or any app, in VR and on the web, and stay immersed while editing.

## 1. The model: templates first, then free building (hybrid)

- **Start from a template, then pull it apart.** A template drops a whole working scene in one undoable step: `insert()` is live (abff7e8), via the laptop Templates picker. Every piece stays an ordinary item you can move, delete or restyle, the way Fortnite prefabs break apart. A visitor's first action is turning a knob that works, not arranging windows.
- **Summon a component like opening a browser window.** Tap it in the Library, or say "add a synth". It appears facing you, already selected:
  - Small controls appear 0.45 m away, within poke reach.
  - Whole tools (synth, kanban, dashboard) appear 1.2–1.5 m away, about 5° below eye level, for ray use. Pattern: `addInFront()` in vr-dock.tsx:55.
- **Don't let windows sprawl.** At most about 3 free tool windows; more than that feels crowded (Apple HIG; Quest caps multitasking at 3+3). Everything else snaps: 2.5 cm and 15° (`snap.ts`), onto frames, or onto `surface` tops such as desks and imported .glb models.
- **Two distances only.** Poke UI at 0.42–0.46 m and ray UI at 0.8–3 m. Leave 0.5–0.8 m empty. Targets at least 22 mm, with 12 mm gaps (Meta hands guidelines).

## 2. In the headset (immersed editing)

| Thing | Decision | Owner |
|---|---|---|
| Panels | Content stays fixed in the room. Only the small editor dock lazy-follows, and it can be pinned. Panels fixed at the session origin (today's vr-workspace + vr-shelf) get lost when you turn. **Danny decides:** mount `vr-dock.tsx` (it has follow + pin + 4 tabs) or port its follow logic into vr-workspace. Ship only one dock. | Danny |
| Props | Edit them in the dock (PropControls, already in vr-workspace's Inspector, 30a458e) or by voice ("make it blue", "bigger"). Hands place things; voice tweaks them. | done / Danny |
| Move / scale | As built: grab bar or pinch to move, a second hand to scale and turn. **Hide the gizmo during an XR session:** its 0.35 m handles catch pokes meant for knobs (layout-renderer.tsx:114). The laptop keeps the gizmo. | ek-c8 |
| Lost item | A "Bring here" button in the Inspector puts the selection 0.6 m in front of you. | Danny |
| **Lock = Play** | One 🔒 in the dock header. **Locked (Play):** `editable` off (scene.tsx hard-codes it on today), grab bars, gizmo and grid hidden, dock collapsed. Components still work, and you can walk around without nudging anything. **Unlocked (Edit):** handles, snap and grid. The backdrop is always locked: it renders outside the layout, and rays pass through it. Per-item 🔒 works too (55bd406), e.g. on an imported .glb room. | Danny (button), ek-c8 (`mode` → editable/grid) |
| Hotbar (stretch) | 6–9 favourites on the wrist, plus pick-block: pinch-hold a placed item to copy it. That's Minecraft's fastest loop. | later |

## 3. On the laptop (Figma-style split)

- **Left column = Add.** Two tabs, Templates and Components. Open on Templates when the scene is empty. Fold the categories into 6 chips: Basics · App UI · Web · Media & Motion · Objects · Games · Music. Hide `soon` items.
- **Centre = canvas.** Move the Assistant out of the canvas: its 340 px overlay leaves only about 540 px of canvas at 1440 px. Put it at the bottom of the right column, collapsible. Code becomes a drawer opened from the top bar.
- **Right column = Edit.**
  - A name field, then **Props** (from `Entry.props`, native inputs), then Controls (bindings), then Duplicate and Delete.
  - **With nothing selected: a Scene panel** with environment, Grid and Snap.
- **Empty canvas card:** "Start from a template · Drop your app's .glb · Add a component".
- **Keys:** ⌘Z, ⇧⌘Z, ⌘D. Delete removes the whole selection (`removeSelected`).
- **Light theme** (Danny):
  - A scoped `.theme-light` on the Studio root. It changes token values only, because Tailwind v4 utilities read `var(--color-*)`. Suggested values: `--color-bg:#F6F7F9 --color-surface:#FFF --color-border:#E3E6EB --color-text:#14161B --color-muted:#5B6170 --color-accent:#0B7A60 --color-on-accent:#FFF --color-stage:#ECEEF2`.
  - Mint fails contrast on white, so the accent goes darker.
  - `scene.tsx` canvas background goes from `#111214` to `#E9ECF0`. X-ray stays dark.
  - In-headset panels keep `xr-theme` (dark reads better over passthrough).
  - Log it in DESIGN.md.

## 4. Previews (why the site cards are blank)

The cards each run their own live WebGL canvas. That's fragile, and browsers cap a page at about 16 contexts. Evan is generating **static thumbnails** for every component at `web/public/previews/<name>.jpg`.
- **Danny:** `card.tsx` shows the image and goes live only on hover or focus (one canvas at a time), like 21st.dev.
- The Studio Library can show the same thumbnails, and a hover can open one floating live preview.

## 5. Templates (Evan is writing them; `web/registry/templates/*.json`)

Live: **3D Landing Page** (hero, features, pricing, product turntable, Light Studio) and **Music Studio** (one `tempo` drives knob, transport and display; keys, drum machine and synth play straight away).

Next, ★ = demo: ★ Ops Dashboard · ★ Product Showcase (your .glb + callouts) · ★ Arcade Corner (hoop → score) · Focus Desk · Window Wall · Portfolio · Settings Screen · Media App · Smart Room (lever → lamp, AR) · Dungeon Quest.

ek-c8: Launch (`app-view.tsx`) drops the layout's environment today; render it the way `scene.tsx` does.

## 6. Demo script (rehearse at 5:15)

1. In the headset, pick the Music Studio template. Turn the tempo knob and tap the keys: it plays.
2. Drop in your app's .glb, then lock it.
3. Say "add a pricing table". Pinch it into place and stretch it with two hands. Say "make it dark".
4. Tap 🔒 Play and walk around: nothing moves.
5. Launch: the same scene runs as a web app on the laptop.

## 7. Who it's for (research, sources in the agent report)

- **Demand signal:** weekly npm downloads of `three` went 2.7M → 21.4M and `@react-three/fiber` 0.96M → 6.24M (Oct 2025 → Oct 2026), mostly attributed to AI coding agents. `@react-three/xr` is still small at 67K a week.
- **Segments, ranked:**
  1. AI-agent builders (MCP Apps became an official MCP extension in Jan 2026)
  2. 3D marketing sites and agencies
  3. E-commerce product configurators
  4. WebXR app developers (over 1M people use WebXR on Quest each month)
  5. Industrial training and digital twins
  6. Real estate walkthroughs
- **Components those segments want next:**
  - a scroll-scrubbed camera hero
  - an exploded product view
  - a globe with arcs
  - a configurator (swatches → variant/price events)
  - an AR Quick Look / `<model>` handoff
  - a training checklist pinned to an object
  - a floor-plan minimap with teleport hotspots
- **Biggest threat:** Meta IWSDK 1.0 (Oct 14, 2026) ships an MCP server and a Scene Composer. It has no app-level component library, no React, and is built around Meta devices.
- **Our claim:** the only installable library of *working, app-level* spatial components that run in any WebXR browser, export as R3F code you own, and can be put together in the headset or by an agent over MCP. Lead with components and React; don't pitch Quest fleets to businesses.

## Cut for today

Drag-out ghost, palm-up summon, grab-to-pin panels, snap guides, haptics, accessibility presets, coach card, multi-scene templates, light/dark toggle, Layers panel on the laptop.
