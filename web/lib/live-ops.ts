// Live edits from Claude Code (Spatial MCP) to the open Studio, like Claude driving Blender.
// Pure validation + application on a store-like object, so `node --test` covers it.
import type { Item, Layout, Vec3 } from "./layout.ts"

export type LiveOp =
  | { op: "add"; component: string; position?: Vec3; rotation?: Vec3; scale?: number; props?: Record<string, unknown>; bind?: Record<string, string>; name?: string; parentId?: string }
  | { op: "update"; id: string; position?: Vec3; rotation?: Vec3; scale?: number; props?: Record<string, unknown>; name?: string }
  | { op: "bind"; id: string; prop: string; name: string }
  | { op: "remove"; id: string }
  | { op: "select"; id: string | null }
  | { op: "set_value"; name: string; value: number | boolean | string }
  | { op: "set_environment"; value: string | null }
  | { op: "play"; on: boolean }
  | { op: "insert_template"; slug: string; mode: "guide" | "fill" }
  | { op: "load_layout"; id: string }

export const LIVE_OPS = ["add", "update", "bind", "remove", "select", "set_value", "set_environment", "play", "insert_template", "load_layout"] as const

const COMPONENT = /^[a-z0-9-]{1,60}$/
const ID = /^[A-Za-z0-9_-]{1,40}$/
const KEY = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const num = (v: unknown, lim: number) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim
const vec = (v: unknown, lim = 50): Vec3 | undefined => (Array.isArray(v) && v.length === 3 && v.every((n) => num(n, lim)) ? (v as Vec3) : undefined)
const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : undefined)
const primitive = (v: unknown) => v === null || typeof v === "boolean" || num(v, 1e9) || (typeof v === "string" && v.length <= 500)

/** JSON-safe prop map: identifier keys, primitive values or short arrays of primitives. */
function props(v: unknown): Record<string, unknown> | undefined | null {
  if (v === undefined) return undefined
  if (!isObj(v)) return null
  for (const [k, x] of Object.entries(v)) if (!KEY.test(k) || !(primitive(x) || (Array.isArray(x) && x.length <= 64 && x.every(primitive)))) return null
  return v
}

/** Returns a clean op, or a reason it was rejected. */
export function sanitizeLiveOp(raw: unknown): LiveOp | string {
  if (!isObj(raw) || typeof raw.op !== "string") return "expected { op: string, ... }"
  const o = raw
  const transform = () => {
    for (const k of ["position", "rotation"] as const) if (o[k] !== undefined && !vec(o[k], k === "rotation" ? 7 : 50)) return `${k} must be [x, y, z] numbers`
    if (o.scale !== undefined && !(num(o.scale, 20) && (o.scale as number) >= 0.05)) return "scale must be 0.05-20"
    if (props(o.props) === null) return "props must be { identifierKey: string | number | boolean | null | short array }"
    if (o.name !== undefined && !str(o.name, 80)) return "name must be a string (max 80)"
    return null
  }
  const t = { position: vec(o.position), rotation: vec(o.rotation, 7), scale: o.scale as number | undefined, props: props(o.props) ?? undefined, name: str(o.name, 80) }
  switch (o.op) {
    case "add": {
      if (typeof o.component !== "string" || !COMPONENT.test(o.component)) return "add needs component (a registry name)"
      const bad = transform()
      if (bad) return bad
      if (o.bind !== undefined && !(isObj(o.bind) && Object.entries(o.bind).every(([k, n]) => KEY.test(k) && typeof n === "string" && n.length <= 40))) return "bind must be { prop: sharedName }"
      if (o.parentId !== undefined && !(typeof o.parentId === "string" && ID.test(o.parentId))) return "parentId must be an item id"
      return { op: "add", component: o.component, ...t, bind: o.bind as Record<string, string> | undefined, parentId: o.parentId as string | undefined }
    }
    case "update": {
      if (typeof o.id !== "string" || !ID.test(o.id)) return "update needs id"
      const bad = transform()
      return bad ?? { op: "update", id: o.id, ...t }
    }
    case "bind":
      if (typeof o.id !== "string" || !ID.test(o.id) || typeof o.prop !== "string" || !KEY.test(o.prop) || typeof o.name !== "string" || o.name.length > 40)
        return "bind needs id, prop and name (empty name unbinds)"
      return { op: "bind", id: o.id, prop: o.prop, name: o.name }
    case "remove":
      return typeof o.id === "string" && ID.test(o.id) ? { op: "remove", id: o.id } : "remove needs id"
    case "select":
      return o.id === null || (typeof o.id === "string" && ID.test(o.id)) ? { op: "select", id: o.id as string | null } : "select needs id (or null)"
    case "set_value":
      return typeof o.name === "string" && o.name.length <= 40 && (typeof o.value === "boolean" || num(o.value, 1e9) || (typeof o.value === "string" && o.value.length <= 200))
        ? { op: "set_value", name: o.name, value: o.value as number | boolean | string }
        : "set_value needs name and a number, boolean or short string value"
    case "set_environment":
      return o.value === null || (typeof o.value === "string" && COMPONENT.test(o.value)) ? { op: "set_environment", value: o.value as string | null } : "set_environment needs an env-* component name or null"
    case "play":
      return typeof o.on === "boolean" ? { op: "play", on: o.on } : "play needs on: boolean"
    case "insert_template":
      return typeof o.slug === "string" && COMPONENT.test(o.slug) && (o.mode === "guide" || o.mode === "fill")
        ? { op: "insert_template", slug: o.slug, mode: o.mode }
        : 'insert_template needs slug and mode "guide" | "fill"'
    case "load_layout":
      return typeof o.id === "string" && /^(latest|[a-z0-9]{6,12})$/.test(o.id) ? { op: "load_layout", id: o.id } : "load_layout needs a layout id"
    default:
      return `unknown op "${o.op}"; use one of ${LIVE_OPS.join(", ")}`
  }
}

