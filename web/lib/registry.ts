import index from "@/registry/index.json"
import type { Bindable } from "./layout"
import "./three-fixes" // every surface that renders components imports the registry, so the Box3 fix loads first

export type Entry = {
  name: string
  displayName: string
  category: string
  kind: "section" | "basic" | "object" | "environment" | "layout"
  style: string
  tags: string[]
  aliases: string[]
  description: string
  file: string
  status: "ready" | "soon"
  tier?: number
  xrOnly?: boolean
  author: string
  license: string
  price: string
  /** npm packages beyond react/three/r3f the file needs, e.g. ["tone"] */
  deps: string[]
  /** Props the Studio can wire to a shared name */
  bindable?: Bindable[]
  /** Editable props for the inspector + voice (colour, label, size…) */
  props?: PropSpec[]
}

export type PropSpec = {
  name: string
  type: "color" | "string" | "number" | "boolean" | "enum"
  options?: string[]
  min?: number
  max?: number
  default?: unknown
}

// name → React component, generated from index.json (run `node web/scripts/merge-registry.mjs` after adding a component).
export { components } from "./components.generated"

export const registry = index as Entry[]

export const categories = [...new Set(registry.map((e) => e.category))]

export const findEntry = (name: string) => registry.find((e) => e.name === name)

/** Other styles of the same section, for the style switcher. */
export const siblings = (entry: Entry) =>
  registry.filter((e) => e.kind === "section" && e.category === entry.category)

export function matches(entry: Entry, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [entry.name, entry.displayName, entry.category, entry.description, ...entry.tags, ...entry.aliases]
    .join(" ")
    .toLowerCase()
    .includes(q)
}
