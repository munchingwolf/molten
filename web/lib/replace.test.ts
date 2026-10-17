import { test } from "node:test"
import assert from "node:assert/strict"
import { carryOver, dropTarget, replaced, type Specs } from "./replace.ts"
import { toSlots, type Slot } from "./guides.ts"
import type { Bindable, Item } from "./layout.ts"

const B: Record<string, Bindable[]> = {
  knob: [{ prop: "value", event: "onChange", type: "number" }, { prop: "label", type: "string" }],
  slider: [{ prop: "value", event: "onChange", type: "number" }],
  toggle: [{ prop: "value", event: "onChange", type: "boolean" }],
}
const P: Record<string, { name: string; type: string; options?: string[] }[]> = {
  knob: [{ name: "color", type: "color" }, { name: "size", type: "number" }],
  slider: [{ name: "color", type: "color" }, { name: "size", type: "enum", options: ["sm", "lg"] }],
}
const specs: Specs = { bindable: (c) => B[c] ?? [], props: (c) => P[c] ?? [] }

const slot = (id: string, position: [number, number, number], size: [number, number, number], extra: Partial<Slot> = {}): Slot => ({
  id, component: "knob", position, rotation: [0, 0, 0], scale: 1, bind: {}, size, ...extra,
})
const root = { position: [1, 0, -1] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: 1 }

test("dropTarget: point inside an open slot (template-local box, root moved) finds it", () => {
  const slots = toSlots([slot("pads", [0, 1, 0], [0.4, 0.1, 0.4])])
  assert.deepEqual(dropTarget([1.1, 1.02, -1], slots, root, []), { kind: "slot", slotId: "pads" })
  assert.equal(dropTarget([0.1, 1.02, 0], slots, root, []), null) // that spot without the root's offset: outside
  assert.equal(dropTarget([1.1, 1.02, -1], slots, null, []), null) // no guide root: no slots
})

test("dropTarget: a ray hit on the box face (within eps) counts; slot `center` shifts the box", () => {
  const slots = toSlots([slot("desk", [0, 0, 0], [1, 0.8, 0.6], { center: [0, 0.4, 0] })])
  assert.deepEqual(dropTarget([1, 0.81, -1], slots, root, []), { kind: "slot", slotId: "desk" })
  assert.equal(dropTarget([1, -0.1, -1], slots, root, []), null) // below its base
})

test("dropTarget: smallest containing volume wins across slots and items", () => {
  const slots = toSlots([slot("pads", [0, 0.95, 0], [0.3, 0.1, 0.3])])
  const desk = { id: "desk", min: [0, 0, -1.5] as [number, number, number], max: [2, 1, -0.5] as [number, number, number] }
  assert.deepEqual(dropTarget([1, 0.95, -1], slots, root, [desk]), { kind: "slot", slotId: "pads" })
  assert.deepEqual(dropTarget([1.6, 0.5, -1], slots, root, [desk]), { kind: "item", itemId: "desk" })
  const knob = { id: "k", min: [1.5, 0.4, -1.1] as [number, number, number], max: [1.7, 0.6, -0.9] as [number, number, number] }
  assert.deepEqual(dropTarget([1.6, 0.5, -1], [], null, [desk, knob]), { kind: "item", itemId: "k" })
  assert.equal(dropTarget([5, 5, 5], slots, root, [desk]), null)
})

test("carryOver keeps bind/props only where the new component has them with the same type", () => {
  const from = { component: "knob", bind: { value: "volume", label: "name" }, props: { color: "#fff", size: 2, junk: 1 } }
  assert.deepEqual(carryOver(from, "slider", specs), { bind: { value: "volume" }, props: { color: "#fff" } }) // size: enum, 2 isn't an option
  assert.deepEqual(carryOver(from, "toggle", specs), { bind: {} }) // value is boolean there
  assert.deepEqual(carryOver(from, "knob", specs), { bind: from.bind, props: from.props }) // same component: all of it
  assert.notEqual(carryOver(from, "knob", specs).bind, from.bind)
})

test("replaced keeps id, parent and transform, drops the old layer name", () => {
  const old: Item = { id: "a1", component: "knob", parentId: "root", position: [0.2, 1, -1], rotation: [0, 0.3, 0], scale: 1.5, bind: { value: "volume" }, name: "Vol", locked: true }
  const r = replaced(old, "slider", specs)
  assert.deepEqual(r, { id: "a1", component: "slider", parentId: "root", position: [0.2, 1, -1], rotation: [0, 0.3, 0], scale: 1.5, bind: { value: "volume" } })
  assert.notEqual(r.position, old.position)
})
