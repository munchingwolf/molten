// Audit: does a spoken request change the scene the way the user meant?
// Each case goes through the live POST /api/assist (local model + word gating), then applyOps on the real store,
// and the resulting scene is checked. Run with the dev server up: node scripts/audit-voice.ts [http://localhost:3000]
import { readFileSync } from "node:fs"
import { applyOps, COLORS, type Op, type RegEntry } from "../lib/assist-ops.ts"
import { useStudio } from "../lib/studio-store.ts"
import type { Item } from "../lib/layout.ts"

const BASE = process.argv[2] ?? "http://localhost:3000"
const S = () => useStudio.getState()
const index = JSON.parse(readFileSync(new URL("../registry/index.json", import.meta.url), "utf8")) as RegEntry[]
// Same payload as assistant-store.ts REGISTRY
const REGISTRY = index.map((e) => ({ name: e.name, displayName: e.displayName, aliases: e.aliases, category: e.category, style: e.style, status: e.status, props: e.props }))

type Snap = { items: Item[]; selectedId: string | null; environment?: string | null }
type Ids = Record<string, string>
type Case = { say: string; scene: string[]; select?: string; expect: (b: Snap, a: Snap, ids: Ids) => boolean; want: string }

const snap = (): Snap => structuredClone({ items: S().items, selectedId: S().selectedId, environment: S().environment })
const get = (s: Snap, id: string) => s.items.find((i) => i.id === id)
const yawDeg = (s: Snap, id: string) => Math.round(((get(s, id)?.rotation[1] ?? 0) * 180) / Math.PI)
const same = (b: Snap, a: Snap) => JSON.stringify(b) === JSON.stringify(a)
const added = (b: Snap, a: Snap, comp: string | RegExp) =>
  a.items.filter((i) => !get(b, i.id) && (typeof comp === "string" ? i.component === comp : comp.test(i.component)))
const near = (x: number | undefined, y: number) => x !== undefined && Math.abs(x - y) < 1e-6

