# Demo run-sheet: the Night Set

The target is the Spatial VR Editor mockup: https://claude.ai/artifact/LGfThjydyHGLEVhFp6FuNk. We build it by hand in the headset from guided slots, then play it.

**One sentence:** Grab parts out of the air, drop them into the glowing slots, they wire themselves, hit Play, and you're making music.

## Before you start (5 min before recording or judging)

1. On the laptop, `cd web && npm run dev`, then open `/studio`, `/apps/<id>` and `/components/drum-pads` once each, so the routes aren't cold (an `/apps/<id>` took 11.6 s cold).
2. For the Quest: run `cloudflared tunnel --url http://localhost:3000` and open the https URL in the Quest browser.
3. Clear the scene. The environment can be left empty, because the template sets the concert stage.
4. Turn the Quest volume up. Mute the laptop, or it echoes.

## Video (under 60 s, no slides, filmed through the Quest plus a phone on the hands)

| Time | On screen | Body input | Proves |
|---|---|---|---|
| 0:00–0:05 | Headset view. Pinch **Templates**, then **Night Set**, then **Build with guide**. Glowing slots appear on the desk and on the arc wall. | Pinch | It clicks fast |
| 0:05–0:25 | Pull the **mixing console**, **synth keys** and **drum pads** from the library and drop each near its slot; it snaps in. Then tap the three lane slots to place them. The counter climbs "4/7… 7/7". | Grab, poke | A new way to create |
| 0:25–0:30 | X-ray: cables show tempo knob to tempo lane, pads to drums lane, keys to keys lane, all wired by the slots. | Pinch | It's real software |
| 0:30–0:50 | **Play.** The drums lane loops. Finger-drum on the pads (the hits record into the lane), play a chord on the keys (it records into the keys lane), turn the TEMPO knob (BPM changes, the beat speeds up), pull the DRUMS fader down. | Poke, both hands | It works in space; made with the body |
| 0:50–0:58 | Say "make the pads glow blue" (voice; check it works first). Then cut to the laptop: Claude Code with the Spatial MCP pulls this layout into a fresh project (`get_layout`, then `add_component`). | Voice | Worth making with again |

## At the judging table

1. Hand them the headset with the Night Set guide already started and 2 slots filled. They place the rest, press Play and drum.
2. If anything stalls, tap **Place next** on the guide panel, which fills the next slot for them.
3. Say what's stubbed before they ask (list below).

## What works and what's stubbed (for the submission form; keep it honest)

- **Works:**
  - Studio on the laptop and in Quest (WebXR) with grab, poke, pinch, two-hand scale, voice and a VR dock and assistant.
  - Guided templates with snap-to-slot and auto-wiring.
  - Patch-cable wiring of shared values.
  - Play mode, and Launch to `/apps/<id>`, which is saved to disk so links survive restarts.
  - About 200 copy-paste components.
  - An MCP server, verified end to end with headless Claude Code: it rebuilt a saved layout in a fresh Next.js project that type-checks, in 58 s.
- **Stubbed or not built:**
  - Marketplace uploads, payments and creator payouts (the price badges are display only).
  - Multi-user editing.
  - Exporting a layout back to Blender (GLB import works, export doesn't).
  - Kaedim integration (GLB import is the path for real objects).
  - Measured Quest FPS.
  - The code panel is generated deterministically from the layout; no LLM writes it at runtime.
- **Reused (credit it):** pmndrs uikit, React Three Fiber, @react-three/xr and handle, drei, Tone.js, Poly Haven HDRIs (CC0), and the Salamander piano samples (CC-BY). See SOURCES.md.
