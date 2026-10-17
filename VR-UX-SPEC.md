# VR-UX-SPEC: Spatial Studio user interface (Quest 3/3S WebXR + laptop mirror)

> **Audience:** Danny (frontend) and the Claude Code session on Danny's machine. Build from this file alone.
> **Status:** plan of record for the Studio UI, written 2:10 PM Oct 17 against the code at that time. The code wins over this doc where they disagree. Log the conflict in LOG.md.
> **Landed after this was written (2:50 PM), so don't rebuild these:** `components/studio/prop-controls.tsx` (`<PropControls item />`, live colour/enum/number/boolean controls from registry `props`) and a **Tilt** row are already in `vr-workspace.tsx`'s `Inspector()`. Voice environment names now map to `env-*` ids. The assistant (laptop panel + `VRAssistant`), `VoiceButton`, `useGestureKeys()` and X-ray are mounted. The registry map is generated (`node web/scripts/merge-registry.mjs`).
> **Units:** uikit `pixelSize 0.002`, so **100 px = 20 cm** and 1 px = 2 mm. Every size is given as px@0.002 and in cm. If a panel root uses `pixelSize 0.001` (as `vr-dock.tsx` does), double the px number. **The cm value is the contract.**
> **Angles:** the yaw "bearing" is measured from the user's forward direction (+ = left). Pitch is measured from eye level (− = below).
> **"Decision"** marks a choice this doc makes where the code hasn't decided yet. Build it as written. Changing it needs a LOG.md entry.

---

## 0. Purpose, scope, ownership, file map

**Purpose.** Spatial Studio lets people build 3D software in the headset: 2D sites laid out in space, and immersive apps like a 3D DAW. They use their hands, controllers and voice, and the laptop Studio mirrors the same UI. This doc specifies **every surface, control, state and gesture** of that UI.

**Scope.** VR first (Quest 3 / 3S browser, `immersive-vr` + `immersive-ar` passthrough), then the laptop Studio (`/studio`) as a mirror with the same information architecture. Out of scope: the marketplace site, component internals (`components/spatial/*`), store and format logic.

**Ownership (SPEC §42).**
- **Danny builds the UI.** He never changes store or format semantics (`lib/*`). He calls `useStudio` actions only.
- New behaviour (a new action, field or hook) → **ask Evan in LOG.md** with the exact signature you need. Until it lands, use the fallback named in §13.4.
- Visual edits inside Evan's files are allowed only where this doc says so, and get logged.

### 0.1 File map

