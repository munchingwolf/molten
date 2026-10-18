#!/usr/bin/env node
// Spatial MCP server (stdio). stdout belongs to the transport: log with console.error only.
import { execFile } from "node:child_process"
import { constants } from "node:fs"
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  WEB_DIR,
  bindableSummary,
  checkComponentSource,
  COMPONENT_NAME,
  importedPackages,
  upsertEntry,
  depsFor,
  loadRegistry,
  resolveEntry,
  safeTargetPath,
  search,
  sourcePath,
  suggest,
  usageExample,
  validateLayoutId,
} from "./lib.mjs"

const SPATIAL_URL = (process.env.SPATIAL_URL || "http://localhost:3000").replace(/\/+$/, "")

const PEER_NOTE = " (assumes a React Three Fiber project: react, three, @react-three/fiber)"
const text = (t) => ({ content: [{ type: "text", text: typeof t === "string" ? t : JSON.stringify(t, null, 2) }] })
const fail = (t) => ({ ...text(t), isError: true })
const unknown = (entries, name) =>
  fail(`Unknown component "${name}". Did you mean: ${suggest(entries, name).join(", ")}? Use search_components to browse.`)

const server = new McpServer({ name: "spatial", version: "0.1.0" })

server.registerTool(
  "search_components",
  {
    title: "Search Spatial XR components",
    description:
      "Find 3D/XR UI components (React Three Fiber) in the Spatial marketplace: panels, buttons, sliders, menus, cards, data viz and more. " +
      "Use this first whenever the user wants UI for a 3D, WebXR, VR/AR or Quest/Vision Pro scene. Every word of `query` must match " +
      "the name, title, category, description, tags or aliases (case-insensitive); omit `query` to list everything. " +
      "Only ready-to-install components are returned unless includeSoon is true. Follow up with get_component or add_component.",
    inputSchema: {
      query: z.string().optional().describe('Words to match, e.g. "glass settings" or "slider"'),
      category: z.string().optional().describe("Exact category name (see list_categories)"),
      includeSoon: z.boolean().default(false).describe('Also return "soon" components that are listed but not built yet'),
    },
  },
  async ({ query = "", category, includeSoon = false }) => {
    const entries = loadRegistry()
    const hits = search(entries, { query, category, includeSoon })
    const hidden = includeSoon ? 0 : search(entries, { query, category, includeSoon: true }).length - hits.length
    const results = hits.map((e) => ({
      name: e.name,
      displayName: e.displayName,
      category: e.category,
      style: e.style,
      status: e.status,
      description: e.description,
      bindable: bindableSummary(e),
    }))
    const note = hidden ? `\n${hidden} more "soon" (not built yet) matches hidden; pass includeSoon: true to see them.` : ""
    return text(`${results.length} component(s)\n${JSON.stringify(results, null, 2)}${note}`)
  },
)

server.registerTool(
  "get_component",
  {
    title: "Get a Spatial component's source and install notes",
    description:
      "Return one component's full registry entry, its complete .tsx source code, the npm packages it needs, the target path and a usage example. " +
      "Use it to read or adapt a component's code; use add_component instead to copy the file into a project.",
    inputSchema: { name: z.string().describe('Exact component name from search_components, e.g. "settings-glass"') },
  },
  async ({ name }) => {
    const entries = loadRegistry()
    const entry = resolveEntry(entries, name)
    if (!entry) return unknown(entries, name)
    if (entry.status !== "ready")
      return text(`${JSON.stringify(entry, null, 2)}\n\nStatus "${entry.status}": this component is not built yet, so there is no source code.`)
    let source
    try {
      source = await readFile(sourcePath(entry), "utf8")
    } catch (err) {
      return fail(`Could not read source for "${name}" (${entry.file}): ${err.message}`)
    }
    const deps = depsFor(entry, source)
    return text(
      [
        "## Registry entry",
        JSON.stringify(entry, null, 2),
        "## Install",
        `Dependencies: npm i ${deps.join(" ")}${PEER_NOTE}`,
        `Target path: components/spatial/${name}.tsx (add_component writes it there for you)`,
        "## Usage (inside a React Three Fiber <Canvas>)",
        "```tsx",
        usageExample(entry),
        "```",
        `## Source (${entry.file})`,
        "```tsx",
        source,
        "```",
      ].join("\n"),
    )
  },
)

