# Voice editing

Hold the mic button, say what you want, let go. The scene changes.

```
hold → MediaRecorder (webm/opus) → POST /api/stt   → ElevenLabs Scribe → { text }
     → POST /api/assist { text, layout, selectedId, registry }
          → Ollama (qwen2.5:7b, JSON mode, 15 s deadline) classifies the intent
          → lib/assist-ops.ts keeps only what your own words support, and picks every value
     → applyOps(ops, useStudio.getState, viewer?) → store actions
```

## Run it

1. `ollama serve` (models already pulled: `qwen2.5:7b`, `hermes3:8b`). Pick one with `OLLAMA_MODEL=hermes3:8b`; point elsewhere with `OLLAMA_URL`.
2. Put `ELEVENLABS_API_KEY=...` in `web/.env.local`. Optional: `ELEVENLABS_STT_MODEL` (default `scribe_v2`).
3. Without the key, the button uses the browser's Web Speech API instead (Chrome/Edge desktop only, not the Quest browser). Without Ollama, a keyword grammar produces the same ops (`source: "keywords"`).
4. On a Quest: press the top-bar button once on the 2D page to grant the mic, then enter XR. The page needs HTTPS (it already does for WebXR).

Opening the Studio warms the model (`GET /api/assist`). Cold load is about 10 s; after that a command takes 1.3 to 3.7 s on an M4.

## Mounting (lead)

```tsx
import { VoiceButton, XRVoiceButton } from "@/components/studio/voice"
<VoiceButton />      // top bar, beside <EnterXRButtons />
<XRVoiceButton />    // inside <XR> in scene.tsx, beside <VRShelf />; XR sessions only, on your right
```

`applyOps` calls `setEnvironment(id)` only if the store has it. The ids are `space | forest | loft | stage | gallery | room`; edit `ENVIRONMENTS` in `lib/assist-ops.ts` if yours differ.

## Things to say

| Say | Does |
|---|---|
| "make it bigger" / "smaller" / "twice as big" / "50% bigger" | scale ×1.25 / ×0.8 / ×2 / ×1.5 |
| "turn it 45 degrees" / "rotate the knob 90 clockwise" / "turn it around" | yaw +45° / −90° / 180° (default 15°) |
| "move it left" / "bring it 30 cm closer" / "move it up half a meter" | 10 cm default; left/right/up/down/closer/farther |
| "add a drum pad" / "add a piano" | adds the ready component (in XR: in front of you, facing you) |
| "add a drum pad and make it bigger" | "it" means the item you just added |
| "make the lamp blue" / "turn on the lamp" / "set the text to Hello" | `props` from the registry's `props` metadata |
| "make it glass" / "make it a slider" | swaps to a same-category entry |
| "switch to the space environment" / "take me to the forest" | `setEnvironment("space")` |
| "delete it" / "select the knob" | remove / select |

## Gating (why the 8B model can't break the scene)

The model only names op kinds. Code keeps an op only when your words support it, and takes every value from your words:
- **Components**: a name, alias or unique word ("piano") must be in the sentence. "Soon" entries count as names but are never added.
- **Target**: a component you named that is in the layout, else the selection ("it", "this", or no name at all). If you name something that isn't in the scene ("the lamp" with no lamp), the op is dropped. It does not fall through to the selection.
- **Colours**: the last colour word you said, mapped to a fixed hex. If the model says red and you said blue, you get blue.
- **Numbers**: only numbers you said ("forty five" counts). Otherwise the defaults above.
- **Move**: needs a move verb and a direction word.
- "don't", "cancel", "never mind" and "undo" produce no ops.

If the model's ops all fail the gate, the keyword grammar runs on its own, so a model miss isn't silent.

## Limits

- Colour changes write `props.color` (or the entry's first `color` prop). The component has to read that prop for the change to show.
- Rotation is yaw only. Move axes follow your gaze in XR and the world axes on the laptop.
- One add per sentence. Nothing for undo, duplicate, or "the second knob" (it picks the selected one, else the newest).
- Web Speech fallback sends audio to Google and isn't available on Quest. In the headset you need the ElevenLabs key.
- Tests: `node --test web/lib/assist-ops.test.ts`.
