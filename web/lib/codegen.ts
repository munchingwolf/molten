// .ts extension so `node --test` can run this file directly (allowImportingTsExtensions)
import { initialValues, toIdent as ident, type Bindable, type Item, type Layout, type Scene } from "./layout.ts"

const pascal = (name: string) => name.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("")
const vec = (v: number[]) => `[${v.map((n) => +n.toFixed(3)).join(", ")}]`
const setterOf = (n: string) => `set${n[0].toUpperCase()}${n.slice(1)}`
/** Prop keys become JSX attribute names: anything else (a crafted layout) would inject code, so it's skipped. */
export const PROP_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Layout → a self-contained React scene file a developer (or Claude) drops into their project.
 * Frames become <Frame> (auto-layout does the positioning), environments render first,
 * and a multi-scene app takes a `scene` index prop.
 */
export function generateCode(layout: Layout, bindablesOf: (component: string) => Bindable[]) {
  const scenes: Scene[] = layout.scenes?.length
    ? layout.scenes
    : [{ id: "main", name: layout.name, environment: layout.environment, items: layout.items }]
  const visible = (items: Item[]) => items.filter((i) => !i.hidden)
  const all = scenes.flatMap((s) => visible(s.items))
  const init = initialValues(all, bindablesOf)
  const state = new Map<string, unknown>() // shared name → initial value
  for (const item of all)
    for (const b of bindablesOf(item.component)) {
      const name = item.bind[b.prop]
      if (name && !state.has(ident(name))) state.set(ident(name), init[name])
    }
  const imports = [...new Set([...scenes.flatMap((s) => (s.environment ? [s.environment] : [])), ...all.map((i) => i.component)])]

  const propsOf = (item: Item) => {
    const props: string[] = []
    for (const [k, v] of Object.entries(item.props ?? {})) if (PROP_KEY.test(k)) props.push(`${k}={${JSON.stringify(v)}}`)
    for (const b of bindablesOf(item.component)) {
      const name = item.bind[b.prop]
      if (!name) continue
      props.push(`${b.prop}={${ident(name)}}`)
      if (b.event) props.push(`${b.event}={${setterOf(ident(name))}}`)
    }
    return props.length ? " " + props.join(" ") : ""
  }

  const out: string[] = []
  const renderItem = (item: Item, items: Item[], pad: string, inFrame: boolean) => {
    const children = items.filter((c) => c.parentId === item.id)
    const tag = pascal(item.component)
    const inner = pad + (inFrame ? "" : "  ")
    if (!inFrame) {
      const attrs = [`position={${vec(item.position)}}`]
      if (item.rotation.some((r) => r !== 0)) attrs.push(`rotation={${vec(item.rotation)}}`)
      if (item.scale !== 1) attrs.push(`scale={${+item.scale.toFixed(3)}}`)
      out.push(`${pad}<group ${attrs.join(" ")}>`)
    }
    if (children.length) {
      out.push(`${inner}<${tag}${propsOf(item)}>`)
      // A free frame (a template) doesn't place its children: each keeps its own transform in a <group>.
      for (const c of children) renderItem(c, items, inner + "  ", item.props?.direction !== "free")
      out.push(`${inner}</${tag}>`)
    } else out.push(`${inner}<${tag}${propsOf(item)} />`)
    if (!inFrame) out.push(`${pad}</group>`)
  }
  const renderScene = (scene: Scene, pad: string) => {
    if (scene.environment) out.push(`${pad}<${pascal(scene.environment)} />`)
    const items = visible(scene.items)
    const ids = new Set(items.map((i) => i.id))
    for (const item of items) if (!item.parentId || !ids.has(item.parentId)) renderItem(item, items, pad, false)
  }

  const multi = scenes.length > 1
  out.push('"use client"', "")
  if (state.size) out.push('import { useState } from "react"')
  for (const c of imports) out.push(`import ${pascal(c)} from ${JSON.stringify(`@/components/spatial/${c}`)}`)
  out.push("")
  if (multi) out.push(`/** Scenes: ${scenes.map((s, i) => `${i} = ${s.name}`).join(", ")} */`)
  out.push(`export default function ${pascal(layout.name) || "SpatialScene"}(${multi ? "{ scene = 0 }: { scene?: number }" : ""}) {`)
  for (const [name, v] of state) out.push(`  const [${name}, ${setterOf(name)}] = useState(${v === undefined ? "" : JSON.stringify(v)})`)
  out.push("  return (", "    <>")
  if (multi)
    scenes.forEach((s, i) => {
      out.push(`      {scene === ${i} && (`, "        <>")
      renderScene(s, "          ")
      out.push("        </>", "      )}")
    })
  else renderScene(scenes[0], "      ")
  out.push("    </>", "  )", "}", "")
  return out.join("\n")
}
