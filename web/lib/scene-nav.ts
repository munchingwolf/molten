// Scene navigation: a component fires `window.dispatchEvent(new CustomEvent("spatial:go", { detail: { to } }))`
// (portal, nav-button, or your own), and the Studio's Play mode and launched apps switch scenes. Components never
// import this file, so they stay copy-pasteable; outside Spatial the event simply goes unheard.
export const GO_EVENT = "spatial:go"

type Named = { id: string; name: string }

/** Scene id for `to`: a scene name (case and spacing ignored), a 1-based number, "next", or "back"/"prev". Null if none. */
export function resolveScene(scenes: Named[], to: string, currentId: string): string | null {
  if (!scenes.length) return null
  const key = to.trim().toLowerCase().replace(/\s+/g, " ")
  const at = Math.max(0, scenes.findIndex((s) => s.id === currentId))
  if (key === "next") return scenes[(at + 1) % scenes.length].id
  if (key === "back" || key === "prev" || key === "previous") return scenes[(at - 1 + scenes.length) % scenes.length].id
  const byName = scenes.find((s) => s.name.trim().toLowerCase().replace(/\s+/g, " ") === key)
  if (byName) return byName.id
  const n = Number(key)
  return Number.isInteger(n) && n >= 1 && n <= scenes.length ? scenes[n - 1].id : null
}
