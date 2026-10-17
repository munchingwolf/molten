"use client"

import { useEffect } from "react"
import { Euler, Quaternion, Vector3 } from "three"
import { useStudio } from "@/lib/studio-store"
import { clampScale } from "@/lib/snap"
import type { Vec3 } from "@/lib/layout"

const TURN = Math.PI / 12 // 15°
const UP = new Vector3(0, 1, 0)

/** Turn about the world vertical. Keeps plain numbers when the item is only yawed. */
function yawBy([x, y, z]: Vec3, a: number): Vec3 {
  if (x === 0 && z === 0) return [0, y + a, 0]
  const e = new Euler().setFromQuaternion(new Quaternion().setFromEuler(new Euler(x, y, z)).premultiply(new Quaternion().setFromAxisAngle(UP, a)))
  return [e.x, e.y, e.z]
}

/**
 * Laptop transform keys for the selected item (see GESTURES.md). Mount once, e.g. in StudioApp.
 * Arrows nudge x/y 1 cm (Shift 10 cm), PageUp/PageDown nudge z, [ ] turn 15°, - = scale, Alt+wheel over the canvas scales.
 */
export function useGestureKeys() {
  useEffect(() => {
    const selected = () => {
      const s = useStudio.getState()
      return s.items.find((i) => i.id === s.selectedId)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return // leave browser shortcuts (Cmd +/-) alone
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.closest("input, textarea, select"))) return
      const item = selected()
      if (!item) return
      const update = useStudio.getState().update
      const d = e.shiftKey ? 0.1 : 0.01
      const [x, y, z] = item.position
      const moves: Record<string, Vec3> = {
        ArrowLeft: [x - d, y, z],
        ArrowRight: [x + d, y, z],
        ArrowUp: [x, y + d, z],
        ArrowDown: [x, y - d, z],
        PageUp: [x, y, z - d], // away from you
        PageDown: [x, y, z + d], // toward you
      }
      if (moves[e.key]) update(item.id, { position: moves[e.key] })
      else if (e.key === "[" || e.key === "]") update(item.id, { rotation: yawBy(item.rotation, e.key === "[" ? TURN : -TURN) })
      else if (e.key === "-" || e.key === "_") update(item.id, { scale: clampScale(item.scale * 0.9) })
      else if (e.key === "=" || e.key === "+") update(item.id, { scale: clampScale(item.scale * 1.1) })
      else return
      e.preventDefault() // arrows/PageUp would otherwise scroll the page
    }
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey || !(e.target instanceof HTMLCanvasElement)) return
      const item = selected()
      if (!item) return
      e.preventDefault()
      e.stopPropagation() // capture phase on window: the orbit camera never sees this wheel, so it doesn't zoom too
      useStudio.getState().update(item.id, { scale: clampScale(item.scale * Math.exp(-e.deltaY * 0.002)) })
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("wheel", onWheel, { capture: true, passive: false })
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("wheel", onWheel, { capture: true })
    }
  }, [])
}