server.registerTool(
  "add_component",
  {
    title: "Add a Spatial component to a project",
    description:
      "Copy a ready component's .tsx file into <projectPath>/components/spatial/<name>.tsx (folders are created) and return the npm install command for its dependencies. " +
      "Use when the user wants the component in their own codebase. Does not overwrite an existing file unless overwrite is true. " +
      "Run the returned npm command in the project afterwards.",
    inputSchema: {
      name: z.string().describe("Exact component name from search_components"),
      projectPath: z.string().describe("Absolute path to the root of the user's project (an existing directory)"),
      overwrite: z.boolean().default(false).describe("Replace the file if it already exists"),
    },
  },
  async ({ name, projectPath, overwrite = false }) => {
    const entries = loadRegistry()
    const entry = resolveEntry(entries, name)
    if (!entry) return unknown(entries, name)
    if (entry.status !== "ready") return fail(`"${name}" is not built yet (status "${entry.status}"). Pick a ready component.`)
    if (!path.isAbsolute(projectPath)) return fail(`projectPath must be an absolute path, got "${projectPath}"`)
    try {
      if (!(await stat(projectPath)).isDirectory()) return fail(`projectPath is not a directory: ${projectPath}`)
    } catch {
      return fail(`projectPath does not exist: ${projectPath}`)
    }
    let target, source
    try {
      target = safeTargetPath(entries, projectPath, name)
      source = await readFile(sourcePath(entry), "utf8")
      await mkdir(path.dirname(target), { recursive: true })
      await copyFile(sourcePath(entry), target, overwrite ? 0 : constants.COPYFILE_EXCL)
    } catch (err) {
      if (err.code === "EEXIST") return fail(`${target} already exists. Pass overwrite: true to replace it.`)
      return fail(`Could not add "${name}": ${err.message}`)
    }
    const deps = depsFor(entry, source)
    return text(
      [
        `Wrote ${target}`,
        `Install dependencies: npm i ${deps.join(" ")}${PEER_NOTE}`,
        "",
        "Usage:",
        usageExample(entry),
      ].join("\n"),
    )
  },
)

server.registerTool(
  "get_layout",
  {
    title: "Get a saved Spatial Studio layout",
    description:
      "Fetch a scene layout saved in the Spatial Studio: which components are placed where (position, rotation, scale), their props, " +
      "and which props share a value through a common bind name. Use it when the user wants to rebuild a Studio layout in their own project. " +
      'id is "latest" (default) or the 6-12 character id from the share link.',
    inputSchema: { id: z.string().default("latest").describe('"latest" or a layout id like "k3j9x2"') },
  },
  async ({ id = "latest" }) => {
    if (!validateLayoutId(id)) return fail(`Invalid layout id "${id}": use "latest" or 6-12 lowercase letters/digits.`)
    const url = `${SPATIAL_URL}/api/layout/${id}`
    let layout
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return fail(`GET ${url} failed: HTTP ${res.status}`)
      layout = await res.json()
    } catch (err) {
      return fail(`GET ${url} failed: ${err.message}. Is the Spatial web app running? Set SPATIAL_URL to its address.`)
    }
    const components = [...new Set((layout.items ?? []).map((i) => i.component))]
    return text(
      [
        JSON.stringify(layout, null, 2),
        "",
        `Components used: ${components.join(", ") || "none"}`,
        "To rebuild: add_component for each distinct component, then create a scene file placing each in a <group position rotation scale>, " +
          "with one useState per shared bind name wired to the props/events in each component's bindable metadata.",
      ].join("\n"),
    )
  },
)

server.registerTool(
  "list_categories",
  {
    title: "List Spatial component categories",
    description: "List every component category with how many components are ready and how many are coming soon. Use it to browse or to get exact category names for search_components.",
    inputSchema: {},
  },
  async () => {
    const counts = new Map()
    for (const e of loadRegistry()) {
      const c = counts.get(e.category) ?? { category: e.category, ready: 0, soon: 0 }
      c[e.status === "ready" ? "ready" : "soon"]++
      counts.set(e.category, c)
    }
    return text([...counts.values()])
  },
)

// ---- Live Studio: Claude works inside the open Spatial Studio, like Claude driving Blender. ----

