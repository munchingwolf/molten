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

test("insert adds a template as one undo step with fresh ids and kept parent links", () => {
  S().add("existing")
  const tpl = [
    { id: "f", component: "frame", position: [0, 1, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: 1, bind: {} },
    { id: "c", component: "button", position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: 1, bind: {}, parentId: "f" },
  ]
  const tops = S().insert(tpl, [0, 0.5, -1])
  assert.equal(tops.length, 1)
  const frame = S().items.find((i) => i.id === tops[0])!
  assert.deepEqual(frame.position, [0, 1.5, -1])
  assert.ok(S().items.some((i) => i.parentId === frame.id && i.component === "button"))
  assert.ok(!S().items.some((i) => i.id === "f")) // fresh ids
  S().undo()
  assert.deepEqual(S().items.map((i) => i.component), ["existing"])
})

test("guide: placeSlot fills a slot in one undo step; deleting/undoing frees it; claimSlot snaps a nearby drop", async () => {
  const { progress, liveFilled } = await import("./guides.ts")
  const items = [
    { id: "d", component: "desk", position: [0, 0.45, -1], rotation: [0, 0, 0], scale: 1.2, bind: {}, size: [1.4, 0.9, 0.7], order: 1 },
    { id: "p", component: "drum-pads", position: [0.2, 0.94, -1.1], rotation: [0, -0.18, 0], scale: 1, bind: { hit: "drums" }, order: 2 },
    { id: "w", component: "frame", position: [0, 1.75, -1.6], rotation: [0, 0, 0], scale: 1, bind: {}, props: { direction: "arc" }, order: 3 },
    { id: "l", component: "keys-lane", parentId: "w", position: [-0.62, 0, 0.13], rotation: [0, 0.4, 0], scale: 1, bind: {}, order: 4 },
  ] as Parameters<ReturnType<typeof S>["startGuide"]>[0]["items"]
  S().startGuide({ name: "Night Set", slug: "night-set", environment: "env-concert-stage", items })
  const g = () => S().guide!
  const root = S().items.find((i) => i.id === g().rootId)!
  assert.equal(root.props?.direction, "free") // only the empty template root
  assert.equal(S().items.length, 1)
  assert.equal(S().environment, "env-concert-stage")
  assert.equal(S().name, "Night Set")
  const id = S().placeSlot("d")!
  assert.equal(S().items.find((i) => i.id === id)!.parentId, root.id)
  assert.equal(progress(g().slots, liveFilled(g().filled, S().items)).next?.id, "p")
  S().undo()
  assert.equal(progress(g().slots, liveFilled(g().filled, S().items)).placed, 0) // undo freed it
  S().redo()
  assert.equal(liveFilled(g().filled, S().items).d, id)
  S().add("drum-pads", [0.35, 1.0, -1.0]) // dropped near its ghost (root at the origin: world = template space)
  const pads = S().selectedId!
  assert.ok(S().claimSlot(pads))
  const it = S().items.find((i) => i.id === pads)!
  assert.deepEqual(it.position, [0.2, 0.94, -1.1])
  assert.deepEqual(it.bind, { hit: "drums" })
  assert.equal(it.parentId, root.id)
  S().remove(pads)
  assert.equal(progress(g().slots, liveFilled(g().filled, S().items)).next?.id, "p") // deleted: slot open again
  S().placeSlot("p")
  const wall = S().placeSlot("w")!
  const laneId = S().placeSlot("l")
  const lane = S().items.find((i) => i.id === laneId)!
  assert.equal(lane.parentId, wall) // lane goes inside the placed track wall, with its wall-local transform
  assert.deepEqual(lane.position, [-0.62, 0, 0.13])
  S().endGuide()
  assert.equal(S().guide, null)
})

test("insertAll: the template is ONE item (free frame) holding every part; ungrouping keeps parts in place", () => {
  const items = [
    { id: "a", component: "knob", position: [0.5, 1, -1], rotation: [0, 0, 0], scale: 1, bind: {}, hint: "x", order: 1 },
  ] as Parameters<ReturnType<typeof S>["insertAll"]>[0]["items"]
  S().insertAll({ name: "Tpl", items }, [1, 0, 0], Math.PI / 2)
  const root = S().items.find((i) => !i.parentId)!
  assert.equal(S().items.length, 2)
  assert.equal(root.component, "frame")
  assert.equal(root.name, "Tpl")
  const child = S().items.find((i) => i.parentId === root.id)!
  assert.deepEqual(child.position, [0.5, 1, -1]) // template-local
  assert.equal("hint" in child, false)
  S().undo()
  assert.equal(S().items.length, 0) // one undo step
  S().redo()
  S().ungroup(S().items.find((i) => !i.parentId)!.id)
  const freed = S().items[0]
  // root at x=1 turned 90 deg left: local (0.5, 1, -1) lands at world (1 - 1, 1, -0.5)
  assert.ok(Math.abs(freed.position[0] - 0) < 1e-9 && Math.abs(freed.position[1] - 1) < 1e-9 && Math.abs(freed.position[2] + 0.5) < 1e-9)
  assert.ok(Math.abs(freed.rotation[1] - Math.PI / 2) < 1e-9)
  assert.equal(freed.parentId, undefined)
})
