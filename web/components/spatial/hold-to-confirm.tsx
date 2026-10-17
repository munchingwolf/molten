"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Check, Fingerprint } from "@react-three/uikit-lucide"
import { Color, LatheGeometry, ShaderMaterial, Vector2, type Group } from "three"

type Props = { label?: string; duration?: number; color?: string; size?: number; onPress?: () => void }

const R = 0.04 // 8 cm disc
const D = 0.016

// Disc with a rounded rim, facing +z (lathe profile runs bottom -> top so normals face out).
function puck(r: number, d: number, b: number) {
  const pts = [new Vector2(0, -d / 2)]
  const arc = (y: number, from: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = from + (i / 6) * (Math.PI / 2)
      pts.push(new Vector2(r - b + b * Math.cos(a), y + b * Math.sin(a)))
    }
  }
  arc(-d / 2 + b, -Math.PI / 2) // bottom rim
  arc(d / 2 - b, 0) // top rim
  pts.push(new Vector2(0, d / 2))
  return new LatheGeometry(pts, 64).rotateX(Math.PI / 2)
}

// Ring that fills clockwise from 12 o'clock up to uProgress.
const vertexShader = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`
const fragmentShader = /* glsl */ `
uniform float uProgress;
uniform vec3 uColor;
uniform vec3 uTrack;
varying vec2 vUv;
void main() {
  vec2 p = vUv - .5;
  float a = fract(atan(p.x, p.y) / 6.28318 + 1.);
  gl_FragColor = vec4(mix(uTrack, uColor, step(a, uProgress)), 1.);
  #include <colorspace_fragment>
}`

/**
 * 8 cm disc for destructive or important actions: press and hold, a ring fills around it,
 * `onPress` fires only when it completes. Letting go early drains the ring.
 */
export default function HoldToConfirm({ label = "Hold to confirm", duration = 1.2, color = "#F2B48A", size = 1, onPress }: Props) {
  const disc = useRef<Group>(null)
  const [phase, setPhase] = useState<"idle" | "holding" | "done">("idle")
  const st = useRef({ progress: 0, holding: false, done: 0, z: 0, zv: 0, hover: 0, target: 0 })
  const ring = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uProgress: { value: 0 }, uColor: { value: new Color() }, uTrack: { value: new Color("#242833") } },
      }),
    [],
  )
  useEffect(() => void ring.uniforms.uColor.value.set(color), [ring, color])
  const geometry = useMemo(() => puck(R, D, 0.005), [])
  useEffect(() => () => (ring.dispose(), geometry.dispose()), [ring, geometry])

  useFrame(({ clock }, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    if (s.done > 0) {
      s.done -= dt
      if (s.done <= 0) {
        s.progress = 0
        s.holding = false // must let go and press again
        setPhase("idle")
      }
    } else if (s.holding) {
      s.progress = Math.min(1, s.progress + dt / Math.max(0.2, duration))
      if (s.progress >= 1) {
        s.done = 1.2 // show the check for 1.2 s, then reset
        setPhase("done")
        onPress?.()
      }
    } else s.progress = Math.max(0, s.progress - dt * 2.5)
    ring.uniforms.uProgress.value = s.progress
    s.hover += (s.target - s.hover) * (1 - Math.exp(-dt * 10))
    const charge = s.holding && s.done <= 0 ? 0.0007 * Math.sin(clock.elapsedTime * 60) * s.progress : 0 // builds a tremble while charging
    const rest = s.holding && s.done <= 0 ? -0.006 : s.done > 0 ? 0.004 : s.hover * 0.002
    s.zv += (380 * (rest - s.z) - 20 * s.zv) * dt
    s.z += s.zv * dt
    if (disc.current) {
      disc.current.position.set(charge, 0, s.z)
      const pop = 1 + (s.done > 0 ? 0.04 : 0)
      disc.current.scale.setScalar(pop)
    }
  })

  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (st.current.done > 0) return
    st.current.holding = true
    setPhase("holding")
  }
  const up = () => {
    if (st.current.done > 0) return
    st.current.holding = false
    setPhase("idle")
  }

  return (
    <group scale={size}>
      <mesh material={ring} position={[0, 0, -0.002]}>
        <ringGeometry args={[R + 0.003, R + 0.009, 96]} />
      </mesh>
      <group ref={disc}>
        <mesh geometry={geometry}>
          <meshStandardMaterial color={phase === "done" ? color : "#1B1E26"} emissive={phase === "done" ? color : "#15171E"} emissiveIntensity={phase === "done" ? 0.35 : 1} roughness={0.45} metalness={0.2} />
        </mesh>
        <group position={[0, 0, D / 2 + 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none">
            {phase === "done" ? <Check width={18} height={18} color="#0B0C10" /> : <Fingerprint width={18} height={18} color={phase === "holding" ? color : "#EEF0F4"} />}
          </Container>
        </group>
      </group>
      <group position={[0, -R - 0.026, 0]}>
        <Container pixelSize={0.002} pointerEvents="none">
          <Text fontSize={11} fontWeight="medium" color={phase === "idle" ? "#9AA0AD" : color}>
            {phase === "done" ? "Confirmed" : phase === "holding" ? "Keep holding" : label}
          </Text>
        </Container>
      </group>
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerOver={() => (st.current.target = 1)}
        onPointerOut={() => (st.current.target = 0)}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <cylinderGeometry args={[R + 0.009, R + 0.009, D + 0.004, 32]} />
      </mesh>
    </group>
  )
}
