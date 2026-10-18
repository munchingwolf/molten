"use client"

import { useEffect, useState } from "react"
import { useStudio } from "@/lib/studio-store"
import { GO_EVENT, resolveScene } from "@/lib/scene-nav"

/** Fade to black, run `swap` at the darkest point, fade back: the "loading the next level" beat. */
export function useSceneFade() {
  const [dark, setDark] = useState(false)
  const fade = (swap: () => void) => {
    setDark(true)
    window.setTimeout(() => (swap(), window.setTimeout(() => setDark(false), 60)), 260)
  }
  const overlay = (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-[260ms] ${dark ? "opacity-100" : "opacity-0"}`}
    />
  )
  return { fade, overlay }
}

/**
 * Scenes are the pages (or levels) of an experience. Tabs switch, + adds, double-click renames, × deletes.
 * In Play mode a portal or nav-button press ("spatial:go") moves to its target scene behind a short fade.
 */
export function SceneBar() {
  const { scenes, sceneId, addScene, switchScene, renameScene, removeScene, playMode } = useStudio()
  const [editing, setEditing] = useState<string | null>(null)
  const { fade, overlay } = useSceneFade()

  useEffect(() => {
    if (!playMode) return
    const onGo = (e: Event) => {
      const to = String((e as CustomEvent<{ to?: string }>).detail?.to ?? "next")
      const s = useStudio.getState()
      const id = resolveScene(s.scenes, to, s.sceneId)
      if (id && id !== s.sceneId) fade(() => useStudio.getState().switchScene(id))
    }
    window.addEventListener(GO_EVENT, onGo)
    return () => window.removeEventListener(GO_EVENT, onGo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playMode])

  return (
    <>
      {overlay}
      <nav aria-label="Scenes" className="absolute bottom-3 left-3 z-10 flex max-w-[70%] items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface/90 p-1 text-sm backdrop-blur">
        {scenes.map((sc, i) =>
          editing === sc.id ? (
            <input
              key={sc.id}
              autoFocus
              aria-label="Scene name"
              defaultValue={sc.name}
              onBlur={(e) => (renameScene(sc.id, e.target.value.trim() || sc.name), setEditing(null))}
              onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && (e.target as HTMLInputElement).blur()}
              className="w-28 rounded-md border border-accent bg-bg px-2 py-1"
            />
          ) : (
            <span key={sc.id} className="flex items-center">
              <button
                onClick={() => sc.id !== sceneId && switchScene(sc.id)}
                onDoubleClick={() => setEditing(sc.id)}
                aria-pressed={sc.id === sceneId}
                title="Double-click to rename"
                className="rounded-md px-2.5 py-1 text-muted hover:bg-bg aria-pressed:bg-bg aria-pressed:font-semibold aria-pressed:text-text"
              >
                <span className="mr-1 font-mono text-xs text-faint">{i + 1}</span>
                {sc.name}
              </button>
              {scenes.length > 1 && sc.id === sceneId && (
                <button onClick={() => removeScene(sc.id)} aria-label={`Delete ${sc.name}`} title="Delete scene" className="px-1 text-faint hover:text-text">
                  ×
                </button>
              )}
            </span>
          ),
        )}
        <button onClick={() => addScene()} title="Add a scene (a page or level)" className="rounded-md px-2.5 py-1 text-muted hover:bg-bg">
          + Scene
        </button>
        {playMode && <span className="px-2 text-xs text-accent">Portals and nav buttons work in Play</span>}
      </nav>
    </>
  )
}
