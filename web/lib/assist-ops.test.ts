import { test } from "node:test"
import assert from "node:assert/strict"
import { applyOps, COLORS, extractOps, moveTarget, norm, parseModelOps, spotInFront, type Ctx, type Op, type RegEntry, type StudioLike } from "./assist-ops.ts"
import type { Item } from "./layout.ts"

const REG: RegEntry[] = [
  { name: "knob", displayName: "Knob / Dial", category: "controls", style: "default" },
  { name: "slider", displayName: "Slider", category: "controls", style: "default" },
  { name: "drum-pad", displayName: "Drum Pad", category: "music", style: "default" },
  { name: "piano-keys", displayName: "Piano Keys", category: "music", style: "default" },
  { name: "gauge", displayName: "Gauge / Meter", category: "data", style: "default" },
  { name: "lamp", displayName: "Lamp", category: "objects", style: "default", props: [
    { name: "color", type: "color", default: "#ffffff" },
    { name: "on", type: "boolean", default: true },
  ] },
  { name: "settings-default", displayName: "Settings Panel", category: "settings", style: "default", aliases: ["preferences"] },
  { name: "settings-glass", displayName: "Glass Settings", category: "settings", style: "glass", aliases: ["preferences"] },
  { name: "label", displayName: "Label / Title", category: "containers", props: [{ name: "text", type: "string", default: "Label" }] },
]
const ctx = (items: [string, string][], selectedId: string | null = items.at(-1)?.[0] ?? null): Ctx => ({
  items: items.map(([id, component]) => ({ id, component })), selectedId, registry: REG,
})

test("spoken numbers become digits", () => {
  assert.equal(norm("Turn it forty-five degrees."), "turn it 45 degrees")
  assert.equal(norm("a hundred and eighty"), "180")
  assert.equal(norm("rotate that one"), "rotate that one") // "one" stays a word, not 1°
})

test("'make it bigger' with a selection → scale ×1.25 on the selection", () => {
  assert.deepEqual(extractOps("make it bigger", ctx([["k1", "knob"]])), [{ op: "scale", target: "k1", amount: 1.25 }])
  assert.deepEqual(extractOps("make it smaller", ctx([["k1", "knob"]])), [{ op: "scale", target: "k1", amount: 0.8 }])
  assert.deepEqual(extractOps("make it twice as big", ctx([["k1", "knob"]])), [{ op: "scale", target: "k1", amount: 2 }])
})

test("nothing selected → edits are dropped", () => {
  assert.deepEqual(extractOps("make it bigger", ctx([["k1", "knob"]], null)), [])
})

test("'make the lamp blue' with no lamp in the layout → no op (not the selected knob)", () => {
  assert.deepEqual(extractOps("make the lamp blue", ctx([["k1", "knob"]])), [])
})

test("'make the lamp blue' with a lamp → its colour prop, blue hex", () => {
  const ops = extractOps("make the lamp blue", ctx([["l1", "lamp"], ["k1", "knob"]]))
  assert.deepEqual(ops, [{ op: "set_prop", target: "l1", prop: "color", value: COLORS.blue }])
})

test("model says red, user said blue → blue (code picks the value)", () => {
  const model: Op[] = [{ op: "set_prop", target: "l1", prop: "color", value: "red" }]
  const ops = extractOps("make the lamp blue", ctx([["l1", "lamp"]]), model)
  assert.deepEqual(ops, [{ op: "set_prop", target: "l1", prop: "color", value: COLORS.blue }])
})

test("'add a drum pad' → add drum-pad", () => {
  assert.deepEqual(extractOps("add a drum pad", ctx([])), [{ op: "add_component", component: "drum-pad" }])
  assert.deepEqual(extractOps("Add a piano.", ctx([])), [{ op: "add_component", component: "piano-keys" }])
})

test("uncorroborated extra model ops are dropped", () => {
  const model: Op[] = [
    { op: "scale", target: "k1", amount: 3 },
    { op: "rotate", target: "k1", amount: 90 },
    { op: "set_prop", target: "k1", prop: "color", value: "red" },
    { op: "add_component", component: "drum-pad" },
  ]
  assert.deepEqual(extractOps("make it bigger", ctx([["k1", "knob"]]), model), [{ op: "scale", target: "k1", amount: 1.25 }])
})

