# Spatial component visual QA

Run 2026-10-17 against http://localhost:3000/components/<name>, viewport 1280x800, 2.5 s settle, canvas screenshots in /Users/ek/.playwright-mcp/qa/. 150 ready components.

## Summary

| verdict | count |
|---|---|
| broken | 4 |
| ugly | 30 |
| ok | 37 |
| good | 79 |

## Top recurring issues

1. **Unlit / black materials** (about 12 objects: speaker, door, whiteboard, plant, desk, chair, sofa, pressure-plate, gltf-model, acoustic-panels, piano-keys, spring-toggle). The detail-page preview has too little light for MeshStandardMaterial, so they render as black silhouettes.
2. **Missing-glyph boxes (■)** for non-ASCII characters (curly quotes, middle dot ·, ×) in the uikit/troika font: dialog, window, flip-card, coin-pickup, synth.
3. **Framing**: small controls render tiny in the centre (knob, dice, mascot, vu-meter) and big objects are clipped (door, desk, sofa, floor-lamp, weather/clock-widget). Flat objects are seen edge-on (rug, env-light-studio, hardware units).

Console errors: only **tabs** throws (3x `TypeError: Cannot convert undefined or null to object` in @pmndrs/uikit `setLayersWithConditionals` -> `Object.entries`, then in R3F `removeChild`). Every page also logs a dev-only `[Turbopack HMR] Expected module to match pattern: [project]/registry/index.json` (excluded from counts) and a `THREE.Clock deprecated` warning.

## Results

