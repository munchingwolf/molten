"use client"

import { Children, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import { Box3, Vector3, type Group, type Mesh } from "three"

type Vec3 = [number, number, number]

export type FrameProps = {
  /** row / column / grid like Figma auto-layout; arc = a curved wall facing the viewer. */
  direction?: "row" | "column" | "grid" | "arc"
  /** metres between children */
  gap?: number
  /** metres around the children */
  padding?: number
  columns?: number
  /** arc radius in metres */
  radius?: number
  align?: "start" | "center" | "end"
  background?: boolean
  color?: string
  opacity?: number
  children?: ReactNode
}

// ---- layout math: verbatim copy of layoutFrame in web/lib/auto-layout.ts (tested there; a test checks they match)
// so this file stays copy-pasteable on its own.
type Size = [number, number]
type Placement = { position: Vec3; rotation: Vec3 }
type LayoutProps = { direction: "row" | "column" | "grid" | "arc"; gap: number; padding: number; columns?: number; radius?: number; align?: "start" | "center" | "end" }
// LAYOUT-START
function layoutFrame(p: LayoutProps, sizes: Size[]): { placements: Placement[]; size: Size } {
  const n = sizes.length
  if (!n) return { placements: [], size: [0.4 + 2 * p.padding, 0.25 + 2 * p.padding] }

  if (p.direction === "row" || p.direction === "column") {
    const main = p.direction === "row" ? 0 : 1
    const total = sizes.reduce((s, sz) => s + sz[main], 0) + p.gap * (n - 1)
    const cross = Math.max(...sizes.map((sz) => sz[1 - main]))
    let cursor = -total / 2
    const placements = sizes.map((sz) => {
      const c = cursor + sz[main] / 2
      cursor += sz[main] + p.gap
      const off = p.align === "center" || !p.align ? 0 : ((p.align === "start" ? -1 : 1) * (cross - sz[1 - main])) / 2
      // rows run left→right (start = top); columns run top→bottom (start = left)
      const position: Vec3 = main === 0 ? [c, -off, 0] : [off, -c, 0]
      return { position, rotation: [0, 0, 0] as Vec3 }
    })
    const size: Size = main === 0 ? [total, cross] : [cross, total]
    return { placements, size: [size[0] + 2 * p.padding, size[1] + 2 * p.padding] }
  }

  if (p.direction === "grid") {
    const cols = Math.max(1, Math.min(p.columns ?? 2, n))
    const rows = Math.ceil(n / cols)
    const cw = Math.max(...sizes.map((s) => s[0]))
    const rh = Math.max(...sizes.map((s) => s[1]))
    const w = cols * cw + (cols - 1) * p.gap
    const h = rows * rh + (rows - 1) * p.gap
    const placements = sizes.map((_, i) => {
      const c = i % cols
      const r = Math.floor(i / cols)
      return { position: [-w / 2 + cw / 2 + c * (cw + p.gap), h / 2 - rh / 2 - r * (rh + p.gap), 0] as Vec3, rotation: [0, 0, 0] as Vec3 }
    })
    return { placements, size: [w + 2 * p.padding, h + 2 * p.padding] }
  }

  // arc: children spread along a circle of `radius` centred on the viewer, each turned to face them.
  const r = p.radius ?? 1.4
  const arc = sizes.reduce((a, s) => a + s[0], 0) + p.gap * (n - 1)
  let cursor = -arc / 2
  const placements = sizes.map((sz) => {
    const theta = (cursor + sz[0] / 2) / r
    cursor += sz[0] + p.gap
    // frame origin sits on the arc's middle; the viewer is at (0, 0, r) in frame space
    return { position: [r * Math.sin(theta), 0, r - r * Math.cos(theta)] as Vec3, rotation: [0, -theta, 0] as Vec3 }
  })
  return { placements, size: [2 * r * Math.sin(Math.min(Math.PI / 2, arc / (2 * r))), Math.max(...sizes.map((s) => s[1])) + 2 * p.padding] }
}
// LAYOUT-END

const world = new Box3()
const local = new Box3()
const corner = new Vector3()

/** Child's bounding size in its slot's own space (so a slot's rotation doesn't feed back into its measured width). */
function measure(slot: Group): Size {
  local.makeEmpty()
  for (const child of slot.children) {
    world.setFromObject(child)
    if (world.isEmpty()) continue
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? world.max.x : world.min.x, i & 2 ? world.max.y : world.min.y, i & 4 ? world.max.z : world.min.z)
      local.expandByPoint(slot.worldToLocal(corner))
    }
  }
  if (local.isEmpty()) return [0.2, 0.1]
  return [local.max.x - local.min.x, local.max.y - local.min.y]
}

/** Auto-layout container: lays its children out in a row, column, grid or an arc wall, with gap and padding. */
export default function Frame({
  direction = "row", gap = 0.05, padding = 0.06, columns = 2, radius = 1.4, align = "center",
  background = true, color = "#15171E", opacity = 0.55, children,
}: FrameProps) {
  const slots = useRef<(Group | null)[]>([])
  const bg = useRef<Mesh>(null)
  const tick = useRef(0)
  const count = Children.count(children)

  // Children (uikit especially) size themselves asynchronously, so re-measure a few times a second.
  useFrame(() => {
    if (tick.current++ % 12) return
    const live = slots.current.slice(0, count).filter((g): g is Group => !!g)
    const { placements, size } = layoutFrame({ direction, gap, padding, columns, radius, align }, live.map(measure))
    live.forEach((g, i) => {
      g.position.set(...placements[i].position)
      g.rotation.set(...placements[i].rotation)
    })
    if (bg.current) {
      bg.current.visible = background && direction !== "arc"
      bg.current.scale.set(Math.max(size[0], 0.05), Math.max(size[1], 0.05), 1)
    }
  })

  return (
    <group>
      <mesh ref={bg} position={[0, 0, -0.015]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {Children.map(children, (child, i) => (
        <group ref={(el) => void (slots.current[i] = el)}>{child}</group>
      ))}
    </group>
  )
}
