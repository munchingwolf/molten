// Voice command → scene ops. The local 8B model only classifies intent; every value here comes from the
// user's own words (measured rule: gating beats trusting the model). Pure + .ts imports so `node --test` runs it.
import type { Item, Vec3 } from "./layout.ts"
import { resolveScene } from "./scene-nav.ts"

export const OP_NAMES = ["add_component", "remove", "scale", "rotate", "move", "set_prop", "swap_style", "set_environment", "select", "go_scene", "show"] as const
export type OpName = (typeof OP_NAMES)[number]
export type Op = { op: OpName; target?: string; component?: string; prop?: string; value?: unknown; amount?: number; direction?: string }

export type PropMeta = { name: string; type: "color" | "string" | "number" | "boolean" | "enum"; options?: string[]; min?: number; max?: number; default?: unknown }
/** `status: "soon"` entries still count as names ("the lamp") but are never added or swapped in. */
export type RegEntry = { name: string; displayName: string; aliases?: string[]; category?: string; style?: string; status?: string; props?: PropMeta[] }
export type Ctx = { items: Pick<Item, "id" | "component">[]; selectedId: string | null; registry: RegEntry[] }

/** Environment ids the lead's `setEnvironment` receives, and the words that name each. */
export const ENVIRONMENTS: Record<string, string[]> = {
  space: ["outer space", "space", "galaxy", "stars"],
  forest: ["forest", "woods", "jungle"],
  loft: ["studio loft", "loft"],
  stage: ["concert stage", "concert", "stage"],
  gallery: ["minimal gallery", "gallery", "museum"],
  room: ["my room", "your room", "real room", "passthrough", "pass through"],
  "light-studio": ["light studio", "white studio", "photo studio"],
  meadow: ["meadow", "field", "grass"],
  beach: ["beach", "sand", "sea", "ocean", "coast"],
  "open-lot": ["open lot", "parking lot", "lot", "plaza"],
  desert: ["desert", "dunes", "canyon"],
  "night-field": ["night field", "night", "starry"],
}

export const COLORS: Record<string, string> = {
  red: "#e5484d", orange: "#f76b15", yellow: "#ffe629", gold: "#d4a72c", green: "#30a46c", lime: "#99d52a",
  teal: "#12a594", cyan: "#00a2c7", turquoise: "#3ddbd9", blue: "#0090ff", navy: "#1e3a8a", indigo: "#3e63dd",
  purple: "#8e4ec6", violet: "#6e56cf", magenta: "#d6409f", pink: "#ff8dc7", brown: "#a07553", white: "#ffffff",
  black: "#111111", gray: "#8b8d98", grey: "#8b8d98", silver: "#c0c0c0",
}

// ---------- text helpers ----------

const NUM: Record<string, number> = {
  zero: 0, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
}

/** Lowercase, strip punctuation (keeps % ° and decimals), spoken numbers → digits ("forty five" → "45"). */
export function norm(text: string) {
  const t = text.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9%°.\s]/g, " ").replace(/(?<!\d)\.|\.(?!\d)/g, " ")
  const out: string[] = []
  let n: number | null = null
  for (const w of t.split(/\s+/).filter(Boolean)) {
    if (w === "hundred" && n === null && out.at(-1) === "a") out.pop() // "a hundred"
    if (w in NUM) n = w === "hundred" ? (n || 1) * 100 : (n ?? 0) + NUM[w]
    else if (w === "and" && n !== null) continue
    else {
      if (n !== null) out.push(String(n))
      n = null
      out.push(w)
    }
  }
  if (n !== null) out.push(String(n))
  return out.join(" ")
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** Index of the first whole-word match of any phrase (plural ok), or -1. */
function at(t: string, phrases: string[]) {
  let best = -1
  for (const p of phrases) {
    const m = new RegExp(`\\b${esc(p)}(?:s|es)?\\b`).exec(t)
    if (m && (best < 0 || m.index < best)) best = m.index
  }
  return best
}
const find = (t: string, re: RegExp) => re.exec(t)?.index ?? -1
const words = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

// ---------- component mentions ----------

