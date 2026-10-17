"use client"

import { Suspense, useMemo, useState } from "react"
import * as THREE from "three"
import { Cloud, Clouds } from "@react-three/drei"

type Props = {
  color?: string
  /** Billow speed */
  speed?: number
  /** Cloud width in metres */
  size?: number
  opacity?: number
}

/** Soft white puff to soften a corner of the room */
function puffTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, "rgba(255,255,255,1)")
  r.addColorStop(0.5, "rgba(255,255,255,0.55)")
  r.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  return c.toDataURL()
}

/** A small volumetric cloud (drei <Clouds>/<Cloud>) with a procedural puff texture. Hover tints it, tap makes it billow. */
export default function CloudPuff({ color = "#EEF0F4", speed = 0.3, size = 0.3, opacity = 0.8 }: Props) {
  const texture = useMemo(puffTexture, [])
  const [hover, setHover] = useState(false)
  const [puffed, setPuffed] = useState(false)
  // drei's cloud is ~6 units wide at these settings
  const k = size / 6

  return (
    <Suspense fallback={null}>
      <Clouds
        texture={texture}
        material={THREE.MeshBasicMaterial}
        limit={24}
        scale={k}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onClick={() => setPuffed((p) => !p)}
      >
        <Cloud
          seed={7}
          segments={16}
          bounds={[3, 1, 1]}
          volume={puffed ? 4 : 3}
          growth={puffed ? 2 : 1}
          speed={speed}
          fade={0}
          opacity={opacity}
          color={hover ? "#9FE7D2" : color}
        />
      </Clouds>
    </Suspense>
  )
}
