// Pure helpers for the Spatial MCP server. No MCP or network code here, so tests can import it directly.
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const WEB_DIR = fileURLToPath(new URL("../web/", import.meta.url))
export const TARGET_DIR = path.join("components", "spatial")
const LAYOUT_ID = /^(latest|[a-z0-9]{6,12})$/

// Read fresh on every call: the registry is edited while the server runs.
export function loadRegistry(webDir = WEB_DIR) {
  return JSON.parse(readFileSync(path.join(webDir, "registry", "index.json"), "utf8"))
}

const haystack = (e) =>
  [e.name, e.displayName, e.category, e.description, ...(e.tags ?? []), ...(e.aliases ?? [])]
    .join(" ")
    .toLowerCase()

export function search(entries, { query = "", category, includeSoon = false } = {}) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const cat = category?.trim().toLowerCase()
  return entries.filter(
    (e) =>
      (includeSoon || e.status === "ready") &&
      (!cat || e.category?.toLowerCase() === cat) &&
      words.every((w) => haystack(e).includes(w)),
  )
}

// Exact match only: the name is later used to build a file path.
export const resolveEntry = (entries, name) => entries.find((e) => e.name === name) ?? null

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++)
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

export function suggest(entries, name, n = 3) {
  const q = String(name).toLowerCase()
  const score = (e) => (e.name.includes(q) || q.includes(e.name) ? 0 : levenshtein(q, e.name))
  return entries
    .map((e) => [score(e), e.name])
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map(([, name]) => name)
}

export const validateLayoutId = (id) => typeof id === "string" && LAYOUT_ID.test(id)

// Where add_component writes. Throws unless name is a registry entry and the result stays inside projectPath.
export function safeTargetPath(entries, projectPath, name) {
  const entry = resolveEntry(entries, name)
  if (!entry || !/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`Unknown component "${name}"`)
  const root = path.resolve(projectPath)
  const target = path.join(root, TARGET_DIR, `${name}.tsx`)
  if (!target.startsWith(root + path.sep)) throw new Error(`Refusing to write outside ${root}`)
  return target
}

// Registry `file` is relative to web/; keep it there.
export function sourcePath(entry, webDir = WEB_DIR) {
  const root = path.resolve(webDir)
  const p = path.resolve(root, entry.file)
  if (!p.startsWith(root + path.sep)) throw new Error(`Bad file path in registry for "${entry.name}"`)
  return p
}

// Package names a source file imports (bare specifiers only), e.g. "@react-three/drei/core" -> "@react-three/drei".
export function importedPackages(source) {
  const specs = [
    ...source.matchAll(/\b(?:import|export)\s[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*['"]([^'"]+)['"]/g),
  ].map((m) => m[1])
  const pkgs = specs
    .filter((s) => !s.startsWith(".") && !s.startsWith("/") && !s.startsWith("node:") && !s.startsWith("@/"))
    .map((s) => s.split("/").slice(0, s.startsWith("@") ? 2 : 1).join("/"))
  return [...new Set(pkgs)]
}

// entry.deps plus whatever the source actually imports, so nothing needed is missed.
export const depsFor = (entry, source = "") => [...new Set([...(entry.deps ?? []), ...importedPackages(source)])]

export const pascalCase = (name) => name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())

export const bindableSummary = (entry) =>
  (entry.bindable ?? [])
    .map((b) => {
      const range = b.min !== undefined || b.max !== undefined ? ` ${b.min ?? ""}..${b.max ?? ""}` : ""
      return `${b.prop}: ${b.type ?? "any"}${range}`
    })
    .join(", ") || null

export function usageExample(entry) {
  const C = pascalCase(entry.name)
  return [
    `import { Canvas } from "@react-three/fiber"`,
    `import ${C} from "./components/spatial/${entry.name}" // adjust to where the file lives`,
    ``,
    `export default function Scene() {`,
    `  return (`,
    `    <Canvas>`,
    `      <${C} /> {/* every prop is optional; controlled props are listed in "bindable" */}`,
    `    </Canvas>`,
    `  )`,
    `}`,
  ].join("\n")
}