| name | category | renders | errors | verdict | note |
|---|---|---|---|---|---|
| kinetic-title | motion | no | 0 | broken | renders only a soft glow; title text never appears (checked again at 7 s) |
| rug | room | yes | 0 | broken | effectively invisible: flat rug seen edge-on, shows as a 1px dark line |
| spotlight-text | motion | yes | 0 | broken | spotlight cone renders but the text is missing (checked at 7 s) |
| tabs | navigation | no | 3: PAGEERROR: Cannot convert undefined or null to object | broken | throws on mount, no canvas: @pmndrs/uikit setLayersWithConditionals -> Object.entries(undefined) (likely an undefined conditional/style prop) |
| acoustic-panels | room | yes | 0 | ugly | black panels fill frame, unlit |
| chair | objects | yes | 0 | ugly | unlit black silhouette, clipped |
| checkbox | inputs | yes | 0 | ugly | box nearly invisible against bg |
| clock-widget | app | yes | 0 | ugly | tall panel clipped, content small |
| coin-pickup | interactive | yes | 0 | ugly | missing-glyph box in counter (× sign) |
| curved-gallery | media | yes | 0 | ugly | all tiles render black (images not loading) |
| desk | objects | yes | 0 | ugly | unlit black, oversized |
| dialog | containers | yes | 0 | ugly | missing-glyph boxes around "Drums 2" (curly quotes) |
| door | objects | yes | 0 | ugly | unlit black, fills frame height |
| drum-pad | music | yes | 0 | ugly | plain black square |
| env-concert-stage | environments | yes | 0 | ugly | stage cut off, lower half empty black |
| env-light-studio | environments | yes | 0 | ugly | only a thin floor line visible (camera edge-on) |
| flip-card | containers | yes | 0 | ugly | missing-glyph box in "Synth preset ■ 124 BPM" |
| floor-lamp | room | yes | 0 | ugly | oversized, clipped top and bottom |
| frame | layout | yes | 0 | ugly | near-invisible dark rectangle |
| gltf-model | objects | yes | 0 | ugly | unlit black silhouette, clipped top/bottom |
| knob | controls | yes | 0 | ugly | tiny in frame; dark knob barely visible |
| piano-keys | music | yes | 0 | ugly | black rectangle, keys not visible |
| plant | objects | yes | 0 | ugly | unlit black silhouette |
| press-button | buttons with effects | yes | 0 | ugly | dark box, label not visible |
| pressure-plate | interactive | yes | 0 | ugly | unlit black disc |
| sofa | room | yes | 0 | ugly | unlit black, oversized, clipped |
| speaker | objects | yes | 0 | ugly | unlit black silhouette |
| spring-toggle | controls | yes | 0 | ugly | black unlit rectangle |
| synth | music | yes | 0 | ugly | CUTOFF/RESO labels overlap; missing-glyph box in "SAWTOOTH ■ MONO" |
| vu-meter | music | yes | 0 | ugly | tiny, unlit black bar |
| wall-art | room | yes | 0 | ugly | black canvas, clipped |
| weather-widget | app | yes | 0 | ugly | tall panel clipped, content small |
| whiteboard | objects | yes | 0 | ugly | unlit black slab |
| window | containers | yes | 0 | ugly | missing-glyph box in "WAV ■ 48 kHz" (middle dot) |
| achievement-popup | interactive | yes | 0 | ok | small |
| audio-interface | hardware | yes | 0 | ok | tiny |
| badge | feedback | yes | 0 | ok | small |
| confetti-burst | interactive | yes | 0 | ok | small |
| cooldown-ring | interactive | yes | 0 | ok | small |
| dice | interactive | yes | 0 | ok | tiny |
| drum-machine | hardware | yes | 0 | ok | flat, seen edge-on |
| env-gallery | environments | yes | 0 | ok | lower half empty floor |
| env-studio-loft | environments | yes | 0 | ok | lower half empty floor |
| fader | music | yes | 0 | ok | small |
| glass-button | buttons | yes | 0 | ok | small in frame |
| glow-button | buttons | yes | 0 | ok | small in frame |
| hardware-synth | hardware | yes | 0 | ok | flat, seen edge-on |
| health-bar | interactive | yes | 0 | ok | small |
| hold-to-confirm | buttons | yes | 0 | ok | small |
| holo-button | buttons | yes | 0 | ok | small in frame |
| icon-button | buttons | yes | 0 | ok | small in frame |
| label | containers | yes | 0 | ok | plain text only |
| lever-switch | interactive | yes | 0 | ok | small, dark |
| loop-player | music | yes | 0 | ok | small, dense text |
| magnetic-button | buttons | yes | 0 | ok | small in frame |
| mascot | interactive | yes | 0 | ok | tiny |
| mixer-strip | music | yes | 0 | ok | small, dense text |
| mixing-console | hardware | yes | 0 | ok | flat, seen edge-on |
| neon-button | buttons | yes | 0 | ok | small in frame |
| number-pad | inputs | yes | 0 | ok | small |
| range-slider | inputs | yes | 0 | ok | small, labels tiny |
| ripple-button | buttons | yes | 0 | ok | small in frame |
| score-counter | interactive | yes | 0 | ok | small |
| select | inputs | yes | 0 | ok | small |
| slider | controls | yes | 0 | ok | small in frame |
| spinner-3d | feedback | yes | 0 | ok | odd shape, small |
| stepper | inputs | yes | 0 | ok | small |
| tv | objects | yes | 0 | ok | black screen (play icon only) |
| video-panel | media | yes | 0 | ok | video area black until play |
| waveform | music | yes | 0 | ok | flat line, small |
| xy-pad | music | yes | 0 | ok | small |
| activity-timeline | app | yes | 0 | good |  |
| audio-player | media | yes | 0 | good |  |
| aurora-ribbon | motion | yes | 0 | good |  |
| avatar-group | app | yes | 0 | good |  |
| bar-chart-3d | data | yes | 0 | good |  |
| basketball-hoop | interactive | yes | 0 | good |  |
| bookshelf | room | yes | 0 | good |  |
| breadcrumbs | app | yes | 0 | good |  |
| calendar | app | yes | 0 | good |  |
| chat-panel | app | yes | 0 | good |  |
| clock | objects | yes | 0 | good |  |
| color-picker | inputs | yes | 0 | good |  |
| command-palette | app | yes | 0 | good |  |
| computer-monitor | hardware | yes | 0 | good |  |
| context-menu | app | yes | 0 | good |  |
| countdown-timer | interactive | yes | 0 | good |  |
| data-table | app | yes | 0 | good |  |
| dialogue-box | interactive | yes | 0 | good |  |
| dock | navigation | yes | 0 | good |  |
| env-beach | environments | yes | 0 | good |  |
| env-desert | environments | yes | 0 | good |  |
| env-forest | environments | yes | 0 | good |  |
| env-meadow | environments | yes | 0 | good |  |
| env-night-field | environments | yes | 0 | good |  |
| env-open-lot | environments | yes | 0 | good |  |
| env-space | environments | yes | 0 | good |  |
| file-browser | app | yes | 0 | good |  |
| floating-cards | motion | yes | 0 | good |  |
| gauge | data | yes | 0 | good |  |
| glass-card | containers and feedback | yes | 0 | good |  |
| globe | objects | yes | 0 | good |  |
| gradient-orb | motion | yes | 0 | good |  |
| headphones-stand | hardware | yes | 0 | good |  |
| inventory-grid | interactive | yes | 0 | good |  |
| item-wheel | interactive | yes | 0 | good |  |
| kanban-board | app | yes | 0 | good |  |
| lamp | objects | yes | 0 | good |  |
| liquid-button | motion | yes | 0 | good |  |
| login-form | app | yes | 0 | good |  |
| marquee-ring | motion | yes | 0 | good |  |
| minimap | interactive | yes | 0 | good |  |
| model-viewer | media | yes | 0 | good |  |
| morph-blob | motion | yes | 0 | good |  |
| music-now-playing | app | yes | 0 | good |  |
| neon-sign | room | yes | 0 | good |  |
| notification-center | app | yes | 0 | good |  |
| pagination | app | yes | 0 | good |  |
| particle-field | motion | yes | 0 | good |  |
| portal-ring | motion | yes | 0 | good |  |
| profile-card | app | yes | 0 | good |  |
| progress-ring | feedback | yes | 0 | good |  |
| quest-tracker | interactive | yes | 0 | good |  |
| radial-menu | navigation | yes | 0 | good |  |
| reveal-card | motion | yes | 0 | good |  |
| search-bar | app | yes | 0 | good |  |
| settings-default | settings | yes | 0 | good |  |
| settings-glass | settings | yes | 0 | good |  |
| settings-horizon | settings | yes | 0 | good |  |
| side-table | room | yes | 0 | good |  |
| sidebar-nav | app | yes | 0 | good |  |
| sparkline | data | yes | 0 | good |  |
| stat-card | data | yes | 0 | good |  |
| step-sequencer | music | yes | 0 | good |  |
| studio-monitors | hardware | yes | 0 | good |  |
| target-reticle | interactive | yes | 0 | good |  |
| tempo-display | music | yes | 0 | good |  |
| timeline-scrubber | data | yes | 0 | good |  |
| toast | feedback | yes | 0 | good |  |
| todo-list | app | yes | 0 | good |  |
| toolbar | app | yes | 0 | good |  |
| tooltip | feedback | yes | 0 | good |  |
| transport | music | yes | 0 | good |  |
| treasure-chest | interactive | yes | 0 | good |  |
| tree-view | app | yes | 0 | good |  |
| turntable | hardware | yes | 0 | good |  |
| typewriter-panel | motion | yes | 0 | good |  |
| wall-window | room | yes | 0 | good |  |
| wrist-menu | navigation | yes | 0 | good |  |
| xylophone | interactive | yes | 0 | good |  |
