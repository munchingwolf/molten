"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import type { ThreeEvent } from "@react-three/fiber"
import { Decal } from "@react-three/drei"

type Props = {
  /** Ball colour */
  color?: string
  /** Sticker colour */
  stickerColor?: string
  /** Ball diameter in metres */
  size?: number
  /** Sticker size relative to the ball (0.1–0.8) */
  stickerSize?: number
}

const MAX_STICKERS = 6

/** A star sticker painted on a canvas */
function stickerTexture(color: string) {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  g.fillStyle = color
  g.beginPath()
  g.arc(64, 64, 60, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = "#15171E"
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 ? 18 : 42
    g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r)
  }
  g.closePath()
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A ball you can stick stickers on (drei <Decal>): tap anywhere on it to project a star sticker onto the surface. */
export default function DecalObject({ color = "#EEF0F4", stickerColor = "#9FE7D2", size = 0.16, stickerSize = 0.35 }: Props) {
  const texture = useMemo(() => stickerTexture(stickerColor), [stickerColor])
  useEffect(() => () => texture.dispose(), [texture])
  const ball = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const [stickers, setStickers] = useState<[number, number, number][]>([[0, 0, size / 2]])

  const stick = (e: ThreeEvent<MouseEvent>) => {
    const b = ball.current
    if (!b) return
    const p = b.worldToLocal(e.point.clone())
    setStickers((s) => [...s, [p.x, p.y, p.z] as [number, number, number]].slice(-MAX_STICKERS))
  }

  const s = size * stickerSize
  return (
    <mesh
      ref={ball}
      onClick={stick}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <sphereGeometry args={[size / 2, 48, 32]} />
      <meshStandardMaterial color={color} roughness={hover ? 0.25 : 0.45} />
      {stickers.map((p, i) => (
        <Decal key={`${i}-${p.join()}`} position={p} scale={[s, s, s]} map={texture} />
      ))}
    </mesh>
  )
}