const STOP = new Set(["3d", "the", "a", "an", "and", "of", "with", "effects", "default", "soon"])
// Names that are also everyday command words ("half a meter", "select the knob"): never proof that a component is absent.
const AMBIGUOUS = new Set(["meter", "select", "label", "title", "options", "spatial audio"])

function phrasesOf(name: string, reg: RegEntry[]) {
  const e = reg.find((r) => r.name === name)
  const list = [name.replace(/-/g, " ")]
  if (e) {
    for (const part of e.displayName.split(/[/()]/)) list.push(part, part.replace(/\b3d\b/gi, ""))
    list.push(...(e.aliases ?? []))
  }
  return [...new Set(list.map(norm).filter((p) => p.length > 1))]
}

/** Words that name exactly one registry entry ("piano" → piano-keys), so partial names still work. */
function uniqueTokens(reg: RegEntry[]) {
  const owners = new Map<string, Set<string>>()
  for (const e of reg) for (const p of phrasesOf(e.name, reg)) for (const w of p.split(" "))
    if (w.length > 2 && !STOP.has(w)) owners.set(w, (owners.get(w) ?? new Set()).add(e.name))
  const out = new Map<string, string[]>()
  for (const [w, s] of owners) if (s.size === 1) { const n = [...s][0]; out.set(n, [...(out.get(n) ?? []), w]) }
  return out
}

/** Registry entries the text names, earliest mention first. `loose` also accepts a unique word. */
function mentioned(t: string, reg: RegEntry[], loose: boolean, skip?: Set<string>) {
  const uniq = loose ? uniqueTokens(reg) : null
  return reg
    .map((e) => {
      let i = at(t, phrasesOf(e.name, reg).filter((p) => !skip?.has(p)))
      if (i < 0 && uniq) i = at(t, uniq.get(e.name) ?? [])
      return { name: e.name, i }
    })
    .filter((m) => m.i >= 0)
    .sort((a, b) => a.i - b.i)
}

// ---------- cue words ----------

const NEGATION = /\b(dont|do not|never ?mind|cancel|undo)\b/
const ADD = /\b(add|create|insert|spawn|give me|i want|i need|bring in|(?:put|place|drop|make(?: me)?) (?:a|an|another|some|one more))\b/
const REMOVE = /\b(remove|delete|get rid of|trash|destroy|take away|discard|erase)\b/
const SELECT = /\b(select|pick|choose|focus on)\b/
const SHOW = /\b(show me|show|display|find)\b/
// "it" / "that" mean the selection: only a full name may override it ("display it" is not the tempo display).
const PRONOUN = /\b(it|this|that|them)\b/
const RECENT = /\b(just added|you added|i added|new one|newest|latest|last one)\b/
const SCALE_UP = /\b(bigger|larger|grow|enlarge|huge|giant|scale up|increase (?:the |its )?size)\b/
const SCALE_DOWN = /\b(smaller|shrink|tiny|tinier|scale down|(?:reduce|decrease) (?:the |its )?size)\b/
const ROTATE = /\b(rotate|rotated|spin|twist|clockwise|counterclockwise|anticlockwise|degrees?)\b|°|\bturn\b.*\b(left|right|around|\d+)\b/
const MOVE = /\b(move|shift|push|pull|slide|nudge|bring|put|drag|lift|raise|scoot|send)\b/
const ENV_CUE = /\b(environment|world|background|backdrop|scene|scenery|setting|take me|go to|switch to|change to|teleport|put me|bring me|lets go)\b/
const SWAP_CUE = /\b(style|look|version|variant|swap|switch|change|make it|make this|turn it|turn this|use|into|instead)\b/
const ON = /\b(on|true|enable|enabled|show|start)\b/
const OFF = /\b(off|false|disable|disabled|hide|stop)\b/
const DIRS: [string, RegExp][] = [
  ["left", /\bleft\b/],
  ["right", /\bright\b/],
  ["up", /\b(up|upward|upwards|higher)\b/],
  ["down", /\b(down|downward|downwards)\b/],
  ["closer", /\b(closer|nearer|towards? me)\b/],
  ["farther", /\b(farther|further|away)\b/],
]

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number) => Math.round(n * 1000) / 1000

