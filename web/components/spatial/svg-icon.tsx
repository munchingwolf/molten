"use client"

import { Suspense, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Svg } from "@react-three/drei"

type Props = {
  /** Bolt colour */
  color?: string
  /** Ring colour */
  ringColor?: string
  /** Icon width in metres */
  size?: number
  /** Idle sway speed */
  speed?: number
}

// Inline icon: a ring and a lightning bolt in a 100×100 viewBox. Colours are overridden by the material props.
const ICON = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="44" fill="none" stroke="#fff" stroke-width="6"/>
    <path d="M56 14 L28 56 L47 56 L42 86 L72 42 L53 42 Z" fill="#fff"/>
  </svg>`,
)}`

/** A flat vector icon parsed from an inline SVG (drei <Svg>). Sways gently, hover grows it, tap flips it. */
export default function SvgIcon({ color = "#9FE7D2", ringColor = "#7FE3FF", size = 0.15, speed = 1 }: Props) {
  const g = useRef<THREE.Group>(null)
  const flip = useRef(0)
  const [hover, setHover] = useState(false)
  const s = size / 100

  useFrame((state, dt) => {
    const o = g.current
    if (!o) return
    o.rotation.y = THREE.MathUtils.damp(o.rotation.y, flip.current + Math.sin(state.clock.elapsedTime * speed) * 0.25, 6, dt)
    o.scale.setScalar(THREE.MathUtils.damp(o.scale.x, hover ? 1.1 : 1, 10, dt))
  })

  return (
    <group
      ref={g}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => (flip.current += Math.PI * 2)}
    >
      <Suspense fallback={null}>
        <Svg
          src={ICON}
          scale={s}
          position={[-size / 2, size / 2, 0]}
          fillMaterial={{ color }}
          strokeMaterial={{ color: ringColor }}
        />
      </Suspense>
    </group>
  )
}
