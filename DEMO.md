# Demo run-sheet: the Night Set

The target is the Spatial VR Editor mockup: https://claude.ai/artifact/LGfThjydyHGLEVhFp6FuNk. We build it by hand in the headset from guided slots, then play it.

**One sentence:** Grab parts out of the air, drop them into the glowing slots, they wire themselves, hit Play, and you're making music.

## Before you start (5 min before recording or judging)

1. On the laptop, `cd web && npm run dev`, then open `/studio`, `/apps/<id>` and `/components/drum-pads` once each, so the routes aren't cold (an `/apps/<id>` took 11.6 s cold).
2. For the Quest: run `cloudflared tunnel --url http://localhost:3000` and open the https URL in the Quest browser.
3. Clear the scene. The environment can be left empty, because the template sets the concert stage.
4. Turn the Quest volume up. Mute the laptop, or it echoes.

## Stream the headset to the laptop or TV (scrcpy, not Meta casting)

[scrcpy](https://github.com/Genymobile/scrcpy) mirrors the Quest over USB through adb, so there's no Wi-Fi lag and nothing goes through Meta's servers.

1. One-time setup: `brew install scrcpy && brew install --cask android-platform-tools`. Developer Mode must be on for the Quest (Meta Horizon phone app → headset settings).
2. Plug the Quest into the laptop with a USB-C data cable. In the headset, allow USB debugging and tick "Always allow". `adb devices` should list it.
3. Run:
   ```sh
   scrcpy --crop=5496:8000:0:0 --no-control --max-fps=60 -b 8M -m2560 --record=$HOME/Desktop/quest-demo.mp4
   ```
   - `--crop` shows the left eye only. The Quest 3S crops in its 10992×8000 virtual-display coordinates, so a crop based on the 3664×1920 panel looks badly zoomed in.
   - `--no-control` stops laptop clicks from reaching the headset.
   - `--record` saves a backup clip; closing the window finishes the file.
4. TV: there's no direct cable, because the Quest's USB-C port doesn't output video. Plug the laptop into the TV with HDMI and make the scrcpy window fullscreen (`Cmd+F`).
5. Components at the edge of the view look warped by the lens. Bring what you're showing to the centre of your view.

## Video (under 60 s, no slides, filmed through the Quest plus a phone on the hands)

| Time | On screen | Body input | Proves |
|---|---|---|---|
| 0:00–0:05 | Headset view. Pinch **Templates**, then **Night Set**, then **Build with guide**. Glowing slots appear on the desk and on the arc wall. | Pinch | It clicks fast |
| 0:05–0:25 | Pull the **mixing console** and **synth keys** from the library and drop each near its slot; it snaps in. Then say **"Stark, add the drums"** (the pads drop into their slot, wired to drums) and **"Stark, build the track wall"** (the wall and its three lanes). The counter climbs to "8 of 8". | Grab, voice | A new way to create: your hands and the agent fill the same template |
| 0:25–0:30 | X-ray: cables show tempo knob to tempo lane, pads to drums lane, keys to keys lane, all wired by the slots. | Pinch | It's real software |
| 0:30–0:50 | **Play.** The drums lane loops. Finger-drum on the pads (the hits record into the lane), play a chord on the keys (it records into the keys lane), turn the TEMPO knob (BPM changes, the beat speeds up), pull the DRUMS fader down. | Poke, both hands | It works in space; made with the body |
| 0:50–0:58 | Say "make the pads glow blue" (voice; check it works first). Then cut to the laptop: Claude Code with the Spatial MCP pulls this layout into a fresh project (`get_layout`, then `add_component`). | Voice | Worth making with again |

## At the judging table

1. Hand them the headset with the Night Set guide already started and 2 slots filled. They place the rest, press Play and drum.
2. If anything stalls, tap **Place next** on the guide panel (or say "Stark, next"), which fills the next slot for them.
3. **Template voice commands** (only act when you say them; the template pre-loads the phrases in each slot's `say`): "Stark, add the drums / the keys / the mixer", "Stark, set up the rig" (desk, mixer, keys, pads), "Stark, build the track wall" (wall + 3 lanes), "Stark, next", "Stark, fill the rest". Everything else ("make the pads glow blue", "next scene") goes to the normal assistant.
4. Say what's stubbed before they ask (list below).

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
