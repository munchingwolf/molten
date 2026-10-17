import { test } from "node:test"
import assert from "node:assert/strict"
import { Euler, Quaternion } from "three"
import { clampScale, isSurface, restOn, snapRotation, snapTo, SNAP, type Bounds } from "./snap.ts"

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Bounds => ({
  min: { x: x0, y: y0, z: z0 },
  max: { x: x1, y: y1, z: z1 },
})
const desk = box(-0.5, 0, -1.5, 0.5, 0.75, -0.9) // top at 0.75 m

test("item dropped 5 cm above a desk lands on its top", () => {
  const dy = restOn(box(-0.1, 0.8, -1.25, 0.1, 1.0, -1.15), [desk])
  assert.ok(Math.abs(dy - -0.05) < 1e-9)
})

test("too high, off to the side, or deep inside: no snap", () => {
  assert.equal(restOn(box(-0.1, 0.9, -1.25, 0.1, 1.1, -1.15), [desk]), 0) // 15 cm above
  assert.equal(restOn(box(0.6, 0.8, -1.25, 0.8, 1.0, -1.15), [desk]), 0) // centre not over the desk
  assert.equal(restOn(box(-0.1, 0.5, -1.25, 0.1, 0.7, -1.15), [desk]), 0) // 25 cm sunk in
  assert.equal(restOn(box(-0.1, 0.8, -1.25, 0.1, 1.0, -1.15), []), 0)
})

test("slightly sunk in pops up; highest qualifying surface wins", () => {
  const sunk = restOn(box(-0.1, 0.74, -1.25, 0.1, 0.94, -1.15), [desk])
  assert.ok(Math.abs(sunk - 0.01) < 1e-9)
  const tray = box(-0.2, 0.75, -1.3, 0.2, 0.78, -1.1) // sits on the desk, top at 0.78
  const dy = restOn(box(-0.05, 0.8, -1.25, 0.05, 0.9, -1.15), [desk, tray])
  assert.ok(Math.abs(dy - -0.02) < 1e-9)
})

test("surface names and tags", () => {
  assert.ok(isSurface("desk") && isSurface("stage") && isSurface("table"))
  assert.ok(isSurface("workbench", ["wood", "surface"]))
  assert.ok(!isSurface("knob", ["audio"]))
})

test("grid and scale clamp", () => {
  assert.ok(Math.abs(snapTo(0.137, SNAP.move) - 0.125) < 1e-9)
  assert.equal(clampScale(9), 5)
  assert.equal(clampScale(0.01), 0.2)
})

test("rotation snaps to 15° steps about the gesture's own axis", () => {
  const from = new Quaternion() // facing forward
  const q = new Quaternion().setFromEuler(new Euler(0, (20 * Math.PI) / 180, 0))
  const e = new Euler().setFromQuaternion(snapRotation(q, from, SNAP.angle))
  assert.ok(Math.abs(e.y - Math.PI / 12) < 1e-6 && Math.abs(e.x) < 1e-6 && Math.abs(e.z) < 1e-6)
  // A pitched item yawed by 5° snaps back to its start pitch, not to a world grid.
  const pitched = new Quaternion().setFromEuler(new Euler(0.3, 0, 0))
  const nudged = new Quaternion().setFromEuler(new Euler(0, (5 * Math.PI) / 180, 0)).multiply(pitched)
  assert.ok(snapRotation(nudged, pitched, SNAP.angle).angleTo(pitched) < 1e-6)
})
