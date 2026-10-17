import { test } from "node:test"
import assert from "node:assert/strict"
import { generateCode } from "./codegen.ts"
import { bindingProps, isValidId, toIdent, type Bindable, type Item } from "./layout.ts"

const BINDABLES: Record<string, Bindable[]> = {
  slider: [{ prop: "value", event: "onChange", type: "number", default: 0.5 }],
  readout: [{ prop: "value", type: "number" }],
}
const of = (c: string) => BINDABLES[c] ?? []
const item = (component: string, bind: Record<string, string> = {}, extra: Partial<Item> = {}): Item => ({
  id: component, component, position: [0, 1.2, -1], rotation: [0, 0, 0], scale: 1, bind, ...extra,
})

test("empty layout is a valid component with no state", () => {
  const code = generateCode({ name: "my scene", items: [] }, of)
  assert.match(code, /export default function MyScene\(\)/)
  assert.doesNotMatch(code, /useState/)
})

test("two components bound to one name share a single useState", () => {
  const code = generateCode({ name: "demo", items: [item("slider", { value: "master volume" }), item("readout", { value: "master volume" })] }, of)
  assert.equal(code.match(/useState\(/g)?.length, 1)
  assert.match(code, /const \[masterVolume, setMasterVolume\] = useState\(0\.5\)/)
  assert.match(code, /<Slider value=\{masterVolume\} onChange=\{setMasterVolume\} \/>/)
  assert.match(code, /<Readout value=\{masterVolume\} \/>/) // input-only: no setter
})

test("unbound item is positioned without props; rotation/scale only when set", () => {
  const code = generateCode({ name: "x", items: [item("slider"), item("readout", {}, { scale: 2, rotation: [0, 0.5, 0] })] }, of)
  assert.match(code, /<group position=\{\[0, 1\.2, -1\]\}>\n\s+<Slider \/>/)
  assert.match(code, /rotation=\{\[0, 0\.5, 0\]\} scale=\{2\}/)
})

test("same component twice imports once", () => {
  const code = generateCode({ name: "x", items: [item("slider"), item("slider")] }, of)
  assert.equal(code.match(/import Slider /g)?.length, 1)
})

test("bindingProps wires value + setter, falls back to default", () => {
  const set: [string, unknown][] = []
  const p = bindingProps(item("slider", { value: "volume" }), of("slider"), {}, (n, v) => set.push([n, v]))
  assert.equal(p.value, 0.5)
  ;(p.onChange as (v: unknown) => void)(0.9)
  assert.deepEqual(set, [["volume", 0.9]])
})

test("isValidId blocks traversal", () => {
  for (const ok of ["latest", "k3f9a2", "abc12345"]) assert.ok(isValidId(ok), ok)
  for (const bad of ["../x", "a/b", "", "UPPER1", "x".repeat(13)]) assert.ok(!isValidId(bad), bad)
})

test("toIdent makes valid identifiers", () => {
  assert.equal(toIdent("master volume"), "masterVolume")
  assert.equal(toIdent("2nd knob"), "v2ndKnob")
})

test("frames nest children inside <Frame> without their own group; hidden items are skipped", () => {
  const frame: Item = { ...item("frame"), id: "f1", props: { direction: "row", gap: 0.05 } }
  const child: Item = { ...item("slider"), id: "c1", parentId: "f1", position: [9, 9, 9] }
  const ghost: Item = { ...item("readout"), id: "h1", hidden: true }
  const code = generateCode({ name: "x", items: [frame, child, ghost] }, of)
  assert.match(code, /<group position=\{\[0, 1\.2, -1\]\}>\n\s+<Frame direction=\{"row"\} gap=\{0\.05\}>\n\s+<Slider \/>\n\s+<\/Frame>\n\s+<\/group>/)
  assert.doesNotMatch(code, /\[9, 9, 9\]/) // auto-layout decides child positions
  assert.doesNotMatch(code, /Readout/)
})

test("environment renders first; multi-scene takes a scene prop", () => {
  const code = generateCode({
    name: "site", items: [], scenes: [
      { id: "a", name: "Home", environment: "env-space", items: [item("slider")] },
      { id: "b", name: "About", environment: "env-forest", items: [item("readout")] },
    ],
  }, of)
  assert.match(code, /import EnvSpace from "@\/components\/spatial\/env-space"/)
  assert.match(code, /export default function Site\(\{ scene = 0 \}: \{ scene\?: number \}\)/)
  assert.match(code, /\{scene === 1 && \(\n\s+<>\n\s+<EnvForest \/>/)
})
