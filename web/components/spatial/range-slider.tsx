"use client"

import { useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import type { Group } from "three"

type Props = {
  low?: number
  high?: number
  onLowChange?: (v: number) => void
  onHighChange?: (v: number) => void
  /** Fires with both ends whenever either moves. */
  onChange?: (v: [number, number]) => void
  min?: number
  max?: number
  step?: number
  label?: string
  color?: string
  size?: number
}

const L = 0.24 // 24 cm track
const T = 0.014 // thumb radius: 2.8 cm across

/** 24 cm two-thumb range slider. Drag either thumb (or tap the track to move the nearest one); thumbs lift toward you while held. */
export default function RangeSlider({
  low, high, onLowChange, onHighChange, onChange, min = 0, max = 100, step = 1, label = "Range", color = "#9FE7D2", size = 1,
}: Props) {
  const span = max - min || 1
  const [inner, setInner] = useState<[number, number]>([min + span * 0.25, min + span * 0.75])
  const lo = Math.min(max, Math.max(min, low ?? inner[0]))
  const hi = Math.min(max, Math.max(lo, high ?? inner[1]))
  const t0 = (lo - min) / span
  const t1 = (hi - min) / span
  const decimals = (String(step).split(".")[1] ?? "").length
  const root = useRef<Group>(null)
  const thumbs = [useRef<Group>(null), useRef<Group>(null)]
  const st = useRef({ drag: -1, hover: false, z: [0, 0], zv: [0, 0] })

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    for (let i = 0; i < 2; i++) {
      const to = s.drag === i ? 0.012 : s.hover ? 0.004 : 0
      s.zv[i] += (380 * (to - s.z[i]) - 20 * s.zv[i]) * dt
      s.z[i] += s.zv[i] * dt
      const g = thumbs[i].current
      if (g) {
        g.position.z = s.z[i]
        g.scale.setScalar(1 + s.z[i] * 15)
      }
    }
  })

  const valueAt = (e: ThreeEvent<PointerEvent>) => {
    const x = root.current ? root.current.worldToLocal(e.point.clone()).x : 0
    const t = Math.min(1, Math.max(0, x / L + 0.5))
    return +(Math.round((min + t * span) / step) * step).toFixed(decimals)
  }
  const apply = (which: number, v: number) => {
    const next: [number, number] = which === 0 ? [Math.min(v, hi), hi] : [lo, Math.max(v, lo)]
    if (next[0] === lo && next[1] === hi) return
    if (low === undefined && high === undefined) setInner(next)
    if (which === 0) onLowChange?.(next[0])
    else onHighChange?.(next[1])
    onChange?.(next)
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const v = valueAt(e)
    st.current.drag = Math.abs(v - lo) <= Math.abs(v - hi) && !(v > hi) ? 0 : 1
    apply(st.current.drag, v)
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const s = st.current
    if (s.drag < 0) return
    const v = valueAt(e)
    if (lo === hi) s.drag = v > hi ? 1 : v < lo ? 0 : s.drag // stacked thumbs: the drag direction picks which one moves
    apply(s.drag, v)
  }
  const up = () => {
    st.current.drag = -1
  }

  const fill = Math.max(0.0001, (t1 - t0) * L)
  return (
    <group scale={size}>
      <group ref={root}>
        <group position={[-L / 2, 0.034, 0]}>
          <Container pixelSize={0.002} anchorX="left" pointerEvents="none">
            <Text fontSize={10} fontWeight="medium" color="#9AA0AD">
              {label}
            </Text>
          </Container>
        </group>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.004, 0.004, L, 16]} />
          <meshStandardMaterial color="#242833" emissive="#15171E" roughness={0.6} />
        </mesh>
        <mesh position={[(t0 + t1) / 2 * L - L / 2, 0, 0.0005]} rotation={[0, 0, Math.PI / 2]} scale={[1, fill, 1]}>
          <cylinderGeometry args={[0.0055, 0.0055, 1, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
        {[t0, t1].map((t, i) => (
          <group key={i} position={[t * L - L / 2, 0, 0]}>
            <group ref={thumbs[i]}>
              <mesh>
                <sphereGeometry args={[T, 32, 16]} />
                <meshStandardMaterial color="#EEF0F4" emissive="#9AA0AD" emissiveIntensity={0.35} roughness={0.3} metalness={0.1} />
              </mesh>
              <mesh position={[0, 0, T * 0.92]}>
                <circleGeometry args={[0.004, 24]} />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
            </group>
            <group position={[0, -0.03, 0]}>
              <Container pixelSize={0.002} pointerEvents="none">
                <Text fontSize={10} fontWeight="semi-bold" color="#EEF0F4">
                  {(i === 0 ? lo : hi).toFixed(decimals)}
                </Text>
              </Container>
            </group>
          </group>
        ))}
        {/* One hit strip for the whole track: picks the nearest thumb, then drags it with the pointer captured. */}
        <mesh
          visible={false}
          onPointerOver={() => (st.current.hover = true)}
          onPointerOut={() => (st.current.hover = false)}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <boxGeometry args={[L + 2 * T, 0.04, 2 * T + 0.002]} />
        </mesh>
      </group>
    </group>
  )
}
