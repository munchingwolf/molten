import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Template layouts live as JSON in web/registry/templates/*.json ({ name, environment?, items }).
const DIR = join(process.cwd(), "registry", "templates")

export async function GET() {
  try {
    const files = (await readdir(DIR)).filter((f) => f.endsWith(".json")).sort()
    const templates = []
    for (const f of files) {
      try {
        const t = JSON.parse(await readFile(join(DIR, f), "utf8"))
        if (t && typeof t.name === "string" && Array.isArray(t.items)) templates.push({ id: f.replace(/\.json$/, ""), ...t })
      } catch {
        // skip a malformed template rather than failing the whole list
      }
    }
    return NextResponse.json(templates)
  } catch {
    return NextResponse.json([])
  }
}
