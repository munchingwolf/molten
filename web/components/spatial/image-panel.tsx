"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Image } from "@react-three/drei"

type Props = {
  /** Panel width in metres (4:3) */
  width?: number
  /** Corner radius, 0–0.5 of the short side */
  radius?: number
  colorA?: string
  colorB?: string
}

/** Procedural artwork: a diagonal gradient with soft orbs, painted on a canvas */
function artTexture(a: string, b: string) {
  const c = document.createElement("canvas")
  c.width = 512
  c.height = 384
  const g = c.getContext("2d")!
  const lin = g.createLinearGradient(0, 0, 512, 384)
  lin.addColorStop(0, a)
  lin.addColorStop(0.55, b)
  lin.addColorStop(1, "#15171E")
  g.fillStyle = lin
  g.fillRect(0, 0, 512, 384)
  for (const [x, y, r, o] of [
    [380, 110, 90, 0.35],
    [140, 280, 120, 0.25],
    [300, 260, 40, 0.5],
  ]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, `rgba(238,240,244,${o})`)
    rg.addColorStop(1, "rgba(238,240,244,0)")
    g.fillStyle = rg
    g.fillRect(0, 0, 512, 384)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

type ImageMat = THREE.ShaderMaterial & { zoom: number; grayscale: number }

/** Rounded picture panel (drei <Image>) with generated art, no image file needed. Hover zooms in and brings the colour up. */
export default function ImagePanel({ width = 0.32, radius = 0.06, colorA = "#9FE7D2", colorB = "#7FE3FF" }: Props) {
  const texture = useMemo(() => artTexture(colorA, colorB), [colorA, colorB])
  useEffect(() => () => texture.dispose(), [texture])
  const mesh = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)

  useFrame((_, dt) => {
    const m = mesh.current?.material as ImageMat | undefined
    if (!m) return
    m.zoom = THREE.MathUtils.damp(m.zoom, hover ? 1.18 : 1, 6, dt)
    m.grayscale = THREE.MathUtils.damp(m.grayscale, hover ? 0 : 0.35, 6, dt)
  })

  return (
    <Image
      ref={mesh}
      texture={texture}
      scale={[width, width * 0.75]}
      radius={radius}
      transparent
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    />
  )
}