const SPACE_NOTE =
  "Units are metres, Y up. The viewer stands at the origin facing -Z (eyes ~1.6 m). A desk top is ~0.92 m; " +
  "arm's reach ~0.4-0.6 m in front (z -0.4..-0.6); a wall of panels ~1.5-2 m away. rotation is radians [x, y, z] " +
  "(y turns left/right; something at x>0 faces the user with y<0). 'left' = -x, 'right' = +x, 'closer' = +z, 'farther' = -z."

async function readScene() {
  const res = await fetch(`${SPATIAL_URL}/api/live/scene`, { signal: AbortSignal.timeout(5000) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

const round = (v) => (Array.isArray(v) ? v.map((n) => +Number(n).toFixed(3)) : v)
function sceneSummary(scene) {
  const items = (scene.items ?? []).map((i) => ({
    id: i.id, component: i.component, ...(i.name ? { name: i.name } : {}), position: round(i.position), rotation: round(i.rotation), scale: i.scale,
    ...(i.parentId ? { parentId: i.parentId } : {}), ...(Object.keys(i.bind ?? {}).length ? { bind: i.bind } : {}), ...(i.props && Object.keys(i.props).length ? { props: i.props } : {}),
  }))
  return {
    name: scene.name, environment: scene.environment, playMode: scene.playMode, selectedId: scene.selectedId,
    selected: items.find((i) => i.id === scene.selectedId) ?? null, values: scene.values, guide: scene.guide,
    items, updatedSecondsAgo: Math.round((scene.ageMs ?? 0) / 1000),
  }
}

server.registerTool(
  "get_scene",
  {
    title: "Get the live Spatial Studio scene",
    description:
      "Read what is in the user's OPEN Spatial Studio right now (laptop or Quest headset): every placed item with id, component, position, rotation, scale, " +
      "parent, bindings and props, plus what the user has SELECTED, the shared values (e.g. tempo), the environment and Play mode. " +
      "Call it first whenever the user refers to the scene ('the selected one', 'the pads', 'move it left'). " + SPACE_NOTE,
    inputSchema: {},
  },
  async () => {
    try {
      return text(sceneSummary(await readScene()))
    } catch (err) {
      return fail(`No live scene: ${err.message}. Ask the user to open ${SPATIAL_URL}/studio (Studio must be open in a browser or the headset).`)
    }
  },
)

server.registerTool(
  "edit_scene",
  {
    title: "Edit the live Spatial Studio scene",
    description:
      "Apply edits to the user's OPEN Spatial Studio; they appear live (within ~0.5 s) on the laptop and in the headset, and are logged in the Studio's assistant panel. " +
      "Ops (JSON objects, applied in order): " +
      '{op:"add", component, position?, rotation?, scale?, props?, bind?:{prop:sharedName}, name?, parentId?} (component = a ready registry name; returns its new id) | ' +
      '{op:"update", id, position?, rotation?, scale?, props? (merged), name?} | {op:"bind", id, prop, name} (items sharing a name share a value; "" unbinds) | ' +
      '{op:"remove", id} | {op:"select", id|null} | {op:"set_value", name, value} (e.g. tempo 140) | {op:"set_environment", value:"env-concert-stage"|null} | ' +
      '{op:"play", on:true|false} | {op:"insert_template", slug, mode:"guide"|"fill"} (guide = empty translucent slots) | {op:"load_layout", id}. ' +
      "Use get_scene first to get ids and the selection, and search_components/get_component for names, bindable props and props. " + SPACE_NOTE,
    inputSchema: { ops: z.array(z.record(z.string(), z.any())).min(1).max(50).describe("Edits to apply, in order") },
  },
  async ({ ops }) => {
    let queued
    try {
      const res = await fetch(`${SPATIAL_URL}/api/live`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ops }), signal: AbortSignal.timeout(5000) })
      queued = await res.json()
      if (!res.ok) return fail(`Rejected: ${queued.error}`)
    } catch (err) {
      return fail(`Couldn't reach ${SPATIAL_URL}/api/live: ${err.message}. Is the Spatial dev server running?`)
    }
    // Wait for the open Studio to apply them and report back.
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 200))
      try {
        const scene = await readScene()
        if ((scene.lastSeq ?? -1) >= queued.last) {
          const results = (scene.results ?? []).filter((r) => r.seq >= queued.first && r.seq <= queued.last)
          return text({ applied: results, scene: sceneSummary(scene) })
        }
      } catch {
        // no scene yet
      }
    }
    return fail(`Queued ${ops.length} edit(s), but no open Studio applied them within 5 s. Ask the user to open ${SPATIAL_URL}/studio; the edits apply when it connects.`)
  },
)

