"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Billboard, Line, Text } from "@react-three/drei"
import { Box3, Vector3, type Material, type Mesh } from "three"
import type { Item } from "@/lib/layout"
import { findEntry } from "@/lib/registry"
import { contents } from "./layout-renderer"

type Measured = { id: string; min: Vector3; max: Vector3; center: Vector3 }
const box = new Box3()

// Same name → same cable colour.
const hue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

/**
 * X-ray view: every item gets an outline box and a label, frames a dashed bound, and items that share a wired
 * value name are joined by a coloured cable. Component meshes go translucent while it's on.
 */
export function XRayOverlay({ items, selectedId }: { items: Item[]; selectedId: string | null }) {
  const [boxes, setBoxes] = useState<Measured[]>([])
  const tick = useRef(0)

  // Re-measure a few times a second (items move, uikit lays out async).
  useFrame(() => {
    if (tick.current++ % 15) return
    const next: Measured[] = []
    for (const item of items) {
      const o = contents.get(item.id)
      if (!o || item.hidden) continue
      box.setFromObject(o)
      if (box.isEmpty()) continue
      next.push({ id: item.id, min: box.min.clone(), max: box.max.clone(), center: box.getCenter(new Vector3()) })
    }
    setBoxes(next)
  })

  // Translucent components while X-ray is on; restore exactly on exit.
  useEffect(() => {
    const saved = new Map<Material, { transparent: boolean; opacity: number; depthWrite: boolean }>()
    for (const item of items)
      contents.get(item.id)?.traverse((o) => {
        const mats = (o as Mesh).material
        for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
          if (saved.has(m)) continue
          saved.set(m, { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite })
          m.transparent = true
          m.opacity = m.opacity * 0.35
          m.depthWrite = false
        }
      })
    return () => saved.forEach((v, m) => Object.assign(m, v))
  }, [items])

  const byId = new Map(boxes.map((b) => [b.id, b]))
  // Cables: link consecutive items that bind the same name.
  const groups = new Map<string, string[]>()
  for (const item of items) for (const name of new Set(Object.values(item.bind))) groups.set(name, [...(groups.get(name) ?? []), item.id])
  const cables = [...groups].flatMap(([name, ids]) =>
    ids.slice(1).flatMap((id, i) => {
      const a = byId.get(ids[i])
      const b = byId.get(id)
      return a && b ? [{ key: `${name}-${i}`, name, a: a.center, b: b.center }] : []
    }),
  )

  return (
    <group>
      {boxes.map((b) => {
        const item = items.find((i) => i.id === b.id)!
        const frame = item.component === "frame"
        const color = b.id === selectedId ? "#F2B48A" : frame ? "#B794F6" : "#9FE7D2"
        const { min: n, max: x } = b
        const corners: [number, number, number][] = [
          [n.x, n.y, n.z], [x.x, n.y, n.z], [x.x, x.y, n.z], [n.x, x.y, n.z], [n.x, n.y, n.z],
          [n.x, n.y, x.z], [x.x, n.y, x.z], [x.x, x.y, x.z], [n.x, x.y, x.z], [n.x, n.y, x.z],
        ]
        return (
          <group key={b.id}>
            <Line points={corners} color={color} lineWidth={1.5} dashed={frame} dashSize={0.02} gapSize={0.015} />
            <Line points={[[x.x, n.y, n.z], [x.x, n.y, x.z]]} color={color} lineWidth={1.5} />
            <Line points={[[x.x, x.y, n.z], [x.x, x.y, x.z]]} color={color} lineWidth={1.5} />
            <Line points={[[n.x, x.y, n.z], [n.x, x.y, x.z]]} color={color} lineWidth={1.5} />
            <Billboard position={[b.center.x, x.y + 0.04, b.center.z]}>
              <Text fontSize={0.025} color={color} anchorY="bottom" outlineWidth={0.002} outlineColor="#0B0C10">
                {item.name ?? findEntry(item.component)?.displayName ?? item.component}
              </Text>
            </Billboard>
          </group>
        )
      })}
      {cables.map((c) => (
        <group key={c.key}>
          <Line points={[c.a, c.a.clone().lerp(c.b, 0.5).add(new Vector3(0, 0.12, 0)), c.b]} color={`hsl(${hue(c.name)}, 80%, 65%)`} lineWidth={2.5} />
          <Billboard position={c.a.clone().lerp(c.b, 0.5).add(new Vector3(0, 0.15, 0))}>
            <Text fontSize={0.022} color={`hsl(${hue(c.name)}, 80%, 72%)`} outlineWidth={0.002} outlineColor="#0B0C10">
              {c.name}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  )
}
