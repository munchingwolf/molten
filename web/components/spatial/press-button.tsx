"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Group } from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

const DEPTH = 0.006 // metres the cap travels on press

type Props = { label?: string; onPress?: () => void; color?: string }

/** 8 cm physical button: the cap sinks 6 mm while held and springs back. Fires onPress on click. */
export default function PressButton({ label = "Press", onPress, color = "#9FE7D2" }: Props) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const cap = useRef<Group>(null)
  const geometry = useMemo(() => new RoundedBoxGeometry(0.08, 0.04, 0.016, 4, 0.008), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, dt) => {
    const g = cap.current
    if (g) g.position.z += ((down ? -DEPTH : 0) - g.position.z) * Math.min(1, dt * 30)
  })

  const up = () => setDown(false)

  return (
    <group>
      {/* Static hit box: the cap moves back on press, the hit surface must not, or a poke would re-trigger. */}
      <mesh
        visible={false}
        position={[0, 0, 0.004]}
        onClick={() => onPress?.()}
        onPointerDown={() => setDown(true)}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => {
          setHover(false)
          up()
        }}
      >
        <boxGeometry args={[0.08, 0.04, 0.024]} />
      </mesh>
      <mesh position={[0, 0, -0.012]}>
        <boxGeometry args={[0.088, 0.048, 0.006]} />
        <meshStandardMaterial color="#15171E" roughness={0.7} />
      </mesh>
      <group ref={cap}>
        <mesh geometry={geometry}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.25 : 0.05} roughness={0.5} />
        </mesh>
        <group position={[0, 0, 0.0085]}>
          <Container pixelSize={0.002}>
            <Text fontSize={14} fontWeight="semi-bold" color="#06221B">
              {label}
            </Text>
          </Container>
        </group>
      </group>
    </group>
  )
}