// ---------- per-op extractors: each returns ops only when the words support them ----------

type Found = Op & { at: number }
type Target = { id?: string } | null

/** Named item in the layout → its id; a named component that isn't there → null (drop); else the selection. */
function resolveTarget(t: string, ctx: Ctx, adding: string[], hint?: Op, ignoreCategory?: string): Target {
  const inLayout = [...new Set(ctx.items.map((i) => i.component))]
  const named = mentioned(t, ctx.registry.filter((e) => inLayout.includes(e.name) || adding.includes(e.name)), adding.length > 0 || !PRONOUN.test(t))
  for (const c of inLayout) if (!ctx.registry.some((e) => e.name === c)) {
    const i = at(t, phrasesOf(c, ctx.registry)) // layout item whose entry wasn't sent
    if (i >= 0) named.push({ name: c, i })
  }
  if (named.length) {
    const pick = (named.find((m) => hint?.target && (m.name === hint.target || ctx.items.some((i) => i.id === hint.target && i.component === m.name))) ?? named[0]).name
    if (adding.includes(pick)) return {} // the item this command just added = the selection at apply time
    const hinted = ctx.items.find((i) => i.id === hint?.target && i.component === pick)
    const sel = ctx.items.find((i) => i.id === ctx.selectedId && i.component === pick)
    return { id: (hinted ?? sel ?? ctx.items.filter((i) => i.component === pick).at(-1))!.id }
  }
  // "set the text to Hello": the selection's prop names aren't proof that text-3d is missing
  const selProps = ctx.registry.find((e) => e.name === ctx.items.find((i) => i.id === ctx.selectedId)?.component)?.props ?? []
  const skip = new Set([...AMBIGUOUS, ...selProps.map((p) => words(p.name).join(" "))])
  const absent = mentioned(t, ctx.registry.filter((e) => !adding.includes(e.name) && (!ignoreCategory || e.category !== ignoreCategory)), false, skip)
  if (absent.length) return null // "the lamp", but there's no lamp
  if (adding.length) return {}
  if (RECENT.test(t) && ctx.items.length) return { id: ctx.items.at(-1)!.id } // "the one you just added": items are in add order
  return ctx.selectedId ? { id: ctx.selectedId } : null
}

const tgt = (target: Target) => (target?.id ? { target: target.id } : {})

function addOps(t: string, ctx: Ctx, hints?: Op[]): Found[] {
  const cue = find(t, ADD)
  if (cue < 0) return []
  const after = t.slice(cue)
  const ready = ctx.registry.filter((e) => e.status !== "soon")
  let cands = mentioned(after, ready, false)
  if (!cands.length) cands = mentioned(after.split(" ").slice(0, 5).join(" "), ready, true) // "add a piano"
  if (!cands.length) return []
  const name = cands.find((c) => hints?.some((h) => h.component === c.name))?.name ?? cands[0].name
  return [{ op: "add_component", component: name, at: cue }]
}

function scaleOps(t: string, target: Target): Found[] {
  const up = find(t, SCALE_UP), down = find(t, SCALE_DOWN)
  const times = /(\d+(?:\.\d+)?)\s*(?:x|times)\b/.exec(t)
  const pct = /(\d+(?:\.\d+)?)\s*(?:%|percent)/.exec(t)
  const dbl = find(t, /\b(double|twice)\b/), half = find(t, /\bhalf (?:the |its )?size\b|\bhalf as (?:big|large)\b/)
  const cue = [up, down, dbl, half].filter((i) => i >= 0)
  if (!cue.length || !target) return []
  const shrink = down >= 0 && up < 0
  let f = shrink ? 0.8 : 1.25
  if (half >= 0) f = 0.5
  else if (times) f = shrink ? 1 / +times[1] : +times[1]
  else if (pct && (up >= 0 || down >= 0)) f = shrink ? 1 - +pct[1] / 100 : 1 + +pct[1] / 100
  else if (dbl >= 0) f = 2
  return [{ op: "scale", ...tgt(target), amount: round(clamp(f, 0.1, 10)), at: Math.min(...cue) }]
}

