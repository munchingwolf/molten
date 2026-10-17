// Shared layout format (SPEC §41): Studio ⇄ /api/layout ⇄ /apps/[id] ⇄ MCP.
// No framework imports, so plain Node can run the tests.

export type Vec3 = [number, number, number]

/** A prop the Studio can wire to a shared name. `event` is the setter callback, absent for input-only props. */
export type Bindable = {
  prop: string
  event?: string
  type: "number" | "boolean" | "string"
  min?: number
  max?: number
  default?: unknown
}

export type Item = {
  id: string
  component: string
  position: Vec3
  rotation: Vec3
  scale: number
  /** prop → shared value name, e.g. { value: "volume" } */
  bind: Record<string, string>
  props?: Record<string, unknown>
}

export type Layout = { id?: string; name: string; items: Item[] }

export const newId = () => Math.random().toString(36).slice(2, 10)

export const isValidId = (id: string) => id === "latest" || /^[a-z0-9]{6,12}$/.test(id)

/** "master volume" → "masterVolume"; always a valid JS identifier. */
export function toIdent(name: string) {
  const words = name.trim().split(/[^A-Za-z0-9]+/).filter(Boolean)
  const id = words.map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1))).join("")
  return /^[A-Za-z_]/.test(id) ? id : `v${id}`
}

/** Props to pass a placed component: its fixed props, then each bound prop wired to the shared value. */
export function bindingProps(
  item: Item,
  bindables: Bindable[],
  values: Record<string, unknown>,
  setValue: (name: string, v: unknown) => void,
) {
  const props: Record<string, unknown> = { ...item.props }
  for (const b of bindables) {
    const name = item.bind[b.prop]
    if (!name) continue
    props[b.prop] = name in values ? values[name] : b.default
    if (b.event) props[b.event] = (v: unknown) => setValue(name, v)
  }
  return props
}
