import { readFile } from "node:fs/promises"
import { NextResponse } from "next/server"
import { assetPath } from "../store"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const path = assetPath(id)
  if (!path) return NextResponse.json({ error: "invalid id" }, { status: 400 })
  try {
    const bytes = await readFile(path)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": id.endsWith(".glb") ? "model/gltf-binary" : "model/gltf+json",
        "cache-control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
}
