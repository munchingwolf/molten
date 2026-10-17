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

# 41. Hackathon Plan & Work Split (WebXR, updated 1:05 PM Oct 17)

> Supersedes §7 (Unity), §13 (music app) and older plans. Event rules and judging: https://moltenhack.com/agents.md

## What we're building

**Spatial: a library of 3D UI components for XR (21st.dev / shadcn for spatial apps), usable from anywhere you build.**

One catalog, three ways in:

| Way in | For | What happens |
|---|---|---|
| **Website** (laptop) | Browsing | See components live in 3D, copy the code |
| **MCP** (Claude Code, Cursor, any MCP client) | Building in your own tool (an XR app, a DAW, a site) | The agent searches the catalog, pulls components into the project, and edits them, like 21st.dev's MCP for websites |
| **Studio** (headset) | Creating | Grab components from a floating catalog and place them (hands). Restyle them by voice. Save the layout. The MCP's `get_layout` lets Claude turn it into code |

## Decisions

| Topic | Decision |
|---|---|
| Platform | **WebXR**: Next.js + Tailwind + React Three Fiber + `@react-three/xr` + `pmndrs/uikit` (MIT). One app = website (`/`) + Studio (`/studio`). |
| Components | Featured: **finished XR sections** (settings panel, media player, tab bar/dock, wrist menu, toast, profile card, confirm dialog, stats dashboard), 2–3 styles each (Default/shadcn, Glass/apfel, Horizon/Meta). Basics tab: the uikit primitives. |
| Component = | A React (.tsx) file. "Add" = copy the file into your project (shadcn model). |
| Demo (judged) | In headset: grab and place components (**hands**), "make it glass" (**voice**), Save. Then Claude Code + Spatial MCP → `get_layout` → code in the project. Navigate track. |
| Cut for today | Audio engine, music/DAW components, Kaedim drum pad (**later phase**), Unity, Rokoko. |

## Shared contract (lock first, 20 min together)

```
registry/index.json     pure data, read by website, Studio, voice, MCP:
  [{ name, displayName, category, kind: "section"|"basic", style, tags, aliases, description, file }]
components/spatial/     one .tsx per component, default export, no required props
lib/registry.ts         name → React component map (React app only)
Layout (Studio → server → MCP):
  { id, items: [{ component, position:[x,y,z], rotation:[x,y,z], scale }] }
```

Change these only after logging it in LOG.md.

## Person 1: Studio + MCP + server

| # | Task | Done when |
|---|---|---|
| 1.1 | `registry/index.json` + `lib/registry.ts` + 2 stub components so work isn't blocked | Imports work |
| 1.2 | `/studio`: `<XR>` scene (AR passthrough), hands + controllers | Shows in Quest browser |
| 1.3 | Floating catalog shelf: live mini-previews. **Tap** to place in front of you (fallback), then **grab** to move (`@react-three/handle`) | Place + move works in headset |
| 1.4 | Voice (ElevenLabs `useScribe` + `/api/scribe-token`): "make it glass / horizon / default" restyles the selected item; "add a <thing>"; "bigger/smaller"; "save" | Works in headset |
| 1.5 | Layout save: `POST /api/layout`, `GET /api/layout/:id` (shortcut: in-memory/file, needs dev server) | Studio saves, curl reads |
| 1.6 | MCP server (`mcp/`): `search_components`, `get_component` (returns code), `add_component` (copies .tsx into a project), `get_layout` | Claude Code installs a component + rebuilds a saved layout |

## Person 2: Website + components

| # | Task | Done when |
|---|---|---|
| 2.1 | Next.js + Tailwind scaffold (push ASAP, Person 1 builds inside it) | `npm run dev` works |
| 2.2 | **Finished sections** (list above) in 2–3 styles each, from uikit kits | ~8 sections render |
| 2.3 | Home: hero, search, category chips, cards with **live 3D previews** | Search filters |
| 2.4 | Detail page: big live preview, style switcher, **Copy code**, **Copy MCP prompt**, "Open in Studio" | Copy works |
| 2.5 | Basics tab (uikit primitives) | Listed |
| 2.6 | Deploy (Vercel) for the public site | URL works |

## Timeline (submit by 6:30 PM)

| Time | |
|---|---|
| 1:05–1:30 | Lock contract; scaffold pushed |
| 1:30–3:30 | P1: 1.1–1.3 · P2: 2.2–2.3 |
| ~3:30 | **First headset test** |
| 3:30–5:15 | P1: 1.4–1.6 · P2: 2.4–2.6 |
| 5:15–5:45 | Integration: full demo run 3× |
| 5:45–6:15 | Record video in headset (<1 min, no slides), fill form, credit uikit/R3F/ElevenLabs |
| 6:30 | Submitted |

## Top risks

| Risk | Fallback |
|---|---|
| ElevenLabs/mic fails in Quest browser | Web Speech API; else voice from laptop mic drives the headset via the same server |
| Grab is fiddly | Tap-to-place already works |
| Layout save needs persistence on Vercel | Demo from the laptop's HTTPS dev server (`next dev --experimental-https`) |
| One venue Quest | Desktop XR emulator for dev; book one solid headset block |