| File | Owner | Danny may… |
|---|---|---|
| `web/app/studio/studio-app.tsx` | **Danny** | Edit freely (laptop layout, top bar, panels, shortcuts) |
| `web/components/studio/vr-workspace.tsx` | **Danny** | **Canonical in-headset Editor Dock.** Edit freely |
| `web/components/studio/vr-dock.tsx` | agent (WIP) | **Parts source only.** Copy its lazy-follow, Library/Inspect/World tabs and `PropControl` into `vr-workspace.tsx`, then unmount it. Never mount two docks |
| `web/components/studio/vr-shelf.tsx` | Danny | Retire: its Library moves into the dock. Keep the file until M1 passes |
| `web/components/studio/xr-theme.ts` | **Danny** | Add tokens (§9). Keep values in sync with `app/globals.css` |
| `web/components/studio/assistant-panel.tsx` | **Danny** | Laptop assistant UI (Evan's agent seeded it) |
| `web/components/studio/xray.tsx` | shared | **Visuals only** (colours, line widths, label sizes). Measuring and cable logic stay as they are |
| `web/components/studio/scene.tsx` | shared | **Add or remove mounts only** (§13.1). Don't change the renderer props' meaning |
| `web/components/studio/layout-renderer.tsx` | **Evan** | Only the `GrabHandle` bar meshes (colour, radius, hit box) and `Missing`. Log it first |
| `web/components/studio/voice.tsx`, `VOICE.md` | Evan | Don't edit. Danny's PTT UI calls `useAssistant` instead (§7) |
| `web/components/studio/use-gesture-keys.ts`, `GESTURES.md`, `XR-INTERACTION.md`, `xr-store.ts`, `xr-controls.tsx` | Evan | Mount and use; don't edit |
| `web/lib/*` (studio-store, layout, codegen, auto-layout, snap, wiring, assist-ops, assistant-store, registry, components.generated) | **Evan** | Read only |
| `web/registry/*`, `web/scripts/merge-registry.mjs` | Evan | Read only. The registry is **generated**; never hand-edit the component map |
| **New (Danny):** `components/studio/ui-store.ts`, `follow.ts`, `vr-assistant.tsx`, `mascot.tsx`, `selection-outline.tsx`, `drag-ghost.tsx`, `haptics.ts`, `sfx.ts`, `toast-3d.tsx` | **Danny** | Create (§13.3) |

**Acceptance (§0):** ☐ No diff in `web/lib/**` or `web/registry/**` from Danny's commits. ☐ Exactly one dock component mounted in `scene.tsx`. ☐ Every new behaviour request appears in LOG.md with a signature.

---

## 1. Design principles for spatial UI

### 1.1 Comfort zones (Decision: these numbers bind every placement below)

| Thing | Distance from eyes | Horizontal | Vertical (pitch) | Why |
|---|---|---|---|---|
| Work area (what you build) | 0.5–2.0 m, default centre 1.2 m | ±30° | −5° to −20° | Content zone. Eyes rest about 15° below horizontal |
| Constant panels (Dock, Assistant) | 0.60 m | centre at ±32° | centre −17° | Poke reach without straightening the arm. Peripheral, so the work area stays clear |
| Anything poked | ≤ 0.65 m from eyes, ≤ 0.55 m from the shoulder | | below shoulder height | Avoids "gorilla arm" (raised arm, extended elbow) |
| Ray-only targets | 1.0–4.0 m | any | −30° to +20° | Hand-ray jitter is about 1–2°, so targets must be ≥ 3° |
| Never place UI | < 0.35 m | > ±60° (no turn) | > +25° or < −50° | Vergence strain, neck strain, out of view |

### 1.2 Legibility (computed: angle = 2·atan(h / 2d), h = font em height)

| fontSize px@0.002 | em height | @0.6 m | @1.0 m | @1.5 m | @2.0 m | Use |
|---|---|---|---|---|---|---|
| 10 | 2.0 cm | 1.91° | 1.15° | 0.76° | 0.57° | Hints and badges only, ≤ 1 m |
| 12 | 2.4 cm | 2.29° | 1.38° | 0.92° | 0.69° | Secondary text, mono op log, captions |
| **14** | 2.8 cm | **2.67°** | 1.60° | 1.07° | 0.80° | **Body and row labels (floor for body text)** |
| 18 | 3.6 cm | 3.44° | 2.06° | 1.37° | 1.03° | Panel titles |
| 24 | 4.8 cm | 4.58° | 2.75° | 1.83° | 1.37° | Toasts and labels seen from 1.5–2 m |

**Rule (Decision):** text em must subtend ≥ 1.0° at its farthest expected viewing distance. That is roughly 19 display px of em on Quest 3S (about 19 PPD centre), which keeps x-height above 9 display px. Minimum px ≈ 8.73 × d(m): 6 px @0.6 m, 9 @1 m, 13 @1.5 m, 18 @2 m, 27 @3 m. Body text in the chrome is 14 px, for comfort margin plus lens blur at ±32°.

### 1.3 Targets

| Target | px@0.002 | cm | Angle @0.6 m | Rule |
|---|---|---|---|---|
| Primary (PTT mic, Launch/Play) | 44 (`xr.hit`) | 8.8 | 8.4° | One per panel |
| Row (list item) | 32 | 6.4 | 6.1° | Lists, tabs content |
| Icon button | 28×28 | 5.6 | 5.3° | Action bar, steppers |
| Absolute minimum | 24 | 4.8 | 4.6° | Secondary icons inside a row (eye, lock) |
| Gap between targets | ≥ 6 | ≥ 1.2 | | Stops mis-pokes from a 1.6–2 cm fingertip |

### 1.4 Arm fatigue
- Panels sit below shoulder height (centre −17°), so the elbow stays bent and the arm stays low.
- Any action that takes more than 3 s with a raised arm gets a voice or one-tap alternative: "Bring here", steppers, voice "move it left 20 cm".
- Two-hand scale is for short bursts. The inspector steppers do the same job seated.

### 1.5 Poke vs ray
- **Poke** (fingertip touch) for everything ≤ 0.65 m: panels, nearby components.
- **Ray + pinch** for everything farther, and as an equal fallback on panels. Every panel control works with both: uikit's `onClick` fires for touch and ray pointers alike.
- **Grab pointer** (pinch near / grip) is reserved for **moving things** (items, panels). It never presses buttons. The code already filters on `e.pointerType === "grab"` in `GrabHandle`.

### 1.6 Hand ↔ controller parity
Every action is reachable with hands only, with controllers only, and on the laptop (§3 table). Controllers add haptics and buttons as accelerators (§3.3). Hands get visual and audio feedback instead of haptics.

### 1.7 Laptop parity
The laptop shows the same four Dock tabs, the same Assistant and the same modes, with the same store actions (§10.4).

### 1.8 Accessibility
| Setting | Where | Effect |
|---|---|---|
| Seated mode | World tab, auto at session start if eye height < 1.35 m | §2.5 seated preset |
| Left-handed (mirror) | World tab | Dock ↔ Assistant swap sides. PTT button A ↔ X. Summon hand stays "either" |
| Reduced motion | World tab, default = OS `prefers-reduced-motion` on laptop | Follow jumps with a fade instead of gliding. Mascot doesn't bob. No spring overshoot |
| Contrast | Always | Text on panel ≥ 7:1 (`#EEF0F4` on `#15171E` = 15.6:1). Muted ≥ 4.5:1 (`#9AA0AD` on `#15171E` = 6.9:1). Faint (`#6B7180`, 3.6:1) only for ≥ 12 px non-essential labels |
| Sound | World tab, default on | §9.5 |
| Voice-free | Always | Everything voice does has a manual control |

**Acceptance (§1):** ☐ No chrome text < 12 px except hints (10 px). ☐ No target < 24 px. ☐ No panel closer than 0.5 m. ☐ Both panels usable by poke and by ray. ☐ All five settings in §1.8 work and persist in `localStorage` (try/catch).

---

## 2. Spatial layout of the VR Studio

### 2.1 Pieces

| Piece | What | Pose (standing, relative to the follow anchor A = head position, head yaw ψ) |
|---|---|---|
| **Editor Dock** (left) | `VRWorkspace`: header, action bar, tabs Library / Inspect / Layers / World | bearing +32°, horizontal 0.58 m, centre 0.18 m below eye (pitch −17°), face tilted back 17° so its normal hits the eye. Distance 0.61 m. Size **220 × 300 px = 44 × 60 cm** (39.8° × 52.6°) |
| **Assistant panel + Pix** (right) | `VRAssistant`: mode header, transcript, chips, PTT | bearing −32°, horizontal 0.58 m, drop 0.18 m, tilt 17°. Size **200 × 260 px = 40 × 52 cm** (36.5° × 46.4°) |
| **Pix mascot** | 3D character, §7.6 | sits on the Assistant's top edge, 60 px (12 cm) in from its centre-side corner, 4 cm above the edge. Body Ø 8 cm |
| **Work area** | Where items live (world-locked) | centred 1.2 m ahead of the session-start pose, x ±0.9 m, y 0.8–2.0 m, z −0.8 to −2.0 m. Default spawn slots are `slot(n)` in `studio-store.ts`: x ∈ {−0.85, 0, 0.85}, y = 1.45 − 0.6·row, z −1.2 |
| **Floor grid** | `gridHelper` 8 m, 32 divisions = 25 cm cells (10 snap steps) | at y = 0. Shown when `showGrid`. X-ray brightens the lines (already in `scene.tsx`) |
| **Environment** | `components[environment]` (`env-*`) | world-locked around the origin. Hidden in AR and in X-ray (`scene.tsx`) |
| **Toasts** | `toast-3d.tsx` | 0.9 m ahead, 0.25 m below eye, lazy-follow anchor, max width 160 px (32 cm), auto-hide 2.5 s |

**Decision:** the floating top toolbar in `vr-workspace.tsx` (`TOOLBAR_POS [0,1.62,-0.7]`) is **removed**. It sits in the work area at eye level and blocks the view. Its tools move to the Dock action bar (§6.1) and the mode header (§7.1).

### 2.2 Top-down (standing, user at A facing −Z; 1 char ≈ 10 cm)

```
                        −Z (forward)
            x=-0.9            x=0             x=+0.9
   z=-2.0   ┌───────────────── WORK AREA ─────────────────┐
            │                                             │
            │   [slot0]          [slot1]        [slot2]   │  z=-1.2  (items, world-locked)
            │                                             │
   z=-0.8   └─────────────────────────────────────────────┘
                                 ·
        DOCK (+32°)              ·              ASSISTANT (−32°)
     ┌──────────┐ x=-0.31,z=-0.49·   x=+0.31,z=-0.49 ┌──────────┐
      ╲ 44 cm   ╲                ·                 ╱  40 cm  ╱   ← both face A
        ╲        ╲   32°         ·          32°   ╱        ╱
                   ╲             ·             ╱        (Pix on top edge, centre side)
                      ╲          ·          ╱
                            ╲    ·    ╱
                                 A  (eyes ~1.60 m, origin of session)
                                 +Z (behind)
```

### 2.3 Front view (what the user sees, standing, eye at 1.60 m)

```
 pitch
  +10° ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
         ┌────────────┐                                   (•‿•) Pix
   0° ── │ ▣ Studio 📌│  ─ ─ ─ ─ ─ eye level ─ ─ ─ ─ ─ ┌───────────────┐ ─
         │ ↶ ↷ ⧉ ▢ 🗑 │      ┌──────┐   ┌──────┐        │[Edit|Play] ◎X │
  −10°   │Lib Ins Lay W│      │ knob │   │mixer │        │> add a knob   │
         │ ┌──┐ ┌──┐  │      └══════┘   └══════┘        │● add knob ✓   │
  −17° ──│ │  │ │  │  │──── work area centre (1.2 m) ───│  Done.        │── panel centres
         │ └──┘ └──┘  │      ┌──────┐                     │[bigger][glass]│
  −30°   │ ┌──┐ ┌──┐  │      │ pads │   ══ = grab bar    │ ( ◉ Hold to  )│
         │ └──┘ └──┘  │      └══════┘                     │ (   talk    )│
  −43° ──└────────────┘                                   └───────────────┘
       ◄──── 52° ─── 12°            0°            −12° ─── −50° ────►
          DOCK                                         ASSISTANT
```

### 2.4 Lazy follow (Decision: one shared anchor for both panels and toasts, `follow.ts`)

Adapted from `vr-dock.tsx` lines 86–118 (same exponential chase), extended to a shared anchor:

```
state: anchor = { pos: Vector3, yaw: number, chasing: bool, init: bool }
each frame (dt):
  head = camera world position; yaw = atan2(-dir.x, -dir.z) of the flattened gaze (keep the old yaw if looking straight down)
  if !init or |head - anchor.pos| > 1.0 m        → snap (anchor = head, yaw), chasing=false   // session start / recentre / reset
  else if !pinned:
     if |Δyaw| > 60°  or  horiz|head - pos| > 0.35 m  or  |Δy| > 0.25 m   → chasing = true
     if chasing: k = 1 - exp(-4·dt); yaw += Δyaw·k; pos.lerp(head, k)
                 if |Δyaw| < 2° and |head - pos| < 0.02 m → chasing = false
  reduced motion: when chasing starts → fade panels to 0 over 120 ms, snap, fade in 120 ms
panel pose = anchor.pos + R(anchor.yaw + bearing) · (0, -drop, -dist), rotation (pitch tilt, yaw anchor.yaw + bearing)
```

- **60° threshold:** you can read the Dock's far edge (52°) without it running away, with 8° margin.
- **k = 4 s⁻¹:** 63% of the way there in 250 ms, settled in about 1 s. Slow enough not to cause sickness.
- **Recentre** (snap anchor to the head, 300 ms ease-out glide, or a fade under reduced motion). Triggers:
  - World tab "Recentre"
  - Summon gesture
  - Left controller **Menu** button
  - `xrStore` reference-space `reset` event
  - Session start
- **Pin / unpin:** pin icon in each panel header (24 px). Pinned = world-locked at its current pose; the other panel keeps following. Grabbing a panel header with the grab pointer (pinch-near or grip) moves the panel (`@react-three/handle` `Handle` on the header) and **auto-pins** it. Unpin glides back to the follow pose (300 ms).
- **Summon gesture (Decision):** palm-up on either hand. The palm normal must be within 35° of world up, the hand within 0.55 m of the head and below the chin, held **500 ms**. While held, a 3 cm mint ring fills on the palm over the 500 ms. On fill → Recentre + unpin both panels, and a haptic pulse on controllers (n/a for hands). Cancels if the hand pinches or leaves the cone. Read joints with `useXRInputSourceState('hand', side)` and compute the palm normal from the `wrist`, `index-finger-metacarpal` and `pinky-finger-metacarpal` joint poses.

### 2.5 Presets

| Preset | Dock / Assistant | Work area | Trigger |
|---|---|---|---|
| Standing (default) | bearing ±32°, horiz 0.58 m, drop 0.18 m, tilt 17° | centre 1.2 m ahead at eye −0.15 m | eye height ≥ 1.35 m at session start |
| Seated | bearing ±30°, horiz 0.50 m, drop 0.14 m, tilt 16° | centre 1.0 m ahead at eye −0.10 m. `add` in front uses 0.55 m | eye height < 1.35 m, or the World tab toggle |
| Left-handed | bearings mirrored (Dock −32°, Assistant +32°) | same | World tab toggle |

**Acceptance (§2):** ☐ On session start both panels appear at the poses above (±2 cm, ±2°). ☐ Turning the head 50° and back moves nothing. Turning 70° makes both glide and settle in ≤ 1.2 s. ☐ Walking 0.5 m makes them follow. ☐ The pinned panel stays while the other follows. ☐ Palm-up for 0.5 s recentres; a 0.3 s palm-up does nothing. ☐ The left Menu button recentres. ☐ Seated auto-detects in the emulator (set eye height to 1.2 m). ☐ Left-handed swaps sides live. ☐ The old top toolbar is gone.

---

## 3. Input model and gesture grammar

### 3.1 Master table (E = Edit mode only; P = also in Play)

| Action | Hand poke | Hand pinch-ray | Hand pinch-near (grab ptr) | Two hands | Controller | Laptop |
|---|---|---|---|---|---|---|
| Press a panel button / row | tap | point + pinch | — (never) | — | trigger (ray) or poke with the controller tip | click |
| Operate a component control (P/E) | tap / drag | pinch / pinch-drag | — | — | trigger / drag | click / drag |
| **Select** item (E) | tap item | pinch item | grabbing selects | — | trigger on item | click item |
| Add to selection (E) | Layers row checkbox, or **Multi** on + tap | same | — | — | same, or hold **B** + trigger | Shift-click |
| Deselect all (E) | Layers "Clear", or tap empty floor | pinch empty space (ray hits nothing) for < 300 ms | — | — | trigger on nothing | Esc / click empty |
| **Move** item (E) | drag the grab bar | pinch-drag the grab bar | pinch anywhere on the item + move | — | grip on item/bar, or trigger-drag the bar | drag the bar; arrows (1 cm, ⇧ 10 cm), PgUp/PgDn = z |
| Push/pull along the ray (E) | — | — | — | — | while gripping: right stick Y, 0.6 m/s | — |
| **Scale** uniform (E) | Inspect stepper | Inspect stepper | — | both pinch-near, pull apart / push together (0.2–5×) | both grips, same | `−`/`=` ×0.9/×1.1, Alt+wheel, gizmo balls |
| **Yaw** (E) | Inspect ⟲ ⟳ (15°) | same | — | both grab, swing like a flat steering wheel | both grips; or right stick X flick while gripping = ±15° | `[` `]` ±15°, gizmo green ring |
| Pitch / roll / tilt (E) | gizmo rings (poke-drag) | gizmo rings | — | — | gizmo rings | gizmo red/blue rings |
| Duplicate (E) | action bar ⧉ | same | — | — | same | ⌘D |
| Delete (E) | action bar 🗑 | same | — | — | same | Delete / Backspace |
| Group into frame (E) | action bar ▢ | same | — | — | same | ⌘G |
| Ungroup (E) | Inspect (frame) "Ungroup" | same | — | — | same | ⇧⌘G |
| Undo / Redo (E) | action bar ↶ ↷ | same | — | — | **B** = undo (hold B 600 ms = redo) | ⌘Z / ⇧⌘Z |
| Add component (E) | Library tile tap | same | pinch-hold a tile, drag out ≥ 6 cm, release = place | — | trigger tap / trigger-drag out | click row = add in slot; drag onto the canvas = drop at point |
| Voice (PTT) (E/P) | hold the mic button | pinch-hold the mic button | — | — | hold **A** (left-handed: **X**) | hold Space (canvas focused) or the mic button |
| Scroll a panel list | poke-drag the list | pinch-drag the list | — | — | trigger-drag; or right stick Y over the list, 600 px/s | wheel |
| Move / pin a panel | — | — | pinch-near the header + move (auto-pins) | — | grip on the header | n/a |
| Recentre panels | World tab button | same | — | palm-up 500 ms (one hand) | left **Menu** | n/a |
| Edit ↔ Play | mode header | same | — | — | — | `P` |
| X-ray | mode header ◎ | same | — | — | — | `X` |

### 3.2 Selection rules (Decisions)
1. **Tap = replace selection.** Tap on an item, a Layers row label, or via voice "select the knob".
2. **Additive:** laptop Shift-click. VR: (a) each Layers row has a 24 px checkbox at its left edge that toggles membership (`select(id, true)`); (b) a **Multi** chip in the Dock action bar makes every tap additive until it's turned off, Esc is pressed, or the selection is cleared; (c) controller: hold B + trigger.
   - **This replaces** `vr-workspace.tsx`'s current "tap adds when anything is selected", because that made replacing the selection impossible.
3. **No marquee** in VR or on the laptop (cut: low value, high cost).
4. **Primary** = `selectedId` (gizmo, Inspect target, last tapped). The others in `selectedIds` get the secondary outline.
5. **Frame children:** tapping a child selects the child (`FrameChild` stops propagation). Use Layers to select the frame.
6. **Locked** items: selectable (Inspect shows the lock). Move, scale and rotate are disabled (§4.8).
7. **Hidden** items: not rendered. Selectable in Layers only. Inspect shows "Hidden" with a Show button.

### 3.3 Controller button map (right hand; mirrored for left-handed)
| Button | Action | Haptic |
|---|---|---|
| Trigger | ray click / drag | press 0.4 / 20 ms |
| Grip | grab (move item / panel) | grab 0.6 / 30 ms, release 0.3 / 20 ms |
| A (hold) | push-to-talk | start 0.5 / 30 ms, stop 0.3 / 20 ms |
| B (tap / hold 600 ms) | undo / redo | 0.3 / 15 ms |
| B (held) + trigger | additive select | as trigger |
| Right stick Y / X while gripping | push-pull 0.6 m/s / yaw ±15° per flick (deflection > 0.7) | snap tick 0.25 / 12 ms per step |
| Right stick Y over a panel | scroll 600 px/s | — |
| Left Menu | recentre panels | 0.5 / 30 ms |

Read buttons with `useXRInputSourceState('controller', 'right')` + `useXRControllerButtonEvent(state, 'a-button' | 'b-button' | 'thumbstick', cb)`. Put this in `ui-store.ts` / a small `ControllerShortcuts` component inside `<XR>`.

### 3.4 Hover and focus in 3D
- **Ray hover:** the row gets the `rowHover` fill (120 ms) and the ray cursor shows (built into `@react-three/xr`).
- **Fingertip proximity (touch pointer hover):** same `rowHover` + a 1.5 px `accent` border. Press: `rowActive` + translate −2 px z (4 mm) for 80 ms.
- **Item hover (E):** a 1 px `border-2` outline box around `contents.get(id)` (`selection-outline.tsx`). Selected: 2 px `accent`. Secondary: 1.5 px `accent` at 50%.
- **Focus ring (laptop keyboard focus on canvas items):** same as selected but dashed. The DOM focus ring stays the global 2 px accent outline from `globals.css`.
- **No hover-only information** (DESIGN.md: Quest hands have no hover). Every hover affordance has a visible default.

### 3.5 Conflict resolution: Edit vs Play (Decision)
- **Edit mode (default):** components stay **live**. Poke and ray operate their controls (knob turns, buttons press), **and** the bubbling click selects the item. Grab-pointer and grab-bar presses move it. This matches the current renderer: `Handle filter` accepts only `pointerType === "grab"` or the bar. No component control ever moves the item.
- **Play mode:** `LayoutRenderer editable={false}`. No bars, gizmo, selection or outlines. The panels collapse to their headers (§8.3). This is the "launched app" feel, inside the session.
- **Mode lives in `ui-store.ts`** (`mode: "edit" | "play"`), UI-local, not undoable. X-ray stays `useStudio.viewMode`.

### 3.6 Discoverability hints
- **First session:** a 3-step coach card in the Assistant transcript ("Tap a tile on your left to add" → "Pinch anywhere on it to move · two hands to stretch" → "Hold the mic and say 'make it blue'"). Each step is ticked by doing it. Dismissed forever with "Got it" (`localStorage`).
- Grab bar tooltip on the first item only, 10 px, 3 cm under the bar: "pinch to move".
- Empty states (§12) always say the next action.

**Acceptance (§3):** ☐ Every row of 3.1 works in the IWER emulator with hands and with controllers. ☐ Turning a knob in Edit mode never moves it. ☐ Pinch-near on the knob moves it. ☐ Multi chip + three taps = 3 selected. ☐ Tap without Multi replaces. ☐ B undoes. ☐ Play hides all editor affordances and the knob still turns. ☐ The coach card advances on real actions.

---

## 4. Direct manipulation

### 4.1 Grab bar (visuals: Danny; logic: `layout-renderer.tsx` `GrabHandle`)
| Property | Value |
|---|---|
| Shape | capsule, radius 1.2 cm, length = clamp(item width × 0.5, 15–50 cm) (existing) |
| Position | 5 cm below the item's bounding box, centred (existing) |
| Hit box | +6 cm wide, 6 × 6 cm cross-section, invisible (existing) |
| Colour: default | `xr.muted` `#9AA0AD` (**replace** the legacy `#ECE9DF`) |
| Hover | `xr.text` `#EEF0F4`, capsule radius × 1.25 (120 ms) |
| Selected | `xr.accent` `#9FE7D2` (**replace** legacy `#1FB54A`) |
| Grabbed | `accent`, radius × 1.4, emissive-look via `meshBasicMaterial` at full brightness |
| Locked | `xr.faint` + a 2 cm lock glyph at its centre. No grab |
| Play mode | not rendered (existing `editable`) |

### 4.2 Move, scale, rotate (as built; see `GESTURES.md`)
- **Grab-anywhere** = grab pointer only. One pointer moves. A second pointer on the same item adds uniform scale (hand distance) and yaw (hand twist). Releasing one hand continues as a move.
- **Release** reports `onTransform(id, {position, rotation, scale})`, so **one undo step per gesture**. `scene.tsx` already passes `onTransform → update`.
- **Gizmo (`PivotHandlesHandles`, size 0.35)** shows on the **primary selected item, Edit mode, not locked, not a frame child**. Arrows and plane squares move. Quarter rings pitch/yaw/roll. Balls scale uniformly.
  - Decision: hide the gizmo while two hands are grabbing (it clutters the view). Ask Evan: renderer flag.
  - Laptop: always shown on the primary selected item.

### 4.3 Snapping (`lib/snap.ts`: 2.5 cm, 15°, 0.05 scale, scale clamp 0.2–5; surface seat ≤ 8 cm above / 2 cm into a `desk|stage|table|tag:surface` top)
| Feedback | Spec |
|---|---|
| Snap tick | Each time the snapped position or angle changes a step during a drag: controller pulse 0.25 / 12 ms. `sfx.tick` (2 kHz, 10 ms, −30 dB). Throttle ≥ 40 ms |
| Ghost | During a grab: a 1 px `faint` outline box at the **pre-grab** pose. Removed on release |
| Guides | During a move: a 1 px `accent` 40% line from the item centre down to the floor, with a 6 cm ring on the floor/surface below. When the item's centre x or y is within 1 cm of another item's centre: a dashed `accent` alignment line between them, 300 ms fade |
| Surface seat | When release would seat: the target top's outline glows `accent` during the drag (the same `restOn()` test, run in `selection-outline.tsx` at 10 Hz). On release: 150 ms settle animation + pulse 0.4 / 20 ms |
| Snap off | Laptop Shift bypasses. World tab "Snap" toggle → `toggleSnap()`. The mode header shows a `Magnet` icon when on |

### 4.4 Constraints
Scale is clamped 0.2–5× (renderer). The voice path allows 0.05–20× (`applyOps`); the Inspect stepper clamps 0.2–5. Positions are unconstrained, except the "Too far" handling in §12. Frame children ignore their own position (the frame lays them out).

### 4.5 Undo granularity (Decisions)
- One gesture (grab → release) = 1 step. One stepper tap = 1 step (`update` checkpoints each call).
- **Laptop number and text inputs commit on blur or Enter, not per keystroke.** Today's Inspector calls `update` on every `onChange`, which floods history. Fix it in M0.
- A voice command with N ops = N steps today. The Assistant "Undo" chip undoes N (§7.4). Ask Evan for `batch(fn)`.
- `undo()`/`redo()` clear the selection (store behaviour). The UI shows toast "Undone: <label>".

### 4.6 Multi-select manipulation
- Grab gestures move **one** item (renderer).
- **Decision:** with ≥ 2 selected, the Inspect tab shows a **Group** header ("3 selected") with only these:
  - Duplicate / Delete / Frame (store supports ids)
  - Nudge X/Y/Z ±5 cm, Turn ±15°, Scale ±0.1 applied to each selected item. This needs `updateMany` for one undo step; until it lands, loop `update` (N steps). Ask Evan.
- Laptop arrows move only `selectedId` (`use-gesture-keys.ts`). Ask Evan to extend this to `selectedIds`.

### 4.7 Frames
- **Create:** action bar ▢ / ⌘G → `groupIntoFrame()` (selection; default `{direction:"row", gap:0.05, padding:0.06}`). The new frame is selected.
- **Visuals (Edit):** background plane `#15171E` at 55% (component default). When selected, a 1.5 px dashed `accent` bound. Hovered: a dashed `border-2` bound. X-ray: §8.2.
- **Edit in VR (Inspect, frame selected):** see the controls table in §6.3. Each tap writes `update(id, { props: { ...props, k: v } })`.
- **Reorder children:** Layers rows inside a frame get ▲ ▼ (24 px) → `reorder(id, index ∓ 1)`. Laptop: drag rows (§10.1).
- **Move into / out of a frame:** Layers row ⋯ menu → "Move to frame ▸ <frame names>" / "Out of frame" → `setParent(id, frameId|null)`. Laptop: drag a row onto a frame row.
- **Ungroup:** Inspect → `ungroup(frameId)`.

### 4.8 Locked / hidden
| | Locked | Hidden |
|---|---|---|
| Render | yes, with a lock glyph on the faint bar | no (`LayoutRenderer` filters) |
| Select | yes (tap / Layers) | Layers only |
| Move / scale / rotate | **blocked**. Needs Evan: renderer must skip `Handle`/gizmo when `item.locked`. Until then, Danny hides the gizmo for locked items by passing `selectedId={null}` if the selected item is locked (scene.tsx mount detail), and the bar still grabs. Log it as a known gap | n/a |
| Codegen | included | excluded (`codegen.ts` `visible`) |
| Layers row | lock icon, faint text | eye-off icon, faint text |

**Acceptance (§4):** ☐ Bar colours use tokens only. ☐ A two-hand stretch persists after release (scale saved). ☐ One gesture = one ⌘Z. ☐ Snap ticks are felt on a controller at 2.5 cm steps. ☐ A knob dropped 5 cm above a desk seats exactly with a pulse. ☐ Laptop inputs make one undo step per commit. ☐ Frame direction / gap / padding change live in VR. ☐ ▲▼ reorder children. ☐ The gizmo is hidden for locked items.

---

## 5. Adding things

### 5.1 Library in VR (Dock → Library tab)
- **Source:** `registry.filter(e => e.status === "ready" && e.kind !== "environment")`. Group by `category` (today: music 12, objects 10, buttons with effects 7, containers and feedback 5, data 5, controls 4, xr-native picks 4, input 4, settings 3, media 2, navigation 1, layout 1 [frame]). `components.generated.ts` holds the map.
- **Category chips** (horizontal scroll row, 28 px tall, 12 px text): All · Music · Objects · Buttons · Containers · Data · Controls · Input · Media · Nav · Layout. Selected = `accent` fill / `onAccent` text.
- **Tiles, not thumbnails (Decision):** 2-column grid, tile **98 × 56 px (19.6 × 11.2 cm)**, 6 px gap. Each tile has:
  - a 20 px lucide icon per category (Music→`Music`, Objects→`Box`, Buttons→`MousePointer2`, Containers→`Frame`, Data→`BarChart3`, Controls→`SlidersHorizontal`, Input→`TextCursorInput`, Media→`Image`, Nav→`Menu`, Layout→`LayoutGrid`, Settings→`Settings2`)
  - `displayName` 14 px (2 lines max, ellipsis)
  - `XR` 10 px badge if `xrOnly`
  - Live 3D thumbnails are **cut** (draw-call cost: one canvas, many roots).
- **Search:** no keyboard in VR. A 🎤 "Search" chip at the top-right of the tab: PTT dictation → `matches(entry, text)` filter, shown as "“drum” ✕". Voice "add a drum pad" also works directly (§7).
- **Tap a tile** = `add(name, pos, patch)` in front of the user. Use `vr-shelf.tsx`'s `addInFront`: 0.6 m ahead (seated 0.55), 0.1 m below eye, **swung 40° (0.7 rad) toward the work-area side, away from the Dock** (mirror for left-handed), facing the user. Then a toast "Added Knob" + pulse 0.4 / 20 ms. Stay on the Library tab.
- **Drag out (preview-before-place):** pinch-hold (ray or poke) a tile, move ≥ 6 cm off the dock face. A **ghost** follows the pointer point: a `faint` 1 px wireframe box 30 × 20 × 5 cm + a 12 px name label, 60% opacity (`drag-ghost.tsx`). Over a frame: the frame bound turns `accent` (drop = child via `add` then `setParent`). Release over the work area → `add(name, ghostPos, {rotation:[0, yawToUser, 0]})`. Release over the Dock → cancel. Uses `setPointerCapture` on the tile.

### 5.2 Environments (Dock → World tab; laptop top-bar picker)
Six 98 × 56 px tiles:
- None (dark studio)
- Studio Loft (`env-studio-loft`)
- Outer Space (`env-space`)
- Forest (`env-forest`)
- Concert Stage (`env-concert-stage`)
- Gallery (`env-gallery`)

Each tile: swatch = its `tint` prop default, plus the name. Tap → `setEnvironment(name|null)` (undoable). AR session: tiles disabled with the caption "Passthrough: your room is the environment" (environments are hidden in AR by `scene.tsx`). Environment props (intensity 0–2, tint) appear in the World tab under the picker, using the §6.3 controls, written to… **nowhere today**: `Layout.environment` is a string and has no props. Hide these until Evan adds `environmentProps` (open question Q3).

### 5.3 Templates (Decision: Library tab section "Start from", top, collapsed by default)
Five 98 × 40 px tiles: Settings screen · Dashboard · Media app · 3D landing page · Music DAW (SPEC §42). Tap → confirm sheet "Replace current scene? ↶ to undo" → `load(templateLayout)`. Templates are **Evan's data** (not in the repo yet). Show the section only when `templates.length > 0` (Q4).

### 5.4 Scenes (World tab)
- List rows (32 px): name, item count, ● on the active one. Tap → `switchScene(id)` with a 300 ms fade-to-`bg` transition (reduced motion: instant).
- `+ Scene` → `addScene()`. Rename = PTT ("call it About"; Assistant routes it to `renameScene`. Needs an op, Q5; fallback: laptop only).
- Delete = ⋯ → hold-to-confirm 600 ms → `removeScene(id)` (disabled when only one scene exists).

**Acceptance (§5):** ☐ Every ready non-environment entry is reachable in ≤ 2 taps. ☐ A tap adds the item 0.6 m out, on the work-area side, facing me. ☐ Drag-out shows the ghost and places it on release. Release on the dock cancels. ☐ Dropping on a frame parents it. ☐ The environment switches live and undo restores it. ☐ The scene switch fades. ☐ Voice search filters tiles.

---

## 6. Editor Dock in full (`vr-workspace.tsx`)

### 6.1 Chrome
| Region | Size (px@0.002) | Contents | States / action |
|---|---|---|---|
| Panel | 220 × 300 (44 × 60 cm), padding 10, radius `xr.radius.lg` 20, border 1.5 `xr.border` | | bg `xr.panel` |
| Header | h 28 | 8 px mint dot · "Studio" 14 bold · **mode chip** (EDIT / PLAY / X-RAY, 10 px mono, §8.5) · scene name 12 `muted` (ellipsis) · 📌 pin 24 px | pin: default `row`, on = `accent`. The header is the panel's grab handle (grab pointer) |
| Action bar | h 32, 6 icons × 28 px, gap 6 | ↶ Undo (`undo`), ↷ Redo (`redo`), ⧉ Duplicate (`duplicate()`), ▢ Frame (`groupIntoFrame()`), 🗑 Delete (`removeSelected`), **Multi** chip (ui-store) | Disabled (35% opacity, no hover) when: Undo `!past.length`; Redo `!future.length`; Dup/Frame/Delete `!selectedIds.length`. Pressed: `rowActive` + −2 px z |
| Tabs | h 40, 4 × flexGrow | Library · Inspect · Layers · World (icon 16 + label 12) | Selected: `rowHover` bg + `accent` text, bold. Default: `panel` bg, `muted` |
| Content | flexGrow, `overflow="scroll"`, scrollbar 4 px `faint` | per tab | Scroll: poke-drag / ray-drag / stick |

**Tab auto-switch (Decision):**
- After an add, stay in Library.
- Selecting an item while in **Library** shows a footer bar (28 px, `accent` text) "Knob selected · Inspect ›". Tap → Inspect.
- No auto-switch from other tabs.

### 6.2 Library tab: see §5.1. Footer: count "34 components".
Empty (search miss): "No match for “drum” · ✕ clear".

### 6.3 Inspect tab (target = `selectedId`)
**Nothing selected:** icon `MousePointer2` 28 px faint + "Tap a component, or pick one in Layers." 14 `muted`.

**Rows top → bottom:**

| Row | Control | Action |
|---|---|---|
| Title | name 18 bold (`item.name ?? displayName`), component 12 faint | Rename = PTT "call it Main knob" → needs an op (Q5); laptop input → `update(id,{name})` |
| Visibility / lock | 👁 / 🔒 24 px toggles | `update(id,{hidden})`, `update(id,{locked})` |
| Position X / Y / Z | stepper: label 12 (52 px) · − 28 · value 14 mono "0.85 m" (70 px) · + 28 | ±0.05 m (Decision: 5 cm = 2 snap steps; laptop 0.01 via arrows) → `update(id,{position})` |
| Scale | stepper "1.0×" | ±0.1, clamp 0.2–5 |
| Turn | ⟲ ⟳ 28 px | ±15° yaw (as built) |
| Tilt | ⤒ ⤓ 28 px | ±15° pitch (x). Decision: added for "tilt" parity with the gizmo |
| Anchor | segmented World · Head · Wrist (h 28) | `update(id,{anchor})`. Head/Wrist rendering = Evan (§11.2). Show the caption "previews in Play" until it's built |
| **Bring here** | 32 px row, `MapPin` icon | Moves the item to 0.8 m ahead, eye −0.1 m, facing the user (`update`). §12 |
| **Props** (from registry `props`) | one control per `PropSpec` (below) | `update(id,{props:{...item.props,[name]:v}})` |
| **Controls** (from `bindable`) | "controls: <name>" rows (below) | `bind(id, prop, name)` |
| Frame section (frame only) | below | |
| Danger | Delete 32 px row, `warm` text | `remove(id)` |

**Prop controls (`PropSpec {name, type, label?, options?, min?, max?, default}`, types in the registry today: number 24, color 18, string 8, boolean 4, enum 1):**

| type | VR control (sizes px@0.002) | Laptop control | Value |
|---|---|---|---|
| `color` | label 12 · 6 swatches Ø 24, gap 6: `#9FE7D2 #7DB4FF #C9A7FF #F58BB0 #F2B48A #EEF0F4` (from `vr-dock.tsx`) + current hex 12 mono. Selected swatch: 2 px `text` ring | `<input type=color>` + hex text input (commit on blur) | hex string |
| `number` | stepper: step = `step ?? (max−min)/20 ?? 0.1`, clamp min/max, value 14 mono (2 dp) | range slider + number input | number |
| `boolean` | switch 44 × 24 px: off `row` / on `accent`, 20 px knob slides 120 ms | checkbox switch | bool |
| `enum` | ≤ 4 options: segmented (h 28). > 4: ‹ value › cycler | `<select>` | option string |
| `string` | value 14 (2 lines) + 🎤 "Say it" chip → PTT; the transcript is written raw (no LLM) | text input, commit on blur/Enter | string ≤ 80 chars |

**Missing `props` metadata:** no Props section is shown.

**Controls (bindable) rows:** prop name 12 mono · chip showing the bound name (`accent` outline) or "Wire…" (`muted`) · current value 12 mono (`values[name] ?? default`). Tap the chip → sheet listing:
- existing names (`items.flatMap(i => Object.values(i.bind))`), 32 px rows
- "New name… 🎤" (PTT dictation → `bind(id, prop, text)`; `toIdent` normalises it)
- "Unwire" → `bind(id, prop, "")`.

Laptop: the existing datalist input, kept, commit on blur. Cables are shown in X-ray (§8.2). Patch-cable jack dragging (`lib/wiring.ts planLink/nearestJack`) is **P3 / cut** for today.

**Frame section** (`component === "frame"`, props from the merge-script `frame` entry):

| Control | Spec |
|---|---|
| Direction | segmented Row · Col · Grid · Arc (icons `Columns3`, `Rows3`, `LayoutGrid`, `Rotate3d`) |
| Gap | stepper ±0.01 m, 0–0.30 |
| Padding | stepper ±0.01 m, 0–0.30 |
| Columns (grid only) | stepper ±1, 1–6 |
| Radius (arc only) | stepper ±0.1 m, 0.8–3.0 |
| Align | segmented Start · Center · End |
| Background | switch |
| Ungroup | 32 px row → `ungroup(id)` |

**Multi-select (≥ 2):** §4.6.

### 6.4 Layers tab
- Depth-first tree (as built in `vr-workspace.tsx`). Indent 18 px per depth.
- Row h 32:
  - ☐ 24 px checkbox (additive select)
  - frame icon if `frame`
  - label 14 (`faint` if hidden)
  - right side: 👁 24 + 🔒 24 (tap toggles `update`), ▲▼ 24 only for frame children
  - ⋯ 24 → sheet: Duplicate · Move to frame ▸ · Out of frame · Delete
- Row states: default `row`; hover `rowHover`; pressed `rowActive`; primary selected `rowHover` + 1.5 px `accent` border; secondary selected `rowHover`.
- Header: `Layers` icon + "Layers" 14 bold + count 12 faint. Footer when a selection exists: "Clear selection" (36 px) → `select(null)`.
- Empty: "Nothing here yet. Add from Library." + a "Library ›" link.
- Scroll: content scrolls; the header is fixed.

### 6.5 World tab
Top → bottom:
- Environment tiles (§5.2)
- Scenes (§5.4)
- toggles (32 px rows, switch at the right):
  - Grid → `toggleGrid`
  - Snap → `toggleSnap`
  - Seated, Left-handed, Reduced motion, Sound (ui-store)
- "Recentre panels" → follow.recentre()
- **Save** (32 px) → `POST /api/layout` with `useStudio.getState().layout()` → toast "Saved · <id>" and show the id + `…/apps/<id>` 12 mono under the button
- **Launch** (44 px, `accent`): in VR, **Decision:** do Save and switch to **Play** mode in place. Opening `/apps/<id>` would end the session. The laptop Launch opens the tab as built.

**Acceptance (§6):** ☐ Each control calls exactly the action listed. ☐ Disabled states are correct for empty history and empty selection. ☐ Every PropSpec type renders and edits live (test lamp `color`, knob `min/max`, a boolean, the frame enum). ☐ Wire knob.value → "tempo", and transport.bpm to the same name: both stay in sync. ☐ Layers checkbox multi-selects. ☐ ▲▼ reorder. ☐ Empty states show. ☐ Save shows the id. ☐ VR Launch enters Play.

---

## 7. Assistant panel + voice + Pix

### 7.1 Layout (`vr-assistant.tsx`, 200 × 260 px = 40 × 52 cm, pose §2.1)
| Region | Size | Contents |
|---|---|---|
| Mode header | h 36 | **Edit · Play** segmented (2 × 52 px, h 28) · ◎ X-ray toggle 28 · status pill (right): dot + "ready" / "listening…" / "thinking…" (12 mono) · 📌 24 |
| Model pill | h 16 | 10 px mono `faint`: "local model" or "keyword mode" (from `GET /api/assist` → `{ready}`, polled every 30 s) + "voice: ElevenLabs" / "voice off" (from `GET /api/stt` → `{ready}`) |
| Transcript | flexGrow, scroll, auto-scroll to the bottom on a new message | terminal style (§7.2) |
| Quick chips | h 28, horizontal scroll, gap 6 | context-aware (§7.3) |
| PTT button | h 44 (`xr.hit`), full width, radius 22 | §7.4 |

### 7.2 Transcript (mirrors `assistant-panel.tsx`, mono 12 px, line height 18 px ≈ 7 lines visible)
- User line: `> ` in `accent` + text in `text`.
- Op lines (from `Message.ops`): `● <label> ✓` with the dot + ✓ in `accent` for ok, `● <label> ✗` in `warm` for failed. Labels come from `assistant-store.ts` `label()`, e.g. `scale ×1.25 knob`, `set color = #0090ff drum-pad`, `environment space`.
- Assistant text: `muted`.
- Thinking: `● thinking…` in `faint`, opacity pulsing 0.4↔1 at 1 Hz (static under reduced motion).
- Max 40 messages rendered (older ones hidden; store keeps all).

### 7.3 Quick chips (12 px, h 28, `row` bg, tap = `send(text, viewer)`)
| Context | Chips |
|---|---|
| Nothing selected | "add a knob" · "add a drum pad" · "concert stage" · "what can I do?" |
| Item selected | "bigger" · "smaller" · "turn 45°" · "make it blue" · "move left" · "delete it" |
| After an edit | "undo" · plus the selected-item chips |

### 7.4 Push-to-talk (Decision: use `useAssistant.startTalking()` / `stopTalking(viewer)` so spoken commands land in the transcript; don't mount `voice.tsx`'s `XRVoiceButton` beside it)
| State (`useAssistant.status`) | Button | Pix | Haptic / sound |
|---|---|---|---|
| idle | `row` bg, `Mic` 20 + "Hold to talk" 14 | idle | — |
| listening (pointer down / A held) | `accent` bg, `onAccent` "Listening… let go to send", 2 px ring pulse 1 Hz | listening | 0.5 / 30 ms · `sfx.listen` |
| thinking (after release) | `row` bg, spinner + "Thinking…" (disabled) | thinking | — |
| done (last message has ≥ 1 ok op) | flash `accent` border 400 ms → idle | happy (1.2 s) | 0.3 / 20 ms · `sfx.done` |
| error (no ops, network, mic) | `warm` border 600 ms, the error text lands in the transcript | idle (head tilt) | 2 × (0.8 / 40 ms, 60 ms apart) · `sfx.error` |

- Down = `onPointerDown`, up = `onPointerUp` **and** `onPointerLeave` (as in `voice.tsx`), plus `setPointerCapture` so a drifting finger doesn't cancel.
- Releasing after < 350 ms → store note "Hold the button while you speak."
- **Timeouts:** auto-stop recording at **15 s** (Decision; the UI calls `stopTalking` with a toast "Stopped at 15 s"). STT 20 s and assist 25 s are server/client timeouts (existing) → error state.
- Viewer: `{ position: camera world pos, direction: camera world dir }` (same as `XRVoiceButton`), so "add" and "move left" are gaze-relative.

**Confirm / undo voice ops:** ops apply immediately. No confirm step, because the store gates values on the user's words. Under the latest assistant message with ok ops, show an **"Undo"** chip (h 24, 12 px). It calls `undo()` once per ok op, **only if** `past.length` is unchanged since the reply (else the chip is disabled: "changed since"). Requires Evan's `batch` to become one step (Q2).

### 7.5 Laptop Assistant (`assistant-panel.tsx`, as built)
Mount it in the right column (§10.1). Swap its `<VoiceButton/>` for a PTT button wired to `startTalking/stopTalking`, so speech shows in the log. Space-to-talk is allowed when the canvas has focus.

### 7.6 Pix mascot (`mascot.tsx`, procedural, no assets)
- **Body:** sphere Ø 8 cm, `meshStandardMaterial` `#EEF0F4`, roughness 0.4.
- **Visor:** a band 6 × 2.4 cm, `#0B0C10`, with two eye capsules (1 × 1.6 cm, `accent`, emissive-look basic material).
- **Antenna:** 2 cm stalk + 8 mm tip ball (tip colour = state colour).
- Faces the user (yaw billboard only). Clicking or poking Pix fires the "poked" state.

| State | Trigger | Animation (normal / reduced motion) | Tip colour |
|---|---|---|---|
| idle | `status === "idle"` | bob ±1 cm at 0.5 Hz, blink every 3–5 s (eyes scaleY 0.1 for 120 ms) / static, blink only | `faint` |
| listening | `status === "listening"` | leans 10° toward the user, eyes scale 1.2, tip pulses 1 Hz / no lean | `accent` |
| thinking | `status === "thinking"` | eyes look up-left, antenna spins 1 rev/s / eyes only | `#7DB4FF` |
| talking | new assistant message, 1.2 s | eyes squash at 6 Hz (as if speaking) / none | `accent` |
| happy | reply with all ops ok | hop 2 cm (spring stiffness 300, damping 15) + eyes ^ ^ 1.2 s / eyes only | `accent` |
| poked | tap on Pix | squash 0.8 / stretch 1.1 over 250 ms + `sfx.boop`, then the coach tip of the day in the transcript / no squash | `warm` |

Placement: §2.1. On the laptop, a 48 px SVG version renders into `#assistant-mascot` (no second WebGL canvas), with the same states as CSS classes.

**Acceptance (§7):**
- ☐ Hold → speak "add a knob" → release: the transcript shows `> add a knob`, `● add_component knob ✓`, "Done.", and Pix goes happy.
- ☐ With the mic denied: transcript error "Microphone blocked…" and the warm border.
- ☐ With Ollama stopped: pill "keyword mode" and commands still work.
- ☐ Undo chip reverts the whole command.
- ☐ Chips change with selection.
- ☐ Poking Pix reacts.
- ☐ Recording auto-stops at 15 s.

---

## 8. Modes

### 8.1 Design (Edit), the default
Grab bars, gizmo, outlines, panels full. `viewMode === "design"` and `ui.mode === "edit"`.

### 8.2 X-ray (`viewMode === "xray"`, `xray.tsx`, as built, with these visual changes)
| Element | Built | Spec change (Danny, visuals only) |
|---|---|---|
| Components | materials opacity × 0.35, depthWrite off | keep |
| Environment | hidden; background `#07080B` | keep |
| Item boxes | 1.5 px lines, `#9FE7D2` | keep. **Selected → 2.5 px `accent`** (replaces `#F2B48A`, so selection reads the same in every mode) |
| Frame bounds | dashed `#B794F6` | → dashed `muted` `#9AA0AD` (no off-token purple) |
| Labels | drei Text 2.5 cm, billboard, 4 cm above | keep (2.5 cm = 12.5 px; legible to 1.4 m) |
| Value cables | arc 12 cm up, `hsl(hue,80%,65%)`, name label | keep the hue-per-name. Add the current value after the name ("tempo = 120") |
| Grid | brighter lines | keep |
| Grab bars / gizmo | still shown | keep (you can edit in X-ray) |

### 8.3 Play (`ui.mode === "play"`)
- `LayoutRenderer editable={false}`. No outlines, no X-ray (entering Play sets `viewMode("design")`).
- Dock collapses to its header (220 × 28 px) with "Edit ›".
- Assistant collapses to the mode header + PTT (voice still edits; on success, offer the chip "Back to Edit").
- Laptop `P` toggles. The laptop canvas hides the code panel.

### 8.4 Grid and Snap
Toggles in the World tab and on keys `G` / `S`. The state is in the store (`showGrid`, `snap`). `scene.tsx` already passes `snap`.

### 8.5 Mode indicator (always visible)
- Dock header chip, 10 px mono, h 16, radius 6:
  - EDIT: `row` bg / `muted` text
  - PLAY: `accent` bg / `onAccent`
  - X-RAY: `#7DB4FF` 20% bg / `#7DB4FF` text
- The Assistant header segmented control shows the same.
- Laptop: the top bar shows the segmented control.

### 8.6 Launch / preview
- Laptop Launch (as built) saves and opens `/apps/<id>`; it's disabled with an empty scene.
- VR Launch = Save + Play (§6.5).

**Acceptance (§8):** ☐ X-ray shows outlines, frame bounds, labels and cables with values, and the selected item is mint. ☐ Exiting restores the materials exactly. ☐ Play hides every editor affordance and components stay operable. ☐ The mode chip is correct in all three modes on both panels and on the laptop.

---

## 9. Visual system for 3D UI

### 9.1 Colour tokens (`xr-theme.ts` = `globals.css`; add the bold ones)
| Token | Hex | Use |
|---|---|---|
| `bg` | #0B0C10 | sheet / segmented track, Pix visor |
| `panel` | #15171E | panel fill |
| `row` / `rowHover` / `rowActive` | #1B1E27 / #262A35 / #0F1116 | rows, buttons |
| `border` | #323745 | panel border 1.5 px |
| `text` / `muted` / `faint` | #EEF0F4 / #9AA0AD / #6B7180 | text tiers |
| `accent` / `onAccent` | #9FE7D2 / #06221B | **selection, primary action, active toggle, focus, listening.** Only where the user acts |
| **`warm`** (add) | #F2B48A | errors, destructive text, warnings (Decision: no red in chrome; matches `voice.tsx` WARN) |
| **`info`** (add) | #7DB4FF | X-ray chip, thinking |
| **`scrim`** (add) | #0B0C10 at 70% | sheets over the panel content |

Legacy hex to remove when touched: `#1FB54A`, `#ECE9DF`, `#1A1B18` (grab bar, `Missing`); `#B794F6` (xray); `voice.tsx` own palette (Evan's file, leave it).

### 9.2 Shape, depth, glass
- Radii (px@0.002): `sm 8` (rows, chips), `md 12` (buttons), `lg 20` (panels). Pills only for status dots and the PTT button.
- **Depth layers** (z offsets inside a panel, so poke hits the right layer):
  - panel 0
  - row content +1 px (2 mm)
  - pressed −2 px
  - sheets +6 px (12 mm) with `scrim`
  - toasts are their own root
- **No glass/blur** on chrome (cost and legibility). Panels are opaque `panel`. Backplates for components remain the component's business.

### 9.3 Type and icons
- Hanken Grotesk is not loaded in uikit; the default uikit font (Inter) is the **Decision** for today (font loading = risk). Sizes per §1.2: 10 / 12 / 14 / 18 / 24. Mono-style lines use the same font at 12 px with `letterSpacing 0.5` (no mono font in uikit today).
- Icons: `@react-three/uikit-lucide`, 16 (tabs), 18 (rows), 20 (action bar / Mic), stroke default, colour = text tier.

### 9.4 Motion (DESIGN.md: enter ease-out, exit ease-in, 150–400 ms)
| Event | Duration | Easing |
|---|---|---|
| Hover fill | 120 ms | ease-out |
| Press depth | 80 ms down, 120 ms up | ease-out |
| Tab switch content | 150 ms fade | ease-out |
| Sheet open / close | 200 ms (+6 px z, fade) / 150 ms | ease-out / ease-in |
| Panel collapse (Play) | 240 ms height | ease-in-out |
| Recentre glide | 300 ms | ease-out |
| Follow chase | exponential k = 4 s⁻¹ | — |
| Toast in / out | 180 ms / 150 ms, hold 2.5 s | ease-out / ease-in |
| Surface seat settle | 150 ms | ease-out |
| Pix hop | spring k = 300, c = 15 | — |
| Scene switch | 300 ms fade to `bg` | ease-in-out |

Reduced motion: all of these become ≤ 80 ms fades or instant. No bob, no spring.

### 9.5 Haptics (controllers) and sound
`haptics.ts`: `pulse(hand, amp, ms) = inputSource.gamepad?.hapticActuators?.[0]?.pulse?.(amp, ms)`, guarded with try/catch.

| Cue | Haptic amp / ms | Sound (`sfx.ts`, WebAudio oscillator; mute in World) |
|---|---|---|
| hover enter (ray) | 0.1 / 10 | — |
| press | 0.4 / 20 | 1.2 kHz sine, 25 ms, −24 dB |
| snap tick | 0.25 / 12 (≥ 40 ms apart) | 2 kHz, 10 ms, −30 dB |
| grab / release | 0.6 / 30 · 0.3 / 20 | — |
| add placed / surface seat | 0.4 / 20 | 880 Hz, 40 ms |
| PTT listen | 0.5 / 30 | 660→880 Hz sweep, 80 ms |
| voice done | 0.3 / 20 | 880 + 1320 Hz, 120 ms |
| error | 2 × 0.8 / 40 | 220 Hz, 150 ms, −20 dB |
| Pix boop | — | 520→780 Hz, 90 ms |

Hands have no haptics, so every cue also has its visual (§3.4, §4.3) and sound.

**Acceptance (§9):** ☐ `grep -n "#[0-9A-Fa-f]\{6\}"` in Danny's new and edited files shows hex only in `xr-theme.ts` and `mascot.tsx` geometry colours. ☐ Every listed motion has reduced-motion behaviour. ☐ Haptics fire on a real Quest controller and are silent with hands. ☐ Mute silences all sfx.

---

## 10. Laptop Studio mirror (`studio-app.tsx`)

### 10.1 Layout (Decision: mirror the VR panels: Dock left, Assistant right)
```
┌────────────────────────────────────────────────────────────────────────────────────┐ 56
│ Spatial  Studio [scene name]  [Edit|Play] ◎X  [env ▾]   status   [Enter AR][Enter VR] [Save] [Launch] │
├──────────────┬─────────────────────────────────────────────┬───────────────────────┤
│ DOCK  280    │                CANVAS (1fr)                 │ ASSISTANT  320        │
│ ↶ ↷ ⧉ ▢ 🗑   │   StudioScene (orbit camera, grid, gizmo)   │ (Pix) status          │
│ Lib Ins Lay W│   drop target highlight while dragging      │ transcript            │
│ <tab content>│                                             │ chips                 │
│              ├─────────────────────────────────────────────┤ [input][Send]         │
│              │ CODE  (collapsible, 220 / 32 when closed)   │ (◉ Hold to talk)      │
└──────────────┴─────────────────────────────────────────────┴───────────────────────┘
grid-cols: 280px 1fr 320px · rows: 56px 1fr (code panel inside the centre column)
```
- **Dock tabs** = the same four as VR (the same React state shape in `ui-store.ts`, so both show the same tab). Library keeps search + click-to-add + **drag onto the canvas**.
- Inspect = the existing inspector + Props + Frame sections (§6.3, laptop column), with **commit on blur**.
- Layers: rows h 28 css px, drag to reorder (HTML5 DnD → `reorder`), drop on a frame row → `setParent`, Shift-click additive, double-click rename.
- Code panel: collapsible, remembers its state, regenerates from `useStudio.getState().layout()` (multi-scene aware: pass the full layout, not `{name, items}` as today).
- Under 1100 px width: the Assistant collapses to a 48 px rail (Pix + mic); click to expand as an overlay.

### 10.2 Keyboard shortcuts (ignored while typing in input / textarea / select; ⌘ = Ctrl on non-Mac)
| Keys | Action | Store / where |
|---|---|---|
| ⌘Z / ⇧⌘Z (also ⌘Y) | undo / redo | `undo()` / `redo()`. Studio-app (new) |
| ⌘D | duplicate | `duplicate()` (preventDefault: bookmark) |
| ⌘C / ⌘V | copy / paste | `copy()` / `paste()` |
| ⌘G / ⇧⌘G | frame / ungroup | `groupIntoFrame()` / `ungroup(selectedId)` if it's a frame |
| Delete / Backspace | delete selection | `removeSelected()` (replaces `remove(selectedId)`) |
| Esc | exit sheet → exit Play → clear selection | `select(null)` |
| ← → ↑ ↓ (⇧ ×10) | nudge x/y 1 cm (10 cm) | `useGestureKeys()`: **mount it** (built, unmounted) |
| PgUp / PgDn | nudge z away / toward | same |
| `[` `]` | yaw ±15° | same |
| `−` `=` | scale ×0.9 / ×1.1 | same |
| Alt + wheel | scale | same |
| G / X / S / P | grid / X-ray / snap / Play | `toggleGrid`, `setViewMode`, `toggleSnap`, ui-store |
| 1 2 3 4 | Dock tab Library / Inspect / Layers / World | ui-store |
| `/` | focus the Assistant input | DOM |
| Space (hold, canvas focused) | push-to-talk | `startTalking/stopTalking` |
| ⇧ while dragging | bypass snap | renderer (built) |

### 10.3 Drag from the library onto the canvas
- `dragstart` on a Library row sets `application/x-spatial-component = name`. The canvas `dragover`:
  - raycast from the camera through the cursor against item contents (`contents` map) and the work plane (z = −1.2, facing +Z).
  - Draw a ghost (`drag-ghost.tsx`) at the hit.
  - If the hit is inside a frame → that frame's bound turns `accent` (drop target highlight).
- `drop` → `add(name, point)`; for a frame, `setParent(newId, frameId)` (2 undo steps until `batch`).
- **Decision:** Danny implements this simple raycast now (inside the Canvas via a `DropCatcher` component that reads the camera). Evan's "drop raycast + placement logic" (SPEC §42) replaces it later behind the same `onDrop(name, clientX, clientY)` call.

### 10.4 Parity table VR ↔ laptop
| Capability | VR | Laptop |
|---|---|---|
| Add | tile tap / drag-out ghost / voice | row click / drag onto the canvas / typed or spoken |
| Select / multi | tap / Multi chip / Layers checkbox | click / Shift-click |
| Move / scale / turn | grab, two hands, gizmo, steppers | bar drag, gizmo, keys, Alt-wheel, inspector |
| Undo / redo | action bar, B | ⌘Z / ⇧⌘Z |
| Frames | ▢, Inspect frame section, Layers ▲▼ | ⌘G, inspector, Layers drag |
| Props / wiring | §6.3 VR controls | §6.3 laptop controls |
| Modes | Assistant header + Dock chip | top bar + keys |
| Environment / scenes | World tab | top-bar env picker + World tab |
| Assistant | VR panel + Pix + A-button PTT | right column + Space PTT |
| Code | — (Decision: no code in VR) | code panel |
| Save / Launch | World tab: Save, Launch = Play | top bar: Save, Launch → `/apps/<id>` |

**Acceptance (§10):** ☐ Every shortcut in 10.2 works and none fires while typing. ☐ Drag from the Library drops at the cursor. Dropping on a frame parents with the highlight. ☐ The same tab is selected after entering and exiting XR. ☐ The code panel reflects multi-scene layouts. ☐ Under 1100 px the Assistant rail works.

---

## 11. Versatility: what people build

### 11.1 Patterns the UI must support
| Pattern | How in the Studio |
|---|---|
| **Multi-scene site, "the site is the environment"** | Each scene = a page with its own environment. Navigation = a door, tabs or a button whose `onPress` switches scene in generated code (codegen emits `scene` prop). The World tab scene list + 300 ms fade. Frames in `arc` = curved content walls |
| **3D DAW** (demo) | Concert stage env; mixer, drum pads, knob → two-hand stretch → wire knob.value + transport.bpm to "tempo" (Inspect controls) → Play |
| **Dashboard** | Frame `grid` (2–3 cols) of stat-card, gauge, bar-chart-3d; anchor the frame `head` for a follow-HUD or `world` for a wall |
| **Room customisation with hardware** | AR session (passthrough; environment hidden), place objects (lamp, tv, speaker, desk); surface seat onto `desk`; lamp `value` wired to a switch |
| **2D site / platform in space** | Frames `column` of settings / window / tabs components at 1–1.5 m; arc wall for galleries |

### 11.2 Anchors (`Item.anchor`, renderer support = Evan, TODO)
| Anchor | Behaviour (spec for Evan; Danny shows the control and caption) |
|---|---|
| `world` (default) | fixed in the room |
| `head` | lazy-follow with `follow.ts` parameters (60° / 0.35 m / k 4), keeping its initial offset from the head |
| `wrist` | child of the left-hand `XRSpace space="wrist"` (or the left controller grip), offset 4 cm above the back of the wrist, scale clamp ≤ 0.5. In Edit mode it is shown at its world pose with a "wrist" badge, so it stays editable |

### 11.3 Templates
Settings screen · Dashboard · Media app · 3D landing page · Music DAW (§5.3, Q4).

**Acceptance (§11):** ☐ The DAW, a 2-scene site and a grid dashboard can each be built with only the UI in this doc (VR or laptop). ☐ The anchor control is present and saved in the layout.

---

## 12. States and edge cases

| State | Detection | UI |
|---|---|---|
| Empty scene | `items.length === 0` | Library tab forced on session start. Ghost text in the work area at 1.2 m (24 px): "Tap a tile on your left, or hold the mic and say “add a knob”". Laptop Launch disabled (built) |
| Nothing selected | `!selectedId` | Inspect empty state (§6.3). Action bar Dup/Frame/Delete disabled |
| Ollama down | `GET /api/assist` → `ready:false` | Pill "keyword mode". Commands still work. No error toast |
| No ElevenLabs key | `GET /api/stt` → `ready:false` | VR: PTT shows "Voice off. Use chips" (disabled, 50%). Laptop: the browser speech fallback is handled by the store message |
| Mic denied | `NotAllowedError` | Transcript error + caption "Allow the mic on the 2D page first (press the mic once before Enter VR)" |
| Assist / STT timeout / 5xx | store error message | error state (§7.4) |
| Tracking lost mid-grab | pointer cancel | toast "Hand lost: move it back into view". The item stays where the handle last put it; one undo reverts it |
| Item lost behind the user / out of view | selected item > 50° from gaze for > 2 s | Dock shows a 14 px "◀ Knob is behind you · Bring here" row. A 6 cm `accent` chevron at the panel edge points to it |
| Too far | item centre > 4 m from the head | Inspect caption "4.6 m away" `warm` + **Bring here** |
| Too close | item within 0.25 m of the head | the item's materials fade to 30% (X-ray-style, restored on exit). No pointer events |
| Save failed | fetch error | toast "Save failed (502)" `warm`, retry button |
| Missing component (unknown name) | renderer `Missing` | keep the placeholder card (restyle with tokens). Inspect: "Not installed: <name>" |
| Too many items | > 60 items or > 200 draw calls (dev overlay) | toast "Heavy scene: 72 fps at risk" once |
| Session ended unexpectedly | `xrStore` session null | laptop UI resumes. Toast "Left VR · your scene is saved in the Studio" |

**Performance budget (Quest 3 / 3S, 72 Hz = 13.9 ms/frame):**
- ≤ 200 draw calls total; chrome ≤ 40.
- ≤ 4 uikit roots for chrome (Dock, Assistant, sheet, toast).
- ≤ 400 k triangles; Pix ≤ 2 k triangles.
- **No React setState per frame in chrome:** follow/mascot animate refs in `useFrame`; `xray.tsx` re-measures every 15 frames (existing).
- Lazy components only (`components.generated.ts`).
- Measure with `renderer.info.render.calls` in a dev-only overlay (`?perf`).

**Acceptance (§12):** ☐ Each row is reproduced once in the emulator (stop Ollama, remove the key, deny the mic, move an item 5 m away, turn around). ☐ A 30-item DAW scene holds ≥ 72 fps on the Quest (Meta perf HUD or `?perf`).

---

## 13. Architecture for Danny's build

### 13.1 Component tree (`scene.tsx`)
```
<Canvas events={noEvents}>
  <PointerEvents/>
  <XR store={xrStore}>
    <NotInXR><OrbitHandles/></NotInXR>
    {Env | background}  {lights}  {showGrid && <gridHelper/>}          // built
    <LayoutRenderer editable={ui.mode==="edit"} selectedId=… onSelect=… onTransform=… snap=…/>  // built; editable from ui-store
    {mode==="edit" && <SelectionOutline/>}                           // NEW: hover / selected / secondary / snap guides / seat glow
    {xray && <XRayOverlay/>}                                         // built
    <DropCatcher/>                                                   // NEW (laptop drag-drop raycast)
    <IfInSessionMode allow={["immersive-ar","immersive-vr"]}>
      <FollowAnchor>                                                 // NEW follow.ts provider (shared anchor)
        <VRWorkspace/>       // canonical Dock (merge vr-dock parts in)
        <VRAssistant/>       // NEW, contains <Mascot/>
        <Toast3D/>           // NEW
      </FollowAnchor>
      <ControllerShortcuts/> // NEW: A/B/X/Menu/stick (§3.3)
      <SummonGesture/>       // NEW: palm-up (§2.4)
      <DragGhost/>           // NEW: library drag-out
    </IfInSessionMode>
    {/* unmount: <VRShelf/>, any <VRDock/>, <XRVoiceButton/> */}
  </XR>
</Canvas>
```

### 13.2 State flow
```
 hand/controller/mouse ──► R3F pointer events ──► uikit onClick / Handle apply
                                                    │
 voice: useAssistant.startTalking/stopTalking ──► /api/stt ─► /api/assist ─► applyOps ┐
                                                    ▼                                  │
 Danny's UI ──► useStudio actions (add/update/select/bind/undo/…) ◄────────────────────┘
                    │ (zustand)                ui-store.ts (mode, tab, multi, pinned, seated, handed, reducedMotion, sound)
                    ▼                                    │
          items / selectedIds / viewMode / values ───────┴──► scene.tsx render ──► LayoutRenderer / XRay / panels
                    ▼
          layout() ──► codegen (code panel) · POST /api/layout (Save/Launch) · MCP get_layout
```
Rule: the UI only **reads** store state and **calls** actions. Nothing in Danny's files writes `useStudio.setState`.

### 13.3 New files (Danny)
| File | Exports | Notes |
|---|---|---|
| `components/studio/ui-store.ts` | `useStudioUI` (zustand): `mode`, `tab`, `multi`, `pinned:{dock,assistant}`, `seated`, `leftHanded`, `reducedMotion`, `sound`, setters | `localStorage` persist for settings (try/catch) |
| `components/studio/follow.ts` | `useFollowAnchor()`, `FollowAnchor`, `recentre()`, `PanelMount({bearing,dist,drop,tilt,pinKey})` | §2.4 algorithm |
| `components/studio/vr-assistant.tsx` | `VRAssistant` | §7 |
| `components/studio/mascot.tsx` | `Mascot` (3D), `MascotSvg` (laptop) | §7.6 |
| `components/studio/selection-outline.tsx` | `SelectionOutline` | reads `contents`, `selectedIds` |
| `components/studio/drag-ghost.tsx` | `DragGhost`, `DropCatcher` | §5.1, §10.3 |
| `components/studio/haptics.ts`, `sfx.ts` | `pulse()`, `sfx.*` | §9.5 |
| `components/studio/toast-3d.tsx` | `Toast3D`, `toast(text, tone?)` | tiny zustand queue |
| `components/studio/controller-shortcuts.tsx` | `ControllerShortcuts`, `SummonGesture` | §3.3, §2.4 |

### 13.4 Status
| Item | Status | Where |
|---|---|---|
| Store v2 actions (undo, multi, frames, scenes, env, modes) | ✅ | `lib/studio-store.ts` |
| Grab bar, grab-anywhere, two-hand scale/yaw, gizmo, snap, surface seat | ✅ | `layout-renderer.tsx`, `lib/snap.ts` |
| Renderer gets onTransform + snap from the store | ✅ | `scene.tsx` |
| Environments render, hidden in AR/X-ray | ✅ | `scene.tsx`, `env-*.tsx` |
| X-ray overlay | ✅ (colour tweaks ⬜) | `xray.tsx` |
| Laptop keys hook | 🟡 built, **not mounted** | `use-gesture-keys.ts` |
| Laptop ⌘ shortcuts (undo/dup/copy/group) | ⬜ | `studio-app.tsx` (only Delete/Esc today) |
| Laptop Dock tabs (Layers / World), Props / Frame inspector | ⬜ | `studio-app.tsx` |
| Laptop Assistant mounted | 🟡 built, not mounted | `assistant-panel.tsx` |
| Voice pipeline + store PTT | ✅ | `assistant-store.ts`, `/api/stt`, `/api/assist` |
| VR Dock (canonical) | 🟡 toolbar / inspector / layers built; no follow, tabs, library, props, world | `vr-workspace.tsx` |
| VR Dock parts (follow, tabs, Library, PropControl, World) | 🟡 parts source | `vr-dock.tsx` |
| VR shelf | ✅ → retire | `vr-shelf.tsx` |
| VR Assistant + PTT + chips | ⬜ | new `vr-assistant.tsx` |
| Pix mascot | ⬜ | new `mascot.tsx` |
| Play mode | ⬜ | `ui-store.ts` + `scene.tsx` editable |
| Selection outlines / multi-select visuals / snap guides | ⬜ | new `selection-outline.tsx` |
| Drag-out ghost (VR) / drag-drop (laptop) | ⬜ | new `drag-ghost.tsx` |
| Haptics / sfx / toasts | ⬜ | new |
| Summon / controller shortcuts | ⬜ | new |
| Anchor head/wrist rendering | ⬜ **Evan** | `layout-renderer.tsx` |
| Lock enforcement | ⬜ **Evan** | `layout-renderer.tsx` |
| Templates data | ⬜ **Evan** | — |

### 13.5 Integration points needing Evan (log each in LOG.md; fallback in brackets)
1. **Environment id mismatch:** `assist-ops.ts ENVIRONMENTS` produces `space|forest|loft|stage|gallery|room`, but the renderer expects registry names `env-space` etc. Voice "concert stage" sets `environment="stage"` → renders nothing. Ask: map to `env-*`, and treat `room` as null + AR. [Danny: none; demo-critical]
2. `batch(fn)` / `transaction`: one checkpoint for N actions (voice commands, drop-into-frame, multi nudge). [count-based undo chip]
3. `updateMany(patches: {id, patch}[])`: one undo step. [loop `update`]
4. `LayoutRenderer`: honour `item.locked` (no Handle/gizmo); accept `selectedIds` (outline-only); a flag to hide the gizmo during two-hand grabs. [hide the gizmo by passing `selectedId=null` for locked items]
5. Anchor rendering for `head` / `wrist` (§11.2). [caption "previews in Play"]
6. `useGestureKeys` acting on all `selectedIds`. [primary only]
7. Assist ops for `rename` (item / scene) and `select` by name for the Bind sheet dictation. [laptop rename only]
8. `Layout.environmentProps` (intensity / tint) (Q3). [hide env props]
9. Template layouts list (Q4). [hide the section]
10. Optional: expose `source: "ollama"|"keywords"` on each assistant message. [GET /api/assist poll]

---

## 14. Build order for Danny (now → 5:15 PM; demo-critical first)

Test rig:
- **Laptop:** `cd web && npm run dev` → `http://localhost:3000/studio`. IWER emulator auto-injects (Option+Cmd+E elsewhere). Switch hands/controllers in the emulator panel.
- **Quest:** `cloudflared tunnel --url http://localhost:3000` → open `https://<random>.trycloudflare.com/studio` in the Quest browser. Press the mic once on the 2D page, then Enter VR/AR. A font error after a pull → `rm -rf web/.next` and restart.

| # | Time | Milestone | Acceptance checklist |
|---|---|---|---|
| **M0** | 2:15–2:35 | **Laptop wiring quick wins:** mount `useGestureKeys()`; add the ⌘Z/⇧⌘Z/⌘D/⌘C/⌘V/⌘G/⇧⌘G/Delete→`removeSelected` shortcuts; inspector commit-on-blur; mount `AssistantPanel` in a right column; code panel uses the full `layout()`; grab-bar colours → tokens (log it) | ☐ arrows / `[` `]` / `−` `=` work ☐ ⌘Z after a drag reverts it in one step ☐ typing "0.5" in X makes 1 undo step ☐ "add a knob" typed in the Assistant adds a knob with a ✓ line |
| **M1** | 2:35–3:20 | **VR Dock v1 (canonical):** `ui-store.ts` + `follow.ts` (from vr-dock); move `vr-workspace` into a followed 220×300 px panel with header, action bar, 4 tabs; merge Library (tiles, tap-add) + World (environments, Save, Launch=Play, toggles) from `vr-dock.tsx`; remove the top toolbar; unmount `VRShelf` / `VRDock` | Emulator: ☐ dock at +32°/−17°/0.61 m ☐ follow thresholds per §2 ☐ tap Knob tile → knob 0.6 m out facing me ☐ env tile → concert stage ☐ undo/redo/dup/delete disabled states ☐ pin works |
| **M2** | 3:20–3:50 | **Inspect v2 + Layers:** PropSpec controls (color/number/bool/enum/string), Controls wiring sheet, frame section, Bring here, multi-select checkbox + Multi chip | ☐ lamp colour swatch changes it live ☐ knob + transport → "tempo" sync ☐ frame Row→Grid live ☐ Layers checkbox selects 3 ☐ Bring here works |
| **M3** | 3:50–4:15 | **VR Assistant + PTT + Pix (basic):** `vr-assistant.tsx` with mode header (Edit/Play/X-ray), transcript, chips, PTT via `startTalking/stopTalking`, A-button PTT; `mascot.tsx` idle/listening/thinking/happy; Play mode toggles `editable` | ☐ hold-speak-release in the emulator (laptop mic) produces op lines ☐ Pix changes state ☐ Play hides bars/gizmo; knob still turns ☐ mode chip correct |
| **M4** | 4:15–4:45 | **Real Quest round** (venue headset). Fix the top 5 issues only | On the Quest via the tunnel: ☐ panels legible at 14 px ☐ poke a tile, pinch-ray a tile ☐ two-hand stretch the mixer persists ☐ "make the pads glow blue and add a tempo display" works (needs §13.5 #1 for env voice) ☐ ≥ 72 fps with the DAW scene ☐ haptics on controllers |
| **M5** | 4:45–5:05 | **Feel pass:** selection outlines + snap tick haptics/sfx + toasts + empty states + reduced motion + left-handed | ☐ §3.4 outlines ☐ tick felt at 2.5 cm ☐ empty-scene hint ☐ left-handed mirror ☐ reduced motion: no glide |
| **M6** | 5:05–5:15 | **Demo rehearsal path, ×2:** concert stage → mixer, drum pads, knob from the Dock → two-hand stretch → voice → Launch (Play) → play. Then the laptop: code panel + Launch `/apps/<id>` | ☐ full path < 3 min, no console errors ☐ LOG.md entry with what shipped and the known gaps |

**Cut order if late** (last first): drag-out ghost (tap-add stays) → summon gesture (Menu button + World Recentre stay) → sfx → Pix laptop SVG → Layers ⋯ sheet → laptop library drag-drop → tilt row.

---

## 15. Open questions (each has a default, so don't block on them)

| # | Question | Default if no answer by M1 |
|---|---|---|
| Q1 | Environment ids: `env-*` everywhere? (§13.5 #1) | Danny's UI uses `env-*`. Ask Evan to map voice ids to them |
| Q2 | Will `batch()` land today? | Count-based Undo chip (§7.4) |
| Q3 | Environment props in the layout? | Hide intensity/tint controls |
| Q4 | Where do templates live (`web/registry/templates/*.json`?) | Hide "Start from" |
| Q5 | Rename by voice (item / scene)? | Laptop-only rename |
| Q6 | Should Play mode be `viewMode: "play"` in the store (so voice and MCP can see it)? | UI-local `ui-store.mode` |
| Q7 | Hanken Grotesk in uikit (font JSON generation)? | uikit default font today |
| Q8 | Does the venue Quest run hand tracking well enough under the lighting for poke? | Ray + pinch works on every panel; controllers as backup |
| Q9 | Real live thumbnails in the Library? | No: icon tiles (perf) |
