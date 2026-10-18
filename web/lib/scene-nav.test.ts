import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveScene } from "./scene-nav.ts"

const scenes = [
  { id: "a", name: "Lobby" },
  { id: "b", name: "Music Room" },
  { id: "c", name: "Gallery" },
]

test("by name, ignoring case and extra spaces", () => {
  assert.equal(resolveScene(scenes, "music  room", "a"), "b")
  assert.equal(resolveScene(scenes, " GALLERY ", "a"), "c")
})

test("next and back wrap around", () => {
  assert.equal(resolveScene(scenes, "next", "c"), "a")
  assert.equal(resolveScene(scenes, "back", "a"), "c")
  assert.equal(resolveScene(scenes, "prev", "b"), "a")
})

test("1-based number, else null", () => {
  assert.equal(resolveScene(scenes, "2", "a"), "b")
  assert.equal(resolveScene(scenes, "4", "a"), null)
  assert.equal(resolveScene(scenes, "nowhere", "a"), null)
  assert.equal(resolveScene([], "next", "a"), null)
})
