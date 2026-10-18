"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, CapsuleGeometry, Color, SRGBColorSpace, type Group, type MeshMatcapMaterial } from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"

const TRAVEL = 0.02 // thumb offset from centre, metres
const K = 900 // spring stiffness
const C = 18 // damping; under-damped (C < 2*sqrt(K) = 60) so the thumb overshoots and bounces
const ACCENT = "#9FE7D2"
const OFF = "#2A2F3A"

type Props = { value?: boolean; onChange?: (v: boolean) => void; label?: string; accent?: string }

let matcap: CanvasTexture | undefined
// Glossy matcap: consistent shading with or without scene lights.
function getMatcap() {
  if (matcap) return matcap
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(50, 38, 1, 64, 64, 82)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.18, "#eef0f3")
  grad.addColorStop(0.7, "#9a9fa8")
  grad.addColorStop(1, "#3c4048")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  matcap = new CanvasTexture(c)
  matcap.colorSpace = SRGBColorSpace
  return matcap
}

/** 8 cm toggle switch whose thumb snaps over with a bouncy spring while the track fades to the accent. Tap to flip. Controlled via `value`, or uncontrolled. */
export default function SpringToggle({ value, onChange, label = "Toggle", accent = ACCENT }: Props) {
  const [inner, setInner] = useState(false)
  const [hover, setHover] = useState(false)
  const on = value ?? inner
  const thumb = useRef<Group>(null)
  const trackMat = useRef<MeshMatcapMaterial>(null)
  const s = useRef({ v: 0, mix: on ? 1 : 0, squash: 0 })
  const cOff = useMemo(() => new Color(OFF), [])
  const cOn = useMemo(() => new Color(accent), [accent])
  // Flattened capsules: a true pill-shaped track (8 x 4 cm) in a slightly larger bezel.
  const track = useMemo(() => new CapsuleGeometry(0.02, 0.04, 8, 32).rotateZ(Math.PI / 2).scale(1, 1, 0.3), [])
  const bezel = useMemo(() => new CapsuleGeometry(0.024, 0.04, 8, 32).rotateZ(Math.PI / 2).scale(1, 1, 0.2), [])
  useEffect(
    () => () => {
      track.dispose()
      bezel.dispose()
    },
    [track, bezel],
  )
  const mc = useMemo(getMatcap, [])

  useFrame((state, delta) => {
    const m = thumb.current
    if (!m) return
    const dt = Math.min(delta, 1 / 30) // keep the integrator stable through frame drops
    const k = s.current
    const target = on ? TRAVEL : -TRAVEL
    k.v += (target - m.position.x) * K * dt - k.v * C * dt
    m.position.x += k.v * dt
    // the thumb stretches along its travel while moving fast
    const st = Math.min(0.25, Math.abs(k.v) * 1.2)
    m.scale.set(1 + st, 1 - st * 0.4, 1)
    m.position.z = 0.009 + (hover ? 0.002 : 0)
    k.mix += ((on ? 1 : 0) - k.mix) * (1 - Math.exp(-dt * 10))
    if (trackMat.current) trackMat.current.color.copy(cOff).lerp(cOn, k.mix)
    if (Math.abs(target - m.position.x) > 1e-5 || Math.abs(k.v) > 1e-4 || Math.abs((on ? 1 : 0) - k.mix) > 1e-3) state.invalidate()
  })

  const flip = () => {
    if (value === undefined) setInner(!on)
    onChange?.(!on)
  }

  return (
    <group>
      <group onClick={flip} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <mesh geometry={bezel} position={[0, 0, -0.003]}>
          <meshMatcapMaterial matcap={mc} color={hover ? "#4A505C" : "#383D47"} />
        </mesh>
        <mesh geometry={track}>
          <meshMatcapMaterial ref={trackMat} matcap={mc} color={on ? accent : OFF} />
        </mesh>
        {/* x is driven by the spring in useFrame; initial position only. */}
        <group ref={thumb} position={[on ? TRAVEL : -TRAVEL, 0, 0.009]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.01, 40]} />
            <meshMatcapMaterial matcap={mc} color="#F4F6F8" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.0052]}>
            <cylinderGeometry args={[0.004, 0.004, 0.0006, 20]} />
            <meshBasicMaterial color={on ? "#0E5C49" : "#9AA0AD"} toneMapped={false} />
          </mesh>
        </group>
      </group>
      <group position={[0, -0.056, 0]}>
        <Container pixelSize={0.002} width={90} flexDirection="column" alignItems="center" gap={1}>
          <Text fontSize={11} fontWeight="semi-bold" color="#EEF0F4">
            {label}
          </Text>
          <Text fontSize={10} fontWeight="medium" color={on ? accent : "#9AA0AD"}>
            {on ? "ON" : "OFF"}
          </Text>
        </Container>
      </group>
    </group>
  )
}
