import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { toSlots } from "./guides.ts"
import { slotCommand, templateCommand, type SayingSlot } from "./slot-commands.ts"

// The real Night Set template, so the shipped trigger phrases are what's tested.
const nightSet = JSON.parse(readFileSync(new URL("../registry/templates/night-set.json", import.meta.url), "utf8"))
const slots = toSlots(nightSet.items) as SayingSlot[]
const registry = JSON.parse(readFileSync(new URL("../registry/index.json", import.meta.url), "utf8")) as { name: string; displayName: string; aliases?: string[] }[]
const namesOf = (c: string) => {
  const e = registry.find((r) => r.name === c)
  return e ? [e.displayName, ...(e.aliases ?? [])] : []
}
const run = (text: string, filled: Record<string, string> = {}) => slotCommand(text, slots, filled, namesOf)

test("names a slot: the trigger phrase picks it and says how it's wired", () => {
  const r = run("add the drums")!
  assert.deepEqual(r.slotIds, ["pads"])
  assert.match(r.reply, /wired to drums/)
  assert.match(r.reply, /1 of 8 placed/)
  assert.deepEqual(run("the keys")!.slotIds, ["keys"])
  assert.deepEqual(run("put the mixer in")!.slotIds, ["console"])
})

test("longest phrase wins: 'keys lane' is the lane, not the synth", () => {
  assert.deepEqual(run("add the keys lane")!.slotIds, ["keys-lane"])
  assert.deepEqual(run("add the drums lane")!.slotIds, ["drums-lane"])
  assert.deepEqual(run("add the keys and the drums")!.slotIds, ["keys", "pads"])
})

test("a phrase shared by several slots is a group command", () => {
  assert.deepEqual(run("set up the rig")!.slotIds, ["desk", "console", "keys", "pads"])
  assert.deepEqual(run("add the instruments", { keys: "i1" })!.slotIds, ["pads"])
})

test("a container brings its children: the track wall places the three lanes too", () => {
  assert.deepEqual(run("build the track wall")!.slotIds, ["wall", "keys-lane", "tempo-lane", "drums-lane"])
})

test("next and the rest follow build order and skip filled slots", () => {
  assert.deepEqual(run("next")!.slotIds, ["desk"])
  assert.deepEqual(run("next one", { desk: "i1" })!.slotIds, ["console"])
  const all = run("fill the rest", { desk: "i1", pads: "i2" })!
  assert.deepEqual(all.slotIds, ["console", "keys", "wall", "keys-lane", "tempo-lane", "drums-lane"])
  assert.match(all.reply, /All 8 placed/)
  const done = Object.fromEntries(slots.map((s) => [s.id, "x"]))
  assert.deepEqual(run("next", done)!.slotIds, [])
})

test("an already placed slot answers instead of adding a stray copy", () => {
  const r = run("add the drums", { pads: "i9" })!
  assert.deepEqual(r.slotIds, [])
  assert.match(r.reply, /already placed/)
})

test("leaves everything else to the normal assistant", () => {
  for (const t of ["make the drums bigger", "next scene", "go to the next scene", "the drums sound great", "dont add the drums", "add a knob", "what is this"])
    assert.equal(run(t), null, t)
})

test("a build request names a whole template: Night Set by name or its own trigger phrases", () => {
  const templates = [nightSet, { name: "Music Studio" }, { name: "Smart Home" }]
  assert.equal(templateCommand("build the night set", templates)?.name, "Night Set")
  assert.equal(templateCommand("set up the DAW", templates)?.name, "Night Set")
  assert.equal(templateCommand("make the demo", templates)?.name, "Night Set")
  assert.equal(templateCommand("build the music studio", templates)?.name, "Music Studio")
  for (const t of ["the night set", "make it bigger", "build the track wall", "dont build the night set", "add the drums"])
    assert.equal(templateCommand(t, templates), null, t)
})
