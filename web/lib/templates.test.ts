import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"

// A template naming a renamed or hidden component inserts "missing" placeholders mid-demo, so every one is checked here.
const web = new URL("../", import.meta.url)
const index = JSON.parse(readFileSync(new URL("registry/index.json", web), "utf8")) as { name: string; status: string }[]
const ready = new Set(index.filter((e) => e.status === "ready").map((e) => e.name))
const dir = new URL("registry/templates/", web)

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  test(`template ${file}: every component and environment exists and is ready`, () => {
    const t = JSON.parse(readFileSync(new URL(file, dir), "utf8")) as { name?: unknown; environment?: string; items?: { id: string; component: string }[] }
    assert.equal(typeof t.name, "string")
    assert.ok(Array.isArray(t.items) && t.items.length > 0, "no items")
    const missing = t.items.map((i) => i.component).filter((c) => !ready.has(c))
    if (t.environment && !ready.has(t.environment)) missing.push(t.environment)
    assert.deepEqual(missing, [])
    const ids = t.items.map((i) => i.id)
    assert.equal(new Set(ids).size, ids.length, "duplicate item ids")
  })
}
