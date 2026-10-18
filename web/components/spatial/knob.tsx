"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, Color, InstancedMesh, Object3D, RingGeometry, SRGBColorSpace, type Group } from "three"
import { Container, Text } from "@react-three/uikit"

const SWEEP = 1.5 * Math.PI // 270 degrees from min to max
const DRAG_RANGE = 0.15 // metres of vertical drag for the full min-max range
const R = 0.03 // knob radius: 6 cm, finger-sized
const TICKS = 11
const RIDGES = 40
const ACCENT = "#9FE7D2"

type Props = { value?: number; onChange?: (v: number) => void; label?: string; min?: number; max?: number; accent?: string }

let metal: CanvasTexture | undefined
// Lights vary per scene; a generated brushed-metal matcap shades the knob the same everywhere.
function getMetal() {
  if (metal) return metal
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(100, 80, 4, 128, 128, 150)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.25, "#d9dce2")
  grad.addColorStop(0.6, "#7d828c")
  grad.addColorStop(0.9, "#2a2d33")
  grad.addColorStop(1, "#16181c")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  // soft rim light from below
  const rim = g.createRadialGradient(150, 230, 0, 150, 230, 90)
  rim.addColorStop(0, "#9fb3c8aa")
  rim.addColorStop(1, "#00000000")
  g.fillStyle = rim
  g.fillRect(0, 0, 256, 256)
  metal = new CanvasTexture(c)
  metal.colorSpace = SRGBColorSpace
  return metal
}

