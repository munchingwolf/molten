// Snapping math for Studio transforms. No relative imports so `node --test` can run snap.test.ts directly.
import { Quaternion, Vector3 } from "three"

type XYZ = { x: number; y: number; z: number }
/** Axis-aligned world bounds; a three `Box3` fits. */
export type Bounds = { min: XYZ; max: XYZ }

/** Grid steps: 2.5 cm, 15°, 0.05 scale. */
export const SNAP = { move: 0.025, angle: Math.PI / 12, scale: 0.05 }
export const MIN_SCALE = 0.2
export const MAX_SCALE = 5

export const snapTo = (v: number, step: number) => Math.round(v / step) * step
export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

const SURFACE_NAMES = ["desk", "stage", "table"]
/** Components other items can rest on: desk/stage/table, or any registry entry tagged "surface". */
export const isSurface = (name: string, tags: string[] = []) => SURFACE_NAMES.includes(name) || tags.includes("surface")

/**
 * Height to add to `item` so it rests exactly on the highest surface top under its centre, or 0 if none qualifies.
 * A surface qualifies when the item's bottom is at most `reach` above its top (or sunk at most 2 cm into it).
 */
export function restOn(item: Bounds, surfaces: Bounds[], reach = 0.08): number {
  const cx = (item.min.x + item.max.x) / 2
  const cz = (item.min.z + item.max.z) / 2
  let best: number | undefined
  for (const s of surfaces) {
    const gap = item.min.y - s.max.y
    const under = cx >= s.min.x && cx <= s.max.x && cz >= s.min.z && cz <= s.max.z
    if (under && gap >= -0.02 && gap <= reach && (best === undefined || s.max.y > best)) best = s.max.y
  }
  return best === undefined ? 0 : best - item.min.y
}

const axis = new Vector3()
/** Rounds the rotation from `from` to `q` to whole `step`s about the same axis. Mutates and returns `q`. */
export function snapRotation(q: Quaternion, from: Quaternion, step: number): Quaternion {
  const delta = q.clone().multiply(from.clone().invert()) // q = delta * from
  if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w) // shortest way round
  const half = Math.acos(Math.min(1, delta.w))
  const s = Math.sin(half)
  if (s < 1e-6) return q.copy(from)
  return q.setFromAxisAngle(axis.set(delta.x / s, delta.y / s, delta.z / s), snapTo(2 * half, step)).multiply(from)
}

export type Mount = { position: [number, number, number]; yaw?: number }

/**
 * Wall mount: items tagged `mount:wall` have their origin on their back face, facing +Z. On release, if `origin` is
 * within `reach` of a vertical face of a `wall` item's bounds, put the origin on that face and turn it to face out
 * (away from a solid's centre; toward the centre when the item is inside the bounds, i.e. a room's inner walls).
 */
export function mountOnWall(origin: XYZ, walls: Bounds[], reach = 0.1): Mount | null {
  let best: (Mount & { d: number }) | null = null
  for (const w of walls) {
    const inX = origin.x >= w.min.x - reach && origin.x <= w.max.x + reach
    const inZ = origin.z >= w.min.z - reach && origin.z <= w.max.z + reach
    const inY = origin.y >= w.min.y && origin.y <= w.max.y
    if (!inY) continue
    const inside = origin.x > w.min.x && origin.x < w.max.x && origin.z > w.min.z && origin.z < w.max.z
    const cx = (w.min.x + w.max.x) / 2
    const cz = (w.min.z + w.max.z) / 2
    const faces: { axis: "x" | "z"; at: number; ok: boolean }[] = [
      { axis: "x", at: w.min.x, ok: inZ }, { axis: "x", at: w.max.x, ok: inZ },
      { axis: "z", at: w.min.z, ok: inX }, { axis: "z", at: w.max.z, ok: inX },
    ]
    for (const f of faces) {
      if (!f.ok) continue
      const d = Math.abs(origin[f.axis] - f.at)
      if (d > reach || (best && d >= best.d)) continue
      const centre = f.axis === "x" ? cx : cz
      // +1 when the item should face +axis: outside faces point away from the centre, inside ones toward it.
      const sign = Math.sign(f.at - centre) * (inside ? -1 : 1) || 1
      const yaw = f.axis === "z" ? (sign > 0 ? 0 : Math.PI) : sign > 0 ? Math.PI / 2 : -Math.PI / 2
      const position: [number, number, number] = [origin.x, origin.y, origin.z]
      position[f.axis === "x" ? 0 : 2] = f.at
      best = { position, yaw, d }
    }
  }
  return best && { position: best.position, yaw: best.yaw }
}

/** Ceiling mount: items tagged `mount:ceiling` hang from their origin at the ceiling of the room they're in, else 2.6 m. */
export function mountOnCeiling(origin: XYZ, rooms: Bounds[], fallback = 2.6): Mount {
  const room = rooms.find((r) => origin.x > r.min.x && origin.x < r.max.x && origin.z > r.min.z && origin.z < r.max.z)
  return { position: [origin.x, room ? room.max.y : fallback, origin.z] }
}
