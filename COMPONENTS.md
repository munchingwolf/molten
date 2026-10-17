# Component Catalog

Tick `[x]` when the component renders with no props, works with `value`/`onChange` (or `onPress`), and works in the Studio. **Contract:** see SPEC.md Â§41 "Component contract". Every file must be copy-pasteable on its own.

Build **Tier 1 top to bottom**: **general UI first** (the product is for every XR developer), **then music** (the DAW is only the demo). Anything unbuilt at **4:45 PM** is set to `status: "soon"` and shows as "Coming soon" on the marketplace.

- Owner: **P2** builds the general components. **Music: P1 builds the sound + plain look, P2 restyles 4:00â€“4:45** (split update 1:15, SPEC Â§41).
- `bindable`: the prop the Studio can wire to a shared name (e.g. knob `value` â†’ "tempo")
- â­ = only makes sense in XR

## Tier 1: the DAW + general basics (17)

### General (build first)
| âœ“ | name | Component | bindable / props | Notes |
|---|---|---|---|---|
| [x] | label | Label / Title | `text` | 3D text for section titles |
| [x] | press-button | â­ Press Button | `onPress` | Physically depresses on poke |
| [ ] | glow-button | â­ Glow Button | `onPress` | Glows as fingertip approaches |
| [ ] | glass-button | Glass Button | `onPress` | drei `MeshTransmissionMaterial` |
| [x] | spring-toggle | Spring Toggle | `value` (bool) | Bouncy snap |
| [x] | slider | Slider | `value` (0â€“1) | uikit |
| [ ] | tabs | Segmented Tabs | `value` (index) | uikit |
| [x] | glass-card | Glass Card | `title`, children | apfel. Backplate to group a section |
| [ ] | window | â­ Window | `title`, children | Grab bar + close. Wraps a section |

### Music (second: for the DAW demo)
| âœ“ | name | Component | bindable / props | Notes |
|---|---|---|---|---|
| [~] | transport | Transport (play/stop) | `playing`, `bpm` | Built by P1 (`transport.tsx`), needs a registry entry |
| [ ] | drum-pad | â­ Drum Pad | `onPress`, `sound` (kick/snare/hat/clap) | Hit it, makes sound (Tone synth). **Kaedim** model if ready |
| [ ] | step-sequencer | Step Sequencer | `steps`, `onChange` | 16-step grid Ã— 4 drums, plays on Transport |
| [x] | knob | â­ Knob / Dial | `value` (0â€“1) | Drag to turn. Contract reference by P1, P2 may restyle |
| [ ] | fader | Fader | `value` (0â€“1) | Vertical slider |
| [ ] | vu-meter | VU Meter | `value` (0â€“1) | Animated level bars |
| [ ] | tempo-display | Tempo Display | `value` (bpm) | Big BPM readout |
| [ ] | piano-keys | â­ Piano Keys | `onPress(note)` | 1 octave, pokeable keys, Tone synth |

## Tier 2: "Coming soon" unless time (42)

Cut from Tier 1 at 1:15: xy-pad Â· mixer-strip Â· waveform Â· wrist-menu â­
Buttons: neon-button Â· ripple-button â­ Â· magnetic-button â­ Â· holo-button â­ Â· icon-button
Controls: checkbox Â· stepper Â· range-slider Â· select Â· number-pad Â· color-picker â­ Â· spatial-keyboard â­ Â· hold-to-confirm â­
Containers: flip-card â­ Â· tooltip Â· toast Â· dialog Â· curved-panel â­ Â· frosted-backplate
Navigation: radial-menu â­ Â· palm-menu â­ Â· orbiter-toolbar â­ Â· dock Â· vertical-tab-bar
Spatial behaviors: billboard â­ Â· lazy-follow â­ Â· wall-anchor â­ Â· grab-handle â­
Feedback: particle-burst â­ Â· hover-highlight â­ Â· click-sound â­ Â· haptic-pulse â­ Â· badge Â· skeleton Â· spinner-3d Â· progress-ring
Data: bar-chart-3d â­ Â· gauge Â· stat-card Â· sparkline Â· timeline-scrubber
Media: model-viewer â­ (Kaedim) Â· video-panel Â· curved-gallery â­ Â· audio-player
Backdrops: aurora-backdrop Â· grid-floor Â· hand-spotlight â­
