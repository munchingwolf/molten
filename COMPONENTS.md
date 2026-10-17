# Component Catalog

Tick `[x]` when the component renders with no props, works with `value`/`onChange` (or `onPress`), and works in the Studio. **Contract:** see SPEC.md §41 "Component contract". Every file must be copy-pasteable on its own.

Build **Tier 1 top to bottom**: **general UI first** (the product is for every XR developer), **then music** (the DAW is only the demo). Anything unbuilt at **4:45 PM** is set to `status: "soon"` and shows as "Coming soon" on the marketplace.

- Owner: **P2** builds the general components. **Music: P1 builds the sound + plain look, P2 restyles 4:00–4:45** (split update 1:15, SPEC §41).
- `bindable`: the prop the Studio can wire to a shared name (e.g. knob `value` → "tempo")
- ⭐ = only makes sense in XR

## Tier 1: the DAW + general basics (17)

### General (build first)
| ✓ | name | Component | bindable / props | Notes |
|---|---|---|---|---|
| [x] | label | Label / Title | `text` | 3D text for section titles |
| [x] | press-button | ⭐ Press Button | `onPress` | Physically depresses on poke |
| [ ] | glow-button | ⭐ Glow Button | `onPress` | Glows as fingertip approaches |
| [ ] | glass-button | Glass Button | `onPress` | drei `MeshTransmissionMaterial` |
| [x] | spring-toggle | Spring Toggle | `value` (bool) | Bouncy snap |
| [x] | slider | Slider | `value` (0–1) | uikit |
| [ ] | tabs | Segmented Tabs | `value` (index) | uikit |
| [x] | glass-card | Glass Card | `title`, children | apfel. Backplate to group a section |
| [ ] | window | ⭐ Window | `title`, children | Grab bar + close. Wraps a section |

### Music (second: for the DAW demo)
| ✓ | name | Component | bindable / props | Notes |
|---|---|---|---|---|
| [~] | transport | Transport (play/stop) | `playing`, `bpm` | Built by P1 (`transport.tsx`), needs a registry entry |
| [ ] | drum-pad | ⭐ Drum Pad | `onPress`, `sound` (kick/snare/hat/clap) | Hit it, makes sound (Tone synth). **Kaedim** model if ready |
| [ ] | step-sequencer | Step Sequencer | `steps`, `onChange` | 16-step grid × 4 drums, plays on Transport |
| [x] | knob | ⭐ Knob / Dial | `value` (0–1) | Drag to turn. Contract reference by P1, P2 may restyle |
| [ ] | fader | Fader | `value` (0–1) | Vertical slider |
| [ ] | vu-meter | VU Meter | `value` (0–1) | Animated level bars |
| [ ] | tempo-display | Tempo Display | `value` (bpm) | Big BPM readout |
| [ ] | piano-keys | ⭐ Piano Keys | `onPress(note)` | 1 octave, pokeable keys, Tone synth |

## Tier 2: "Coming soon" unless time (42)

Cut from Tier 1 at 1:15: xy-pad · mixer-strip · waveform · wrist-menu ⭐
Buttons: neon-button · ripple-button ⭐ · magnetic-button ⭐ · holo-button ⭐ · icon-button
Controls: checkbox · stepper · range-slider · select · number-pad · color-picker ⭐ · spatial-keyboard ⭐ · hold-to-confirm ⭐
Containers: flip-card ⭐ · tooltip · toast · dialog · curved-panel ⭐ · frosted-backplate
Navigation: radial-menu ⭐ · palm-menu ⭐ · orbiter-toolbar ⭐ · dock · vertical-tab-bar
Spatial behaviors: billboard ⭐ · lazy-follow ⭐ · wall-anchor ⭐ · grab-handle ⭐
Feedback: particle-burst ⭐ · hover-highlight ⭐ · click-sound ⭐ · haptic-pulse ⭐ · badge · skeleton · spinner-3d · progress-ring
Data: bar-chart-3d ⭐ · gauge · stat-card · sparkline · timeline-scrubber
Media: model-viewer ⭐ (Kaedim) · video-panel · curved-gallery ⭐ · audio-player
Backdrops: aurora-backdrop · grid-floor · hand-spotlight ⭐

## Library batch from the source list (Danny, 3:19): 45 built, all ready
| ✓ | name | Component | Category |
|---|---|---|---|
| [x] | accordion | Accordion | ui kit |
| [x] | alert | Alert | ui kit |
| [x] | alert-dialog | Alert Dialog | ui kit |
| [x] | radio-group | Radio Group | ui kit |
| [x] | input | Text Input | ui kit |
| [x] | textarea | Text Area | ui kit |
| [x] | progress-bar | Progress Bar | ui kit |
| [x] | toggle-group | Toggle Group | ui kit |
| [x] | switch | Switch | ui kit |
| [x] | avatar | Avatar | ui kit |
| [x] | kit-card | Card | ui kit |
| [x] | kit-button | Button | ui kit |
| [x] | audio-visualizer | Audio Visualizer | music |
| [x] | oscilloscope | Oscilloscope | music |
| [x] | arpeggiator | Arpeggiator | music |
| [x] | flow-field-particles | Flow Field Particles | interactive |
| [x] | particle-emitter | Particle Emitter | interactive |
| [x] | force-graph | Force Graph | interactive |
| [x] | poke-button-demo | Poke Button | interactive |
| [x] | float-object | Float Object | visuals |
| [x] | sparkles-field | Sparkles Field | visuals |
| [x] | starfield | Starfield Globe | visuals |
| [x] | cloud-puff | Cloud Puff | visuals |
| [x] | text-3d | 3D Text | visuals |
| [x] | text-label | Text Label | visuals |
| [x] | image-panel | Image Panel | visuals |
| [x] | svg-icon | SVG Icon | visuals |
| [x] | rounded-box | Rounded Box | visuals |
| [x] | billboard-tag | Billboard Tag | visuals |
| [x] | motion-trail | Motion Trail | visuals |
| [x] | bezier-curve | Bezier Curve | visuals |
| [x] | spline-path | Spline Path | visuals |
| [x] | wobble-blob | Wobble Blob | materials |
| [x] | distort-orb | Distort Orb | materials |
| [x] | glass-orb | Glass Orb | materials |
| [x] | crystal | Crystal | materials |
| [x] | mirror-floor | Mirror Floor | materials |
| [x] | portal-card | Portal Card | materials |
| [x] | outlined-object | Outlined Object | visuals |
| [x] | edges-object | Edges Object | visuals |
| [x] | wireframe-object | Wireframe Object | visuals |
| [x] | metaballs | Metaballs | visuals |
| [x] | decal-object | Decal Object | visuals |
| [x] | infinite-grid | Infinite Grid | visuals |
| [x] | positional-audio | Positional Audio Speaker | visuals |
