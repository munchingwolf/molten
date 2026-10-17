import type { ComponentType } from "react"
import index from "@/registry/index.json"
import SettingsDefault from "@/components/spatial/settings-default"
import SettingsGlass from "@/components/spatial/settings-glass"
import SettingsHorizon from "@/components/spatial/settings-horizon"
import Knob from "@/components/spatial/knob"
import Transport from "@/components/spatial/transport"

export type Entry = {
  name: string
  displayName: string
  category: string
  kind: "section" | "basic"
  style: "default" | "glass" | "horizon"
  tags: string[]
  aliases: string[]
  description: string
  file: string
  status: "ready" | "soon"
  tier?: number
  xrOnly?: boolean
}

// name → React component. Add a line here for every new file in components/spatial/.
export const components: Record<string, ComponentType> = {
  "settings-default": SettingsDefault,
  "settings-glass": SettingsGlass,
  "settings-horizon": SettingsHorizon,
  knob: Knob,
  transport: Transport,
}

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
