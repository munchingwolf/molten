# Spatial — Hackathon Plan

Product spec: [SPEC.md](SPEC.md). This file is **who builds what, in what order**.

## Decisions so far

| Topic | Decision |
|---|---|
| Problem | XR UI code exists but is scattered. No single place to grab working XR UI and drop it into your project. |
| Why not "just ask Claude" | Claude is slow and weak at XR design. Components give Claude direction and give the dev a clear preview of the result. |
| Component levels | Primitives (slider, knob), sections (settings panel, mixer), themes, and domain components (e.g. DAW parts). |
| Demo moment | **Install** first (the hook), **swap** last (the climax). |
| Music app | Demo vehicle only. Also shows "domain components" (music). |

### Assumed. Confirm or override

| # | Assumption |
|---|---|
| A1 | Hackathon project, built so it can keep going: registry + contract are real, polish can be mocked. |
| A2 | Spatial sits *above* platform kits (Meta UI Set, MRTK3, community). They are sources, not rivals. |
| A3 | Unity 6.3 + Quest 3S + XR Interaction Toolkit. Website shows recorded preview loops, not live 3D. |
| A4 | **Copy-in, shadcn-style**: components land as editable source in `Assets/Spatial/<name>/`. MVP components depend only on XRI. |
| A5 | Two roles: **Unity person** (A) and **Web person** (B). |

## Architecture (the contract both people build against)

```
Unity project
  SettingsState (ScriptableObject)   <- the ONE source of truth
     masterVolume, reverb, tempo, haptics, inputMode
     + OnChanged event
        ^            ^            ^
  DefaultSettings  GlassSettings  CyberSettings   <- prefabs, each with a
                                                     view script bound to SettingsState
  SettingsSlot  <- reads Assets/Spatial/spatial.json ("settings": "glass-settings")
                   and spawns that prefab. Swap = change one string.

Registry (in this repo: /registry)
  registry/index.json
  registry/components/<name>/spatial.json   <- manifest
  registry/components/<name>/files/...      <- prefab + scripts to copy in
  registry/components/<name>/preview.mp4

MCP server (/mcp)
  search_components(query, category?)  -> list
  get_component(name)                  -> manifest + preview URL
  add_component(name, projectPath)     -> copies files into Assets/Spatial/<name>/
  swap_component(slot, name)           -> rewrites spatial.json

Website (/web)  reads registry/index.json, card grid, detail page, "copy install prompt"
```

Why `SettingsSlot` + `spatial.json` and not scene editing: editing Unity scene files through an agent is fragile. Swapping a string in a JSON file always works, and it's what makes the swap feel instant.

## Lock this first (both, ~1 hour together)

1. `SettingsState` fields + names (C#) and the `spatial.json` manifest schema (JSON). **Do not change them after this without telling the other person.**
2. Agree on the 3 settings skins' look (Default / Glass / Cyber). Do a quick moodboard.

## Person A: Unity / Quest

| # | Task | Done when |
|---|---|---|
| A0 | **Day-1 risk spike:** build an empty scene to the Quest 3S from the Mac. Time the build-and-deploy loop. Try Meta XR Simulator for in-editor testing. | Something runs in the headset, and we know the rebuild time |
| A1 | Unity project + XRI + OpenXR setup; Unity `.gitignore` | Teammate can clone and open |
| A2 | `SettingsState` + `SettingsSlot` (reads `spatial.json`) | Changing the JSON swaps the panel |
| A3 | Music demo: one looping beat + one playable instrument (drum pads). Volume, reverb and tempo are *audible*. | Settings changes are heard |
| A4 | DefaultSettings prefab (plain) | Works in headset |
| A5 | GlassSettings prefab | Looks great, same state |
| A6 | CyberSettings prefab | Looks great, same state |
| A7 | 2–4 primitives / music parts (knob, fader, drum pad) for registry depth | In registry |
| A8 | Record a preview clip of each component for the website | `preview.mp4` per component |
| Stretch | Rokoko glove gesture instrument | Only after A1–A8 |

## Person B: Registry / MCP / Website

| # | Task | Done when |
|---|---|---|
| B0 | **License check** on sources: Meta Horizon OS UI Set, JetStyle Vision Pro UI Kit, MRTK3, XRI samples. What may we redistribute? | Table in `SOURCES.md` |
| B1 | Registry folder + `index.json` + manifests for each component | Valid JSON for all components |
| B2 | MCP server: `search_components`, `get_component` | Claude Code finds "glass settings" |
| B3 | MCP: `add_component` (copy files into a Unity project) and `swap_component` (edit `spatial.json`) | Claude installs + swaps in A's project |
| B4 | Website: home (search + category chips + card grid) and detail page (preview, compatibility, install prompt) | Deployed URL |
| B5 | Pitch deck + demo script (with A) | Rehearsed run-through |

## Build order

1. **Together:** lock the contract (above).
2. **In parallel:** A0–A2 | B0–B2
3. **In parallel:** A3–A5 | B3–B4
4. **Integration (both):** B's MCP installs and swaps A's real Glass/Cyber prefabs in A's project, end to end.
5. A6–A8 | B4 polish + B5
6. **Rehearse the demo 3 times. Record the backup video.**

## Top risks

| Risk | Fallback |
|---|---|
| Mac → Quest rebuild is slow (Quest Link doesn't run on macOS) | Demo the swap in Meta XR Simulator, or ship all skins in the build and switch at runtime. Record headset footage as backup |
| Agent install/swap is flaky live | Pre-recorded demo video; MCP tools are simple file ops, so keep them that way |
| Licenses block redistributing third-party UI | Build skins ourselves from XRI primitives (already the plan) |
| Glass/Cyber look mediocre | Spend A's time on 2 great skins over 4 okay ones |

## Open

- Hours available and who is A vs B
- Final product name (keep "Spatial" until the website build)