const CASES: Case[] = [
  // scale
  { say: "make it bigger", scene: ["knob"], expect: (b, a, i) => get(a, i.knob)!.scale > get(b, i.knob)!.scale, want: "knob grows" },
  { say: "make it smaller", scene: ["knob"], expect: (b, a, i) => get(a, i.knob)!.scale < get(b, i.knob)!.scale, want: "knob shrinks" },
  { say: "make it twice as big", scene: ["knob"], expect: (b, a, i) => near(get(a, i.knob)!.scale, get(b, i.knob)!.scale * 2), want: "knob ×2" },
  { say: "can you make the knob a bit larger", scene: ["knob", "lamp"], select: "lamp", expect: (b, a, i) => get(a, i.knob)!.scale > get(b, i.knob)!.scale && same({ ...b, items: [get(b, i.lamp)!] }, { ...a, items: [get(a, i.lamp)!] }), want: "knob grows, lamp untouched" },
  // rotate
  { say: "turn it 45 degrees", scene: ["knob"], expect: (b, a, i) => yawDeg(a, i.knob) - yawDeg(b, i.knob) === 45, want: "yaw +45°" },
  { say: "turn it around", scene: ["knob"], expect: (b, a, i) => Math.abs(yawDeg(a, i.knob) - yawDeg(b, i.knob)) === 180, want: "yaw 180°" },
  { say: "rotate the lamp 90 degrees", scene: ["lamp", "knob"], expect: (b, a, i) => Math.abs(yawDeg(a, i.lamp) - yawDeg(b, i.lamp)) === 90 && yawDeg(a, i.knob) === yawDeg(b, i.knob), want: "lamp turns 90°, knob (selected) doesn't" },
  { say: "spin the knob ninety degrees clockwise", scene: ["knob"], expect: (b, a, i) => yawDeg(a, i.knob) - yawDeg(b, i.knob) === -90, want: "yaw −90°" },
  // move (laptop axes: left = −x, up = +y, closer = +z)
  { say: "move it left", scene: ["knob"], expect: (b, a, i) => get(a, i.knob)!.position[0] < get(b, i.knob)!.position[0], want: "x decreases" },
  { say: "bring it 30 centimeters closer", scene: ["knob"], expect: (b, a, i) => near(get(a, i.knob)!.position[2] - get(b, i.knob)!.position[2], 0.3), want: "z +0.30" },
  { say: "move it up half a meter", scene: ["knob"], expect: (b, a, i) => near(get(a, i.knob)!.position[1] - get(b, i.knob)!.position[1], 0.5), want: "y +0.50" },
  // add
  { say: "add a drum pad", scene: [], expect: (b, a) => added(b, a, "drum-pad").length === 1, want: "one drum-pad added" },
  { say: "add a piano", scene: [], expect: (b, a) => added(b, a, /piano/).length === 1, want: "one piano added" },
  { say: "add a knob and make it bigger", scene: ["lamp"], expect: (b, a, i) => { const k = added(b, a, "knob"); return k.length === 1 && k[0].scale > 1 && get(a, i.lamp)!.scale === get(b, i.lamp)!.scale }, want: "new knob is the one that grows" },
  { say: "put a speaker in the scene", scene: [], expect: (b, a) => added(b, a, "speaker").length === 1, want: "speaker added" },
  // props
  { say: "make the lamp blue", scene: ["lamp", "knob"], expect: (b, a, i) => get(a, i.lamp)!.props?.color === COLORS.blue, want: "lamp color = blue" },
  { say: "set the text to Hello", scene: ["label"], expect: (b, a, i) => /^hello$/i.test(String(get(a, i.label)!.props?.text)), want: "label text = Hello" },
  { say: "change the label to Welcome Home", scene: ["label"], expect: (b, a, i) => /^welcome home$/i.test(String(get(a, i.label)!.props?.text)), want: "label text = Welcome Home" },
  { say: "make it red and twice as big", scene: ["press-button"], expect: (b, a, i) => get(a, i["press-button"])!.props?.color === COLORS.red && near(get(a, i["press-button"])!.scale, get(b, i["press-button"])!.scale * 2), want: "button red AND ×2" },
  // swap style
  { say: "make it glass", scene: ["settings-default"], expect: (b, a, i) => get(a, i["settings-default"])!.component === "settings-glass", want: "settings → glass" },
  // environment
  { say: "switch to the space environment", scene: [], expect: (b, a) => a.environment === "env-space", want: "env-space" },
  { say: "take me to the forest", scene: [], expect: (b, a) => a.environment === "env-forest", want: "env-forest" },
  { say: "take me to the beach", scene: [], expect: (b, a) => a.environment === "env-beach", want: "env-beach" },
  { say: "go to the desert", scene: [], expect: (b, a) => a.environment === "env-desert", want: "env-desert" },
  // remove / select
  { say: "delete the lamp", scene: ["lamp", "knob"], expect: (b, a, i) => !get(a, i.lamp) && !!get(a, i.knob), want: "lamp gone, knob stays" },
  { say: "remove it", scene: ["lamp", "knob"], expect: (b, a, i) => !get(a, i.knob) && !!get(a, i.lamp), want: "selected knob gone" },
  { say: "select the lamp", scene: ["lamp", "knob"], expect: (b, a, i) => a.selectedId === i.lamp, want: "lamp selected" },
  // must do nothing
  { say: "don't make it bigger", scene: ["knob"], expect: same, want: "no change" },
  { say: "never mind", scene: ["knob"], expect: same, want: "no change" },
  { say: "what's the weather like today", scene: ["knob"], expect: same, want: "no change" },
  { say: "make the tv red", scene: ["knob"], expect: same, want: "no change (no tv in scene)" },
  { say: "add a unicorn", scene: ["knob"], expect: same, want: "no change (not in library)" },
]

async function run(c: Case) {
  S().load({ name: "audit", items: [] })
  const ids: Ids = {}
  for (const comp of c.scene) { S().add(comp); ids[comp] = S().selectedId! }
  S().select(c.select ? ids[c.select] : (S().items.at(-1)?.id ?? null))
  const before = snap()
  const t0 = Date.now()
  const res = await fetch(`${BASE}/api/assist`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: c.say, layout: { items: S().items }, selectedId: S().selectedId, registry: REGISTRY }),
  })
  const data = (await res.json()) as { ops?: Op[]; source?: string }
  const ops = data.ops ?? []
  for (const op of ops) applyOps([op], S) // one at a time, like assistant-store send()
  const after = snap()
  let ok = false
  try { ok = c.expect(before, after, ids) } catch { /* expectation hit a missing item */ }
  return { ok, ms: Date.now() - t0, source: data.source ?? `HTTP ${res.status}`, ops }
}

// Warm the model so case 1 isn't timed against a cold load.
await fetch(`${BASE}/api/assist`).catch(() => {})
let pass = 0
const fails: string[] = []
for (const c of CASES) {
  const r = await run(c)
  if (r.ok) pass++
  else fails.push(c.say)
  const ops = r.ops.map((o) => [o.op, o.component, o.prop, o.value ?? o.amount, o.direction].filter((v) => v !== undefined).join(" ")).join(" | ") || "—"
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${c.say.padEnd(40)} ${r.source.padEnd(8)} ${String(r.ms).padStart(5)}ms  want: ${c.want.padEnd(34)} got: ${ops}`)
}
console.log(`\n${pass}/${CASES.length} passed`)
process.exitCode = fails.length ? 1 : 0