server.registerTool(
  "publish_component",
  {
    title: "Publish a new component to the Spatial library",
    description:
      "Add a NEW component you wrote to the Spatial library, so it shows up in the Studio library (and can be placed with edit_scene add). " +
      "Contract: one self-contained React Three Fiber .tsx file, default export, every prop optional, imports only react, three, @react-three/fiber, @react-three/drei, " +
      "@react-three/uikit(-default/-lucide/-horizon), @react-three/xr, @react-three/handle, tone; no imports from the project; R3F pointer events only (onClick, onPointerDown/Up/Over/Out/Move), " +
      "never stopPropagation or DOM events; hit targets >= 2 cm; values via value + onChange(v) (list them in bindable so the Studio can wire them); sound via Tone.js globals. " +
      "Read a similar component with get_component first and match its style. The dev server hot-reloads the library in a few seconds.",
    inputSchema: {
      name: z.string().describe("kebab-case id, e.g. theremin"),
      displayName: z.string().max(60),
      category: z.string().max(40).describe("e.g. music, controls, objects, containers"),
      description: z.string().max(300),
      source: z.string().describe("Full .tsx file contents"),
      tags: z.array(z.string().max(30)).max(12).optional(),
      bindable: z.array(z.record(z.string(), z.any())).optional().describe('e.g. [{prop:"value", event:"onChange", type:"number", min:0, max:1, default:0.5}]'),
      props: z.array(z.record(z.string(), z.any())).optional().describe('Inspector props, e.g. [{name:"color", type:"color", default:"#9FE7D2"}]'),
      overwrite: z.boolean().default(false).describe("Replace a component YOU published earlier with the same name"),
    },
  },
  async ({ name, displayName, category, description, source, tags = [], bindable = [], props = [], overwrite = false }) => {
    if (!COMPONENT_NAME.test(name)) return fail(`name must be kebab-case (a-z, 0-9, -), got "${name}"`)
    const problems = checkComponentSource(source)
    if (problems.length) return fail(`Not published. Fix: \n- ${problems.join("\n- ")}`)
    const existing = resolveEntry(loadRegistry(), name)
    const mine = existing?.author === "Claude (via Spatial MCP)"
    if (existing && !(overwrite && mine)) return fail(`"${name}" already exists${mine ? " (pass overwrite: true to replace it)" : " and isn't yours; pick another name"}.`)
    const file = `components/spatial/${name}.tsx`
    const incoming = path.join(WEB_DIR, "registry", "incoming", "zz-mcp-published.json")
    let list = []
    try {
      list = JSON.parse(await readFile(incoming, "utf8"))
    } catch {
      // first publish
    }
    const entry = {
      name, displayName, category, kind: "object", style: "default", tags: [...new Set([...tags, category, "claude"])], aliases: [], description, file,
      status: "ready", tier: 2, xrOnly: false, deps: importedPackages(source).filter((p) => p === "tone"),
      author: "Claude (via Spatial MCP)", license: "MIT", price: "free", bindable, props,
    }
    try {
      await writeFile(path.join(WEB_DIR, file), source.startsWith('"use client"') ? source : `"use client"\n\n${source}`)
      await writeFile(incoming, JSON.stringify(upsertEntry(list, entry), null, 2) + "\n")
      await new Promise((resolve, reject) =>
        execFile(process.execPath, ["scripts/merge-registry.mjs"], { cwd: WEB_DIR, timeout: 30_000 }, (err) => (err ? reject(err) : resolve())),
      )
    } catch (err) {
      return fail(`Publishing failed: ${err.message}`)
    }
    return text(
      `Published "${displayName}" (${name}) to web/${file}. It appears in the Studio library after the dev server hot-reloads (a few seconds). ` +
        `Place it live with edit_scene {op:"add", component:"${name}", position:[x,y,z]}. Not type-checked: if the Studio shows an error, fix the file and publish again with overwrite: true.`,
    )
  },
)

await server.connect(new StdioServerTransport())
console.error(`spatial MCP server running (SPATIAL_URL=${SPATIAL_URL})`)