test("model intents filter the keyword grammar", () => {
  // Model only heard a rotate: the scale cue in the same sentence is not applied.
  const ops = extractOps("turn it 45 degrees and bigger", ctx([["k1", "knob"]]), [{ op: "rotate" }])
  assert.deepEqual(ops, [{ op: "rotate", target: "k1", amount: 45 }])
})

test("rotate: default 15°, spoken degrees, direction sign", () => {
  const c = ctx([["k1", "knob"]])
  assert.deepEqual(extractOps("rotate it", c), [{ op: "rotate", target: "k1", amount: 15 }])
  assert.deepEqual(extractOps("turn it forty five degrees", c), [{ op: "rotate", target: "k1", amount: 45 }])
  assert.deepEqual(extractOps("rotate it 90 degrees clockwise", c), [{ op: "rotate", target: "k1", amount: -90 }])
  assert.deepEqual(extractOps("turn on the lamp", ctx([["l1", "lamp"]])), [{ op: "set_prop", target: "l1", prop: "on", value: true }])
})

test("move needs a direction word; no number = no amount (applyOps picks); units", () => {
  const c = ctx([["k1", "knob"]])
  assert.deepEqual(extractOps("move it", c), [])
  assert.deepEqual(extractOps("move it left", c), [{ op: "move", target: "k1", direction: "left" }])
  assert.deepEqual(extractOps("move it up half a meter", c), [{ op: "move", target: "k1", direction: "up", amount: 0.5 }])
  assert.deepEqual(extractOps("bring the knob 30 cm closer", c), [{ op: "move", target: "k1", direction: "closer", amount: 0.3 }])
})

test("named target in the layout wins over the selection", () => {
  assert.deepEqual(extractOps("make the knob bigger", ctx([["k1", "knob"], ["d1", "drum-pad"]])), [{ op: "scale", target: "k1", amount: 1.25 }])
})

test("add then edit 'it' → the edit targets the new item (no target = selection at apply time)", () => {
  assert.deepEqual(extractOps("add a drum pad and make it bigger", ctx([["k1", "knob"]])), [
    { op: "add_component", component: "drum-pad" },
    { op: "scale", amount: 1.25 },
  ])
})

test("swap style, environment, remove, select, negation", () => {
  assert.deepEqual(extractOps("make it glass", ctx([["s1", "settings-default"]])), [{ op: "swap_style", target: "s1", component: "settings-glass" }])
  assert.deepEqual(extractOps("make it a slider", ctx([["k1", "knob"]])), [{ op: "swap_style", target: "k1", component: "slider" }])
  assert.deepEqual(extractOps("switch to the space environment", ctx([["k1", "knob"]])), [{ op: "set_environment", value: "space" }])
  assert.deepEqual(extractOps("delete it", ctx([["k1", "knob"]])), [{ op: "remove", target: "k1" }])
  assert.deepEqual(extractOps("select the knob", ctx([["k1", "knob"], ["d1", "drum-pad"]])), [{ op: "select", target: "k1" }])
  assert.deepEqual(extractOps("don't make it bigger", ctx([["k1", "knob"]])), [])
})

test("string prop keeps the speaker's words", () => {
  assert.deepEqual(extractOps("Set the text to Hello World.", ctx([["t1", "label"]])), [{ op: "set_prop", target: "t1", prop: "text", value: "Hello World" }])
})

test("parseModelOps tolerates sloppy JSON shapes", () => {
  assert.deepEqual(parseModelOps({ ops: [{ op: "scale" }, { op: "explode" }, null] }), [{ op: "scale" }])
  assert.deepEqual(parseModelOps({ op: "remove" }), [{ op: "remove" }])
  assert.equal(parseModelOps("nope"), null)
})