function rotateOps(t: string, target: Target): Found[] {
  const cue = find(t, ROTATE)
  if (cue < 0 || !target) return []
  const deg = /(\d+(?:\.\d+)?)\s*(?:°|degrees?\b|deg\b)/.exec(t)
  const any = /\b(\d+(?:\.\d+)?)\b/.exec(t.slice(cue))
  let d = deg ? +deg[1] : /\b(around|flip|half turn)\b/.test(t) ? 180 : /\bquarter turn\b/.test(t) ? 90 : any ? +any[1] : 15
  if (/\b(clockwise|right)\b/.test(t.replace(/\b(counter|anti) ?clockwise\b/g, ""))) d = -d
  return [{ op: "rotate", ...tgt(target), amount: round(clamp(d, -360, 360)), at: cue }]
}

/** Metres from "20 cm" / "1.5 meters" / "half a meter"; plain numbers are centimetres. None said → undefined (applyOps picks). */
function distance(s: string) {
  if (/\bhalf a met(?:er|re)\b/.test(s)) return 0.5
  if (/\ba met(?:er|re)\b/.test(s)) return 1
  const m = /(\d+(?:\.\d+)?)\s*(cm|centimet(?:er|re)s?|m|met(?:er|re)s?|feet|foot|ft)?\b/.exec(s)
  if (!m) return undefined
  const n = +m[1], u = m[2] ?? "cm"
  return clamp(u.startsWith("c") ? n / 100 : u.startsWith("m") ? n : n * 0.3048, 0.01, 3)
}

function moveOps(t: string, target: Target): Found[] {
  const cue = find(t, MOVE)
  if (cue < 0 || !target) return []
  const hits = DIRS.map(([d, re]) => ({ d, i: find(t, re) })).filter((h) => h.i >= 0).sort((a, b) => a.i - b.i)
  if (!hits.length && /\b(raise|lift)\b/.test(t)) hits.push({ d: "up", i: cue })
  return hits.map((h, k): Found => {
    const d = distance(hits.length > 1 ? t.slice(h.i, hits[k + 1]?.i) : t)
    return { op: "move", ...tgt(target), direction: h.d, ...(d === undefined ? {} : { amount: round(d) }), at: h.i }
  })
}

function setPropOps(t: string, original: string, ctx: Ctx, target: Target, component: string | undefined, hints?: Op[]): Found[] {
  if (!target || !component) return []
  const props = ctx.registry.find((e) => e.name === component)?.props ?? []
  const said = (p: PropMeta) => at(t, [words(p.name).join(" ")]) >= 0
  const hinted = (p: PropMeta) => hints?.some((h) => h.prop === p.name)
  const out: Found[] = []
  // colour: the last colour word wins ("from red to blue" → blue)
  let color: { w: string; i: number } | null = null
  for (const w of Object.keys(COLORS)) {
    const m = [...t.matchAll(new RegExp(`\\b${w}\\b`, "g"))].at(-1)
    if (m && (!color || m.index > color.i)) color = { w, i: m.index }
  }
  if (color) {
    const cp = props.filter((p) => p.type === "color")
    const p = cp.find(said) ?? cp.find(hinted) ?? cp[0] ?? (props.length ? undefined : { name: "color" })
    if (p) out.push({ op: "set_prop", ...tgt(target), prop: p.name, value: COLORS[color.w], at: color.i })
  }
  for (const p of props) {
    if (p.type === "enum") {
      const opt = (p.options ?? []).map((o) => ({ o, i: at(t, [norm(o)]) })).find((x) => x.i >= 0)
      const unique = props.filter((q) => q.type === "enum" && q.options?.includes(opt?.o ?? "")).length === 1
      if (opt && (said(p) || unique)) out.push({ op: "set_prop", ...tgt(target), prop: p.name, value: opt.o, at: opt.i })
    } else if (p.type === "boolean") {
      const only = props.filter((q) => q.type === "boolean").length === 1
      const on = find(t, ON), off = find(t, OFF)
      if ((said(p) || only) && (on >= 0) !== (off >= 0)) out.push({ op: "set_prop", ...tgt(target), prop: p.name, value: on >= 0, at: Math.max(on, off) })
    } else if (p.type === "number" && said(p)) {
      const n = [...t.matchAll(/(-?\d+(?:\.\d+)?)/g)].at(-1)
      if (n) out.push({ op: "set_prop", ...tgt(target), prop: p.name, value: clamp(+n[1], p.min ?? -Infinity, p.max ?? Infinity), at: n.index })
    } else if (p.type === "string" && said(p)) {
      // Keep the speaker's casing: take the original words after "<prop> … to/say".
      const m = new RegExp(`${words(p.name).join("\\s+")}[^]*?\\b(?:to|say|says|saying|read|reads)\\s+(?:say\\s+|read\\s+)?["“']?(.+?)["”']?[.!?]*$`, "i").exec(original)
      if (m?.[1].trim()) out.push({ op: "set_prop", ...tgt(target), prop: p.name, value: m[1].trim().slice(0, 80), at: m.index })
    }
  }
  return out
}

