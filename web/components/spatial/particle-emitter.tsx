"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { PointMaterial } from "@react-three/drei"

type Mode = "fountain" | "burst"
const MAX = 1500

type Props = {
  /** fountain = continuous stream, burst = only when tapped */
  mode?: Mode
  /** Particles per second in fountain mode */
  rate?: number
  /** Particles per tap */
  burst?: number
  color?: string
  /** Colour particles fade towards before they die */
  color2?: string
  /** Launch speed, m/s */
  speed?: number
  /** Cone half-angle in degrees */
  spread?: number
  gravity?: number
  /** Seconds a particle lives */
  lifetime?: number
  paused?: boolean
  onPress?: () => void
}

/** Particle emitter on a 7 cm nozzle: a steady fountain or tap-triggered bursts, with colour, rate and spread props. Tap the nozzle to burst. */
export default function ParticleEmitter({
  mode = "fountain",
  rate = 200,
  burst = 300,
  color = "#9FE7D2",
  color2 = "#7FE3FF",
  speed = 0.8,
  spread = 18,
  gravity = 1.2,
  lifetime = 1.4,
  paused = false,
  onPress,
}: Props) {
  const [hover, setHover] = useState(false)
  const sim = useMemo(() => ({ vel: new Float32Array(MAX * 3), age: new Float32Array(MAX).fill(Infinity), next: 0, carry: 0, pending: 0 }), [])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3))
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const cols = useMemo(() => ({ a: new THREE.Color(), b: new THREE.Color(), t: new THREE.Color() }), [])

  useFrame((_, delta) => {
    if (paused) return
    const dt = Math.min(delta, 1 / 30)
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const col = geometry.attributes.color as THREE.BufferAttribute
    const p = pos.array as Float32Array
    const c = col.array as Float32Array
    const life = Math.max(0.1, lifetime)
    cols.a.set(color)
    cols.b.set(color2)

    if (mode === "fountain") sim.carry += Math.max(0, rate) * dt
    let spawn = Math.floor(sim.carry) + sim.pending
    sim.carry -= Math.floor(sim.carry)
    sim.pending = 0
    spawn = Math.min(spawn, MAX)
    const cone = (Math.max(0, Math.min(90, spread)) * Math.PI) / 180
    while (spawn-- > 0) {
      // Ring buffer: the oldest particle is recycled.
      const i = sim.next
      sim.next = (sim.next + 1) % MAX
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(1 - Math.random() * (1 - Math.cos(cone)))
      const s = speed * (0.75 + Math.random() * 0.5)
      sim.vel[i * 3] = Math.sin(ph) * Math.cos(th) * s
      sim.vel[i * 3 + 1] = Math.cos(ph) * s
      sim.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s
      p[i * 3] = 0
      p[i * 3 + 1] = 0.035
      p[i * 3 + 2] = 0
      sim.age[i] = Math.random() * dt
    }

    for (let i = 0; i < MAX; i++) {
      const a = (sim.age[i] += dt)
      const k = i * 3
      if (a >= life) {
        // Dead: black under additive blending is invisible.
        c[k] = c[k + 1] = c[k + 2] = 0
        continue
      }
      sim.vel[k + 1] -= gravity * dt
      p[k] += sim.vel[k] * dt
      p[k + 1] += sim.vel[k + 1] * dt
      p[k + 2] += sim.vel[k + 2] * dt
      const f = a / life
      cols.t.copy(cols.a).lerp(cols.b, f).multiplyScalar(1 - f * f)
      c[k] = cols.t.r
      c[k + 1] = cols.t.g
      c[k + 2] = cols.t.b
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  })

  return (
    <group>
      <points geometry={geometry} frustumCulled={false} raycast={() => null}>
        <PointMaterial vertexColors size={0.008} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <mesh
        position={[0, 0.015, 0]}
        onClick={() => {
          sim.pending += Math.max(1, Math.round(burst))
          onPress?.()
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <cylinderGeometry args={[0.025, 0.035, 0.03, 32]} />
        <meshStandardMaterial color="#15171E" roughness={0.5} metalness={0.4} emissive={color} emissiveIntensity={hover ? 0.25 : 0.05} />
      </mesh>
      <mesh position={[0, 0.0305, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[0.018, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}
