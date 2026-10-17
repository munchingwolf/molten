// Drop-to-fill / drop-to-replace: which slot or item a library/wheel drop lands on, and what a swapped-in component keeps.
// Pure (three math via guides.ts only), so plain Node can run replace.test.ts.
import type { Bindable, Item, Vec3 } from "./layout.ts"
import { DEFAULT_SIZE, toLocal, type Slot } from "./guides.ts"

/** Registry metadata a carry-over needs: bindable props (wiring) and editable props (PropSpec name + type). */
export type Specs = { bindable: (component: string) => Bindable[]; props: (component: string) => { name: string; type: string; options?: string[] }[] }

/** World AABB of a placed item (measured from the renderer's content group). */
export type ItemBox = { id: string; min: Vec3; max: Vec3 }

export type DropTarget = { kind: "slot"; slotId: string } | { kind: "item"; itemId: string }

type Transform = Pick<Item, "position" | "rotation" | "scale">

const inside = (p: Vec3, min: Vec3, max: Vec3, eps: number) => [0, 1, 2].every((k) => p[k] >= min[k] - eps && p[k] <= max[k] + eps)

/**
 * What a drop at world point `p` lands on: an open slot whose box contains it (slots in `root`'s local space) or a placed
 * item whose bounds contain it. Smallest volume wins, so pads sitting on a desk beat the desk. `eps` absorbs a ray hit on a box face.
 */
export function dropTarget(p: Vec3, openSlots: Slot[], root: Transform | null, boxes: ItemBox[], eps = 0.02): DropTarget | null {
  let best: DropTarget | null = null
  let bestV = Infinity
  const consider = (t: DropTarget, v: number) => {
    if (v < bestV) (best = t), (bestV = v)
  }
  if (root) {
    const q = toLocal(root, p)
    for (const s of openSlots) {
      // shortcut: slot box treated as axis-aligned in the root's space, fine for the small yaws templates use.
      const size = s.size ?? DEFAULT_SIZE
      const c = s.center ?? [0, 0, 0]
      const half = size.map((v) => (v * s.scale) / 2)
      const mid = [0, 1, 2].map((k) => s.position[k] + c[k] * s.scale)
      if (inside(q, mid.map((m, k) => m - half[k]) as Vec3, mid.map((m, k) => m + half[k]) as Vec3, eps / (root.scale || 1)))
        consider({ kind: "slot", slotId: s.id }, size[0] * size[1] * size[2] * (s.scale * root.scale) ** 3)
    }
  }
  for (const b of boxes)
    if (inside(p, b.min, b.max, eps)) consider({ kind: "item", itemId: b.id }, (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]))
  return best
}

const fits = (spec: { type: string; options?: string[] }, v: unknown) =>
  spec.type === "number" ? typeof v === "number"
  : spec.type === "boolean" ? typeof v === "boolean"
  : spec.type === "enum" ? typeof v === "string" && (!spec.options || spec.options.includes(v))
  : typeof v === "string" // string, color

/**
 * Wiring and props `from` (an old item or a slot) hands to `component`: a bind entry survives when both components have
 * that bindable prop with the same type; a prop survives when the new component has an editable prop of that name its
 * value fits. Same component: everything carries.
 */
export function carryOver(from: Pick<Item, "component" | "bind" | "props">, component: string, specs: Specs) {
  if (from.component === component) return { bind: { ...from.bind }, ...(from.props ? { props: { ...from.props } } : {}) }
  const oldB = specs.bindable(from.component)
  const newB = specs.bindable(component)
  const bind = Object.fromEntries(
    Object.entries(from.bind ?? {}).filter(([prop]) => {
      const a = oldB.find((b) => b.prop === prop)
      return !!a && newB.some((b) => b.prop === prop && b.type === a.type)
    }),
  )
  const newP = specs.props(component)
  const props = Object.fromEntries(
    Object.entries(from.props ?? {}).filter(([k, v]) => newP.some((s) => s.name === k && fits(s, v))),
  )
  return { bind, ...(Object.keys(props).length ? { props } : {}) }
}

/** `old` swapped for `component`: same id, parent and transform (so its place in the tree and any slot it fills stay), wiring carried. */
export function replaced(old: Item, component: string, specs: Specs): Item {
  const { id, parentId, position, rotation, scale, anchor } = old
  return {
    id, component, position: [...position] as Vec3, rotation: [...rotation] as Vec3, scale, ...carryOver(old, component, specs),
    ...(parentId ? { parentId } : {}), ...(anchor ? { anchor } : {}),
  }
}