function swapOps(t: string, ctx: Ctx, target: Target, component: string | undefined, hints?: Op[]): Found[] {
  const cue = find(t, SWAP_CUE)
  const cur = ctx.registry.find((e) => e.name === component)
  if (cue < 0 || !target?.id || !cur) return []
  const own = new Set([...words(cur.name), ...words(cur.style ?? "")])
  const cands = ctx.registry
    .filter((e) => e.name !== cur.name && e.category === cur.category && e.status !== "soon")
    .map((e) => ({ name: e.name, i: at(t, [...words(e.name), ...words(e.style ?? "")].filter((w) => !own.has(w) && !STOP.has(w))) }))
    .filter((c) => c.i >= 0)
    .sort((a, b) => a.i - b.i)
  if (!cands.length) return []
  const name = cands.find((c) => hints?.some((h) => h.component === c.name))?.name ?? cands[0].name
  return [{ op: "swap_style", target: target.id, component: name, at: cands[0].i }]
}

// "next scene", "go to scene 2", "go to the intro scene". The value is the user's words; applyOps resolves it via resolveScene.
const SCENE_STEP = /\b(next|previous|prev) scene\b/
const SCENE_GO = /\b(?:go|switch|jump|move|take me|bring me|open|show)(?: me)?(?: back)?(?: to)?(?: the)? scene (?:called |named )?(.+)$/
const SCENE_NAMED = /\b(?:go|switch|jump|move|take me|bring me)(?: back)? to (?:the )?(.+?) scene\b/

function sceneOps(t: string): Found[] {
  const step = SCENE_STEP.exec(t)
  if (step) return [{ op: "go_scene", value: step[1] === "next" ? "next" : "back", at: step.index }]
  const named = SCENE_NAMED.exec(t)
  const m = SCENE_GO.exec(t) ?? (named && !envOps(t).length ? named : null) // "go to the forest scene" stays an environment
  const to = m?.[1].split(/ (?:and|then|please) /)[0].replace(/ please$/, "").trim()
  return to ? [{ op: "go_scene", value: to === "one" ? "1" : to, at: m!.index }] : []
}

function envOps(t: string): Found[] {
  if (find(t, ENV_CUE) < 0) return []
  const hit = Object.entries(ENVIRONMENTS).map(([id, ws]) => ({ id, i: at(t, ws) })).filter((h) => h.i >= 0).sort((a, b) => a.i - b.i)[0]
  return hit ? [{ op: "set_environment", value: hit.id, at: hit.i }] : []
}

/**
 * The ops the transcript supports. With `intents` (the model's parsed ops) only those op kinds are kept and
 * the model's picks break ties; without them this is the pure keyword grammar. Values always come from the words.
 */
