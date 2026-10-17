// Guided templates: every template item is a "slot" (a ghost outline where that component belongs).
// A template is ONE component: a free frame (root) whose children are the template items, in template-local space.
// Pure logic (three math only, no React), so plain Node can run guides.test.ts.
import { Euler, Matrix4, Quaternion, Vector3 } from "three"
import type { Item, Vec3 } from "./layout.ts"

/**
 * A template item. `size` (m, before `scale`) is the ghost box, `center` that box's centre relative to the component's
 * origin (e.g. [0, h/2, 0] for one whose origin is its base), `hint` its label, `order` the build order (default: array index).
 */
export type Slot = Item & { size?: Vec3; center?: Vec3; hint?: string; order?: number }

/** Layout-shaped template JSON from web/registry/templates/*.json (`id` = file name, added by /api/templates). */
export type Template = {
  id?: string
  name: string
  slug?: string
  category?: string
  description?: string
  environment?: string
  items: Slot[]
}

/** slot id → id of the item that fills it. */
export type Filled = Record<string, string>

export const DEFAULT_SIZE: Vec3 = [0.3, 0.3, 0.3]

/** Template items as slots: ids guaranteed, `order` defaulted to the array position (1-based). */
export const toSlots = (items: Slot[]): Slot[] =>
  items.map((s, i) => ({ ...s, id: s.id || `slot-${i + 1}`, order: s.order ?? i + 1 }))

/** Only the entries whose item still exists (deleting or undoing a placed item frees its slot again). */
export const liveFilled = (filled: Filled, items: { id: string }[]): Filled => {
  const ids = new Set(items.map((i) => i.id))
  return Object.fromEntries(Object.entries(filled).filter(([, itemId]) => ids.has(itemId)))
}

/** Unfilled slots, lowest `order` first (ties keep template order). */
export const openSlots = (slots: Slot[], filled: Filled): Slot[] =>
  slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !filled[s.id])
    .sort((a, b) => (a.s.order ?? a.i + 1) - (b.s.order ?? b.i + 1) || a.i - b.i)
    .map(({ s }) => s)

export const nextSlot = (slots: Slot[], filled: Filled): Slot | null => openSlots(slots, filled)[0] ?? null

/** Distance from `p` to the slot's ghost box (0 inside it). shortcut: box treated as axis-aligned, fine for the small yaws templates use. */
const distToBox = (p: Vec3, s: Slot) => {
  const size = s.size ?? DEFAULT_SIZE
  const c = s.center ?? [0, 0, 0]
  const d = [0, 1, 2].map((k) => Math.max(0, Math.abs(p[k] - s.position[k] - c[k] * s.scale) - (size[k] * s.scale) / 2))
  return Math.hypot(d[0], d[1], d[2])
}

/**
 * Slot an item released at `item.position` should snap into: the nearest unfilled slot for the same component whose
 * ghost box is within `reach` metres (inside counts as 0), else null.
 */
export function matchSlot(slots: Slot[], filled: Filled, item: Pick<Item, "component" | "position">, reach = 0.35): Slot | null {
  let best: { s: Slot; d: number; c: number } | null = null
  for (const s of slots) {
    if (filled[s.id] || s.component !== item.component) continue
    const d = distToBox(item.position, s)
    const c = Math.hypot(item.position[0] - s.position[0], item.position[1] - s.position[1], item.position[2] - s.position[2])
    if (d <= reach && (!best || d < best.d || (d === best.d && c < best.c))) best = { s, d, c }
  }
  return best?.s ?? null
}

/** What a placed item takes from its slot: exact transform, the template's props and wiring, its layer name. */
export function placeFromSlot(slot: Slot): Pick<Item, "position" | "rotation" | "scale" | "bind"> & Partial<Pick<Item, "props" | "name">> {
  return {
    position: [...slot.position] as Vec3,
    rotation: [...slot.rotation] as Vec3,
    scale: slot.scale ?? 1,
    bind: { ...slot.bind },
    ...(slot.props ? { props: { ...slot.props } } : {}),
    ...(slot.name ? { name: slot.name } : {}),
  }
}

export function progress(slots: Slot[], filled: Filled) {
  const open = openSlots(slots, filled)
  return { placed: slots.length - open.length, total: slots.length, next: open[0] ?? null }
}

type Transform = Pick<Item, "position" | "rotation" | "scale">
const matrixOf = (t: Transform) =>
  new Matrix4().compose(new Vector3(...t.position), new Quaternion().setFromEuler(new Euler(...t.rotation)), new Vector3(t.scale, t.scale, t.scale))

/** A point in `root`'s parent space (e.g. the world) expressed in the root's local space. */
export const toLocal = (root: Transform, p: Vec3): Vec3 => new Vector3(...p).applyMatrix4(matrixOf(root).invert()).toArray() as Vec3

/** A child's transform (local to `root`) expressed in the root's parent space: what it keeps when the root is ungrouped. */
export function toWorld(root: Transform, child: Transform): Transform {
  const position = new Vector3()
  const q = new Quaternion()
  const s = new Vector3()
  matrixOf(root).multiply(matrixOf(child)).decompose(position, q, s)
  const e = new Euler().setFromQuaternion(q, "XYZ")
  return { position: position.toArray() as Vec3, rotation: [e.x, e.y, e.z], scale: s.x }
}

/** Slots posed in the template root's space: a slot whose `parentId` names another slot (a lane in the track wall) sits inside it. */
export function posed(slots: Slot[]): Slot[] {
  const byId = new Map(slots.map((s) => [s.id, s]))
  const pose = (s: Slot, depth = 0): Transform => {
    const parent = s.parentId ? byId.get(s.parentId) : undefined
    return parent && depth < 8 ? toWorld(pose(parent, depth + 1), s) : s
  }
  return slots.map((s) => ({ ...s, ...pose(s) }))
}
