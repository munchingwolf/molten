// Patch-cable wiring rules (Studio jacks + cables). Pure, so `node --test` runs it.
import type { Bindable, Item, Vec3 } from "./layout.ts"

/** One jack = one bindable prop of one placed item. */
export type JackRef = { id: string; prop: string }
type Of = (component: string) => Bindable[]

export const jackKey = (j: JackRef) => `${j.id}:${j.prop}`

// Prop names that say nothing about what the value means; the other side's name wins.
const GENERIC = new Set(["value", "checked", "playing", "x", "y"])

function lookup(items: Item[], of: Of, j: JackRef) {
  const item = items.find((i) => i.id === j.id)
  const b = item && of(item.component).find((b) => b.prop === j.prop)
  return item && b ? { item, b } : null
}

/** Every jack currently bound to `name`, in item order. */
function members(items: Item[], of: Of, name: string): JackRef[] {
  return items.flatMap((i) => of(i.component).filter((b) => i.bind[b.prop] === name).map((b) => ({ id: i.id, prop: b.prop })))
}

/** `base`, or `base2`, `base3`… whichever no item uses yet. */
export function uniqueName(items: Item[], base: string) {
  const used = new Set(items.flatMap((i) => Object.values(i.bind)))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}${n}`)) n++
  return `${base}${n}`
}

export type LinkPlan =
  | { ok: false; reason: "missing" | "type" | "same" }
  /** Apply with store.bind(id, prop, name) per bind, then update props per range patch. */
  | { ok: true; name: string; binds: JackRef[]; ranges: { id: string; min: number; max: number }[] }

/** What linking jack `a` (dragged from) to jack `b` (dropped on) should do. */
export function planLink(items: Item[], of: Of, a: JackRef, b: JackRef): LinkPlan {
  const A = lookup(items, of, a)
  const B = lookup(items, of, b)
  if (!A || !B) return { ok: false, reason: "missing" }
  if (A.b.type !== B.b.type) return { ok: false, reason: "type" }
  const na = A.item.bind[a.prop]
  const nb = B.item.bind[b.prop]
  if (na && na === nb) return { ok: false, reason: "same" }

  let name: string
  let binds: JackRef[]
  if (na && nb) [name, binds] = [na, members(items, of, nb)] // merge b's group into a's
  else if (na) [name, binds] = [na, [b]]
  else if (nb) [name, binds] = [nb, [a]]
  else {
    const base = !GENERIC.has(b.prop) ? b.prop : !GENERIC.has(a.prop) ? a.prop : "value"
    ;[name, binds] = [uniqueName(items, base), [a, b]]
  }

  // A `range` member (knob) without its own span adopts a fixed-span member's (transport.bpm 60–180).
  const group = [...members(items, of, name), ...binds].map((j) => lookup(items, of, j)!)
  const span = group.find((m) => !m.b.range && typeof m.b.min === "number" && typeof m.b.max === "number")?.b
  const ranges = span
    ? group
        .filter((m) => m.b.range && m.item.props?.min === undefined && m.item.props?.max === undefined)
        .map((m) => ({ id: m.item.id, min: span.min!, max: span.max! }))
    : []
  return { ok: true, name, binds, ranges }
}

/** Cables to draw: each jack bound to a name connects to the first jack with that name. */
export function cablePairs(items: Item[], of: Of) {
  const first = new Map<string, JackRef>()
  const pairs: { from: JackRef; to: JackRef; name: string }[] = []
  for (const item of items)
    for (const b of of(item.component)) {
      const name = item.bind[b.prop]
      if (!name) continue
      const j = { id: item.id, prop: b.prop }
      const f = first.get(name)
      if (f) pairs.push({ from: f, to: j, name })
      else first.set(name, j)
    }
  return pairs
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: Vec3) => Math.sqrt(dot(a, a))

/**
 * Jack nearest the release, within `max` metres. A far pointer (mouse, controller/hand ray) is measured
 * against its whole ray (`origin` → `point`), since the captured point floats at the grab distance.
 * A near one (fingertip) is measured against the point itself.
 */
export function nearestJack(
  jacks: { ref: JackRef; pos: Vec3 }[],
  point: Vec3,
  origin: Vec3 | null,
  exclude: JackRef,
  max = 0.06,
): JackRef | null {
  const ray = origin ? sub(point, origin) : null
  const dir = origin && ray && len(ray) > 0.15 ? (ray.map((v) => v / len(ray)) as Vec3) : null
  let best: JackRef | null = null
  let bestD = max
  for (const { ref, pos } of jacks) {
    if (ref.id === exclude.id && ref.prop === exclude.prop) continue
    let d: number
    if (dir && origin) {
      const rel = sub(pos, origin)
      const t = dot(rel, dir)
      d = t <= 0 ? len(rel) : len(sub(rel, dir.map((v) => v * t) as Vec3))
    } else d = len(sub(pos, point))
    if (d <= bestD) [best, bestD] = [ref, d]
  }
  return best
}

const PALETTE = ["#1FB54A", "#4C9AFF", "#F5A524", "#F25FA6", "#2EC4D6", "#A78BFA"]

/** Stable colour per shared name (doesn't shift when other cables come and go). */
export function nameColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}
