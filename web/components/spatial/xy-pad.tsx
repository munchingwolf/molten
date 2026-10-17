"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, type Group } from "three"
import type { ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

const SURFACE = "#15171E"
const STAGE = "#0D0F14"
const BORDER = "#242833"
const MUTED = "#9AA0AD"
const ACCENT = "#9FE7D2"

const S = 0.2 // plate size, metres
const PAD = 0.18 // touch surface
const R = 0.013 // puck radius
const HALF = PAD / 2 - R // puck travel either side of centre
const FRONT = 0.006

type Props = {
  x?: number
  y?: number
  onXChange?: (x: number) => void
  onYChange?: (y: number) => void
  onChange?: (x: number, y: number) => void
  label?: string
  color?: string
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** 20 cm XY pad: drag the glowing puck to set two values at once (0-1 each). Controlled via `x` / `y`, or uncontrolled. */
export default function XyPad({ x, y, onXChange, onYChange, onChange, label = "XY Pad", color = ACCENT }: Props) {
  const [inner, setInner] = useState({ x: 0.5, y: 0.5 })
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const root = useRef<Group>(null)
  const dragId = useRef<number | null>(null)
  const vx = clamp01(x ?? inner.x)
  const vy = clamp01(y ?? inner.y)

  const plate = useMemo(() => new RoundedBoxGeometry(S, S, 0.012, 4, 0.012), [])
  const grid = useMemo(() => {
    const p: number[] = []
    for (let i = 1; i < 8; i++) {
      const k = -PAD / 2 + (i / 8) * PAD
      p.push(k, -PAD / 2, 0, k, PAD / 2, 0, -PAD / 2, k, 0, PAD / 2, k, 0)
    }
    return new BufferGeometry().setAttribute("position", new Float32BufferAttribute(p, 3))
  }, [])
  useEffect(() => () => (plate.dispose(), grid.dispose()), [plate, grid])

  const setFrom = (e: ThreeEvent<PointerEvent>) => {
    if (!root.current) return
    const p = root.current.worldToLocal(e.point.clone())
    const nx = clamp01((p.x + HALF) / (2 * HALF))
    const ny = clamp01((p.y + HALF) / (2 * HALF))
    setInner({ x: nx, y: ny }) // only read while uncontrolled
    onXChange?.(nx)
    onYChange?.(ny)
    onChange?.(nx, ny)
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragId.current = e.pointerId
    setActive(true)
    setFrom(e)
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (dragId.current === e.pointerId) setFrom(e)
  }
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (dragId.current !== e.pointerId) return
    dragId.current = null
    setActive(false)
  }

  const px = -HALF + vx * 2 * HALF
  const py = -HALF + vy * 2 * HALF
  const lit = active || hover

  return (
    <group ref={root}>
      <mesh geometry={plate}>
        <meshStandardMaterial color={SURFACE} roughness={0.75} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, FRONT + 0.0004]}>
        <planeGeometry args={[PAD, PAD]} />
        <meshStandardMaterial color={STAGE} roughness={0.9} />
      </mesh>
      <lineSegments geometry={grid} position={[0, 0, FRONT + 0.0008]}>
        <lineBasicMaterial color={BORDER} />
      </lineSegments>
      {/* crosshair through the puck */}
      <mesh position={[px, 0, FRONT + 0.001]}>
        <planeGeometry args={[0.0012, PAD]} />
        <meshBasicMaterial color={color} transparent opacity={lit ? 0.55 : 0.25} />
      </mesh>
      <mesh position={[0, py, FRONT + 0.001]}>
        <planeGeometry args={[PAD, 0.0012]} />
        <meshBasicMaterial color={color} transparent opacity={lit ? 0.55 : 0.25} />
      </mesh>
      <group position={[px, py, FRONT]}>
        <mesh position={[0, 0, 0.0012]}>
          <ringGeometry args={[R, R + (active ? 0.014 : 0.008), 48]} />
          <meshBasicMaterial color={color} transparent opacity={active ? 0.45 : lit ? 0.25 : 0.12} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R, R, 0.01, 40]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.2} emissive={color} emissiveIntensity={active ? 0.7 : lit ? 0.35 : 0.15} />
        </mesh>
      </group>
      {/* Static hit surface in front of the puck: drag anywhere on the pad. */}
      <mesh
        visible={false}
        position={[0, 0, 0.01]}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[PAD, PAD, 0.016]} />
      </mesh>
      <group position={[0, -S / 2 - 0.024, 0]}>
        <Container pixelSize={0.002} flexDirection="row" alignItems="center" gap={14} pointerEvents="none">
          <Text fontSize={12} color={MUTED}>
            {label}
          </Text>
          <Text fontSize={12} color={lit ? color : MUTED}>
            {`X ${vx.toFixed(2)}  Y ${vy.toFixed(2)}`}
          </Text>
        </Container>
      </group>
    </group>
  )
}
