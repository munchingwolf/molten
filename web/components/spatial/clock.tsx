"use client"

import { useLayoutEffect, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Object3D, type Group, type InstancedMesh } from "three"

type Props = { color?: string }

const R = 0.15 // case radius: a 30 cm wall clock

/** 30 cm analog wall clock that shows the real local time, with a smooth sweeping second hand. `color` sets the case. */
export default function Clock({ color = "#2A2F3A" }: Props) {
  const hours = useRef<InstancedMesh>(null)
  const minutes = useRef<InstancedMesh>(null)
  const hourHand = useRef<Group>(null)
  const minuteHand = useRef<Group>(null)
  const secondHand = useRef<Group>(null)

  useLayoutEffect(() => {
    const d = new Object3D()
    let h = 0
    let m = 0
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2
      const hour = i % 5 === 0
      const r = hour ? 0.118 : 0.124
      d.position.set(Math.sin(a) * r, Math.cos(a) * r, 0)
      d.rotation.set(0, 0, -a)
      d.scale.set(1, i % 15 === 0 ? 1.4 : 1, 1)
      d.updateMatrix()
      if (hour) hours.current?.setMatrixAt(h++, d.matrix)
      else minutes.current?.setMatrixAt(m++, d.matrix)
    }
    if (hours.current) hours.current.instanceMatrix.needsUpdate = true
    if (minutes.current) minutes.current.instanceMatrix.needsUpdate = true
  }, [])

  useFrame(() => {
    const now = new Date()
    const s = now.getSeconds() + now.getMilliseconds() / 1000
    const m = now.getMinutes() + s / 60
    const h = (now.getHours() % 12) + m / 60
    const TAU = Math.PI * 2
    if (secondHand.current) secondHand.current.rotation.z = -(s / 60) * TAU
    if (minuteHand.current) minuteHand.current.rotation.z = -(m / 60) * TAU
    if (hourHand.current) hourHand.current.rotation.z = -(h / 12) * TAU
  })

  return (
    <group>
      {/* Case */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, 0.036, 64]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.018]}>
        <torusGeometry args={[R - 0.006, 0.006, 10, 64]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Dial */}
      <mesh position={[0, 0, 0.0182]}>
        <circleGeometry args={[R - 0.011, 64]} />
        <meshStandardMaterial color="#0B0C10" roughness={0.6} />
      </mesh>
      <group position={[0, 0, 0.0186]}>
        <instancedMesh ref={hours} args={[undefined, undefined, 12]}>
          <planeGeometry args={[0.005, 0.018]} />
          <meshBasicMaterial color="#EEF0F4" />
        </instancedMesh>
        <instancedMesh ref={minutes} args={[undefined, undefined, 48]}>
          <planeGeometry args={[0.0018, 0.006]} />
          <meshBasicMaterial color="#6B7180" />
        </instancedMesh>
      </group>
      {/* Hands: each group pivots at the centre and turns clockwise. */}
      <group ref={hourHand} position={[0, 0, 0.022]}>
        <mesh position={[0, 0.026, 0]}>
          <boxGeometry args={[0.008, 0.07, 0.002]} />
          <meshStandardMaterial color="#EEF0F4" roughness={0.4} />
        </mesh>
      </group>
      <group ref={minuteHand} position={[0, 0, 0.0245]}>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.0055, 0.104, 0.002]} />
          <meshStandardMaterial color="#EEF0F4" roughness={0.4} />
        </mesh>
      </group>
      <group ref={secondHand} position={[0, 0, 0.027]}>
        <mesh position={[0, 0.036, 0]}>
          <boxGeometry args={[0.002, 0.12, 0.0015]} />
          <meshBasicMaterial color="#9FE7D2" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.022, 0]}>
          <circleGeometry args={[0.006, 20]} />
          <meshBasicMaterial color="#9FE7D2" toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.0285]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.003, 20]} />
        <meshStandardMaterial color="#9FE7D2" roughness={0.3} />
      </mesh>
      {/* Glass: a faint sheen, no transmission (cheap on Quest). */}
      <mesh position={[0, 0, 0.031]}>
        <circleGeometry args={[R - 0.008, 64]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.06} roughness={0.05} metalness={0.2} depthWrite={false} />
      </mesh>
    </group>
  )
}
