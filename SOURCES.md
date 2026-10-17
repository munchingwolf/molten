# Component Sources: License Check (2026-10-17)

Licenses were read from the actual LICENSE files. This is not legal advice. Rule: **keep each upstream LICENSE next to any copied files.**

| Source | License | Copy into our registry? | Notes |
|---|---|---|---|
| [pmndrs/uikit](https://github.com/pmndrs/uikit) (web, R3F) | MIT (© 2024 Bela Bohlender, © 2023 Coconut Capital) | **Yes** | Use if we go WebXR. Keep both notices |
| [MRTK3](https://github.com/MixedRealityToolkit/MixedRealityToolkit-Unity) | BSD-3 (fonts OFL, icons MIT) | Yes | Safest big Unity kit. No endorsement use of contributor names |
| [MS Graphics Tools](https://github.com/microsoft/MixedReality-GraphicsTools-Unity) | MIT | Yes | Best glass/acrylic look. Quest perf untested |
| [mob-sakai/UIEffect](https://github.com/mob-sakai/UIEffect) | MIT | Yes | Glow/blur/shine for uGUI |
| [Tilia Controllables](https://github.com/ExtendRealityLtd/Tilia.Interactions.Controllables.Unity) | MIT | Yes | Knob/fader physics, no styling |
| [JetStyle Vision Pro UI Kit](https://github.com/jetstyle/Apple-Vision-Pro-UI-Kit) | MIT (code) | Code yes, **icons no** | Icons look derived from SF Symbols. Drop them, don't brand as Apple |
| [Ultraleap UnityPlugin](https://github.com/ultraleap/UnityPlugin) | Apache-2.0 | Yes (keep NOTICE, mark changes) | Quest hand-tracking compatibility unverified |
| Meta Horizon OS UI Set | Oculus/MPT SDK License | **No**, reference only | Redistribution unclear, can't go under MIT, revocable. List as a dependency instead |
| Unity XRI samples | Unity Companion License | **No** | Unity owns derivative works. Install from the package registry instead |
| [Poly Haven](https://polyhaven.com/hdris) HDRIs | CC0 | **Yes**, no credit required | env-meadow/beach/open-lot/desert/night-field stream the 2k .hdr from dl.polyhaven.org (CORS `*`), so the components work when copied anywhere |
| [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) (Alexander Holm) | CC-BY 3.0 | **Yes, credit required** | `grand-piano` streams 12 mp3s from the Tone.js CDN (tonejs.github.io/audio/salamander, CORS `*`). Credit: "Salamander Grand Piano V3 by Alexander Holm, CC-BY 3.0" |

No permissive, good-looking music controls (knob/fader/drum pad) exist. **We build those ourselves.**
