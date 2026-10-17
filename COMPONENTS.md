# Component Catalog

Tick `[x]` when the component renders and works in the Studio. Build **Tier 1 first**. Anything unbuilt at **5:15 PM** shows on the site as **"Coming soon"**.

- **P1** = Person 1 (effects, spatial behaviors, XR-native interactions)
- **P2** = Person 2 (kit-based UI from uikit-default / apfel / horizon)
- ⭐ = only makes sense in XR (our differentiator)
- File: `components/spatial/<name>.tsx`, default export, no required props, plus an entry in `registry/index.json`

## Tier 1: must ship (28)

### Buttons with effects
| ✓ | name | Component | Owner | Notes |
|---|---|---|---|---|
| [ ] | press-button | ⭐ Press Button | P1 | Physically depresses on poke, springs back |
| [ ] | glow-button | ⭐ Glow Button | P1 | Glows as fingertip approaches |
| [ ] | glass-button | Glass Button | P1 | drei `MeshTransmissionMaterial` |
| [ ] | neon-button | Neon Button | P1 | Pulsing outline |
| [ ] | ripple-button | ⭐ Ripple Button | P1 | Ring ripples from touch point |
| [ ] | magnetic-button | ⭐ Magnetic Button | P1 | Leans toward fingertip |
| [ ] | holo-button | ⭐ Holo Button | P1 | Shimmer shifts with head angle |
| [ ] | icon-button | Icon Button | P2 | uikit + lucide |

### Controls
| ✓ | name | Component | Owner | Notes |
|---|---|---|---|---|
| [ ] | slider | Slider | P2 | kit |
| [ ] | knob | ⭐ Knob / Dial | P1 | Grab and twist (reused for music later) |
| [ ] | spring-toggle | Spring Toggle | P1 | Bouncy snap |
| [ ] | checkbox | Checkbox / Radio | P2 | kit |
| [ ] | segmented-tabs | Segmented Tabs | P2 | kit |
| [ ] | stepper | Stepper | P2 | − / value / + |

### Containers and feedback
| ✓ | name | Component | Owner | Notes |
|---|---|---|---|---|
| [ ] | glass-card | Glass Card | P2 | apfel |
| [ ] | flip-card | ⭐ Flip Card | P1 | 3D flip |
| [ ] | tooltip | Tooltip | P2 | kit |
| [ ] | toast | Toast | P2 | Pops into view |
| [ ] | progress-ring | Progress Ring | P2 | |
| [ ] | dialog | Dialog | P2 | kit |

### XR-native picks
| ✓ | name | Component | Owner | Notes |
|---|---|---|---|---|
| [ ] | window | ⭐ Window | P1 | Grab bar + close + resize. Wraps anything |
| [ ] | wrist-menu | ⭐ Wrist Menu | P1 | Attached to the hand, shows when you look at it |
| [ ] | radial-menu | ⭐ Radial Menu | P1 | Pinch and pull to an option |
| [ ] | billboard | ⭐ Billboard | P1 | Always faces you (wrapper) |
| [ ] | lazy-follow | ⭐ Lazy Follow | P1 | Drifts after you (wrapper) |
| [ ] | hold-to-confirm | ⭐ Hold-to-Confirm | P1 | Ring fills while held |
| [ ] | particle-burst | ⭐ Particle Burst | P1 | Sparks on press (wrapper) |
| [ ] | model-viewer | ⭐ 3D Model Viewer | P1 | Grab to spin; Kaedim model |

## Tier 2: build if time, else "Coming soon" (31)

### Navigation
| ✓ | name | Component | Owner |
|---|---|---|---|
| [ ] | palm-menu | ⭐ Palm Menu | P1 |
| [ ] | orbiter-toolbar | ⭐ Orbiter Toolbar | P1 |
| [ ] | dock | Dock | P2 |
| [ ] | vertical-tab-bar | Vertical Tab Bar | P2 |

### Spatial behaviors
| ✓ | name | Component | Owner |
|---|---|---|---|
| [ ] | curved-panel | ⭐ Curved Panel | P1 |
| [ ] | wall-anchor | ⭐ Wall Anchor | P1 |
| [ ] | grab-handle | ⭐ Grab Handle | P1 |

### Input
| ✓ | name | Component | Owner |
|---|---|---|---|
| [ ] | spatial-keyboard | ⭐ Spatial Keyboard | P1 |
| [ ] | number-pad | Number Pad | P2 |
| [ ] | color-picker | ⭐ 3D Color Picker | P1 |
| [ ] | xy-pad | XY Pad | P2 |
| [ ] | select | Dropdown / Select | P2 |
| [ ] | range-slider | Range Slider | P2 |

### Feedback
| ✓ | name | Component | Owner |
|---|---|---|---|
| [ ] | hover-highlight | ⭐ Hover Highlight | P1 |
| [ ] | click-sound | ⭐ Click Sound (spatial audio) | P1 |
| [ ] | haptic-pulse | ⭐ Haptic Pulse | P1 |
| [ ] | badge | Badge | P2 |
| [ ] | skeleton | Skeleton Loader | P2 |
| [ ] | spinner-3d | 3D Spinner | P2 |

### Data
| ✓ | name | Component | Owner |
|---|---|---|---|
| [ ] | bar-chart-3d | ⭐ 3D Bar Chart | P2 |
| [ ] | gauge | Gauge / Meter | P2 |
| [ ] | stat-card | Stat Card | P2 |
| [ ] | sparkline | Sparkline | P2 |
| [ ] | timeline-scrubber | Timeline Scrubber | P2 |

### Media
| ✓ | name | Component | Owner |
|---|---|---|---|
| [ ] | video-panel | Video Panel | P2 |
| [ ] | curved-gallery | ⭐ Curved Gallery | P1 |
| [ ] | audio-player | Audio Player Card | P2 |

### Backdrops
| ✓ | name | Component | Owner |
|---|---|---|---|
| [ ] | aurora-backdrop | Aurora Gradient | P2 |
| [ ] | grid-floor | Grid Floor | P2 |
| [ ] | hand-spotlight | ⭐ Hand Spotlight | P1 |
| [ ] | frosted-backplate | Frosted Backplate | P2 |

## Later phase: music
Fader · VU Meter · Drum Pad (Kaedim) · Step Sequencer · XY Pad · Mixer Strip
