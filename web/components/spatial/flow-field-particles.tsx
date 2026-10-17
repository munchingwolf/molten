"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { PointMaterial } from "@react-three/drei"

type Props = {
  /** Particle count, 500–4000 (Quest-friendly) */
  count?: number
  /** Edge of the cube the particles live in, metres */
  size?: number
  speed?: number
  /** Field scale: higher = tighter swirls */
  turbulence?: number
  color?: string
  color2?: string
  paused?: boolean
  /** Tap the cloud: it scatters, then calls this */
  onPress?: () => void
}

/**
 * Cube of glowing points drifting through a divergence-free flow field (an animated ABC flow, which is its own curl,
 * so it swirls like curl noise for a few trig calls per particle). Points near your pointer or fingertip get pushed away.
 */
export default function FlowFieldParticles({
  count = 3000,
  size = 0.4,
  speed = 1,
  turbulence = 1,
  color = "#9FE7D2",
  color2 = "#7FE3FF",
  paused = false,
  onPress,
}: Props) {
  const n = Math.max(500, Math.min(4000, Math.round(count)))
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(n * 3)
    for (let i = 0; i < p.length; i++) p[i] = (Math.random() - 0.5) * size
    g.setAttribute("position", new THREE.BufferAttribute(p, 3))
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    return g
  }, [n, size])
  useEffect(() => () => geometry.dispose(), [geometry])

  // Random mix of the two colours, set once per palette change.
  useEffect(() => {
    const c = geometry.attributes.color as THREE.BufferAttribute
    const a = new THREE.Color(color)
    const b = new THREE.Color(color2)
    const t = new THREE.Color()
    for (let i = 0; i < n; i++) {
      t.copy(a).lerp(b, Math.random())
      c.setXYZ(i, t.r, t.g, t.b)
    }
    c.needsUpdate = true
  }, [geometry, n, color, color2])

  const pointer = useRef<{ p: THREE.Vector3; until: number; burst: number }>({ p: new THREE.Vector3(), until: 0, burst: 0 })
  const group = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    if (paused) return
    const dt = Math.min(delta, 1 / 30) * speed
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const p = pos.array as Float32Array
    const h = size / 2
    const k = (Math.PI * 2 * turbulence) / size // one swirl cell per `size / turbulence` metres
    const tt = clock.elapsedTime * 0.15
    const A = 1, B = 0.7, C = 0.45
    const v = 0.06 // metres per second at field strength 1
    const now = performance.now() / 1000
    const push = now < pointer.current.until
    const burst = pointer.current.burst
    pointer.current.burst *= 0.9
    const { x: px, y: py, z: pz } = pointer.current.p
    for (let i = 0; i < p.length; i += 3) {
      let x = p[i], y = p[i + 1], z = p[i + 2]
      const X = x * k + tt, Y = y * k - tt, Z = z * k + tt * 0.7
      let vx = A * Math.sin(Z) + C * Math.cos(Y)
      let vy = B * Math.sin(X) + A * Math.cos(Z)
      let vz = C * Math.sin(Y) + B * Math.cos(X)
      if (push || burst > 0.01) {
        const dx = x - px, dy = y - py, dz = z - pz
        const d2 = dx * dx + dy * dy + dz * dz + 1e-4
        const f = (push ? 0.0006 : 0) / d2 + burst * 0.4
        const inv = f / Math.sqrt(d2)
        vx += dx * inv; vy += dy * inv; vz += dz * inv
      }
      x += vx * v * dt; y += vy * v * dt; z += vz * v * dt
      // Wrap around the cube so density stays even.
      if (x > h) x -= size; else if (x < -h) x += size
      if (y > h) y -= size; else if (y < -h) y += size
      if (z > h) z -= size; else if (z < -h) z += size
      p[i] = x; p[i + 1] = y; p[i + 2] = z
    }
    pos.needsUpdate = true
  })

  const local = (e: { point: THREE.Vector3 }) => group.current?.worldToLocal(pointer.current.p.copy(e.point))

  return (
    <group ref={group}>
      <points geometry={geometry} frustumCulled={false} raycast={() => null}>
        <PointMaterial vertexColors size={0.006} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      {/* Invisible hit volume: hover pushes points away, a tap scatters them. */}
      <mesh
        visible={false}
        onPointerMove={(e) => {
          local(e)
          pointer.current.until = performance.now() / 1000 + 0.2
        }}
        onClick={(e) => {
          local(e)
          pointer.current.burst = 1
          onPress?.()
        }}
      >
        <boxGeometry args={[size, size, size]} />
      </mesh>
    </group>
  )
}
