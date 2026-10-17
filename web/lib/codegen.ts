// .ts extension so `node --test` can run this file directly (allowImportingTsExtensions)
import { toIdent as ident, type Bindable, type Layout } from "./layout.ts"

const pascal = (name: string) => name.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("")
const vec = (v: number[]) => `[${v.map((n) => +n.toFixed(3)).join(", ")}]`

/** Layout → a self-contained React scene file a developer (or Claude) drops into their project. */
export function generateCode(layout: Layout, bindablesOf: (component: string) => Bindable[]) {
  const imports = [...new Set(layout.items.map((i) => i.component))]
  const state = new Map<string, unknown>() // shared name → initial value
  for (const item of layout.items)
    for (const b of bindablesOf(item.component)) {
      const name = item.bind[b.prop]
      if (name && !state.has(ident(name))) state.set(ident(name), b.default)
    }

  const lines = ['"use client"', ""]
  if (state.size) lines.push('import { useState } from "react"')
  for (const c of imports) lines.push(`import ${pascal(c)} from "@/components/spatial/${c}"`)
  lines.push("", `export default function ${pascal(layout.name) || "SpatialScene"}() {`)
  for (const [name, init] of state) {
    const setter = `set${name[0].toUpperCase()}${name.slice(1)}`
    lines.push(`  const [${name}, ${setter}] = useState(${init === undefined ? "" : JSON.stringify(init)})`)
  }
  lines.push("  return (", "    <>")
  for (const item of layout.items) {
    const attrs = [`position={${vec(item.position)}}`]
    if (item.rotation.some((r) => r !== 0)) attrs.push(`rotation={${vec(item.rotation)}}`)
    if (item.scale !== 1) attrs.push(`scale={${+item.scale.toFixed(3)}}`)
    const props: string[] = []
    for (const [k, v] of Object.entries(item.props ?? {})) props.push(`${k}={${JSON.stringify(v)}}`)
    for (const b of bindablesOf(item.component)) {
      const name = item.bind[b.prop]
      if (!name) continue
      const n = ident(name)
      props.push(`${b.prop}={${n}}`)
      if (b.event) props.push(`${b.event}={set${n[0].toUpperCase()}${n.slice(1)}}`)
    }
    lines.push(`      <group ${attrs.join(" ")}>`)
    lines.push(`        <${pascal(item.component)}${props.length ? " " + props.join(" ") : ""} />`)
    lines.push("      </group>")
  }
  lines.push("    </>", "  )", "}", "")
  return lines.join("\n")
}