test("applyOps edits the store in order", () => {
  let state: StudioLike
  const item = (id: string, component: string): Item => ({ id, component, position: [0, 1, -1], rotation: [0, 0, 0], scale: 1, bind: {} })
  let env = ""
  state = {
    items: [item("k1", "knob")],
    selectedId: "k1",
    add: (component, position) => { const it = { ...item("new", component), position: position ?? [0, 1, -1] }; state = { ...state, items: [...state.items, it], selectedId: "new" } },
    update: (id, patch) => { state = { ...state, items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } },
    remove: (id) => { state = { ...state, items: state.items.filter((i) => i.id !== id) } },
    select: (id) => { state = { ...state, selectedId: id } },
    setEnvironment: (n) => { env = n ?? "room" },
  }
  const n = applyOps([
    { op: "scale", target: "k1", amount: 1.25 },
    { op: "rotate", target: "k1", amount: 90 },
    { op: "move", target: "k1", direction: "left", amount: 0.1 },
    { op: "add_component", component: "drum-pad" },
    { op: "set_prop", prop: "color", value: "#0090ff" },
    { op: "set_environment", value: "space" },
  ], () => state)
  assert.equal(n, 6)
  const k = state.items.find((i) => i.id === "k1")!
  assert.equal(k.scale, 1.25)
  assert.ok(Math.abs(k.rotation[1] - Math.PI / 2) < 1e-9)
  assert.deepEqual(k.position, [-0.1, 1, -1])
  assert.deepEqual(state.items.find((i) => i.id === "new")?.props, { color: "#0090ff" })
  assert.equal(env, "env-space") // applyOps maps the spoken id to the environment component
})

test("'soon' entries are names, never added", () => {
  const reg = REG.map((e) => (e.name === "drum-pad" ? { ...e, status: "soon" } : e))
  assert.deepEqual(extractOps("add a drum pad", { items: [], selectedId: null, registry: reg }), [])
  // still recognised as a name, so it can't fall through to the selected knob
  assert.deepEqual(extractOps("make the drum pad bigger", { items: [{ id: "k1", component: "knob" }], selectedId: "k1", registry: reg }), [])
})

test("'set the text to Hello' on a label: the prop name 'text' doesn't mean a missing text-3d", () => {
  const c: Ctx = { items: [{ id: "t1", component: "label" }], selectedId: "t1", registry: [...REG, { name: "text-3d", displayName: "3D Text", category: "objects" }] }
  assert.deepEqual(extractOps("set the text to Hello", c), [{ op: "set_prop", target: "t1", prop: "text", value: "Hello" }])
})

test("photo backdrops are reachable by voice", () => {
  const c = ctx([])
  assert.deepEqual(extractOps("take me to the beach", c), [{ op: "set_environment", value: "beach" }])
  assert.deepEqual(extractOps("go to the desert", c), [{ op: "set_environment", value: "desert" }])
  assert.deepEqual(extractOps("switch to the night field", c), [{ op: "set_environment", value: "night-field" }])
  assert.deepEqual(extractOps("take me to outer space", c), [{ op: "set_environment", value: "space" }])
})

test("scene navigation: value is the user's words; scene wording beats environment words", () => {
  const c = ctx([["k1", "knob"]])
  const go = (s: string) => extractOps(s, c).filter((o) => o.op === "go_scene" || o.op === "set_environment")
  assert.deepEqual(go("next scene"), [{ op: "go_scene", value: "next" }])
  assert.deepEqual(go("go to the previous scene"), [{ op: "go_scene", value: "back" }])
  assert.deepEqual(go("go to scene two"), [{ op: "go_scene", value: "2" }])
  assert.deepEqual(go("go to scene one"), [{ op: "go_scene", value: "1" }])
  assert.deepEqual(go("switch to scene called Intro please"), [{ op: "go_scene", value: "intro" }])
  assert.deepEqual(go("take me to the lobby scene"), [{ op: "go_scene", value: "lobby" }])
  assert.deepEqual(go("go to the forest scene"), [{ op: "set_environment", value: "forest" }])
  assert.deepEqual(go("switch to the space environment"), [{ op: "set_environment", value: "space" }])
  assert.deepEqual(go("dont go to the next scene"), [])
})

test("go_scene switches the real store's scene; unknown scene does nothing", async () => {
  const { useStudio } = await import("./studio-store.ts")
  const S = () => useStudio.getState()
  S().load({ name: "t", items: [] })
  S().addScene("Lobby")
  S().addScene("Stage")
  const [first, lobby] = S().scenes
  S().switchScene(first.id)
  assert.equal(applyOps([{ op: "go_scene", value: "lobby" }], S), 1)
  assert.equal(S().sceneId, lobby.id)
  assert.equal(applyOps([{ op: "go_scene", value: "next" }], S), 1)
  assert.equal(S().scenes.find((s) => s.id === S().sceneId)?.name, "Stage")
  assert.equal(applyOps([{ op: "go_scene", value: "basement" }], S), 0)
  assert.equal(S().scenes.find((s) => s.id === S().sceneId)?.name, "Stage")
})

