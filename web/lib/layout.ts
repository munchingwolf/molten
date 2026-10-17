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
  /** The item picks its own span via `props.min` / `props.max` (e.g. a knob that can drive 60–180 BPM). */
  range?: boolean
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
  /** Child of a frame item (component "frame"); its position is then set by the frame's auto-layout. */
  parentId?: string
  /** Layer name shown in the layers panel (defaults to the component's display name). */
  name?: string
  hidden?: boolean
  locked?: boolean
  /** Where it lives in XR: fixed in the room (default), following the head, or on the left wrist. */
  anchor?: "world" | "head" | "wrist"
}

/** One screen/space of a multi-scene app; each scene can bring its own environment ("the site is the environment"). */
export type Scene = { id: string; name: string; environment?: string; items: Item[] }

/**
 * `items` + `environment` always mirror the FIRST scene so single-scene readers (MCP, older apps) keep working.
 * `scenes` is present when the app has more than one.
 */
export type Layout = { id?: string; name: string; items: Item[]; environment?: string; scenes?: Scene[] }

export const newId = () => Math.random().toString(36).slice(2, 10)

export const isValidId = (id: string) => id === "latest" || /^[a-z0-9]{6,12}$/.test(id)

/** "master volume" → "masterVolume"; always a valid JS identifier. */
export function toIdent(name: string) {
  const words = name.trim().split(/[^A-Za-z0-9]+/).filter(Boolean)
  const id = words.map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1))).join("")
  return /^[A-Za-z_]/.test(id) ? id : `v${id}`
}

/**
 * Starting value per shared name. Prefer a fixed-span bindable's default (transport.bpm 120 beats knob.value 0.5);
 * if only `range` bindables share the name, the first one's default clamped to that item's props.min/max.
 */
export function initialValues(items: Item[], bindablesOf: (component: string) => Bindable[]) {
  const fixed = new Map<string, unknown>()
  const ranged = new Map<string, unknown>()
  for (const item of items)
    for (const b of bindablesOf(item.component)) {
      const name = item.bind[b.prop]
      if (!name || b.default === undefined) continue
      if (!b.range) {
        if (!fixed.has(name)) fixed.set(name, b.default)
      } else if (!ranged.has(name)) {
        const { min, max } = item.props ?? {}
        let v = b.default
        if (typeof v === "number") {
          let n: number = v
          if (typeof min === "number") n = Math.max(min, n)
          if (typeof max === "number") n = Math.min(max, n)
          v = n
        }
        ranged.set(name, v)
      }
    }
  return Object.fromEntries([...ranged, ...fixed]) as Record<string, unknown>
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
