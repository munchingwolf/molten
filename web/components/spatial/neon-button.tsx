"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { AdditiveBlending, CatmullRomCurve3, Color, TubeGeometry, Vector3, type Group, type MeshBasicMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { label?: string; color?: string; size?: number; onPress?: () => void }

const W = 0.16
const H = 0.056
const D = 0.014
const R = 0.016 // corner radius

function outline(radius: number) {
  const pts: Vector3[] = []
  const cx = W / 2 - R
  const cy = H / 2 - R
  const corners: [number, number, number][] = [[cx, cy, 0], [-cx, cy, 0.5], [-cx, -cy, 1], [cx, -cy, 1.5]]
  for (const [x, y, a0] of corners)
    for (let i = 0; i <= 8; i++) {
      const a = (a0 + i / 16) * Math.PI
      pts.push(new Vector3(x + R * Math.cos(a), y + R * Math.sin(a), 0))
    }
  return new TubeGeometry(new CatmullRomCurve3(pts, true, "centripetal"), 180, radius, 6, true)
}

/** 16 x 5.6 cm dark button with a neon tube outline that breathes at rest, burns steady on hover and flares on press. */
export default function NeonButton({ label = "Neon", color = "#9FE7D2", size = 1, onPress }: Props) {
  const body = useRef<Group>(null)
  const coreMat = useRef<MeshBasicMaterial>(null)
  const bloomMat = useRef<MeshBasicMaterial>(null)
  const st = useRef({ hover: 0, target: 0, z: 0, zv: 0, down: false, flash: 0 })
  const plate = useMemo(() => new RoundedBoxGeometry(W, H, D, 4, R - 0.002), [])
  const core = useMemo(() => outline(0.0016), [])
  const bloom = useMemo(() => outline(0.006), [])
  const neon = useMemo(() => new Color(color), [color])
  const hot = useMemo(() => new Color(color).lerp(new Color("white"), 0.55), [color])
  useEffect(() => () => (plate.dispose(), core.dispose(), bloom.dispose()), [plate, core, bloom])

  useFrame(({ clock }, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.flash = Math.max(0, s.flash - dt * 2.5)
    s.hover += (s.target - s.hover) * (1 - Math.exp(-dt * 10))
    const t = clock.elapsedTime
    const breathe = 0.5 + 0.5 * Math.sin(t * 2.4)
    const flicker = s.hover > 0.5 && Math.sin(t * 53) > 0.97 ? 0.6 : 1 // rare tube flicker while lit
    const level = Math.min(1.4, (0.35 + breathe * 0.3) * (1 - s.hover) + s.hover * flicker + s.flash)
    if (bloomMat.current) bloomMat.current.opacity = Math.min(0.9, level * 0.5)
    coreMat.current?.color.copy(neon).lerp(hot, Math.min(1, level * 0.8))
    const a = 400 * ((s.down ? -0.006 : 0) - s.z) - 22 * s.zv
    s.zv += a * dt
    s.z += s.zv * dt
    if (body.current) body.current.position.z = s.z
  })

  const near = (e: ThreeEvent<PointerEvent>) => {
    st.current.target = e.pointerType === "touch" ? Math.min(1, Math.max(0.3, 1.1 - e.distance * 9)) : 1
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    st.current.down = true
  }
  const up = () => {
    st.current.down = false
  }

  return (
    <group scale={size}>
      <group ref={body}>
        <mesh geometry={plate}>
          <meshStandardMaterial color="#0E1015" emissive="#0E1015" roughness={0.7} />
        </mesh>
        <group position={[0, 0, D / 2 + 0.001]}>
          <mesh geometry={core}>
            <meshBasicMaterial ref={coreMat} color={color} toneMapped={false} />
          </mesh>
          <mesh geometry={bloom}>
            <meshBasicMaterial ref={bloomMat} color={neon} transparent opacity={0.25} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <group position={[0, 0, 0.001]}>
            <Container pixelSize={0.002} pointerEvents="none">
              <Text fontSize={13} fontWeight="bold" letterSpacing={1.5} color={color}>
                {label.toUpperCase()}
              </Text>
            </Container>
          </group>
        </group>
      </group>
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => {
          st.current.target = 0
          up()
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          st.current.flash = 1
          onPress?.()
        }}
      >
        <boxGeometry args={[W + 0.01, H + 0.01, D + 0.008]} />
      </mesh>
    </group>
  )
}
