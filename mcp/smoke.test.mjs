import assert from "node:assert/strict"
import { test } from "node:test"
import { depsFor, loadRegistry, resolveEntry, safeTargetPath, search, suggest, validateLayoutId } from "./lib.mjs"

const entries = loadRegistry()

test('search "settings" returns the settings-* components', () => {
  const names = search(entries, { query: "settings" }).map((e) => e.name)
  assert.ok(names.includes("settings-glass"), names.join())
  assert.ok(names.every((n) => n.startsWith("settings-")), names.join())
})

test("search needs every word to match; soon items hidden by default", () => {
  assert.deepEqual(search(entries, { query: "glass settings" }).map((e) => e.name), ["settings-glass"])
  assert.ok(search(entries, {}).every((e) => e.status === "ready"))
  assert.ok(search(entries, { includeSoon: true }).length === entries.length)
})

test("unknown name is rejected, with suggestions", () => {
  assert.equal(resolveEntry(entries, "settings-glas"), null)
  assert.ok(suggest(entries, "settings-glas").includes("settings-glass"))
  assert.throws(() => safeTargetPath(entries, "/tmp/proj", "nope"))
})

test("path traversal in name is rejected", () => {
  assert.throws(() => safeTargetPath(entries, "/tmp/proj", "../x"))
  assert.throws(() => safeTargetPath(entries, "/tmp/proj", "settings-glass/../../x"))
  assert.equal(safeTargetPath(entries, "/tmp/proj", "settings-glass"), "/tmp/proj/components/spatial/settings-glass.tsx")
})

test("layout id validation", () => {
  for (const ok of ["latest", "abc123", "a1b2c3d4e5f6"]) assert.ok(validateLayoutId(ok), ok)
  for (const bad of ["../x", "abc", "ABC123", "abc123/../x", "a1b2c3d4e5f6g", "", undefined]) assert.ok(!validateLayoutId(bad), String(bad))
})

test("deps = entry.deps plus package imports in the source", () => {
  const src = `import { Container } from "@react-three/uikit"\nimport {\n  Slider,\n} from "@react-three/uikit-default/x"\nimport type { Mesh } from "three"\nimport "./local.css"\nimport React from "react"`
  assert.deepEqual(depsFor({ deps: ["tone"] }, src), ["tone", "@react-three/uikit", "@react-three/uikit-default", "three", "react"])
})
