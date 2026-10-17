#!/usr/bin/env node
// Spatial MCP server (stdio). stdout belongs to the transport: log with console.error only.
import { constants } from "node:fs"
import { copyFile, mkdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  bindableSummary,
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

await server.connect(new StdioServerTransport())
console.error(`spatial MCP server running (SPATIAL_URL=${SPATIAL_URL})`)
