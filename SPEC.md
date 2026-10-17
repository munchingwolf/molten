> **Current locked plan: [§41](#41-locked-plan-spatial-studio-locked-1245-pm-oct-17).** Sections 1–40 are the original brainstorm. Where they conflict, §41 wins.

# SPATIAL — MASTER PRODUCT SPEC

## 0. Purpose of This Document

This document is the working product specification for a hackathon project and potential longer-term developer-tools product.

Use this document as the source of truth when helping us:

- refine the product
- research competitors
- make product decisions
- design the architecture
- find existing open-source components
- design the website
- build the component registry
- design MCP/agent integrations
- build the XR demo
- prioritize hackathon tasks
- write code
- prepare the pitch/demo

Do not blindly accept assumptions in this document. If research or implementation reveals a better approach, explain why and propose the change.

However, preserve the core product thesis unless explicitly told otherwise.

---

# 1. One-Sentence Product

Spatial is a visual component registry and developer integration layer for spatial/XR applications that lets developers discover, preview, customize, import, and swap polished spatial UI components without rebuilding their application's underlying functionality.

Simple analogy:

**21st.dev / shadcn for XR, with an MCP/agent-native integration layer.**

Long-term:

**The component ecosystem for spatial computing.**

---

# 2. Core Problem

XR developers have powerful underlying SDKs and frameworks:

- Meta Interaction SDK
- Unity XR Interaction Toolkit
- OpenXR
- RealityKit
- Android XR
- WebXR
- React Three Fiber
- React Three XR
- various GitHub libraries
- Unity Asset Store
- other XR frameworks

These solve much of the underlying functionality:

- hand tracking
- controller tracking
- grabbing
- poking
- rays
- locomotion
- input
- rendering
- physics
- interaction

The problem we are interested in is NOT:

"XR has no components."

The problem is:

**Beautiful, production-ready spatial UI components are fragmented across GitHub repositories, SDK samples, asset stores, design systems, and individual creators. There is no dominant developer-first discovery and integration layer comparable to 21st.dev/shadcn for XR.**

A developer who needs a polished spatial settings interface may have to:

1. Search GitHub.
2. Search asset stores.
3. Search documentation.
4. Evaluate compatibility.
5. Download code/assets.
6. Understand dependencies.
7. Modify the component.
8. Connect it to existing application state.
9. Fix styling.
10. Fix XR interaction behavior.

We want this experience to become:

**Search → Preview → Select → Import → Connect → Done.**

---

# 3. What Spatial Is

Spatial has four primary surfaces.

## A. Visual Component Marketplace / Registry

A website where humans visually discover XR components.

Developers can:

- browse
- search
- filter
- preview
- compare
- inspect compatibility
- customize
- inspect dependencies
- view source
- install/import

Visual discovery is extremely important.

Developers should be able to think:

"That looks awesome. I want that interface."

and immediately bring it into their project.

---

## B. Component Registry

Underneath the visual website is a structured registry.

The registry understands what each component actually is.

Each component should eventually contain structured metadata similar to:

```yaml
name: glass-settings
displayName: Glass Settings Panel

category: settings
type: ui-section

platform:
  - unity

xr:
  - openxr
  - meta-quest

inputs:
  - masterVolume
  - reverb
  - tempo
  - haptics

events:
  - onMasterVolumeChange
  - onReverbChange
  - onTempoChange
  - onHapticsChange

interaction:
  - hand
  - controller
  - ray
  - poke

dependencies:
  - unity-xr-interaction-toolkit

compatibility:
  quest3: true
  quest3s: true
  pcvr: true

author:
  name: Example Creator

license:
  type: MIT

install:
  method: package
```

Exact schema is TBD.

The important principle is:

**Spatial understands components semantically instead of simply linking to repositories.**

---

# 4. AI / MCP Layer

Spatial should eventually expose the component registry to AI coding agents.

Potential integrations:

- Claude Code
- Cursor
- Codex
- other coding agents
- MCP-compatible clients

Example developer request:

> Find me a futuristic settings panel for my Quest application.

The coding agent could conceptually call:

```text
search_components(
    category="settings",
    style="futuristic",
    platform="unity",
    device="quest"
)
```

Spatial returns compatible options.

Example:

```text
1. Glass Settings
2. Holographic Settings
3. Minimal Floating Settings
4. Cyber Control Panel
```

The agent can then inspect:

```text
get_component("glass-settings")
```

and receive:

- component metadata
- source
- dependencies
- installation instructions
- properties
- events
- compatibility
- usage examples

The developer could then say:

> Use #1.

The coding agent should ideally be able to install and wire the component into the existing application.

---

# 5. Human + AI Architecture

The same registry should support two discovery methods.

```text
                     SPATIAL REGISTRY
                           |
              -------------------------
              |                       |
              v                       v
         HUMAN ACCESS              AI ACCESS
              |                       |
           Website                    MCP
              |                       |
       Browse visually           Search tools
       3D previews               Metadata
       Customize                 Dependencies
       Compare                   Documentation
       Install                   Installation
              |                       |
              ----------- -------------
                         |
                         v
                EXISTING XR PROJECT
```

Humans are good at visual discovery.

AI agents are good at semantic search, installation, configuration, and code modification.

Spatial should serve both.

---

# 6. Critical Product Principle

Spatial DOES NOT own the developer's application.

We are NOT initially building:

- a full XR IDE
- a new XR engine
- a replacement for Unity
- a replacement for Meta SDK
- a complete no-code application builder

The developer remains inside:

- Unity
- VS Code
- Cursor
- Claude Code
- their existing development environment

Spatial provides components that enter THEIR project.

Think:

```text
Existing XR Project
        |
        | needs interface
        v
Spatial Registry
        |
        | choose component
        v
Install Component
        |
        v
Existing XR Project
```

Low friction is extremely important.

---

# 7. Initial Technical Target

For the hackathon MVP:

**Unity + Meta Quest 3S**

Likely foundation:

- Unity
- OpenXR
- Unity XR Interaction Toolkit
- Meta Interaction SDK where appropriate

We should leverage existing XR infrastructure rather than recreating it.

We are not trying to beat Meta at hand tracking.

We are building a layer ABOVE those technologies.

---

# 8. MVP Component Strategy

Eventually, we want to build original high-quality Spatial components.

For the hackathon, that is NOT the priority.

Instead:

1. Find high-quality existing components.
2. Verify their licenses.
3. Use permissively licensed/open-source components where legally allowed.
4. Normalize them into a consistent integration format.
5. Demonstrate discovery and swapping.
6. Focus our engineering effort on the registry/integration experience.

Potential sources include:

- Meta samples
- Unity samples
- open-source XR GitHub repositories
- permissively licensed component libraries
- other legally reusable resources

DO NOT copy proprietary components or assets without permission.

Every external component considered for redistribution must have its license verified.

---

# 9. Product Focus: Visual Components

Our initial focus is primarily VISUAL spatial UI.

Examples:

## Controls

- buttons
- sliders
- knobs
- toggles
- switches
- dials
- selectors

## Containers

- cards
- panels
- windows
- docks
- modals

## Navigation

- menus
- radial menus
- wrist menus
- toolbars
- tab systems

## Input

- keyboards
- number pads
- dropdown/selectors
- color pickers

## Data / Feedback

- charts
- meters
- gauges
- progress indicators
- status components

## Media

- video player
- image gallery
- audio player

Different creators could publish visually distinct implementations of the same conceptual component.

Example:

```text
SETTINGS PANEL

Glass
Minimal
Industrial
Holographic
Cyberpunk
Gaming
Music
Vision-style
```

The developer chooses based on appearance and compatibility.

---

# 10. Component Swapping

This is one of the most important ideas in the MVP.

Components should ideally be interchangeable when they implement the same component contract.

Example:

```text
MusicSettingsState

masterVolume
reverb
tempo
haptics
inputMode
```

Different UIs consume the same underlying state:

```text
MusicSettingsState
        |
        |---- DefaultSettingsUI
        |
        |---- GlassSettingsUI
        |
        |---- CyberSettingsUI
        |
        |---- MinimalSettingsUI
```

Changing the visual component should NOT require rewriting the underlying application.

This is essential to our demo.

---

# 11. Component Contracts

Spatial may eventually define standardized contracts.

For example, a settings component could expose:

```text
INPUTS

masterVolume
reverb
tempo
haptics

EVENTS

onMasterVolumeChange
onReverbChange
onTempoChange
onHapticsChange
```

Any settings component implementing the contract could potentially replace another.

This requires further research and architecture work.

Do not overengineer this for the MVP.

However, preserve the separation between:

**application state**

and

**visual presentation.**

---

# 12. Installation Experience

We need to research and determine the easiest possible Unity developer workflow.

Potential options include:

### CLI

```bash
spatial add glass-settings
```

### Unity Package

```text
Add to Unity
```

### Unity Editor Plugin

Browse/install components directly from Unity.

### Coding Agent

Developer says:

> Install Glass Settings from Spatial.

Agent uses MCP/API to:

- locate component
- check compatibility
- install files/package
- resolve dependencies
- modify scene/code
- connect properties

Long-term we may support several methods.

For the hackathon, choose the simplest implementation that makes the demo convincing.

---

# 13. Music Application

We are building a spatial music application as the flagship reference/demo application.

IMPORTANT:

**The music application is NOT the core company.**

It demonstrates that Spatial components work inside a real XR application.

The application should contain a dashboard/settings interface where Spatial components can easily be swapped.

Potential settings:

- master volume
- reverb
- tempo
- haptics
- input method
- visual settings
- audio settings

The underlying settings state should be completely separate from the visual implementation.

---

# 14. Music-Specific Components

Spatial should eventually extend beyond generic UI.

This is an important part of the long-term vision.

The registry could contain domain-specific components.

Our first example is MUSIC.

Potential music components:

- mixer
- mixer channel
- volume fader
- EQ
- rotary knob
- VU meter
- waveform
- drum pad
- drum machine
- piano
- synth controls
- step sequencer
- timeline
- transport controls
- XY pad
- sampler
- spatial audio controls
- gesture instrument

This demonstrates that Spatial can evolve from:

**generic UI components**

into:

**specialized spatial software components.**

---

# 15. Other Future Vertical Libraries

Potential future categories include:

## Healthcare

- patient monitor
- vitals panel
- anatomy viewer
- medical imaging controls
- procedure checklist

## Training

- instruction panel
- procedure tracker
- object highlight
- safety zone
- assessment
- tool selector

## Engineering / Design

- transform gizmo
- measurement tool
- material picker
- object inspector
- layer panel
- asset browser

## Gaming

- inventory
- health interface
- radial menu
- dialogue panel
- quest tracker
- weapon selector

## Productivity

- file browser
- calendar
- dashboard
- notifications
- task board
- media controls

Do not build these for the hackathon.

They demonstrate the expansion opportunity.

---

# 16. Rokoko Smartgloves

Available hardware includes Rokoko Smartgloves.

We want to experiment with a gesture-controlled music component.

Concept:

```text
Rokoko Smartgloves
        |
        v
Rokoko Adapter
        |
        v
Gesture Detection
        |
        v
Gesture Event
        |
        v
Music Mapping
```

Example:

```text
Index finger     -> C
Peace sign       -> D
Three fingers    -> E
Four fingers     -> F
Open hand        -> G
Fist             -> stop
```

Potential expressive controls:

```text
hand shape     -> note
hand height    -> pitch/octave
wrist rotation -> filter
movement speed -> velocity
```

IMPORTANT:

Rokoko should NOT be required for the core product to function.

It is a bonus demonstration of how specialized components/input systems can exist in Spatial.

Core Quest application must work independently.

---

# 17. Demo Thesis

The hackathon demo should prove:

> A developer can discover a beautiful spatial component and integrate/swap it into an existing XR application with extremely little effort.

Everything should optimize around making that moment impressive.

---

# 18. Demo Scenario

The music application initially has:

```text
DEFAULT SETTINGS UI
```

The application works normally.

Then:

1. Open Spatial.
2. Search "settings".
3. Browse several visually different settings components.
4. Preview them.
5. Select "Glass Settings".
6. Import/install it.
7. Return to music application.
8. Settings interface is now Glass.
9. Underlying application functionality remains identical.

Then potentially repeat:

```text
Glass Settings
      ->
Cyber Settings
```

Again:

same state

same music functionality

different interface.

This is the primary "magic moment."

---

# 19. Ideal Demo Video Storyboard

## 0:00–0:10

Show the Quest music application.

Make music.

Demonstrate that it is a real XR application.

## 0:10–0:15

Open the settings/dashboard.

Show generic UI.

## 0:15–0:20

Explain:

"Building the functionality wasn't the hard part. Finding and integrating polished spatial interfaces was."

## 0:20–0:30

Open Spatial website.

Search:

```text
settings
```

Show beautiful component cards.

## 0:30–0:35

Open:

```text
Glass Settings
```

Show preview.

## 0:35–0:45

Integrate it.

Ideal demonstration:

```text
Claude, replace our settings interface with this Spatial component.
```

Agent uses Spatial MCP/registry.

## 0:45–0:55

Return to Quest.

Settings interface is now completely different.

Application functionality remains identical.

## 0:55–1:05

Swap again.

Example:

```text
Glass -> Cyber
```

Show how quickly the UI changes.

## 1:05–1:15

Reveal architecture:

```text
Visual Marketplace
+
Component Registry
+
MCP
+
Developer Integration
```

## 1:15–1:25

Explain expansion beyond generic UI.

Show:

```text
Music
Healthcare
Training
Gaming
Design
```

## 1:25+

Show music-specific components / Rokoko gesture instrument.

End with the larger vision.

---

# 20. Website UX

The website should feel highly visual.

Potential homepage:

```text
SPATIAL

Beautiful components for spatial applications.

[ Browse Components ] [ Get Started ]


SEARCH

Search spatial components...


CATEGORIES

All
Settings
Buttons
Sliders
Knobs
Panels
Menus
Music


TRENDING

[ Glass Settings ]
[ Neon Slider ]
[ Minimal Panel ]
[ Spatial Mixer ]
[ Holographic Menu ]
```

Component cards should prioritize large visual previews.

---

# 21. Component Detail Page

Potential layout:

```text
GLASS SETTINGS

[ LARGE INTERACTIVE 3D PREVIEW ]


STYLE

Glass
Opacity
Accent
Scale
Depth


COMPATIBILITY

Quest 3 / 3S       Yes
OpenXR              Yes
Unity               Yes

INPUT

Hands               Yes
Controllers         Yes
Ray                  Yes


DEPENDENCIES

Unity XR Interaction Toolkit
...


ADD TO PROJECT

[ Add to Unity ]

or

spatial add glass-settings


[ View Source ]
```

Potential future feature:

```text
[ ENTER XR ]
```

allowing developers to physically test the component in-headset before installing it.

---

# 22. Component Discovery

Search/filter dimensions could eventually include:

## Component Type

- settings
- button
- slider
- menu
- panel
- music
- etc.

## Style

- glass
- minimal
- futuristic
- industrial
- neon
- playful
- professional
- holographic

## Platform

- Unity
- WebXR
- visionOS
- Android XR

## Device

- Quest
- Vision Pro
- Android XR
- PCVR

## Input

- hand
- controller
- gaze
- poke
- ray

## License

- open source
- commercial
- free
- paid

For MVP, use only filters needed for the demo.

---

# 23. Creator Ecosystem — Long-Term

Spatial should eventually allow third-party creators to publish components.

Example:

```text
Creator Profile

Alex Chen

18 components
120K installs

Components:

Glass Settings
Spatial Keyboard
Floating Calendar
Radial Inventory
Medical Viewer
```

Users can:

- preview
- install
- fork
- customize
- rate
- save
- follow creators

Potential future marketplace:

- free components
- paid components
- premium packs
- verified components
- creator revenue sharing

This creates a potential network effect.

---

# 24. Long-Term Product Evolution

## V0 — Hackathon

```text
Quest
+
Unity
+
small component registry
+
visual website
+
easy import
+
music demo
```

## V1 — Original Components

Develop our own polished component library.

Improve:

- quality
- consistency
- performance
- accessibility
- XR ergonomics

## V2 — Registry / Package System

Standardized manifests.

Dependency management.

Versioning.

Compatibility checking.

CLI.

## V3 — Community Marketplace

Third-party creators.

Profiles.

Ratings.

Collections.

Paid/free components.

## V4 — MCP / Agent Ecosystem

Claude/Cursor/etc. can:

- search
- inspect
- install
- configure
- replace components

## V5 — Visual Customization

Customize components before installing.

Potential controls:

- material
- color
- transparency
- scale
- typography
- animation
- interaction feedback

## V6 — Spatial Builder

Potential drag-and-drop interface.

Developer visually composes spatial interfaces from registry components.

Then exports to Unity/project.

## V7 — AI Composition

Developer types:

> Build me a floating settings dashboard with volume, reverb, haptics, and input controls using a glass aesthetic.

AI searches Spatial registry and composes known components.

## V8 — Cross-Platform Registry

Same conceptual component could have implementations for:

- Unity
- WebXR
- React Three Fiber
- visionOS
- Android XR
- potentially Unreal

Spatial becomes the discovery layer above frameworks.

---

# 25. Business Model — Future Hypothesis

Not necessary for MVP, but possible direction:

## Free / Open Source

- core components
- basic registry
- personal projects

Goal:

distribution and developer adoption.

## Pro

Possible:

- premium components
- premium themes
- advanced customization
- AI features
- builder
- private collections

## Teams

Potential:

- private component registries
- internal components
- shared themes
- design tokens
- version management
- team permissions

## Enterprise

Potential:

- company-specific spatial design systems
- private deployment
- support
- custom integrations
- hardware adapters
- cross-platform component systems

Business model requires validation.

Do not assume developers will pay until tested.

---

# 26. Enterprise Vision

Potential future product:

```text
NIKE SPATIAL DESIGN SYSTEM

NikeButton
NikePanel
NikeProductViewer
NikeCarousel
NikeTryOn
NikeMenu
```

Designers use the same component vocabulary.

Developers use the same components.

AI agents understand the same components.

This could become analogous to:

**Storybook + shadcn + design systems for spatial computing.**

---

# 27. Key Differentiation

We are NOT trying to beat:

Meta

Unity

OpenXR

Apple

Google

at their underlying XR technology.

We use them.

Conceptually:

```text
XR Hardware
     |
     v
OpenXR / Platform APIs
     |
     v
Meta / Unity / RealityKit / etc.
     |
     v
SPATIAL
     |
     v
Developer Application
```

Their job:

**make interaction possible.**

Our job:

**make polished interfaces easy to discover and integrate.**

---

# 28. What We Should NOT Build During Hackathon

Do NOT:

- build our own rendering engine
- build our own hand tracking
- recreate Meta Interaction SDK
- recreate Unity XR Toolkit
- support every headset
- support every XR framework
- build 50 mediocre components
- build a huge backend
- build a complete marketplace
- build a full no-code editor
- make Rokoko mandatory
- make the DAW too complicated
- spend most of the hackathon implementing basic sliders
- prematurely build enterprise infrastructure

Optimize for the demo thesis.

---

# 29. Hackathon MVP Scope

The MVP should probably contain approximately 6–10 components.

Possible:

## General

1. Default Settings
2. Glass Settings
3. Cyber Settings
4. Slider
5. Knob
6. Toggle / Button

## Music

7. Mixer
8. Drum Pad
9. Gesture Instrument

Potentially one additional component if useful.

Quality > quantity.

---

# 30. Primary MVP Metric

The key question:

> How quickly can a developer go from discovering a component on Spatial to seeing it working inside their existing Quest application?

Ideal target:

**minutes, not hours.**

The demo should make this process feel almost absurdly easy.

---

# 31. Required Architecture for Music Demo

Application logic must be separated from presentation.

Example:

```text
MusicApplication
      |
      v
MusicSettingsState

masterVolume
reverb
tempo
haptics
inputMode

      |
      +--------------------------+
      |             |            |
      v             v            v

DefaultUI       GlassUI       CyberUI
```

All three interfaces modify the same state.

Therefore swapping visual components does not affect music functionality.

This architecture is essential.

---

# 32. Main Technical Question To Solve Next

Determine the simplest practical mechanism for swapping/installing Unity XR components.

Research:

1. Unity Package Manager
2. Unity packages
3. Prefabs
4. Git-based packages
5. CLI installation
6. Unity Editor extensions
7. MCP-driven file installation
8. automatic dependency resolution
9. prefab/code integration
10. how coding agents can reliably modify Unity projects

Recommend the lowest-complexity architecture that creates the strongest hackathon demo while leaving a plausible path toward the long-term product.

---

# 33. Component Sourcing Task

We need to identify high-quality existing XR visual components we can legally use for the MVP.

For each candidate, research:

- repository/project
- URL
- screenshots/examples
- component types
- Unity version
- OpenXR compatibility
- Quest compatibility
- dependencies
- license
- whether modification is allowed
- whether redistribution is allowed
- attribution requirements
- quality
- ease of integration
- how visually impressive it is
- whether it can be restyled
- whether it can be normalized into our registry

Prioritize:

- settings panels
- sliders
- knobs
- toggles
- panels
- radial menus
- music controls
- futuristic/glass spatial UI

Never assume licensing.

Verify it.

---

# 34. Questions Still Open

These are intentionally NOT locked.

Research and refine them.

### Product

- What should the final name be?
- Is "Spatial" too generic?
- Is the primary framing registry, marketplace, library, or MCP?
- What is the strongest initial customer?
- Is Unity the correct first ecosystem?
- How large is the actual developer demand?

### Architecture

- What should component contracts look like?
- What should the manifest schema look like?
- How should dependencies work?
- How should components be installed?
- How should components be swapped?
- How much standardization is realistic across third-party components?
- Should components include source or remain packages?
- How do we avoid dependency conflicts?

### AI

- What MCP tools should exist?
- How does an agent visually choose among components?
- Can screenshots/previews be exposed to multimodal coding agents?
- How should AI understand component compatibility?
- How can agents automatically connect component state/events?

### UX

- What does the ideal component page look like?
- Should users customize before installing?
- Should we offer headset previews?
- What filters matter most?
- How should creators publish components?

### Business

- Who pays?
- Marketplace commission?
- Subscription?
- Teams?
- Enterprise?
- Open-source core?
- What becomes defensible?

### Hackathon

- What can realistically be built within available time?
- Which pieces maximize judge impact?
- Which features should be mocked versus actually functional?

---

# 35. Decision Framework

When making implementation decisions, prioritize in this order:

1. Does it clearly demonstrate the core thesis?
2. Does it make component integration feel dramatically easier?
3. Does it improve the demo?
4. Can it be completed reliably during the hackathon?
5. Does it create reusable infrastructure?
6. Does it support the long-term vision?

Do NOT prioritize architectural purity over shipping the MVP.

---

# 36. Core Demo Moment

The single most important moment is:

```text
Existing Music App
       |
       v
Generic Settings UI

       ↓

Developer discovers component

       ↓

Spatial

       ↓

Glass Settings

       ↓

One simple install / agent command

       ↓

Existing Music App

       ↓

Beautiful Glass Settings UI

       ↓

SAME APPLICATION STATE
SAME MUSIC FUNCTIONALITY
NEW VISUAL COMPONENT
```

Then ideally:

```text
Glass
  ↓
Cyber
```

in another extremely fast swap.

If this works smoothly and looks visually dramatic, the MVP succeeds.

---

# 37. Pitch

Working short pitch:

> Spatial is a visual component registry for spatial computing. Developers can discover, preview, and integrate beautiful XR components into existing applications instead of rebuilding interfaces from scratch.

Expanded:

> XR has powerful underlying SDKs, but polished spatial interfaces remain fragmented across repositories, samples, asset stores, and individual creators. Spatial gives developers one place to visually discover compatible components and integrate them directly into their existing projects. Humans can browse visually, while coding agents can access the same registry through an MCP-style interface to search, install, configure, and swap components.

Demo explanation:

> To prove the concept, we're building a spatial music application whose dashboard can switch between completely different UI component implementations without changing the underlying music application. We're also experimenting with music-specific components such as mixers, drum pads, and gesture-controlled instruments to demonstrate how the registry can eventually expand beyond generic UI into vertical-specific spatial components.

Long-term:

> We're building the component ecosystem for spatial computing.

---

# 38. Current Product Thesis

Treat this as the current working thesis:

**Spatial is not primarily an XR framework.**

**Spatial is not primarily a DAW.**

**Spatial is not primarily a design tool.**

**Spatial is not replacing Unity or Meta.**

Spatial is:

> **A developer-first visual registry and integration layer for reusable spatial components.**

Its value comes from:

```text
DISCOVERY
+
VISUAL PREVIEW
+
COMPATIBILITY
+
STANDARDIZATION
+
EASY INSTALLATION
+
AI/AGENT ACCESS
+
COMMUNITY COMPONENTS
```

The DAW is the reference implementation demonstrating that the system works in a sophisticated real-world XR application.

---

# 39. Instructions for Claude

When helping with this project:

1. Preserve the distinction between Spatial and the music demo.
2. Challenge weak assumptions.
3. Research before making claims about existing XR tools or competitors.
4. Prefer existing infrastructure over reinventing solved XR functionality.
5. Verify licenses before recommending third-party components for redistribution.
6. Optimize the hackathon implementation for speed and reliability.
7. Keep application logic separate from visual components.
8. Design everything with future MCP/agent access in mind.
9. Avoid premature cross-platform complexity.
10. Keep the component swap as the central MVP experience.
11. When proposing features, distinguish between:
   - MUST HAVE for hackathon
   - SHOULD HAVE
   - STRETCH
   - POST-HACKATHON
12. When suggesting architecture, explain the tradeoffs.
13. When identifying existing components, provide exact repositories and licenses.
14. When uncertain, say what needs validation instead of inventing an answer.
15. Continuously look for ways to make the workflow:

**discover → select → integrate → swap**

faster and more visually impressive.

---

# 40. Immediate Next Objective

Before substantial implementation, produce a concrete technical plan answering:

1. What existing open-source XR component libraries should we use?
2. Which exact components should we use for the demo?
3. What are their licenses?
4. What Unity/Quest stack should we use?
5. What should the Spatial registry schema look like for the MVP?
6. What is the simplest installation mechanism?
7. How should the music application's state be architected so UI implementations are interchangeable?
8. What MCP tools would be necessary for the demo?
9. What should actually work versus be mocked?
10. How should work be divided between two developers?
11. What is the hour-by-hour build order?
12. What are the highest-risk technical dependencies and fallbacks?
13. What exact sequence should the final demo video follow?

Do not begin by overengineering the long-term platform.

First optimize for a convincing, working hackathon MVP that demonstrates the core Spatial thesis.

---

# 41. LOCKED PLAN: Spatial Studio (locked 12:45 PM Oct 17)

> Event rules + judging: https://moltenhack.com/agents.md · Component list + owners: [COMPONENTS.md](COMPONENTS.md) · Status: [LOG.md](LOG.md)

## One sentence

**Spatial Studio: drag premade 3D components into a scene, on your laptop or in VR, wire them up, and launch a real XR app. We built a working DAW in 3 minutes.**

## What it is

| Part | What it does |
|---|---|
| **Studio** (main product) | 3D dev studio. Left: component library. Center: 3D scene (laptop with mouse, or headset with hands). Right: inspector (position, "controls: tempo" bindings). Bottom: **live code panel** (generated TSX, Copy / Export). **Launch** opens the built app at its own URL. |
| **Marketplace / website** | Shop for components: browse, live 3D preview, author / license / price, **Copy code**, **Copy for Claude Code**. Long-term: anyone uploads, shares or sells components ("GitHub for XR components, consolidated"). **Today: browse + copy only; upload/sell = post-hackathon.** |
| **MCP** | Claude Code / Cursor / any MCP client: `search_components`, `get_component` (code), `add_component`, `get_layout`. Claude adds logic on top of what you built. |

**Demo use case:** a developer builds a **music DAW** (drum pads, sequencer, tempo knob, faders, VU meter) in the Studio without writing component code, launches it, and plays it in the Quest.

## Decisions

| Topic | Decision |
|---|---|
| Platform | **WebXR**: Next.js + Tailwind + React Three Fiber + `@react-three/xr` + `@react-three/drei` + `pmndrs/uikit` (all MIT). |
| Code in Studio | **Live read-only code panel** + Copy/Export. Real editing = Claude via MCP. No in-Studio editor. |
| Wiring | Inspector sets "controls: <name>" on a component. Components sharing a name share the value. Generated code = one `useState` per name + positioned components. Claude can add logic on top. |
| Launch | Save layout → `/apps/<id>` renders it → open on Quest and play. Developer path: MCP `get_layout` → Claude builds it into their own project. |
| Laptop + headset | **Laptop first** (drei `PivotControls` to move things with the mouse), **then headset** (`@react-three/handle` to grab). Both today. |
| Catalog | ~21 working components built around the DAW (Tier 1), the rest shown as "Coming soon". |
| Marketplace | Registry carries `author`, `license`, `price`. Site shows them. Upload/sell later. |
| Cut today | Voice, Unity, Rokoko, uploads/payments, in-Studio code editing. |

## Component contract (copy-paste rule, applies to every component)

- **One self-contained `.tsx` file**, default export, **every prop optional** (renders with no props).
- Imports **only**: `react`, `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/uikit*`, `@react-three/xr`, `tone` (audio components).
- Values via plain props: `value` + `onChange(v)` for anything adjustable, `onPress()` for buttons, `playing` / `bpm` for audio ones. **No imports from our own code.**
- Sound: audio components use Tone.js's global `Tone.Transport` internally, so they sync without shared code.

## Shared formats (change only after logging in LOG.md)

```
registry/index.json  [{
  name, displayName, category, tier: 1|2, status: "ready"|"soon",
  tags, description, file, deps: ["tone", ...],
  author, license: "MIT", price: "free",
  bindable: [{ prop: "value", type: "number", min, max, default }],
  kind?: "section"|"basic", style?: "default"|"glass"|"horizon", aliases?, xrOnly?   // optional, used by the site
}]
All paths are relative to the app root `web/` (registry = web/registry/index.json, components = web/components/spatial/).
Layout (Studio ⇄ /api/layout ⇄ /apps/<id> ⇄ MCP):
  { id, name, items: [{ id, component, position, rotation, scale, bind: { value: "tempo" }, props }] }
```

## Person 1: Studio + launch + MCP + **XR interaction**

Plan detail: `/Users/ek/.claude/plans/delegated-forging-moth.md` (local). Order: laptop Studio with general components → VR → DAW.

| # | Task | Done when |
|---|---|---|
| 1.1 | Core: `lib/layout.ts` (format, bindings), `lib/codegen.ts`, `lib/studio-store.ts`, tests (`node --test web/lib/*.test.ts`) | Tests pass ✅ |
| 1.2 | Studio on laptop: library panel, R3F scene, click-to-add, **grab bar** to move (`@react-three/handle`, works with mouse and hands), select, delete | Build a scene with the mouse ✅ |
| 1.3 | Inspector: transform + "controls: <name>" per `bindable` prop; shared values | Two components bound to one name stay in sync ✅ (code panel verified) |
| 1.4 | Live code panel: layout → generated TSX, Copy / Download | Code matches the scene ✅ |
| 1.5 | Layout API (`POST/GET /api/layout`, Upstash Redis on Vercel, memory fallback locally) + **Launch** → `/apps/[id]` | Launched app renders at its URL ✅ (Upstash not yet configured) |
| 1.6 | **XR interaction layer** (see below): hands + controllers, poke, pinch, grab, ray, hover cursor, Enter VR/AR, VR shelf to add components | Every interaction works in the Quest (built; **not yet tested on a real Quest**) |
| 1.7 | MCP: `search_components`, `get_component`, `add_component`, `get_layout` | Claude Code rebuilds a layout in a fresh project (server ✅ 6 tests; end-to-end with Claude pending) |
| 1.8 | DAW demo build (with P2's music components) | Build → Launch → play in Quest |

### XR interaction layer (Person 1 owns how the body drives things)

| Input | Gesture | What it does | Built on |
|---|---|---|---|
| Hand, near | **Poke** (fingertip touches) | Press buttons, drag sliders, toggle | `@react-three/xr` touch pointer → normal `onClick` / `onPointerDown/Up` |
| Hand, far | **Ray + pinch** | Click things out of reach | ray pointer, pinch = click |
| Hand | **Grab** (pinch/fist on a grab bar) | Move a placed component | `@react-three/handle` grab bar |
| Controller | Trigger = click, grip = grab | Same as hands | ray + grab pointers |
| Both | **Hover feedback** | Ray/cursor visible; hovered component highlights | `onPointerOver/Out` |
| Laptop | Mouse click, drag grab bar, orbit camera | Same actions on desktop | `noEvents` + `<PointerEvents/>`, `OrbitHandles` |

**Interaction contract for components (Person 2 follow this, Person 1 guarantees the input side):**
- Use R3F pointer events only (`onClick`, `onPointerDown/Up`, `onPointerOver/Out`, `onPointerMove`), never DOM events. Hands, controllers and mouse all arrive as these.
- Buttons fire on `onClick` (poke and pinch both produce it). Press-depth / hold effects use `onPointerDown` / `onPointerUp`. Note: `click` only fires if up happens on the same object within 300 ms.
- Hover states via `onPointerOver/Out` (fingertip approach + ray hover).
- Hit targets ≥ 2 cm: at `pixelSize 0.002` that's ≥ 10 px, so aim for 20+ px controls and 44 px rows. Don't `stopPropagation` (the Studio needs selection clicks).

## Person 2: Components + marketplace website

| # | Task | Done when |
|---|---|---|
| 2.1 | Next.js + Tailwind scaffold (**push first**) | `npm run dev` works |
| 2.2 | **General UI components first, then music** (see COMPONENTS.md), following the contract + the **interaction contract** above. The product is for every XR developer; the DAW is only the demo | Each renders with no props + works with value/onChange |
| 2.2b | **Look and feel owner:** animation, effects (glow, press depth, ripple, glass), formatting/layout of every component | Components feel great under poke/pinch/hover |
| 2.3 | Request the **Kaedim** drum pad model early (fallback: rounded box) | Model in `public/models/` |
| 2.4 | Marketplace home: search, categories, cards with live 3D preview, author/price badges, "Coming soon" cards | Search works |
| 2.5 | Component page: big live preview, props table, **Copy code**, **Copy for Claude Code** (code + `npm i` line), "Open in Studio" | Paste into Claude Code works |
| 2.6 | Deploy marketplace to Vercel | Public URL |

## Split update (1:15 PM): Evan = backend, Danny = frontend

Full task list with "done when": https://claude.ai/artifact/UDisGbDK9Ffx5c95Dmifzn (snapshot; this section is the plan of record).

- **Moves to Person 1 (Evan):** 2.6 Vercel deploy + Upstash; registry data (backfill `author`/`license`/`price`/`deps`, add entries for every Tier 1 component); the **sound side of the music components** (drum-pad, step-sequencer, tempo-display, vu-meter, piano-keys, transport fixes), built working with plain meshes; Studio fixes (knob `min`/`max` so "tempo" can be 60–180 BPM, `/studio?add=<name>`).
- **Person 2 (Danny) keeps:** general components (label, press-button, slider, spring-toggle, glass-card first; then glow-button, glass-button, tabs, window, fader), look and feel of every component (**restyles the music components 4:00–4:45 without changing props**), marketplace (badges, props table, real MCP install line instead of `npx spatial add`, preview canvas limit), Kaedim, submission form. Install `@react-three/drei` first.
- **Cut to Tier 2:** xy-pad, mixer-strip, waveform, wrist-menu.
- **Headset:** the venue's Quest, test both apps as soon as we get it.

## Timeline (submit 6:30 PM)

| Time | Person 1 | Person 2 |
|---|---|---|
| 12:45–1:15 | Lock formats together, 1.1 | 2.1 scaffold |
| 1:15–3:00 | 1.2–1.4 Studio on laptop | 2.2 general components, 2.3 |
| 3:00–4:00 | 1.5 launch, 1.6 headset | 2.2 music, 2.4 |
| 4:00–4:45 | 1.7 MCP | 2.5, 2.6 |
| 4:45–5:30 | **Integration: build the DAW in the Studio 3×** | same |
| 5:30–6:15 | Record video (<1 min, no slides): build DAW → Launch → play in Quest | Fill form, credit libraries |
| 6:30 | Submitted | |

## Top risks

| Risk | Fallback |
|---|---|
| Studio drag/move is fiddly | Click-to-add at a grid spot + inspector number fields |
| Hand grab in headset is fiddly | Arrange on laptop, headset is for **playing** the launched DAW (still "works in space" + hands) |
| Audio timing across components | All audio components use the global `Tone.Transport` |
| Layout storage on Vercel | Run Studio + launch from the laptop's HTTPS dev server (`next dev --experimental-https`) |
| One venue Quest | Desktop XR emulator for dev; book one solid headset block |
