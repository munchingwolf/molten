import { live } from "@/lib/live-store"

export const dynamic = "force-dynamic"
const MAX_BYTES = 512_000

/** The open Studio posts its scene (items, selection, values, last applied op + results) after every change. */
export async function POST(req: Request) {
  const text = await req.text()
  if (text.length > MAX_BYTES) return Response.json({ error: "scene too large" }, { status: 413 })
  try {
    live.scene = JSON.parse(text)
    live.sceneAt = Date.now()
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 })
  }
  return Response.json({ ok: true })
}

/** Claude Code reads the live scene, like get_scene_info in Blender MCP. */
export function GET() {
  if (!live.scene) return Response.json({ error: "no Studio has reported a scene yet; open /studio" }, { status: 404 })
  return Response.json({ ...(live.scene as object), ageMs: Date.now() - live.sceneAt })
}
