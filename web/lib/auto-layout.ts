// Figma-style auto-layout for frames, in metres. Pure, so `node --test` runs it.
import type { Vec3 } from "./layout.ts"

export type FrameProps = {
  direction: "row" | "column" | "grid" | "arc"
  gap: number
  padding: number
  /** grid only */
  columns?: number
  /** arc only: radius of the curved wall around the viewer */
  radius?: number
  align?: "start" | "center" | "end"
}

export const DEFAULT_FRAME: FrameProps = { direction: "row", gap: 0.05, padding: 0.06, columns: 2, radius: 1.4, align: "center" }

export type Size = [number, number] // width, height in metres
export type Placement = { position: Vec3; rotation: Vec3 }

/** Child placements in the frame's local space, centred on the frame origin, plus the frame's content box size. */
export function layoutFrame(p: FrameProps, sizes: Size[]): { placements: Placement[]; size: Size } {
  const n = sizes.length
  if (!n) return { placements: [], size: [0.4 + 2 * p.padding, 0.25 + 2 * p.padding] }
  const align = (extent: number, free: number) =>
    p.align === "start" ? -free / 2 : p.align === "end" ? free / 2 - extent : -extent / 2

  if (p.direction === "row" || p.direction === "column") {
    const main = p.direction === "row" ? 0 : 1
    const total = sizes.reduce((s, sz) => s + sz[main], 0) + p.gap * (n - 1)
    const cross = Math.max(...sizes.map((sz) => sz[1 - main]))
    let cursor = -total / 2
    const placements = sizes.map((sz) => {
      const c = cursor + sz[main] / 2
      cursor += sz[main] + p.gap
      const off = p.align === "center" || !p.align ? 0 : (p.align === "start" ? -1 : 1) * (cross - sz[1 - main]) / 2
      // rows run left→right; columns run top→bottom
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
    void align
    return { placements, size: [w + 2 * p.padding, h + 2 * p.padding] }
  }

  // arc: children spread along a circle of `radius` centred on the viewer, each turned to face them.
  const r = p.radius ?? 1.4
  const widths = sizes.map((s) => s[0])
  const arc = widths.reduce((a, b) => a + b, 0) + p.gap * (n - 1) // arc length
  let cursor = -arc / 2
  const placements = sizes.map((sz) => {
    const theta = (cursor + sz[0] / 2) / r
    cursor += sz[0] + p.gap
    // frame origin sits on the arc's middle; viewer is at (0, 0, r) in frame space
    return { position: [r * Math.sin(theta), 0, r - r * Math.cos(theta)] as Vec3, rotation: [0, -theta, 0] as Vec3 }
  })
  return { placements, size: [2 * r * Math.sin(Math.min(Math.PI / 2, arc / (2 * r))), Math.max(...sizes.map((s) => s[1])) + 2 * p.padding] }
}

/** Snap a value to a grid step (metres). */
export const snap = (v: number, step = 0.025) => Math.round(v / step) * step
