import { test } from "node:test"
import assert from "node:assert/strict"
import { generateCode } from "./codegen.ts"
import { initialValues, type Bindable, type Item } from "./layout.ts"
import { cablePairs, nearestJack, planLink, uniqueName } from "./wiring.ts"

// Mirrors the registry entries for knob + transport.
const BINDABLES: Record<string, Bindable[]> = {
  knob: [{ prop: "value", event: "onChange", type: "number", min: 0, max: 1, default: 0.5, range: true }],
  transport: [
    { prop: "playing", event: "onChange", type: "boolean", default: false },
    { prop: "bpm", type: "number", min: 60, max: 180, default: 120 },
  ],
  readout: [{ prop: "value", type: "number" }],
}
const of = (c: string) => BINDABLES[c] ?? []
const item = (id: string, component: string, bind: Record<string, string> = {}, props?: Record<string, unknown>): Item => ({
  id, component, position: [0, 1, -1], rotation: [0, 0, 0], scale: 1, bind, props,
})

test("knob.value → transport.bpm is named after the descriptive side and adopts its span", () => {
  const plan = planLink([item("k", "knob"), item("t", "transport")], of, { id: "k", prop: "value" }, { id: "t", prop: "bpm" })
  assert.deepEqual(plan, {
    ok: true,
    name: "bpm",
    binds: [{ id: "k", prop: "value" }, { id: "t", prop: "bpm" }],
    ranges: [{ id: "k", min: 60, max: 180 }],
  })
})

test("two generic props get a unique 'value' name", () => {
  const items = [item("a", "knob"), item("b", "knob"), item("c", "readout", { value: "value" })]
  const plan = planLink(items, of, { id: "a", prop: "value" }, { id: "b", prop: "value" })
  assert.ok(plan.ok && plan.name === "value2")
  assert.equal(uniqueName(items, "bpm"), "bpm")
})

test("an already-bound side lends its name; the other side joins it", () => {
  const items = [item("k", "knob", { value: "tempo" }), item("t", "transport")]
  const plan = planLink(items, of, { id: "t", prop: "bpm" }, { id: "k", prop: "value" })
  assert.ok(plan.ok)
  assert.equal(plan.name, "tempo")
  assert.deepEqual(plan.binds, [{ id: "t", prop: "bpm" }])
})

test("both bound to different names: b's whole group merges into a's", () => {
  const items = [item("a", "knob", { value: "x1" }), item("b", "knob", { value: "x2" }), item("c", "readout", { value: "x2" })]
  const plan = planLink(items, of, { id: "a", prop: "value" }, { id: "b", prop: "value" })
  assert.ok(plan.ok)
  assert.equal(plan.name, "x1")
  assert.deepEqual(plan.binds, [{ id: "b", prop: "value" }, { id: "c", prop: "value" }])
})

test("type mismatch and same-group links are refused", () => {
  const items = [item("k", "knob", { value: "v" }), item("t", "transport"), item("r", "readout", { value: "v" })]
  assert.deepEqual(planLink(items, of, { id: "k", prop: "value" }, { id: "t", prop: "playing" }), { ok: false, reason: "type" })
  assert.deepEqual(planLink(items, of, { id: "k", prop: "value" }, { id: "r", prop: "value" }), { ok: false, reason: "same" })
})

test("cables connect every member to the first one with that name", () => {
  const items = [item("a", "knob", { value: "v" }), item("b", "knob", { value: "v" }), item("c", "readout", { value: "v" }), item("d", "knob")]
  assert.deepEqual(cablePairs(items, of).map((p) => `${p.from.id}-${p.to.id}`), ["a-b", "a-c"])
})

test("nearestJack: fingertip uses the point, a ray uses its whole line, 6 cm cap", () => {
  const jacks = [
    { ref: { id: "a", prop: "value" }, pos: [0, 1, -1] as [number, number, number] },
    { ref: { id: "b", prop: "value" }, pos: [0.3, 1, -1.5] as [number, number, number] },
  ]
  const self = { id: "z", prop: "value" }
  // Fingertip released 3 cm from a.
  assert.equal(nearestJack(jacks, [0.03, 1, -1], [0.035, 1, -1], self)?.id, "a")
  // Nothing within 6 cm.
  assert.equal(nearestJack(jacks, [0.2, 1, -1], null, self), null)
  // Ray from the head toward b, captured point floating at 0.5 m (well short of b) still finds b.
  const origin: [number, number, number] = [0, 1, 0]
  const point: [number, number, number] = [0.1, 1, -0.5]
  assert.equal(nearestJack(jacks, point, origin, self)?.id, "b")
  // The jack being dragged never links to itself.
  assert.equal(nearestJack(jacks, [0, 1, -1], null, { id: "a", prop: "value" }), null)
})

test("shared initial value prefers the fixed-span default over a range knob's", () => {
  const items = [item("k", "knob", { value: "bpm" }), item("t", "transport", { bpm: "bpm" })]
  assert.equal(initialValues(items, of).bpm, 120)
  assert.match(generateCode({ name: "x", items }, of), /useState\(120\)/)
})

test("only range bindables: first default clamped to that item's min/max", () => {
  const items = [item("a", "knob", { value: "v" }, { min: 60, max: 180 }), item("b", "knob", { value: "v" })]
  assert.equal(initialValues(items, of).v, 60)
})
