"use client"

import { useEffect, useMemo } from "react"
import * as THREE from "three"

// Real-world 2.0 x 1.4 m area rug, 12 mm pile. Origin = bounding-box centre; lies flat (Y up).
const W = 2.0
const D = 1.4
const T = 0.012

type Pattern = "persian" | "geometric" | "stripes"

const shade = (hex: string, l: number, s = 0) => "#" + new THREE.Color(hex).offsetHSL(0, s, l).getHexString()

function rugTexture(color: string, pattern: Pattern) {
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = Math.round((1024 * D) / W)
  const g = c.getContext("2d")!
  const w = c.width
  const h = c.height
  const dark = shade(color, -0.14)
  const light = shade(color, 0.22, -0.1)
  const cream = "#E9DFC9"
  const accent = "#" + new THREE.Color(color).offsetHSL(0.45, 0, 0.05).getHexString()
  g.fillStyle = color
  g.fillRect(0, 0, w, h)

  if (pattern === "stripes") {
    const bands = [cream, color, dark, cream, accent, cream, dark, color]
    let x = 0
    let i = 0
    while (x < w) {
      const bw = 18 + ((i * 53) % 70)
      g.fillStyle = bands[i % bands.length]
      g.fillRect(x, 0, bw, h)
      x += bw
      i++
    }
  } else if (pattern === "geometric") {
    const s = 96
    for (let y = 0; y < h + s; y += s)
      for (let x = 0; x < w + s; x += s) {
        const k = ((x / s) * 7 + (y / s) * 3) % 4
        g.fillStyle = [cream, dark, accent, light][k]
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + s, y)
        g.lineTo(k % 2 ? x : x + s, y + s)
        g.fill()
      }
    g.strokeStyle = cream
    g.lineWidth = 14
    g.strokeRect(24, 24, w - 48, h - 48)
  } else {
    // borders
    const ring = (inset: number, col: string, lw: number) => {
      g.strokeStyle = col
      g.lineWidth = lw
      g.strokeRect(inset, inset, w - inset * 2, h - inset * 2)
    }
    g.fillStyle = dark
    g.fillRect(0, 0, w, h)
    g.fillStyle = color
    g.fillRect(70, 70, w - 140, h - 140)
    ring(20, cream, 6)
    ring(64, cream, 4)
    // border motifs
    g.fillStyle = accent
    for (let x = 60; x < w - 40; x += 44) {
      for (const y of [42, h - 42]) diamond(g, x, y, 12)
    }
    for (let y = 60; y < h - 40; y += 44) {
      for (const x of [42, w - 42]) diamond(g, x, y, 12)
    }
    // central medallion + corner quarters
    const cx = w / 2
    const cy = h / 2
    ;[
      [200, dark],
      [160, cream],
      [130, accent],
      [90, dark],
      [50, light],
      [22, cream],
    ].forEach(([r, col]) => {
      g.fillStyle = col as string
      diamond(g, cx, cy, r as number, 1.6)
    })
    g.fillStyle = dark
    for (const [x, y] of [
      [70, 70],
      [w - 70, 70],
      [70, h - 70],
      [w - 70, h - 70],
    ]) {
      g.beginPath()
      g.arc(x, y, 110, 0, Math.PI * 2)
      g.fill()
    }
    // scattered field motifs
    g.fillStyle = light
    for (let i = 0; i < 40; i++) {
      const x = 140 + ((i * 97) % (w - 280))
      const y = 130 + ((i * 61) % (h - 260))
      if (Math.hypot((x - cx) / 1.6, y - cy) < 150) continue
      diamond(g, x, y, 9)
    }
  }
  // wool texture
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.05)"
    g.fillRect(Math.random() * w, Math.random() * h, 2, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function diamond(g: CanvasRenderingContext2D, x: number, y: number, r: number, stretch = 1) {
  g.beginPath()
  g.moveTo(x - r * stretch, y)
  g.lineTo(x, y - r)
  g.lineTo(x + r * stretch, y)
  g.lineTo(x, y + r)
  g.closePath()
  g.fill()
}

function fringeTexture() {
  const c = document.createElement("canvas")
  c.width = 512
  c.height = 16
  const g = c.getContext("2d")!
  g.fillStyle = "#E9DFC9"
  for (let x = 0; x < 512; x += 4) g.fillRect(x, 0, 2, 12 + Math.random() * 4)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 2 x 1.4 m wool area rug with a procedural persian, geometric or striped weave. Its top is a placement surface. */
export default function Rug({ color = "#8E2F2B", pattern = "persian" }: { color?: string; pattern?: Pattern }) {
  const tex = useMemo(() => rugTexture(color, pattern), [color, pattern])
  const fringe = useMemo(fringeTexture, [])
  useEffect(() => () => tex.dispose(), [tex])
  useEffect(() => () => fringe.dispose(), [fringe])
  const fl = 0.05 // fringe length
  return (
    <group>
      <mesh>
        <boxGeometry args={[W - 2 * fl, T, D]} />
        <meshPhysicalMaterial color={shade(color, -0.2)} roughness={1} />
      </mesh>
      <mesh position={[0, T / 2 + 0.0002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - 2 * fl, D]} />
        <meshPhysicalMaterial map={tex} roughness={1} sheen={0.6} sheenRoughness={0.8} sheenColor="#ffffff" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - fl / 2), -T / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2]}>
          <planeGeometry args={[D, fl]} />
          <meshStandardMaterial map={fringe} alphaTest={0.5} transparent={false} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
