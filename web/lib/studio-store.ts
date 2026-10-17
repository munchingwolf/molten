import { create } from "zustand"
import { newId, toIdent, type Item, type Layout, type Scene, type Vec3 } from "./layout.ts"

/** What undo/redo restores: the editable document, not view settings or live values. */
type Doc = { scenes: Scene[]; sceneId: string; items: Item[]; environment?: string }

type StudioState = {
  name: string
  /** Items of the ACTIVE scene (what the canvas shows). Other scenes are kept in `scenes`. */
  items: Item[]
  environment?: string
  scenes: Scene[]
  sceneId: string
  /** Primary selection (inspector target); `selectedIds` holds the whole multi-selection. */
  selectedId: string | null
  selectedIds: string[]
  values: Record<string, unknown>
  /** View settings (not undoable). */
  viewMode: "design" | "xray"
  showGrid: boolean
  snap: boolean
  past: Doc[]
  future: Doc[]
  clipboard: Item[]

  // --- existing actions (signatures unchanged) ---
  add: (component: string, position?: Vec3, patch?: Partial<Item>) => void
  update: (id: string, patch: Partial<Item>) => void
  remove: (id: string) => void
  /** additive = shift-click: toggle in the multi-selection. */
  select: (id: string | null, additive?: boolean) => void
  bind: (id: string, prop: string, name: string) => void
  setValue: (name: string, v: unknown) => void
  setName: (name: string) => void
  load: (layout: Layout) => void
  layout: () => Layout

  // --- v2 actions ---
  undo: () => void
  redo: () => void
  duplicate: (ids?: string[]) => void
  copy: (ids?: string[]) => void
  paste: () => void
  removeSelected: () => void
  /** Wrap items in a new frame (auto-layout container); returns the frame id. */
  groupIntoFrame: (ids?: string[], frameProps?: Record<string, unknown>) => string | null
  ungroup: (frameId: string) => void
  setParent: (id: string, parentId: string | null) => void
  /** Move an item to `index` among its siblings (layers panel drag). */
  reorder: (id: string, index: number) => void
  setEnvironment: (name: string | null) => void
  addScene: (name?: string) => void
  switchScene: (id: string) => void
  renameScene: (id: string, name: string) => void
  removeScene: (id: string) => void
  setViewMode: (mode: "design" | "xray") => void
  toggleGrid: () => void
  toggleSnap: () => void
}

// Next free spot on a 3-wide grid in front of the viewer.
const slot = (n: number): Vec3 => [((n % 3) - 1) * 0.85, 1.45 - Math.floor(n / 3) * 0.6, -1.2]
const firstScene = (): Scene => ({ id: newId(), name: "Scene 1", items: [] })
const HISTORY = 100

