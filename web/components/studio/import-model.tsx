"use client"

import { useEffect, useRef, useState } from "react"
import { useStudio } from "@/lib/studio-store"

/** Upload a .glb/.gltf and place it as an editable "gltf-model" object. Returns a status message. */
async function importFile(file: File): Promise<string> {
  if (!/\.(glb|gltf)$/i.test(file.name)) return "Only .glb or .gltf files"
  const res = await fetch("/api/assets", { method: "POST", headers: { "x-filename": file.name }, body: file })
  const data = (await res.json()) as { url?: string; error?: string }
  if (!res.ok || !data.url) return `Import failed: ${data.error ?? res.status}`
  // Lands 1.5 m ahead at floor-ish height so there's room to build onto and around it.
  useStudio.getState().add("gltf-model", [0, 0.6, -1.5], { props: { url: data.url, size: 1.2 }, name: file.name.replace(/\.(glb|gltf)$/i, "") })
  return `Imported ${file.name}`
}

/** "Import 3D" button + drop a .glb anywhere on the Studio to bring an existing app/model in as an editable object. */
export function ImportModelButton() {
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState("")
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return
      e.preventDefault()
      setDragging(true)
    }
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false)
    }
    const drop = async (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0]
      if (!file) return
      e.preventDefault()
      setDragging(false)
      setStatus("Importing…")
      setStatus(await importFile(file))
    }
    window.addEventListener("dragover", over)
    window.addEventListener("dragleave", leave)
    window.addEventListener("drop", drop)
    return () => {
      window.removeEventListener("dragover", over)
      window.removeEventListener("dragleave", leave)
      window.removeEventListener("drop", drop)
    }
  }, [])

  return (
    <>
      <button
        onClick={() => input.current?.click()}
        title="Import a .glb/.gltf model (or drop one on the Studio)"
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium"
      >
        Import 3D
      </button>
      <input
        ref={input}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          setStatus("Importing…")
          setStatus(await importFile(file))
        }}
      />
      {status && <span className="font-mono text-xs text-muted" aria-live="polite">{status}</span>}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-black/40 text-lg font-medium text-white">
          Drop your .glb to import it as an editable object
        </div>
      )}
    </>
  )
}
