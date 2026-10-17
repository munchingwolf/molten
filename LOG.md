# Team Log

Shared status log so both teammates (and their Claude sessions) know what's going on.

## Rules (both of us + our Claudes)

- **Read this file before starting work.** `git pull` first.
- **Add an entry after anything the other person should know:** a decision, a finished task, a blocker, a change to a shared format.
- Newest entries go **at the top** of the Log section. Format:
  `### HH:MM: <name>: <one-line summary>` then a few bullets max.
- Commit and push right after adding an entry (`git pull --rebase && git commit -am "log: ..." && git push`).
- Changing something the other person depends on (registry format, file layout, URLs)? Log it **before** pushing the change.

## Log

### 12:10: Person 1: event facts + proposed pivot (needs Person 2 sign-off)
- MOLTEN is **today**. Hacking ends **6:30 PM** (submit form + demo video, no slides or the video is disqualified). Hardware must be committed by **1:00 PM**.
- Venue has **one** Quest 3S for ~90 people (open slots ~3:00–4:30 PM). We need a headset or the project fails "works in space".
- Judging (equal weight): works live in headset · 2+ body inputs (hands, voice…) · new way to create · worth using again · clear in seconds. Business/market NOT scored. Full brief: https://moltenhack.com/agents.md
- **Proposed pivot (not final):** drop Unity → **WebXR** (Next.js + React Three Fiber + @react-three/xr + pmndrs/uikit). Same app is the laptop catalog site and the in-headset experience. Demo: grab a component from a floating catalog in VR (hands), say "make it cyber" to swap live (voice). Navigate track. MCP becomes stretch.
- SPEC.md §41 task split is **outdated** until we confirm the pivot.