export const useStudio = create<StudioState>((set, get) => {
  const s0 = firstScene()

  /** Save the current document to the undo stack before a change. */
  const checkpoint = () => {
    const { scenes, sceneId, items, environment, past } = get()
    set({ past: [...past.slice(-HISTORY + 1), { scenes, sceneId, items, environment }], future: [] })
  }
  /** Active scene's live items/environment written back into `scenes`. */
  const flushed = (): Scene[] => {
    const { scenes, sceneId, items, environment } = get()
    return scenes.map((sc) => (sc.id === sceneId ? { ...sc, items, environment } : sc))
  }
  const targets = (ids?: string[]) => ids ?? get().selectedIds
  /** Item ids plus all their frame descendants. */
  const withDescendants = (ids: string[]) => {
    const all = new Set(ids)
    let grew = true
    while (grew) {
      grew = false
      for (const i of get().items) if (i.parentId && all.has(i.parentId) && !all.has(i.id)) (all.add(i.id), (grew = true))
    }
    return all
  }
  /** Copies with fresh ids, keeping parent links inside the copied set; returns them offset by `dx`. */
  const cloneSet = (src: Item[], dx: number) => {
    const ids = new Map(src.map((i) => [i.id, newId()]))
    return src.map((i) => ({
      ...i,
      id: ids.get(i.id)!,
      parentId: i.parentId && ids.has(i.parentId) ? ids.get(i.parentId) : i.parentId,
      position: (i.parentId && ids.has(i.parentId) ? i.position : [i.position[0] + dx, i.position[1], i.position[2]]) as Vec3,
    }))
  }

  return {
    name: "my scene",
    items: [],
    environment: undefined,
    scenes: [s0],
    sceneId: s0.id,
    selectedId: null,
    selectedIds: [],
    values: {},
    viewMode: "design",
    showGrid: true,
    snap: true,
    past: [],
    future: [],
    clipboard: [],

    add: (component, position, patch) => {
      checkpoint()
      set((s) => {
        const item: Item = {
          id: newId(), component, position: position ?? slot(s.items.filter((i) => !i.parentId).length),
          rotation: [0, 0, 0], scale: 1, bind: {}, ...patch,
        }
        return { items: [...s.items, item], selectedId: item.id, selectedIds: [item.id] }
      })
    },
    update: (id, patch) => {
      checkpoint()
      set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
    },
    remove: (id) => {
      checkpoint()
      const gone = withDescendants([id])
      set((s) => ({
        items: s.items.filter((i) => !gone.has(i.id)),
        selectedIds: s.selectedIds.filter((x) => !gone.has(x)),
        selectedId: s.selectedId && gone.has(s.selectedId) ? null : s.selectedId,
      }))
    },
    select: (id, additive) =>
      set((s) => {
        if (id === null) return { selectedId: null, selectedIds: [] }
        if (!additive) return { selectedId: id, selectedIds: [id] }
        const has = s.selectedIds.includes(id)
        const selectedIds = has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id]
        return { selectedIds, selectedId: has ? (selectedIds.at(-1) ?? null) : id }
      }),
    bind: (id, prop, name) => {
      checkpoint()
      set((s) => ({
        items: s.items.map((i) => {
          if (i.id !== id) return i
          const bind = { ...i.bind }
          if (name.trim()) bind[prop] = toIdent(name)
          else delete bind[prop]
          return { ...i, bind }
        }),
      }))
    },
    setValue: (name, v) => set((s) => ({ values: { ...s.values, [name]: v } })),
    setName: (name) => set({ name }),
    load: (layout) => {
      const scenes = layout.scenes?.length ? layout.scenes : [{ id: newId(), name: "Scene 1", environment: layout.environment, items: layout.items }]
      set({
        name: layout.name, scenes, sceneId: scenes[0].id, items: scenes[0].items, environment: scenes[0].environment,
        selectedId: null, selectedIds: [], values: {}, past: [], future: [],
      })
    },
    layout: () => {
      const scenes = flushed()
      return { name: get().name, items: scenes[0].items, environment: scenes[0].environment, ...(scenes.length > 1 ? { scenes } : {}) }
    },

    undo: () => {
      const { past, future, scenes, sceneId, items, environment } = get()
      const prev = past.at(-1)
      if (!prev) return
      set({ ...prev, past: past.slice(0, -1), future: [...future, { scenes, sceneId, items, environment }], selectedId: null, selectedIds: [] })
    },
    redo: () => {
      const { past, future, scenes, sceneId, items, environment } = get()
      const next = future.at(-1)
      if (!next) return
      set({ ...next, future: future.slice(0, -1), past: [...past, { scenes, sceneId, items, environment }], selectedId: null, selectedIds: [] })
    },
    duplicate: (ids) => {
      const src = get().items.filter((i) => withDescendants(targets(ids)).has(i.id))
      if (!src.length) return
      checkpoint()
      const copies = cloneSet(src, 0.15)
      const tops = copies.filter((c) => !copies.some((p) => p.id === c.parentId)).map((c) => c.id)
      set((s) => ({ items: [...s.items, ...copies], selectedIds: tops, selectedId: tops.at(-1) ?? null }))
    },
    copy: (ids) => set({ clipboard: get().items.filter((i) => withDescendants(targets(ids)).has(i.id)) }),
    paste: () => {
      const { clipboard } = get()
      if (!clipboard.length) return
      checkpoint()
      const copies = cloneSet(clipboard, 0.15)
      const tops = copies.filter((c) => !copies.some((p) => p.id === c.parentId)).map((c) => c.id)
      set((s) => ({ items: [...s.items, ...copies], selectedIds: tops, selectedId: tops.at(-1) ?? null }))
    },
    removeSelected: () => {
      const ids = get().selectedIds
      if (!ids.length) return
      checkpoint()
      const gone = withDescendants(ids)
      set((s) => ({ items: s.items.filter((i) => !gone.has(i.id)), selectedIds: [], selectedId: null }))
    },
    groupIntoFrame: (ids, frameProps) => {
      const picked = get().items.filter((i) => targets(ids).includes(i.id))
      if (!picked.length) return null
      checkpoint()
      const n = picked.length
      const centre = picked.reduce((c, i) => [c[0] + i.position[0] / n, c[1] + i.position[1] / n, c[2] + i.position[2] / n], [0, 0, 0]) as Vec3
      const frame: Item = {
        id: newId(), component: "frame", position: centre, rotation: [0, 0, 0], scale: 1, bind: {},
        props: { direction: "row", gap: 0.05, padding: 0.06, ...frameProps }, parentId: picked[0].parentId,
      }
      const inFrame = new Set(picked.map((i) => i.id))
      set((s) => ({
        items: [...s.items.map((i) => (inFrame.has(i.id) ? { ...i, parentId: frame.id } : i)), frame],
        selectedId: frame.id, selectedIds: [frame.id],
      }))
      return frame.id
    },
    ungroup: (frameId) => {
      const frame = get().items.find((i) => i.id === frameId)
      if (!frame) return
      checkpoint()
      set((s) => ({
        items: s.items
          .filter((i) => i.id !== frameId)
          // children land at the frame's spot, spread a little so they don't overlap
          .map((i, k) => (i.parentId === frameId ? { ...i, parentId: frame.parentId, position: [frame.position[0] + (k % 3) * 0.3, frame.position[1], frame.position[2]] as Vec3 } : i)),
        selectedId: null, selectedIds: [],
      }))
    },
    setParent: (id, parentId) => {
      if (parentId && withDescendants([id]).has(parentId)) return // no cycles
      checkpoint()
      set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, parentId: parentId ?? undefined } : i)) }))
    },
    reorder: (id, index) => {
      const items = [...get().items]
      const from = items.findIndex((i) => i.id === id)
      if (from < 0) return
      checkpoint()
      const [it] = items.splice(from, 1)
      const siblings = items.filter((i) => i.parentId === it.parentId)
      const anchor = siblings[Math.max(0, Math.min(index, siblings.length))]
      items.splice(anchor ? items.indexOf(anchor) : items.length, 0, it)
      set({ items })
    },
    setEnvironment: (name) => {
      checkpoint()
      set({ environment: name ?? undefined })
    },
    addScene: (name) => {
      checkpoint()
      const scenes = flushed()
      const sc: Scene = { id: newId(), name: name ?? `Scene ${scenes.length + 1}`, environment: get().environment, items: [] }
      set({ scenes: [...scenes, sc], sceneId: sc.id, items: [], selectedId: null, selectedIds: [] })
    },
    switchScene: (id) => {
      const scenes = flushed()
      const target = scenes.find((sc) => sc.id === id)
      if (!target) return
      set({ scenes, sceneId: id, items: target.items, environment: target.environment, selectedId: null, selectedIds: [] })
    },
    renameScene: (id, name) => set((s) => ({ scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, name } : sc)) })),
    removeScene: (id) => {
      const scenes = flushed()
      if (scenes.length < 2) return
      checkpoint()
      const rest = scenes.filter((sc) => sc.id !== id)
      const active = get().sceneId === id ? rest[0] : rest.find((sc) => sc.id === get().sceneId)!
      set({ scenes: rest, sceneId: active.id, items: active.items, environment: active.environment, selectedId: null, selectedIds: [] })
    },
    setViewMode: (viewMode) => set({ viewMode }),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleSnap: () => set((s) => ({ snap: !s.snap })),
  }
})
