# XR interaction (Quest 3 / 3S browser)

Config: `xr-store.ts`. Top-bar buttons: `xr-controls.tsx` (`EnterXRButtons`). In-headset add menu: `vr-shelf.tsx` (`VRShelf`, inside `<XR>`).

## Gestures

Every input reaches components as ordinary R3F pointer events. Each hand or controller has several pointers, and the nearest one wins.

| Input | Gesture | Result |
|---|---|---|
| Hand, near | **Poke**: fingertip touches a surface | `onPointerDown` → `onPointerUp` → `onClick`. Press buttons, drag sliders. |
| Hand, far | **Ray + pinch**: aim the ray from your palm, then pinch thumb and index | Clicks things out of reach. Hold the pinch and move to drag. |
| Hand, near | **Grab**: put your index fingertip on a component's grab bar, pinch, move, release | Moves the placed component. A fist does nothing. |
| Controller | **Trigger** | Ray click (same as a pinch) |
| Controller | **Grip** (squeeze) with the controller at the bar | Grab and move |
| Both | Hover | The ray and cursor show automatically; `onPointerOver/Out` fire on hover. |

Teleport is off. In a session, the **shelf** floats to your left at arm's reach. Tap a row to drop that component about 60 cm in front of you, beside the shelf and facing you. Move it with its grab bar.

## Interaction contract for components (`components/spatial/*`)

- Use R3F pointer events only: `onClick`, `onPointerDown/Up`, `onPointerOver/Out`, `onPointerMove`. Never DOM events.
- Buttons act on `onClick`. A click only fires when down and up land on the same object within 300 ms.
- Hold or press-depth effects use `onPointerDown`/`onPointerUp`. For drags, call `(e.target as Object3D).setPointerCapture(e.pointerId)` in down (three's `Object3D` gets this from `@pmndrs/pointer-events`), so the drag survives the finger or ray leaving the object.
- Don't `stopPropagation`: the Studio uses the bubbling click to select items.
- Hit targets must be at least 2 cm, which is at least 10 uikit px at `pixelSize 0.002`. Aim for 40 px or more for fingertips.

## Testing

**Laptop (localhost).** Run `npm run dev` and open `http://localhost:3000`. On localhost without WebXR, the store injects an emulated Quest 3 (IWER). Enter AR and Enter VR then become enabled. The emulator panel can switch between controllers and hands, move and rotate each one, and pinch, trigger or squeeze. Press Option+Cmd+E to force the emulator on any other host.

**Real Quest.** WebXR needs HTTPS. Run `cloudflared tunnel --url http://localhost:3000`, open the `https://….trycloudflare.com` URL in the Quest browser and press Enter AR. Use the Meta button to leave the session.
