import { test } from "node:test"
import assert from "node:assert/strict"
import { liveFilled, matchSlot, nextSlot, placeFromSlot, progress, toSlots, type Slot } from "./guides.ts"

const slot = (id: string, component: string, position: [number, number, number], extra: Partial<Slot> = {}): Slot => ({
  id, component, position, rotation: [0, 0, 0], scale: 1, bind: {}, ...extra,
})

const slots = toSlots([
  slot("desk", "desk", [0, 0.45, -1], { order: 1, size: [1.4, 0.9, 0.7] }),
  slot("pads", "drum-pads", [0.22, 0.94, -1.08], { order: 4, bind: { hit: "drums" } }),
  slot("keys", "synth-keys", [-0.24, 0.94, -1.1], { order: 3, rotation: [0, 0.21, 0], props: { octave: 3 }, name: "Keys" }),
  slot("lane", "drums-lane", [0.6, 1.75, -1.5]), // no order: defaults to its index (4th)
])

test("next slot follows order, then template order; filled slots are skipped", () => {
  assert.equal(nextSlot(slots, {})?.id, "desk")
  assert.equal(nextSlot(slots, { desk: "a" })?.id, "keys")
  assert.equal(nextSlot(slots, { desk: "a", keys: "b" })?.id, "pads") // order 4 ties with lane's index 4: template order wins
  assert.equal(nextSlot(slots, { desk: "a", keys: "b", pads: "c", lane: "d" }), null)
})

test("progress counts placed slots and names the next one", () => {
  const p = progress(slots, { desk: "a" })
  assert.equal(p.placed, 1)
  assert.equal(p.total, 4)
  assert.equal(p.next?.id, "keys")
})

test("matchSlot: same component, within reach of the ghost box, unfilled", () => {
  assert.equal(matchSlot(slots, {}, { component: "drum-pads", position: [0.3, 1.0, -1.0] })?.id, "pads")
  assert.equal(matchSlot(slots, {}, { component: "drum-pads", position: [1.2, 1.0, -1.0] }), null) // too far
  assert.equal(matchSlot(slots, {}, { component: "synth-keys", position: [0.22, 0.94, -1.08] })?.id, "keys") // 46 cm from its centre, inside reach of its box
  assert.equal(matchSlot(slots, {}, { component: "knob", position: [0.22, 0.94, -1.08] }), null) // no slot for it
  assert.equal(matchSlot(slots, { pads: "x" }, { component: "drum-pads", position: [0.22, 0.94, -1.08] }), null) // taken
  // inside a big box counts as distance 0: dropped at the desk's corner still finds the desk slot
  assert.equal(matchSlot(slots, {}, { component: "desk", position: [0.65, 0.3, -0.7] })?.id, "desk")
})

test("matchSlot picks the nearest of two slots for the same component", () => {
  const two = toSlots([slot("l", "knob", [-0.3, 1, -1]), slot("r", "knob", [0.3, 1, -1])])
  assert.equal(matchSlot(two, {}, { component: "knob", position: [0.25, 1, -1] })?.id, "r")
  assert.equal(matchSlot(two, { r: "x" }, { component: "knob", position: [0.25, 1, -1] }), null) // l's box edge is 40 cm away
})

test("placeFromSlot copies transform, wiring, props and name (not shared references)", () => {
  const keys = slots.find((s) => s.id === "keys")!
  const p = placeFromSlot(keys)
  assert.deepEqual(p, { position: [-0.24, 0.94, -1.1], rotation: [0, 0.21, 0], scale: 1, bind: {}, props: { octave: 3 }, name: "Keys" })
  assert.notEqual(p.position, keys.position)
  assert.deepEqual(placeFromSlot(slots.find((s) => s.id === "pads")!).bind, { hit: "drums" })
})

test("toSlots fills missing ids and orders; liveFilled drops deleted items", () => {
  const s = toSlots([{ ...slot("", "knob", [0, 1, -1]) }])
  assert.equal(s[0].id, "slot-1")
  assert.equal(s[0].order, 1)
  assert.deepEqual(liveFilled({ a: "i1", b: "gone" }, [{ id: "i1" }]), { a: "i1" })
})
