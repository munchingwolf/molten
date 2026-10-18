import { test } from "node:test"
import assert from "node:assert/strict"
import { stripName } from "./wake.ts"

test("strips the name and its punctuation", () => {
  assert.deepEqual(stripName("Stark, add a knob"), { said: true, rest: "add a knob" })
  assert.deepEqual(stripName("hey stark make it bigger"), { said: true, rest: "make it bigger" })
  assert.deepEqual(stripName("OK Starks. go to scene 2"), { said: true, rest: "go to scene 2" })
  assert.deepEqual(stripName("Stark"), { said: true, rest: "" })
})

test("leaves other text alone", () => {
  assert.deepEqual(stripName("start the music"), { said: false, rest: "start the music" })
  assert.deepEqual(stripName("add a starkly lit lamp"), { said: false, rest: "add a starkly lit lamp" })
  assert.deepEqual(stripName("  add a knob "), { said: false, rest: "add a knob" })
})