export function extractOps(text: string, ctx: Ctx, intents?: Op[]): Op[] {
  let t = norm(text)
  if (!t || NEGATION.test(t)) return []
  // The model often files "show me X" as a select or a move.
  const wants = (k: OpName) => !intents || intents.some((o) => o.op === k || (k === "show" && (o.op === "select" || o.op === "move")))
  // "show"/"display" is the verb here, not the monitor's alias or a boolean "show" prop: blank it before reading the rest.
  const show = wants("show") && !/\bscene\b/.test(t) ? find(t, SHOW) : -1 // "show me scene 2" is go_scene
  if (show >= 0) t = t.replace(SHOW, (m) => " ".repeat(m.length))
  const hintsFor = (k: OpName) => intents?.filter((o) => o.op === k)
  const found: Found[] = []

  const adds = wants("add_component") ? addOps(t, ctx, hintsFor("add_component")) : []
  found.push(...adds)
  const adding = adds.map((a) => a.component!)

  const edit = (k: OpName) => resolveTarget(t, ctx, adding, hintsFor(k)?.[0])
  const compOf = (target: Target) => (target?.id ? ctx.items.find((i) => i.id === target.id)?.component : adding[0])

  if (wants("scale")) found.push(...scaleOps(t, edit("scale")))
  if (wants("rotate")) found.push(...rotateOps(t, edit("rotate")))
  if (wants("move")) found.push(...moveOps(t, edit("move")))
  if (wants("set_prop")) { const tg = edit("set_prop"); found.push(...setPropOps(t, text, ctx, tg, compOf(tg), hintsFor("set_prop"))) }
  if (wants("swap_style")) {
    // "make it a slider": a sibling's name is the new style, not a missing target
    const selCat = ctx.registry.find((e) => e.name === ctx.items.find((i) => i.id === ctx.selectedId)?.component)?.category
    const tg = resolveTarget(t, ctx, adding, hintsFor("swap_style")?.[0], selCat)
    found.push(...swapOps(t, ctx, tg, compOf(tg), hintsFor("swap_style"))) }
  const scene = wants("go_scene") ? sceneOps(t) : []
  found.push(...scene)
  if (wants("set_environment") && !scene.length) found.push(...envOps(t))
  if (wants("remove")) {
    const cue = find(t, REMOVE), tg = cue >= 0 ? resolveTarget(t, ctx, [], hintsFor("remove")?.[0]) : null
    if (tg?.id) found.push({ op: "remove", target: tg.id, at: cue })
  }
  if (show >= 0) {
    const tg = resolveTarget(t, ctx, adding, hintsFor("show")?.[0])
    if (tg) found.push({ op: "show", ...tgt(tg), at: show })
  }
  if (wants("select")) {
    const cue = find(t, SELECT), tg = cue >= 0 ? resolveTarget(t, ctx, [], hintsFor("select")?.[0]) : null
    // select needs a name; "select it" is already selected
    if (tg?.id && mentioned(t, ctx.registry, true).length) found.push({ op: "select", target: tg.id, at: cue })
  }
  return found.sort((a, b) => a.at - b.at).map((f) => { const op: Op & { at?: number } = { ...f }; delete op.at; return op })
}

/** Whatever JSON the model produced → a list of well-formed op intents (values are ignored later anyway). */
export function parseModelOps(raw: unknown): Op[] | null {
  const obj = raw as { ops?: unknown; op?: unknown } | null
  const list = Array.isArray(obj?.ops) ? obj.ops : obj && typeof obj.op === "string" ? [obj] : Array.isArray(raw) ? raw : null
  if (!list) return null
  return list.filter((o): o is Op => !!o && typeof o === "object" && OP_NAMES.includes((o as Op).op))
}

// ---------- applying ops to the Studio store (client) ----------

export type StudioLike = {
  items: Item[]
  selectedId: string | null
  add: (component: string, position?: Vec3, patch?: Partial<Item>) => void
  update: (id: string, patch: Partial<Item>) => void
  remove: (id: string) => void
  select: (id: string | null) => void
  setEnvironment?: (name: string | null) => void
  scenes?: { id: string; name: string }[]
  sceneId?: string
  switchScene?: (id: string) => void
}
/** Viewer pose (XR head or laptop camera) in world space; omit to use the store's default slots. */
export type Viewer = { position: Vec3; direction: Vec3 }

