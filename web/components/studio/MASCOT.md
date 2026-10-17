# Mascot: Pix

A pocket-sized voxel critter that sits by the assistant panel in the headset and on the laptop. It's a mint gumdrop with cat-ish ears, a warm bulb antenna, stubby arms and hovering warm feet. It's our own character: the silhouette is tall and rounded, not a wide block on legs, and it uses the night-studio mint + warm palette.

## Name ideas

1. **Pix** (default): short, says "pixel", easy to say to a voice assistant.
2. **Mochi**: soft, round and friendly, which fits the gumdrop shape.
3. **Blip**: a small signal on the radar, sounds like a tiny helper.

## Files

| File | What it is |
|---|---|
| `components/spatial/mascot.tsx` | 3D Pix, default export `Mascot({ mood?, color?, size?, onPress? })`. About 13.5 cm tall at `size` 1, with the origin at its visual centre. It has 303 voxels in one `InstancedMesh` and one `meshStandardMaterial`, patched so each voxel can glow in its own colour. No shadows. Copy-pasteable: it imports only react, three and r3f. |
| `components/studio/mascot-2d.tsx` | `Mascot2D({ mood?, size? })`: the same character as 16×16 pixel-art SVG, animated with CSS keyframes. `prefers-reduced-motion` stops all animation and shows the still pose. Also exports `useAssistantMood()`. |
| `registry/incoming/P.json` | Registry entry `mascot` (interactive / object), with props `mood`, `color` and `size`. |

## States (`mood`)

| Mood | 3D | 2D |
|---|---|---|
| `idle` | Gentle hover bob, blinks every 2 to 5 s, glances around, turns its whole body to face the camera (slerped). | Bob and blink. |
| `listening` | Ears perk up and stretch, eyes widen, the bulb and body glow brighter, and a pulsing ring of voxels appears underneath. | Ears stretch, eyes widen, a pixel ring pulses under the feet. |
| `thinking` | Three voxel dots orbit its head, eyes look up, the head tilts with curiosity, the bulb pulses, and the mouth goes small ("hmm"). | Pupils look up, three dots pulse next to the antenna. |
| `talking` | Squash-and-stretch in rhythm, mouth opens and closes, arms gesture. | Mouth chatters, body squashes. |
| `happy` | Hops with stretch and squash, throws 6 confetti cubes, waves its arms, and smiles with closed eyes. | Hops, `^ ^` eyes, 6 confetti pixels. |
| poke (3D) | `onPointerDown` (poke, pinch, ray or click) makes it giggle: a wiggle, squinted eyes, flicked ears and a wobbling antenna. It then calls `onPress`. A generous invisible hit box makes it easy to poke with Quest hands. | Hovering it with the mouse wiggles it. |

All the 3D channels (ears, eyes, glow, ring, dots, talk) blend smoothly, so changing mood never snaps. With `prefers-reduced-motion`, the 3D version drops the bob, hop, confetti, wiggle and squash, but keeps the expressions.

## Mounting

The store's `status` only covers `idle | listening | thinking`. `useAssistantMood()` adds `happy` for 2.5 s after a reply whose edits all succeeded, and `talking` while a reply is fresh.

```tsx
// Laptop: AssistantPanel's slot (<div id="assistant-mascot" />)
import { Mascot2D, useAssistantMood } from "./mascot-2d"
const mood = useAssistantMood()
<Mascot2D mood={mood} size={32} />

// VR: inside the component that renders <VRAssistant />. It lands on the mascotAnchor at MASCOT_OFFSET (panel space).
import Mascot from "@/components/spatial/mascot"
import { useAssistantMood } from "./mascot-2d"
const mood = useAssistantMood()
<VRAssistant mascot={<Mascot mood={mood} onPress={() => useAssistant.getState().send("help")} />} />
```

`onPress` is optional. The example asks "help" when poked. Leave it out if you only want the giggle.
