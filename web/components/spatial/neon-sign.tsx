"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { RoundedBox, Text } from "@react-three/drei"
import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"

const ENV_KEY = Symbol.for("spatial.roomEnv")
/** Neutral studio reflections, built once per renderer and shared by every Spatial component, so metal reads as metal in any scene. */
function useRoomEnv() {
  const gl = useThree((s) => s.gl)
  return useMemo(() => {
    const cache = gl as unknown as Record<symbol, THREE.Texture | undefined>
    if (!cache[ENV_KEY]) {
      const pmrem = new THREE.PMREMGenerator(gl)
      const room = new RoomEnvironment()
      cache[ENV_KEY] = pmrem.fromScene(room, 0.04).texture
      room.dispose()
      pmrem.dispose()
    }
    return cache[ENV_KEY]
  }, [gl])
}

// Real-world wall sign (metres): 14 cm letters on a clear acrylic backer. Faces +Z, origin = bounding-box centre.
const FONT = 0.14
const PAD = 0.07
const STANDOFF = 0.03
// Ignition flicker: [start, end] seconds the tube is lit before it holds steady.
const IGNITION: [number, number][] = [[0.06, 0.1], [0.22, 0.26], [0.38, 0.58], [0.66, 0.7], [0.82, 99]]

function glowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, "rgba(255,255,255,0.9)")
  grad.addColorStop(0.5, "rgba(255,255,255,0.25)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

type Troika = THREE.Mesh & { fillOpacity: number; outlineOpacity: number; textRenderInfo?: { blockBounds: number[] } }

/**
 * Neon sign with your `text` on a clear acrylic backer. It flickers to life when switched on, hums slightly,
 * and casts coloured light on the room. Tap it to switch on/off.
 */
export default function NeonSign({
  text = "ON AIR",
  color = "#FF2D6F",
  on,
  onChange,
}: {
  text?: string
  color?: string
  on?: boolean
  onChange?: (on: boolean) => void
}) {
  const env = useRoomEnv()
  const [inner, setInner] = useState(true)
  const lit = on ?? inner
  const toggle = () => {
    if (on === undefined) setInner(!lit)
    onChange?.(!lit)
  }
  const label = text.trim() || " "
  const [size, setSize] = useState<[number, number]>([Math.max(0.3, label.length * FONT * 0.62), FONT])
  const w = size[0] + PAD * 2
  const h = size[1] + PAD * 2

  const core = useMemo(() => "#" + new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.45).getHexString(), [color])
  const tubeMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true }), [])
  const glow = useMemo(glowTexture, [])
  useEffect(
    () => () => {
      tubeMat.dispose()
      glow.dispose()
    },
    [tubeMat, glow],
  )

  const textRef = useRef<Troika>(null)
  const glowMat = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const since = useRef(0)
  useEffect(() => {
    since.current = 0
  }, [lit])
  useFrame((_, dt) => {
    since.current += dt
    const t = since.current
    let b = 0
    if (lit) {
      const ignited = IGNITION.some(([a, z]) => t >= a && t < z)
      b = ignited ? 0.97 + Math.sin(t * 120) * 0.015 + (Math.random() < 0.004 ? -0.4 : 0) : 0.06
    }
    const tx = textRef.current
    if (tx) {
      tx.fillOpacity = 0.25 + 0.75 * b
      tx.outlineOpacity = b
    }
    if (glowMat.current) glowMat.current.opacity = 0.5 * b
    if (light.current) light.current.intensity = 1.6 * b
  })

  return (
    <group>
      {/* acrylic backer (also the tap target) */}
      <RoundedBox args={[w, h, 0.006]} radius={0.012} smoothness={3} position={[0, 0, -STANDOFF / 2 + 0.003]} onClick={toggle}>
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.22} roughness={0.12} clearcoat={1} envMap={env} depthWrite={false} />
      </RoundedBox>
      {/* standoffs to the wall */}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sy]) => (
        <mesh key={`${sx}${sy}`} position={[sx * (w / 2 - 0.03), sy * (h / 2 - 0.03), -STANDOFF / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, STANDOFF, 16]} />
          <meshPhysicalMaterial color="#c9ccd1" metalness={0.9} roughness={0.35} envMap={env} />
        </mesh>
      ))}
      {/* halo on the backer */}
      <mesh position={[0, 0, -STANDOFF / 2 + 0.0065]} scale={[w * 1.1, h * 1.6, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={glowMat} map={glow} color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <Text
        ref={textRef}
        position={[0, 0, STANDOFF / 2 - 0.004]}
        fontSize={FONT}
        letterSpacing={0.04}
        anchorX="center"
        anchorY="middle"
        color={core}
        material={tubeMat}
        outlineWidth="6%"
        outlineBlur="35%"
        outlineColor={color}
        onSync={(t: Troika) => {
          const bb = t.textRenderInfo?.blockBounds
          if (!bb) return
          const next: [number, number] = [bb[2] - bb[0], bb[3] - bb[1]]
          if (Math.abs(next[0] - size[0]) > 0.005 || Math.abs(next[1] - size[1]) > 0.005) setSize(next)
        }}
      >
        {label}
      </Text>
      <pointLight ref={light} position={[0, 0, 0.25]} color={color} intensity={0} distance={1.6} decay={2} />
    </group>
  )
}
