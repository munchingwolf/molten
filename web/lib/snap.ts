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
