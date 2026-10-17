"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { CatmullRomCurve3, Color, Object3D, TubeGeometry, Vector3, type Group, type InstancedMesh } from "three"

type Props = {
  /** Distance between the two hooks, metres. */
  span?: number
  /** How far the middle hangs below the hooks, metres. */
  sag?: number
  bulbs?: number
  mode?: "warm" | "party"
  value?: boolean
  onChange?: (on: boolean) => void
}

const WARM = new Color("#FFC98A")
const OFF = new Color("#3A342C")

/** y of a catenary-like sag at t ∈ [0, 1] (parabola: indistinguishable at these spans). */
const droop = (t: number, sag: number) => -4 * sag * t * (1 - t)

/**
 * Festoon string lights hung between two hooks (origin = midpoint between the hooks). Bulbs twinkle out of phase;
 * tap to switch them (value/onChange). "party" cycles the colours along the string. The wire sways gently.
 */
export default function StringLights({ span = 2.4, sag = 0.28, bulbs = 18, mode = "warm", value, onChange }: Props) {
  const [local, setLocal] = useState(true)
  const on = value ?? local
  const n = Math.max(4, Math.min(48, Math.round(bulbs)))
  const sway = useRef<Group>(null)
  const glass = useRef<InstancedMesh>(null)
  const caps = useRef<InstancedMesh>(null)
  const lit = useRef(on ? 1 : 0)
  const phases = useMemo(() => Array.from({ length: n }, (_, i) => (i * 2.399) % (Math.PI * 2)), [n])

  const wire = useMemo(() => {
    const pts = Array.from({ length: 24 }, (_, i) => {
      const t = i / 23
      return new Vector3((t - 0.5) * span, droop(t, sag), 0)
    })
    return new TubeGeometry(new CatmullRomCurve3(pts), 96, 0.0025, 6, false)
  }, [span, sag])

  // Bulbs hang 3 cm under the wire, evenly spaced between the hooks.
  useLayoutEffect(() => {
    const d = new Object3D()
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = (t - 0.5) * span
      const y = droop(t, sag)
      d.position.set(x, y - 0.045, 0)
      d.scale.set(1, 1.25, 1)
      d.updateMatrix()
      glass.current?.setMatrixAt(i, d.matrix)
      d.position.set(x, y - 0.018, 0)
      d.scale.set(1, 1, 1)
      d.updateMatrix()
      caps.current?.setMatrixAt(i, d.matrix)
    }
    if (glass.current) glass.current.instanceMatrix.needsUpdate = true
    if (caps.current) caps.current.instanceMatrix.needsUpdate = true
  }, [n, span, sag])

  const c = useMemo(() => new Color(), [])
  useFrame((state, dt) => {
    const time = state.clock.elapsedTime
    lit.current += ((on ? 1 : 0) - lit.current) * (1 - Math.exp(-Math.min(dt, 0.05) * 6))
    const g = glass.current
    if (g) {
      for (let i = 0; i < n; i++) {
        const twinkle = 0.82 + 0.18 * Math.sin(time * 2.1 + phases[i]) * Math.sin(time * 0.7 + phases[i] * 1.7)
        if (mode === "party") c.setHSL((i / n + time * 0.08) % 1, 0.85, 0.62)
        else c.copy(WARM)
        c.lerp(OFF, 1 - lit.current * twinkle)
        g.setColorAt(i, c)
      }
      if (g.instanceColor) g.instanceColor.needsUpdate = true
    }
    if (sway.current) sway.current.rotation.x = Math.sin(time * 0.9) * 0.03 * (1 + sag)
    state.invalidate()
  })

  const toggle = () => {
    const next = !on
    setLocal(next)
    onChange?.(next)
  }

  return (
    <group onClick={toggle}>
      {/* Hooks */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * span) / 2, 0, 0]}>
          <torusGeometry args={[0.012, 0.003, 8, 24]} />
          <meshStandardMaterial color="#8A8F99" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <group ref={sway}>
        <mesh geometry={wire}>
          <meshStandardMaterial color="#1B1C1F" roughness={0.7} />
        </mesh>
        <instancedMesh ref={caps} args={[undefined, undefined, n]}>
          <cylinderGeometry args={[0.007, 0.007, 0.016, 12]} />
          <meshStandardMaterial color="#222327" roughness={0.6} />
        </instancedMesh>
        <instancedMesh ref={glass} args={[undefined, undefined, n]}>
          <sphereGeometry args={[0.019, 16, 12]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {/* A few real lights along the string, so it actually lights the scene. */}
        {[0.2, 0.5, 0.8].map((t) => (
          <pointLight key={t} position={[(t - 0.5) * span, droop(t, sag) - 0.06, 0]} color="#FFC98A" intensity={on ? 0.5 : 0} distance={2.2} decay={2} />
        ))}
      </group>
    </group>
  )
}