/** 6 cm machined knob on a dial plate. Drag up/down (mouse, ray or fingertip) to turn; the cap glides to the value. `value` is in min-max units (default 0-1). */
export default function Knob({ value, onChange, label = "Knob", min = 0, max = 1, accent = ACCENT }: Props) {
  const span = max - min || 1
  const [inner, setInner] = useState(min + span / 2)
  const [hover, setHover] = useState(false)
  const [held, setHeld] = useState(false)
  const drag = useRef<{ y: number; t: number } | null>(null)
  const v = Math.min(max, Math.max(min, value ?? inner))
  const t = (v - min) / span // 0-1 position of the dial
  const mc = useMemo(getMetal, [])

  const set = (n: number) => {
    const c = min + Math.min(1, Math.max(0, n)) * span
    if (value === undefined) setInner(c)
    onChange?.(c)
  }

  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { y: e.point.y, t }
    setHeld(true)
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (drag.current) set(drag.current.t + (e.point.y - drag.current.y) / DRAG_RANGE)
  }
  const up = () => {
    drag.current = null
    setHeld(false)
  }

  // Eased glide of the cap toward the value, plus hover lift and press dip.
  const cap = useRef<Group>(null)
  const anim = useRef({ a: SWEEP / 2 - t * SWEEP, z: 0 })
  useFrame((state, delta) => {
    const g = cap.current
    if (!g) return
    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 16)
    const s = anim.current
    const ta = SWEEP / 2 - t * SWEEP
    const tz = held ? -0.002 : hover ? 0.004 : 0
    s.a += (ta - s.a) * k
    s.z += (tz - s.z) * k
    g.rotation.z = s.a
    g.position.z = s.z
    if (Math.abs(ta - s.a) > 1e-4 || Math.abs(tz - s.z) > 1e-5) state.invalidate()
  })

  // Value arc around the knob, rebuilt only when the value changes.
  const arc = useMemo(() => new RingGeometry(R + 0.008, R + 0.011, 48, 1, Math.PI / 2 + SWEEP / 2 - t * SWEEP, Math.max(0.0001, t * SWEEP)), [t])
  useEffect(() => () => arc.dispose(), [arc])
  const track = useMemo(() => new RingGeometry(R + 0.008, R + 0.011, 64, 1, Math.PI / 2 - SWEEP / 2, SWEEP), [])
  useEffect(() => () => track.dispose(), [track])

  // Instanced tick marks and knurl ridges.
  const ticks = useRef<InstancedMesh>(null)
  const ridges = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const o = new Object3D()
    const tm = ticks.current
    if (tm) {
      for (let i = 0; i < TICKS; i++) {
        const a = Math.PI / 2 + SWEEP / 2 - (i / (TICKS - 1)) * SWEEP
        const r = R + 0.017
        o.position.set(Math.cos(a) * r, Math.sin(a) * r, 0)
        o.rotation.set(0, 0, a)
        o.scale.set(i % 5 === 0 ? 1.6 : 1, 1, 1)
        o.updateMatrix()
        tm.setMatrixAt(i, o.matrix)
      }
      tm.instanceMatrix.needsUpdate = true
    }
    const rm = ridges.current
    if (rm) {
      for (let i = 0; i < RIDGES; i++) {
        const a = (i / RIDGES) * Math.PI * 2
        o.position.set(Math.cos(a) * R, Math.sin(a) * R, -0.0015)
        o.rotation.set(0, 0, a)
        o.scale.set(1, 1, 1)
        o.updateMatrix()
        rm.setMatrixAt(i, o.matrix)
      }
      rm.instanceMatrix.needsUpdate = true
    }
  }, [])
  // Ticks the value has passed light up in the accent colour.
  const lit = useMemo(() => new Color(accent), [accent])
  const dim = useMemo(() => new Color("#4A505E"), [])
  useLayoutEffect(() => {
    const tm = ticks.current
    if (!tm) return
    for (let i = 0; i < TICKS; i++) tm.setColorAt(i, i / (TICKS - 1) <= t + 1e-6 ? lit : dim)
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true
  }, [t, lit, dim])

  const shown = span > 1 ? `${Math.round(v)}` : `${Math.round(t * 100)}`

  return (
    <group>
      {/* Dial plate */}
      <mesh position={[0, 0, -0.016]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R + 0.026, R + 0.027, 0.004, 64]} />
        <meshMatcapMaterial matcap={mc} color="#3A3F4B" />
      </mesh>
      <mesh geometry={track} position={[0, 0, -0.0138]}>
        <meshBasicMaterial color="#1A1D24" />
      </mesh>
      <mesh geometry={arc} position={[0, 0, -0.0136]}>
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <instancedMesh ref={ticks} args={[undefined, undefined, TICKS]} position={[0, 0, -0.0136]}>
        <planeGeometry args={[0.005, 0.0012]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Knob: drag target (6 cm across) */}
      <group
        ref={cap}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        {/* knurled body */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.002]}>
          <cylinderGeometry args={[R * 0.97, R, 0.022, 64]} />
          <meshMatcapMaterial matcap={mc} color={hover ? "#B9BEC8" : "#9AA0AB"} />
        </mesh>
        <instancedMesh ref={ridges} args={[undefined, undefined, RIDGES]}>
          <boxGeometry args={[0.0016, 0.0022, 0.019]} />
          <meshMatcapMaterial matcap={mc} color="#6E747F" />
        </instancedMesh>
        {/* machined face with a chamfer */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.0095]}>
          <cylinderGeometry args={[R * 0.86, R * 0.95, 0.003, 64]} />
          <meshMatcapMaterial matcap={mc} color="#D4D8DF" />
        </mesh>
        {/* indicator line */}
        <mesh position={[0, R * 0.55, 0.0112]}>
          <boxGeometry args={[0.0035, R * 0.6, 0.001]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      </group>

      <group position={[0, -(R + 0.045), 0]}>
        <Container pixelSize={0.002} width={90} flexDirection="column" alignItems="center" gap={1}>
          <Text fontSize={11} fontWeight="semi-bold" color="#EEF0F4">
            {label.toUpperCase()}
          </Text>
          <Text fontSize={10} fontWeight="medium" color={held || hover ? accent : "#9AA0AD"}>
            {shown}
          </Text>
        </Container>
      </group>
    </group>
  )
}
