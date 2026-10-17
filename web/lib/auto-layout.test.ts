import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { layoutFrame } from "./auto-layout.ts"

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`)
const base = { gap: 0.1, padding: 0.05, align: "center" as const }

test("row: children side by side, centred, gap between; size includes padding", () => {
  const { placements, size } = layoutFrame({ ...base, direction: "row" }, [[0.2, 0.1], [0.4, 0.3]])
  near(placements[0].position[0], -0.25) // total 0.7 → starts at -0.35, first centre -0.25
  near(placements[1].position[0], 0.15)
  near(size[0], 0.8)
  near(size[1], 0.4)
})

test("column runs top to bottom", () => {
  const { placements } = layoutFrame({ ...base, direction: "column" }, [[0.2, 0.2], [0.2, 0.2]])
  assert.ok(placements[0].position[1] > placements[1].position[1])
})

test("grid wraps at `columns`", () => {
  const { placements } = layoutFrame({ ...base, direction: "grid", columns: 2 }, [[0.2, 0.2], [0.2, 0.2], [0.2, 0.2]])
  near(placements[2].position[0], placements[0].position[0])
  assert.ok(placements[2].position[1] < placements[0].position[1])
})

test("arc: middle child at origin facing forward; outer ones turn inward", () => {
  const { placements } = layoutFrame({ ...base, direction: "arc", radius: 1.5 }, [[0.4, 0.3], [0.4, 0.3], [0.4, 0.3]])
  near(placements[1].position[0], 0)
  near(placements[1].rotation[1], 0)
  assert.ok(placements[0].rotation[1] > 0 && placements[2].rotation[1] < 0)
  assert.ok(placements[0].position[2] > 0) // curves toward the viewer
})

test("free: no placements and no panel, whatever the children (they keep their own transforms)", () => {
  const out = layoutFrame({ ...base, direction: "free" }, [[0.4, 0.3], [1.2, 0.8]])
  assert.deepEqual(out.placements, [])
  assert.deepEqual(out.size, [0, 0])
  assert.deepEqual(layoutFrame({ ...base, direction: "free" }, []).size, [0, 0])
})

test("empty frame has a placeholder size", () => {
  assert.deepEqual(layoutFrame({ ...base, direction: "row" }, []).placements, [])
})

test("frame.tsx keeps a verbatim copy of layoutFrame (copy-paste component)", () => {
  const body = (src: string) => src.slice(src.indexOf("function layoutFrame"), src.indexOf("\n}\n", src.indexOf("function layoutFrame")))
  const strip = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ").replace(/export /g, "").replace(/p: FrameProps/, "p: LayoutProps").trim()
  const lib = readFileSync(new URL("./auto-layout.ts", import.meta.url), "utf8")
  const comp = readFileSync(new URL("../components/spatial/frame.tsx", import.meta.url), "utf8")
  assert.equal(strip(body(comp)), strip(body(lib)))
})
