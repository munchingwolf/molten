import assert from "node:assert/strict"
import { test } from "node:test"
import { applyLiveOp, sanitizeLiveOp, type LiveStore } from "./live-ops.ts"
import type { Item, Vec3 } from "./layout.ts"

test("sanitize accepts good ops and rejects injection-shaped ones", () => {
  assert.deepEqual(sanitizeLiveOp({ op: "remove", id: "k3f9a2bc" }), { op: "remove", id: "k3f9a2bc" })
  assert.equal(typeof sanitizeLiveOp({ op: "add", component: 'knob"; import "evil' }), "string")
  assert.equal(typeof sanitizeLiveOp({ op: "add", component: "knob", props: { "x={alert(1)} y": 1 } }), "string")
  assert.equal(typeof sanitizeLiveOp({ op: "add", component: "knob", position: [0, 1] }), "string")
  assert.equal(typeof sanitizeLiveOp({ op: "update", id: "a1", scale: 0 }), "string")
  assert.equal(typeof sanitizeLiveOp({ op: "explode" }), "string")
  const add = sanitizeLiveOp({ op: "add", component: "drum-pads", position: [0.2, 1, -1.08], props: { color: "#ff0000" }, bind: { hit: "drums" } })
  assert.equal(typeof add, "object")
})

function fakeStore() {
  const items: Item[] = []
  let n = 0
  const s: LiveStore & { values: Record<string, unknown> } = {
    items,
    selectedId: null,
    playMode: false,
    values: {},
    add: (component: string, position?: Vec3, patch: Partial<Item> = {}) => {
      const id = `id${++n}`
      items.push({ id, component, position: position ?? [0, 1, -1], rotation: [0, 0, 0], scale: 1, bind: {}, ...patch })
      s.selectedId = id
    },
    update: (id, patch) => Object.assign(items.find((i) => i.id === id)!, patch),
    remove: (id) => items.splice(items.findIndex((i) => i.id === id), 1),
    select: (id) => void (s.selectedId = id),
    bind: (id, prop, name) => void (items.find((i) => i.id === id)!.bind[prop] = name),
    setValue: (name, v) => void (s.values[name] = v),
    setEnvironment: () => {},
    togglePlay: () => void (s.playMode = !s.playMode),
    load: () => {},
  }
  return s
}
const ctx = { isReady: (c: string) => c !== "ghost", template: async () => null, startGuide: () => {}, insertAll: () => {}, layout: async () => null }

test("add places, binds and selects; update merges props; play toggles once", async () => {
  const s = fakeStore()
  const r = await applyLiveOp({ op: "add", component: "drum-pads", position: [0.2, 1, -1.08], props: { color: "#f00" }, bind: { hit: "drums" } }, () => s, ctx)
  assert.equal(r.ok, true)
  assert.deepEqual(s.items[0].position, [0.2, 1, -1.08])
  assert.equal(s.items[0].bind.hit, "drums")
  await applyLiveOp({ op: "update", id: r.id!, props: { volume: 0.5 }, scale: 1.25 }, () => s, ctx)
  assert.deepEqual(s.items[0].props, { color: "#f00", volume: 0.5 })
  assert.equal(s.items[0].scale, 1.25)
  await applyLiveOp({ op: "play", on: true }, () => s, ctx)
  await applyLiveOp({ op: "play", on: true }, () => s, ctx)
  assert.equal(s.playMode, true)
})

test("unknown component or item fails without changing the scene", async () => {
  const s = fakeStore()
  assert.equal((await applyLiveOp({ op: "add", component: "ghost" }, () => s, ctx)).ok, false)
  assert.equal((await applyLiveOp({ op: "remove", id: "nope" }, () => s, ctx)).ok, false)
  assert.equal(s.items.length, 0)
})