/** What applyLiveOp needs from the Studio store (a subset of useStudio's state). */
export type LiveStore = {
  items: Item[]
  selectedId: string | null
  playMode?: boolean
  add: (component: string, position?: Vec3, patch?: Partial<Item>) => void
  update: (id: string, patch: Partial<Item>) => void
  remove: (id: string) => void
  select: (id: string | null) => void
  bind: (id: string, prop: string, name: string) => void
  setValue: (name: string, v: unknown) => void
  setEnvironment: (name: string | null) => void
  togglePlay: () => void
  load: (layout: Layout) => void
}

export type LiveCtx<T> = {
  isReady: (component: string) => boolean
  template: (slug: string) => Promise<T | null>
  startGuide: (t: T) => void
  insertAll: (t: T) => void
  layout: (id: string) => Promise<Layout | null>
}

export type LiveResult = { ok: boolean; message: string; id?: string }

export async function applyLiveOp<T>(op: LiveOp, get: () => LiveStore, ctx: LiveCtx<T>): Promise<LiveResult> {
  const s = get()
  const has = (id: string) => s.items.some((i) => i.id === id)
  switch (op.op) {
    case "add": {
      if (!ctx.isReady(op.component)) return { ok: false, message: `"${op.component}" isn't a ready component (search_components lists them)` }
      if (op.parentId && !has(op.parentId)) return { ok: false, message: `no item ${op.parentId} to put it in` }
      const patch: Partial<Item> = {}
      if (op.rotation) patch.rotation = op.rotation
      if (op.scale) patch.scale = op.scale
      if (op.props) patch.props = op.props
      if (op.name) patch.name = op.name
      if (op.parentId) patch.parentId = op.parentId
      s.add(op.component, op.position, patch)
      const id = get().selectedId ?? undefined // add() selects the new item
      if (id) for (const [prop, name] of Object.entries(op.bind ?? {})) get().bind(id, prop, name)
      return { ok: true, message: `added ${op.component}`, id }
    }
    case "update": {
      const item = s.items.find((i) => i.id === op.id)
      if (!item) return { ok: false, message: `no item ${op.id}` }
      const patch: Partial<Item> = {}
      if (op.position) patch.position = op.position
      if (op.rotation) patch.rotation = op.rotation
      if (op.scale) patch.scale = op.scale
      if (op.props) patch.props = { ...item.props, ...op.props }
      if (op.name) patch.name = op.name
      s.update(op.id, patch)
      return { ok: true, message: `updated ${item.name ?? item.component}`, id: op.id }
    }
    case "bind":
      if (!has(op.id)) return { ok: false, message: `no item ${op.id}` }
      s.bind(op.id, op.prop, op.name)
      return { ok: true, message: op.name ? `wired ${op.prop} to "${op.name}"` : `unwired ${op.prop}`, id: op.id }
    case "remove":
      if (!has(op.id)) return { ok: false, message: `no item ${op.id}` }
      s.remove(op.id)
      return { ok: true, message: "removed", id: op.id }
    case "select":
      if (op.id && !has(op.id)) return { ok: false, message: `no item ${op.id}` }
      s.select(op.id)
      return { ok: true, message: op.id ? "selected" : "deselected", id: op.id ?? undefined }
    case "set_value":
      s.setValue(op.name, op.value)
      return { ok: true, message: `${op.name} = ${op.value}` }
    case "set_environment":
      if (op.value && !ctx.isReady(op.value)) return { ok: false, message: `"${op.value}" isn't a ready environment` }
      s.setEnvironment(op.value)
      return { ok: true, message: op.value ? `environment ${op.value}` : "no environment" }
    case "play":
      if (Boolean(s.playMode) !== op.on) s.togglePlay()
      return { ok: true, message: op.on ? "Play mode" : "Edit mode" }
    case "insert_template": {
      const t = await ctx.template(op.slug)
      if (!t) return { ok: false, message: `no template "${op.slug}"` }
      if (op.mode === "guide") ctx.startGuide(t)
      else ctx.insertAll(t)
      return { ok: true, message: op.mode === "guide" ? `template ${op.slug}: empty slots shown` : `template ${op.slug} inserted` }
    }
    case "load_layout": {
      const l = await ctx.layout(op.id)
      if (!l) return { ok: false, message: `no layout ${op.id}` }
      s.load(l)
      return { ok: true, message: `loaded ${l.name}` }
    }
  }
}