/** Categories that stand on the floor (same set as the library drop and the VR wheel). */
export const ON_FLOOR = new Set(["objects", "room", "hardware", "spaces"])

const UI_REACH = 0.75 // m in front of the eyes: in poke range, fully in view
const FLOOR_REACH = 1.1 // furniture: far enough that you aren't standing in it
const EYE_DROP = 0.2 // UI sits a little below eye height
const NEAREST = 0.5 // "closer" never brings anything nearer than this
const CLEAR = 0.35 // a new spot must be this far from every other item

/** Gaze flattened to the floor (yaw only); straight down/up or missing → world -Z. */
function forward(viewer?: Viewer): [number, number] {
  const [dx, , dz] = viewer?.direction ?? [0, 0, -1]
  const len = Math.hypot(dx, dz)
  return len > 1e-6 ? [dx / len, dz / len] : [0, -1]
}

/** Item's parent chain, nearest first (capped, in case of a cycle). */
function parents(item: Item, items: Item[]) {
  const out: Item[] = []
  for (let p = items.find((i) => i.id === item.parentId); p && out.length < 20; p = items.find((i) => i.id === p!.parentId)) out.push(p)
  return out
}

/**
 * World position, yaw and scale of an item, walking up its frame parents.
 * shortcut: children of row/grid/arc frames are placed by auto-layout, so their stored position is not where they render; right for free frames (templates).
 */
export function worldOf(item: Item, items: Item[]): { position: Vec3; yaw: number; scale: number } {
  let [x, y, z] = item.position
  let yaw = item.rotation[1], scale = item.scale
  for (const p of parents(item, items)) {
    const c = Math.cos(p.rotation[1]), s = Math.sin(p.rotation[1])
    ;[x, y, z] = [p.position[0] + (x * c + z * s) * p.scale, p.position[1] + y * p.scale, p.position[2] + (-x * s + z * c) * p.scale]
    yaw += p.rotation[1]
    scale *= p.scale
  }
  return { position: [x, y, z], yaw, scale }
}

/**
 * Where a new or summoned item goes: in front of the viewer at UI height (or on the floor), facing them,
 * slid sideways until it clears the other items. `skip` = the item being moved.
 */
export function spotInFront(viewer: Viewer, items: Item[], floor: boolean, skip?: string): { position: Vec3; yaw: number } {
  const [fx, fz] = forward(viewer)
  const [hx, hy, hz] = viewer.position
  const d = floor ? FLOOR_REACH : UI_REACH
  const y = floor ? 0 : clamp(hy - EYE_DROP, 0.7, 1.9)
  const others = items.filter((i) => i.id !== skip && i.component !== "frame").map((i) => worldOf(i, items).position)
  let best: Vec3 = [hx + fx * d, y, hz + fz * d]
  for (const side of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35]) {
    const p: Vec3 = [hx + fx * d - fz * side, y, hz + fz * d + fx * side] // right of gaze = (-fz, fx)
    if (others.every((o) => Math.hypot(o[0] - p[0], o[1] - p[1], o[2] - p[2]) >= CLEAR)) { best = p; break }
  }
  return { position: best.map(round) as Vec3, yaw: Math.atan2(-fx, -fz) } // yaw that faces back at the viewer
}

/**
 * New world position for a relative move. With a viewer, closer/farther run along the line to the viewer
 * (default 40% of the gap, never nearer than 0.5 m) and left/right follow their gaze; without one, world axes.
 */
