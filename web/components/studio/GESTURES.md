# Editing gestures (Studio)

Code: `layout-renderer.tsx` (grab, two-hand, gizmo, snapping), `use-gesture-keys.ts` (laptop keys), `lib/snap.ts` (snap math, tested in `snap.test.ts`). The basic pointer gestures (poke, ray + pinch, grab) are covered in `XR-INTERACTION.md`.

## Move, scale, turn

| Input | Gesture | Result |
|---|---|---|
| Mouse | Drag the **bar** under a component | Move |
| Hand / controller | Ray + pinch (trigger) on the bar, or poke and drag the bar | Move |
| Hand | **Pinch near the component** (anywhere on it, or on the bar) and move | Move. Poke and ray still press the component's own buttons. |
| Controller | **Grip** with the controller on the component or bar | Move |
| Two hands / two controllers | Grab the same component with both, then pull apart or push together | **Uniform scale** (0.2× to 5×) |
| Two hands / two controllers | Grab with both, then swing one hand forward and the other back (like turning a steering wheel lying flat) | **Turn** around the vertical axis (yaw). Also moves with the midpoint of your hands. |
| Any | Let go of one hand | Keeps going as a one-hand move |

## Gizmo (selected item only)

Click, tap or grab a component to select it. A gizmo appears at its origin. Escape deselects.

| Part | Drag it to |
|---|---|
| Red / green / blue **arrows** | Move along x / y / z |
| Small **squares** | Move in that plane |
| Red / green / blue **quarter rings** | Pitch / yaw / roll |
| **Balls** (the white one on the diagonal, or a coloured one past each arrow tip) | Uniform scale. Every ball scales the whole item evenly. |

## Snapping (on by default)

- Moves snap to a 2.5 cm grid, turns to 15° steps, and scale to 0.05 steps.
- Hold **Shift** while dragging with the mouse to place freely. To turn snapping off everywhere, pass `snap={false}` to `LayoutRenderer`.
- **Surfaces.** Drop a component with its bottom up to 8 cm above (or 2 cm into) the top of a `desk`, `stage`, `table` or any registry entry tagged `surface`, with its centre over that top. It lands exactly on the surface.

## Laptop keys (selected item, not while typing in an input)

| Key | Result |
|---|---|
| ← → | Nudge x by 1 cm (Shift: 10 cm) |
| ↑ ↓ | Nudge y by 1 cm (Shift: 10 cm) |
| PageUp / PageDown | Nudge z away / toward you by 1 cm (Shift: 10 cm) |
| `[` / `]` | Turn left / right by 15° |
| `-` / `=` | Scale ×0.9 / ×1.1 |
| Alt + mouse wheel over the 3D view | Scale (the camera doesn't zoom) |
| Escape | Deselect (hides the gizmo) |
| Delete / Backspace | Remove the item |
