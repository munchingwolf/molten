import { mkdir, writeFile } from "node:fs/promises"
import { NextResponse } from "next/server"
import { assetPath, MAX_ASSET_BYTES } from "./store"
import { newId } from "@/lib/layout"

export const dynamic = "force-dynamic"

/** Upload a .glb (or self-contained .gltf). Body = raw file bytes; `x-filename` header keeps the extension. */
export async function POST(req: Request) {
  const name = req.headers.get("x-filename") ?? "model.glb"
  const ext = name.toLowerCase().endsWith(".gltf") ? "gltf" : name.toLowerCase().endsWith(".glb") ? "glb" : null
  if (!ext) return NextResponse.json({ error: "only .glb or .gltf files" }, { status: 400 })
  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > MAX_ASSET_BYTES) return NextResponse.json({ error: "file too large (max 50 MB)" }, { status: 413 })
  const bytes = Buffer.from(await req.arrayBuffer())
  if (!bytes.length) return NextResponse.json({ error: "empty file" }, { status: 400 })
  if (bytes.length > MAX_ASSET_BYTES) return NextResponse.json({ error: "file too large (max 50 MB)" }, { status: 413 })
  // .glb files start with the magic "glTF"; .gltf is JSON.
  if (ext === "glb" && bytes.subarray(0, 4).toString("latin1") !== "glTF") return NextResponse.json({ error: "not a valid .glb" }, { status: 400 })
  const id = `${newId()}.${ext}`
  const path = assetPath(id)!
  await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true })
  await writeFile(path, bytes)
  return NextResponse.json({ id, url: `/api/assets/${id}` })
}