// The user's report: "add a drum pad" → "display it and move it closer to me" moved the tempo display.
const REG2: RegEntry[] = [...REG,
  { name: "tempo-display", displayName: "Tempo Display", category: "music" },
  { name: "computer-monitor", displayName: "Computer Monitor", category: "hardware", aliases: ["monitor", "display", "screen"] },
]
test("'it' / 'the X you just added' → the selection or newest item, never a name-alike", () => {
  const c: Ctx = { items: [{ id: "t1", component: "tempo-display" }, { id: "d1", component: "drum-pad" }], selectedId: "d1", registry: REG2 }
  assert.deepEqual(extractOps("display it and move it closer to me", c), [
    { op: "show", target: "d1" },
    { op: "move", target: "d1", direction: "closer" },
  ])
  assert.deepEqual(extractOps("show me the drum pad you just adde", { ...c, selectedId: "t1" }), [{ op: "show", target: "d1" }])
  assert.deepEqual(extractOps("show me the one you just added", { ...c, selectedId: "t1" }), [{ op: "show", target: "d1" }])
  assert.deepEqual(extractOps("add piano keys right in front of me", c), [{ op: "add_component", component: "piano-keys" }])
})

test("placement: in front of the viewer at UI height facing them, furniture on the floor, sideways when taken", () => {
  const viewer = { position: [2, 1.6, 0] as [number, number, number], direction: [1, -0.5, 0] as [number, number, number] } // looking +X, pitched down
  const a = spotInFront(viewer, [], false)
  assert.deepEqual(a.position, [2.75, 1.4, 0])
  assert.ok(Math.abs(a.yaw - Math.atan2(-1, 0)) < 1e-9) // its front (+Z local) points back at -X
  assert.deepEqual(spotInFront(viewer, [], true).position, [3.1, 0, 0])
  const taken: Item = { id: "x", component: "knob", position: [2.75, 1.4, 0], rotation: [0, 0, 0], scale: 1, bind: {} }
  assert.deepEqual(spotInFront(viewer, [taken], false).position, [2.75, 1.4, 0.45]) // nudged to the viewer's right (+Z when facing +X)
})

test("relative moves: closer = 40% of the gap, never within 0.5 m; left/right follow the gaze", () => {
  const viewer = { position: [0, 1.6, 0] as [number, number, number], direction: [0, 0, -1] as [number, number, number] }
  assert.deepEqual(moveTarget([0, 1.4, -2], "closer", undefined, viewer), [0, 1.4, -1.2])
  assert.deepEqual(moveTarget([0, 1.4, -0.6], "closer", undefined, viewer), [0, 1.4, -0.5])
  assert.deepEqual(moveTarget([0, 1.4, -2], "farther", undefined, viewer), [0, 1.4, -2.8])
  assert.deepEqual(moveTarget([0, 1.4, -2], "left", undefined, viewer), [-0.25, 1.4, -2])
})

test("show + add with a viewer: summoned frame child is lifted out at its world scale", () => {
  const it = (id: string, component: string, extra: Partial<Item> = {}): Item => ({ id, component, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, bind: {}, ...extra })
  let state: StudioLike = {
    items: [it("root", "frame", { position: [5, 2, 5], scale: 0.5 }), it("d1", "drum-pad", { parentId: "root", position: [1, 0, 0] })],
    selectedId: null,
    add: (component, position, patch) => { state = { ...state, items: [...state.items, it("new", component, { position: position!, ...patch })], selectedId: "new" } },
    update: (id, patch) => { state = { ...state, items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } },
    remove: () => {},
    select: (id) => { state = { ...state, selectedId: id } },
  }
  const viewer = { position: [0, 1.6, 0] as [number, number, number], direction: [0, 0, -1] as [number, number, number] }
  assert.equal(applyOps([{ op: "show", target: "d1" }, { op: "add_component", component: "lamp" }], () => state, viewer, (c) => c === "lamp"), 2)
  const d = state.items.find((i) => i.id === "d1")!
  assert.equal(state.selectedId, "new")
  assert.deepEqual([d.position, d.parentId, d.scale], [[0, 1.4, -0.75], undefined, 0.5])
  assert.deepEqual(state.items.find((i) => i.id === "new")!.position, [0, 0, -1.1])
})
