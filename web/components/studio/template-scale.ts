"use client"

import { useEffect } from "react"
import { useStudio } from "@/lib/studio-store"

/** Templates are authored at real room size; in the headset that felt too far and too big. */
export const TEMPLATE_SCALE = 0.7

/**
 * When a template starts (a new guide root appears), shrink its root frame so the whole template, slots included, scales
 * toward you (the root sits at your feet). Kept outside studio-store so the store stays untouched; no undo step.
 */
export function useTemplateScale() {
  useEffect(
    () =>
      useStudio.subscribe((s, prev) => {
        const id = s.guide?.rootId
        if (!id || id === prev.guide?.rootId) return
        const root = s.items.find((i) => i.id === id)
        if (root && root.scale === 1) useStudio.setState({ items: s.items.map((i) => (i.id === id ? { ...i, scale: TEMPLATE_SCALE } : i)) })
      }),
    [],
  )
}
