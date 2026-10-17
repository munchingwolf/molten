import { test } from "node:test"
import assert from "node:assert/strict"
import { Box3, BoxGeometry, Group, Mesh } from "three"
import "./three-fixes.ts"

test("Box3 measures an object whose boundingBox isn't a Box3 (uikit icons) through its children", () => {
  const root = new Group()
  const icon = new Group() as Group & { boundingBox?: unknown }
  icon.boundingBox = { value: undefined } // what uikit's Content stores: a signal, not a Box3
  icon.add(new Mesh(new BoxGeometry(1, 2, 3)))
  root.add(icon)
  const b = new Box3().setFromObject(root)
  assert.deepEqual(b.min.toArray(), [-0.5, -1, -1.5])
  assert.deepEqual(b.max.toArray(), [0.5, 1, 1.5])
})
