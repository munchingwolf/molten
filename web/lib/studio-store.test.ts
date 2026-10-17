import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { useStudio } from "./studio-store.ts"

const S = () => useStudio.getState()
beforeEach(() => S().load({ name: "t", items: [] }))

test("undo/redo restores items", () => {
  S().add("knob")
  S().add("slider")
  assert.equal(S().items.length, 2)
  S().undo()
  assert.deepEqual(S().items.map((i) => i.component), ["knob"])
  S().redo()
  assert.equal(S().items.length, 2)
})

test("groupIntoFrame parents the selection; removing the frame removes children", () => {
  S().add("a")
  const a = S().selectedId!
  S().add("b")
  const b = S().selectedId!
  S().select(a)
  S().select(b, true)
  const f = S().groupIntoFrame()!
  assert.ok(f)
  assert.ok(S().items.filter((i) => i.parentId === f).length === 2)
  S().remove(f)
  assert.equal(S().items.length, 0)
})

test("duplicate a frame copies its children with re-pointed parents", () => {
  S().add("a")
  const f = S().groupIntoFrame([S().selectedId!])!
  S().duplicate([f])
  const frames = S().items.filter((i) => i.component === "frame")
  assert.equal(frames.length, 2)
  const copy = frames.find((x) => x.id !== f)!
  assert.equal(S().items.filter((i) => i.parentId === copy.id).length, 1)
})

test("setParent refuses cycles", () => {
  S().add("a")
  const f = S().groupIntoFrame([S().selectedId!])!
  const child = S().items.find((i) => i.parentId === f)!
  S().setParent(f, child.id)
  assert.equal(S().items.find((i) => i.id === f)!.parentId, undefined)
})

test("scenes keep their own items + environment; layout() mirrors scene 1", () => {
  S().add("hero")
  S().setEnvironment("env-space")
  const first = S().sceneId
  S().addScene("About")
  assert.equal(S().items.length, 0)
  S().add("card")
  S().setEnvironment("env-forest")
  S().switchScene(first)
  assert.deepEqual(S().items.map((i) => i.component), ["hero"])
  assert.equal(S().environment, "env-space")
  const l = S().layout()
  assert.equal(l.scenes?.length, 2)
  assert.deepEqual(l.items.map((i) => i.component), ["hero"])
  assert.equal(l.scenes?.[1].environment, "env-forest")
})

test("load() of a single-scene layout gives one scene", () => {
  S().load({ name: "x", items: [{ id: "k1", component: "knob", position: [0, 1, -1], rotation: [0, 0, 0], scale: 1, bind: {} }], environment: "env-gallery" })
  assert.equal(S().scenes.length, 1)
  assert.equal(S().environment, "env-gallery")
  assert.equal(S().layout().scenes, undefined)
})
