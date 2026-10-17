"use client"

// Library (laptop) and wheel (headset) drops onto a guide slot or a placed item: find the target, highlight it while
// dragging, fill / replace it on release. Decision logic is pure in lib/replace.ts.
import { Box3 } from "three"
import { create } from "zustand"
import { useStudio } from "@/lib/studio-store"
import { findEntry } from "@/lib/registry"
import { liveFilled, openSlots, posed } from "@/lib/guides"
import { dropTarget, type DropTarget, type ItemBox, type Specs } from "@/lib/replace"
import type { Vec3 } from "@/lib/layout"
import { bindablesOf, contents } from "./layout-renderer"

export const specs: Specs = { bindable: bindablesOf, props: (c) => findEntry(c)?.props ?? [] }

/** What an in-progress drag would land on (SlotGuides glows it). */
export const useDropAim = create<{ target: DropTarget | null }>(() => ({ target: null }))

const box = new Box3()
/** World bounds of every placed item the renderer has measured. Frames (template roots, auto-layout groups) aren't replace targets. */
function itemBoxes(): ItemBox[] {
  const out: ItemBox[] = []
  for (const i of useStudio.getState().items) {
    const o = i.component === "frame" || i.hidden ? undefined : contents.get(i.id)
    if (!o) continue
    try {
      box.setFromObject(o)
    } catch {
      continue // a child mid-load can throw while measuring
    }
    if (!box.isEmpty()) out.push({ id: i.id, min: box.min.toArray(), max: box.max.toArray() })
  }
  return out
}

export function targetAt(point: Vec3 | null | undefined): DropTarget | null {
  const { guide, items, playMode } = useStudio.getState()
  if (!point || playMode) return null
  const root = guide ? (items.find((i) => i.id === guide.rootId) ?? null) : null
  const open = guide && root ? openSlots(posed(guide.slots), liveFilled(guide.filled, items)) : []
  return dropTarget(point, open, root, itemBoxes())
}

/** While dragging: highlight what a release at `point` would fill or replace (null clears). */
export function aimDrop(point: Vec3 | null | undefined) {
  const target = targetAt(point)
  const cur = useDropAim.getState().target
  if (JSON.stringify(cur) !== JSON.stringify(target)) useDropAim.setState({ target })
  return target
}

/** Release `component` at `point`: fill the open slot or replace the item there (one undo step). False = nothing there, place it freely. */
export function dropOnto(component: string, point: Vec3 | null | undefined): boolean {
  useDropAim.setState({ target: null })
  const t = targetAt(point)
  if (!t) return false
  const s = useStudio.getState()
  if (t.kind === "slot") return s.placeSlot(t.slotId, { component, specs }) !== null
  s.replaceItem(t.itemId, component, specs)
  return true
}

/** Label for the drag ghost / 3D highlight. */
export function aimLabel(t: DropTarget | null) {
  if (!t) return null
  if (t.kind === "slot") return "Drop to place"
  const it = useStudio.getState().items.find((i) => i.id === t.itemId)
  return `Drop to replace ${it?.name ?? findEntry(it?.component ?? "")?.displayName ?? it?.component ?? "item"}`
}
