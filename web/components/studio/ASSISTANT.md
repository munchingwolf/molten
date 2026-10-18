# Assistant panel (laptop + headset)

A Claude-Code-style side panel. You type or say a request and it shows the conversation, with one line per edit it made (`● scale ×1.25 knob ✓`). Everything runs locally on Ollama, with no paid API.

| File | What it is |
|---|---|
| `lib/assistant-store.ts` | `useAssistant` (zustand): `messages [{role, text, ops?: [{label, ok}], at}]`, `status: "idle" \| "listening" \| "thinking"`, `send(text, viewer?)`, `startTalking()`, `stopTalking(viewer?)` |
| `app/api/ask/route.ts` | `POST {text}` → `{answer, source: "ollama" \| "faq"}`. It sends Ollama the "Spatial help" knowledge pack (`HELP`) and gets back at most 3 sentences of plain text. If Ollama is down, a keyword FAQ answers instead. |
| `components/studio/assistant-panel.tsx` | `AssistantPanel()`: terminal-look laptop panel. It fills its parent. |
| `components/studio/vr-assistant.tsx` | `VRAssistant({ mascot? })`: uikit panel shown only in an XR session. Also exports `MASCOT_OFFSET`. |

## How `send(text)` routes

1. `undo` / `redo` call the store actions directly. The op grammar deliberately ignores "undo".
1b. With a guided template open, `lib/slot-commands.ts` checks for a slot command first ("add the drums", "set up the rig", "next", "fill the rest") and calls `placeSlot` for each slot, the same path as dragging onto a slot (snapped, wired). Phrases come from each template slot's `say` list (a phrase on several slots = a group), then the slot's name/hint and its component's names. No model is involved; edits and "next scene" fall through.
2. A question goes to `POST /api/ask`. It counts as a question when it starts with how / what / why / can I / is there / help…, or ends in `?` (but "could you add a knob?" is an edit).
3. Anything else goes to `POST /api/assist` (H's route: the local model classifies, `assist-ops` gates every value on the user's words). If that route fails, the same `extractOps` keyword grammar runs in the browser. Ops are applied **one at a time** with `applyOps([op], useStudio.getState, viewer)`, so each op gets its own ✓/✗ line.
4. If no op survives gating, the text is answered as a question instead of guessing.

## Mounting

```tsx
// components/studio/scene.tsx, inside <XR>, next to <VRShelf />
import { VRAssistant } from "./vr-assistant"
<VRAssistant />            // later: <VRAssistant mascot={<Mascot />} />

// app/studio/studio-app.tsx, e.g. floating over the right of the 3D view, inside <main className="relative …">
import { AssistantPanel } from "@/components/studio/assistant-panel"
<div className="absolute right-3 top-3 bottom-3 w-[340px] overflow-hidden rounded-lg border border-border-2">
  <AssistantPanel />
</div>
```

The VR panel has its own push-to-talk, so you don't need `XRVoiceButton` in the scene as well. The two would sit in the same spot on your right.

## VR panel

- The panel is 220 × 280 px at `pixelSize 0.002`, which is 44 × 56 cm. The asked-for 32 × 40 cm can't hold 14 px text plus three 44 px control rows.
- It sits 0.7 m away, 35° right of gaze and 15 cm below eye height, facing you. It follows lazily: you can turn to look at it, and it slides back (around your head, not through it) only once it is more than 70° to your right, more than 25° to your left, or you've walked away.
- Controls: a "What can I do?" chip in the header, a log of the last 6 messages that sticks to the newest line, Undo / Bigger / Smaller chips, and hold-to-talk (poke and hold, or ray + hold a pinch/trigger). Only the pointer that pressed can release it.
- Edits use your head pose, rotated back 35°, so a new item lands in front of you and not on top of the panel.
- **uikit's bundled Inter font is ASCII-only (plus °)**, so `●` `✓` `✗` `×` `→` `…` and curly quotes don't render. The panel converts its text with `ascii()` and draws status as coloured dots. `voice.tsx`'s XR button shows `“…”` and `…`, which will render blank.
- Mascot: `MASCOT_OFFSET` (panel space) is just above the top-left corner. Pass `mascot` and it is rendered in a `group name="mascotAnchor"` that follows with the panel.

## Known gap: laptop voice isn't in the log

The laptop panel renders H's `<VoiceButton/>`, which runs its own pipeline. Spoken commands are applied, but they don't show up as conversation lines. To fix this, change `run(text)` in `voice.tsx` to `await useAssistant.getState().send(text, viewer?.())`. That one call applies the ops and logs them.
