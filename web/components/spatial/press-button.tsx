"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, SRGBColorSpace, type Group, type MeshBasicMaterial } from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

const DEPTH = 0.006 // metres the cap travels on press

type Props = { label?: string; onPress?: () => void; color?: string }

let matcap: CanvasTexture | undefined
// Soft-touch plastic matcap: consistent shading with or without scene lights.
function getMatcap() {
  if (matcap) return matcap
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(54, 40, 2, 64, 64, 80)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.35, "#e4e6ea")
  grad.addColorStop(0.8, "#8e939c")
  grad.addColorStop(1, "#4a4e56")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  matcap = new CanvasTexture(c)
  matcap.colorSpace = SRGBColorSpace
  return matcap
}

/** 8 cm physical button in a bezel: hover lifts the cap, it sinks 6 mm while held and springs back with a little overshoot. Fires onPress on click. */
export default function PressButton({ label = "Press", onPress, color = "#9FE7D2" }: Props) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const cap = useRef<Group>(null)
  const glow = useRef<MeshBasicMaterial>(null)
  const geometry = useMemo(() => new RoundedBoxGeometry(0.08, 0.04, 0.016, 4, 0.008), [])
  const bezel = useMemo(() => new RoundedBoxGeometry(0.092, 0.052, 0.01, 4, 0.01), [])
  useEffect(
    () => () => {
      geometry.dispose()
      bezel.dispose()
    },
    [geometry, bezel],
  )
  const mc = useMemo(getMatcap, [])
  const s = useRef({ z: 0, v: 0, g: 0 })

  // Spring toward the target height: quick dip on press, bouncy release.
  useFrame((state, delta) => {
    const g = cap.current
    if (!g) return
    const dt = Math.min(delta, 1 / 30)
    const k = s.current
    const target = down ? -DEPTH : hover ? 0.002 : 0
    k.v += ((target - k.z) * 900 - k.v * 28) * dt
    k.z += k.v * dt
    g.position.z = k.z
    const tg = down ? 1 : hover ? 0.55 : 0.2
    k.g += (tg - k.g) * (1 - Math.exp(-dt * 14))
    if (glow.current) glow.current.opacity = k.g
    if (Math.abs(target - k.z) > 1e-5 || Math.abs(k.v) > 1e-4 || Math.abs(tg - k.g) > 1e-3) state.invalidate()
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
      {/* Metal bezel and a glowing well under the cap */}
      <mesh geometry={bezel} position={[0, 0, -0.011]}>
        <meshMatcapMaterial matcap={mc} color="#3A3F4A" />
      </mesh>
      <mesh position={[0, 0, -0.0055]}>
        <planeGeometry args={[0.086, 0.046]} />
        <meshBasicMaterial ref={glow} color={color} transparent opacity={0.2} toneMapped={false} />
      </mesh>
      <group ref={cap}>
        <mesh geometry={geometry}>
          <meshMatcapMaterial matcap={mc} color={color} />
        </mesh>
        <group position={[0, 0, 0.0085]}>
          {/* 36 x 16 px = 7.2 x 3.2 cm, inside the 8 x 4 cm cap */}
          <Container pixelSize={0.002} width={36} height={16} alignItems="center" justifyContent="center">
            <Text fontSize={8} fontWeight="bold" color="#06221B">
              {label}
            </Text>
          </Container>
        </group>
      </group>
    </group>
  )
}