export function moveTarget(from: Vec3, direction: string, amount: number | undefined, viewer?: Viewer): Vec3 | null {
  const [fx, fz] = forward(viewer)
  if (direction === "up" || direction === "down") {
    const d = (amount ?? 0.15) * (direction === "up" ? 1 : -1)
    return [from[0], round(Math.max(0, from[1] + d)), from[2]]
  }
  if (direction === "left" || direction === "right") {
    const d = (amount ?? 0.25) * (direction === "right" ? 1 : -1)
    return [round(from[0] - fz * d), from[1], round(from[2] + fx * d)]
  }
  if (direction !== "closer" && direction !== "farther") return null
  // toward the viewer along the floor plane; no viewer → toward +Z (the laptop's default side)
  let tx = -fx, tz = -fz, gap = Infinity
  if (viewer) {
    const vx = viewer.position[0] - from[0], vz = viewer.position[2] - from[2]
    gap = Math.hypot(vx, vz)
    if (gap > 1e-6) (tx = vx / gap), (tz = vz / gap)
  }
  let d = amount ?? (Number.isFinite(gap) ? gap * 0.4 : 0.25)
  d = direction === "closer" ? Math.min(d, Math.max(0, gap - NEAREST)) : -d
  return [round(from[0] + tx * d), from[1], round(from[2] + tz * d)]
}

/**
 * Apply gated ops in order. Pass `useStudio.getState` so each op sees the previous one's result. Returns how many applied.
 * With a `viewer`, adds and "show" land in front of it and relative moves are relative to it; `isFloor(component)` seats furniture at y = 0.
 */
export function applyOps(ops: Op[], get: () => StudioLike, viewer?: Viewer, isFloor: (component: string) => boolean = () => false) {
  let n = 0
  /** Put an item at a world pose; a frame child is lifted out of its frame so the pose is literal. */
  const place = (item: Item, position: Vec3, yaw: number) => {
    const w = worldOf(item, get().items)
    get().update(item.id, {
      position,
      rotation: [item.rotation[0], yaw, item.rotation[2]],
      ...(item.parentId ? { parentId: undefined, scale: round(w.scale) } : {}),
    })
  }

  for (const op of ops) {
    const s = get()
    if (op.op === "add_component" && op.component) {
      if (viewer) {
        const { position, yaw } = spotInFront(viewer, s.items, isFloor(op.component))
        s.add(op.component, position, { rotation: [0, yaw, 0] })
      } else s.add(op.component)
      n++
      continue
    }
    if (op.op === "set_environment") {
      if (typeof op.value === "string" && s.setEnvironment) {
        // Voice says "space"/"loft"/"stage"; the components are env-space / env-studio-loft / env-concert-stage; "room" = passthrough.
        const v = op.value.toLowerCase()
        const ENV: Record<string, string | null> = { room: null, none: null, loft: "env-studio-loft", stage: "env-concert-stage", concert: "env-concert-stage" }
        s.setEnvironment(v in ENV ? ENV[v] : v.startsWith("env-") ? v : `env-${v}`)
        n++
      }
      continue
    }
    if (op.op === "go_scene") {
      const id = typeof op.value === "string" && s.scenes && s.switchScene ? resolveScene(s.scenes, op.value, s.sceneId ?? "") : null
      if (id) s.switchScene!(id), n++
      continue
    }
    const item = s.items.find((i) => i.id === (op.target ?? s.selectedId))
    if (!item) continue
    if (op.op === "remove") s.remove(item.id)
    else if (op.op === "select") s.select(item.id)
    else if (op.op === "show") {
      s.select(item.id)
      if (viewer) {
        const { position, yaw } = spotInFront(viewer, s.items, isFloor(item.component), item.id)
        place(item, position, yaw)
      }
    } else if (op.op === "scale") s.update(item.id, { scale: round(clamp(item.scale * (op.amount ?? 1), 0.05, 20)) })
    else if (op.op === "rotate") s.update(item.id, { rotation: [item.rotation[0], item.rotation[1] + ((op.amount ?? 0) * Math.PI) / 180, item.rotation[2]] })
    else if (op.op === "move") {
      const w = worldOf(item, s.items)
      const to = moveTarget(w.position, op.direction ?? "", op.amount, viewer)
      if (!to) continue
      if (item.parentId) place(item, to, w.yaw)
      else s.update(item.id, { position: to })
    } else if (op.op === "set_prop" && op.prop) s.update(item.id, { props: { ...item.props, [op.prop]: op.value } })
    else if (op.op === "swap_style" && op.component) s.update(item.id, { component: op.component })
    else continue
    n++
  }
  return n
}
