"use client"

import { useRef, useState } from "react"
import { Vector3, type Group } from "three"
import type { ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"

const W = 0.2 // track length in metres

type Props = { value?: number; onChange?: (v: number) => void; label?: string }

/** 20 cm horizontal slider, value 0–1. Drag along it (mouse, ray or fingertip). Controlled via `value`, or uncontrolled. */
export default function Slider({ value, onChange, label = "Slider" }: Props) {
  const [inner, setInner] = useState(0.5)
  const [hover, setHover] = useState(false)
  const dragging = useRef(false)
  const track = useRef<Group>(null)
  const v = Math.min(1, Math.max(0, value ?? inner))

  const setFrom = (e: ThreeEvent<PointerEvent>) => {
    if (!track.current) return
    // Local x so the slider still works when the component is moved or rotated.
    const x = track.current.worldToLocal(new Vector3().copy(e.point)).x
    const n = Math.min(1, Math.max(0, x / W + 0.5))
    if (value === undefined) setInner(n)
    onChange?.(n)
  }
  const up = () => {
    dragging.current = false
  }

  return (
    <group>
      <group ref={track}>
        {/* Generous invisible hit strip (24 x 6 cm) so fingertips and rays find it easily. */}
        <mesh
          visible={false}
          onPointerDown={(e) => {
            ;(e.target as Element).setPointerCapture(e.pointerId)
            dragging.current = true
            setFrom(e)
          }}
          onPointerMove={(e) => {
            if (dragging.current) setFrom(e)
          }}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerOver={() => setHover(true)}
          onPointerOut={() => setHover(false)}
        >
          <boxGeometry args={[W + 0.04, 0.06, 0.03]} />
        </mesh>
        <mesh>
          <boxGeometry args={[W, 0.008, 0.004]} />
          <meshStandardMaterial color="#323745" />
        </mesh>
        {/* Filled part: a unit-length bar scaled to v, left edge pinned to the track start. */}
        <mesh position={[(v / 2 - 0.5) * W, 0, 0.001]} scale={[Math.max(v, 0.001) * W, 1, 1]}>
          <boxGeometry args={[1, 0.008, 0.004]} />
          <meshStandardMaterial color="#9FE7D2" />
        </mesh>
        <mesh position={[(v - 0.5) * W, 0, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.01, 32]} />
          <meshStandardMaterial color={hover ? "#FFFFFF" : "#EEF0F4"} roughness={0.4} />
        </mesh>
      </group>
      <group position={[0, -0.045, 0]}>
        <Container pixelSize={0.002} width={W / 0.002} flexDirection="row" justifyContent="space-between">
          <Text fontSize={14} color="#EEF0F4">
            {label}
          </Text>
          <Text fontSize={14} color="#9AA0AD">
            {`${Math.round(v * 100)}`}
          </Text>
        </Container>
      </group>
    </group>
  )
}
