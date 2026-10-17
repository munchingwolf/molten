import { create } from "zustand"
import { newId, toIdent, type Item, type Layout, type Vec3 } from "./layout"

type StudioState = {
  name: string
  items: Item[]
  selectedId: string | null
  values: Record<string, unknown>
  add: (component: string, position?: Vec3) => void
  update: (id: string, patch: Partial<Item>) => void
  remove: (id: string) => void
  select: (id: string | null) => void
  /** Wire `prop` of an item to a shared value name; empty name unbinds. */
  bind: (id: string, prop: string, name: string) => void
  setValue: (name: string, v: unknown) => void
  setName: (name: string) => void
  load: (layout: Layout) => void
  layout: () => Layout
}

// Next free spot on a 3-wide grid in front of the viewer.
const slot = (n: number): Vec3 => [((n % 3) - 1) * 0.85, 1.45 - Math.floor(n / 3) * 0.6, -1.2]

export const useStudio = create<StudioState>((set, get) => ({
  name: "my scene",
  items: [],
  selectedId: null,
  values: {},
  add: (component, position) =>
    set((s) => {
      const item: Item = { id: newId(), component, position: position ?? slot(s.items.length), rotation: [0, 0, 0], scale: 1, bind: {} }
      return { items: [...s.items, item], selectedId: item.id }
    }),
  update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),
  select: (id) => set({ selectedId: id }),
  bind: (id, prop, name) =>
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id !== id) return i
        const bind = { ...i.bind }
        if (name.trim()) bind[prop] = toIdent(name)
        else delete bind[prop]
        return { ...i, bind }
      }),
    })),
  setValue: (name, v) => set((s) => ({ values: { ...s.values, [name]: v } })),
  setName: (name) => set({ name }),
  load: (layout) => set({ name: layout.name, items: layout.items, selectedId: null, values: {} }),
  layout: () => ({ name: get().name, items: get().items }),
}))
