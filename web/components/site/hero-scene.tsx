"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { useRef, type ReactNode } from "react"
import type { Group } from "three"
import SettingsDefault from "@/components/spatial/settings-default"
import SettingsGlass from "@/components/spatial/settings-glass"
import SettingsHorizon from "@/components/spatial/settings-horizon"

/** The hero: the three real Settings styles floating in one live scene. */
export function HeroScene() {
  return (
    <Canvas camera={{ position: [0, 0, 2.6], fov: 38 }} gl={{ antialias: true, alpha: true, localClippingEnabled: true }}>
      <Drift position={[-0.95, -0.05, -0.5]} rotationY={0.45} phase={0}>
        <SettingsHorizon />
      </Drift>
      <Drift position={[0.95, -0.2, -0.4]} rotationY={-0.45} phase={2}>
        <SettingsDefault />
      </Drift>
      <Drift position={[0, 0.08, 0.25]} rotationY={-0.06} phase={4}>
        <SettingsGlass />
      </Drift>
    </Canvas>
  )
}

function Drift({
  position,
  rotationY,
  phase,
  children,
}: {
  position: [number, number, number]
  rotationY: number
  phase: number
  children: ReactNode
}) {
  const ref = useRef<Group>(null)
  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  useFrame(({ clock }) => {
    if (!ref.current || still) return
    const t = clock.elapsedTime * 0.7 + phase
    ref.current.position.y = position[1] + Math.sin(t) * 0.035
    ref.current.rotation.y = rotationY + Math.sin(t * 0.6) * 0.04
  })
  return (
    <group ref={ref} position={position} rotation={[0.05, rotationY, 0]}>
      {children}
    </group>
  )
}
