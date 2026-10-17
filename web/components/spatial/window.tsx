"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
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

// Real-world wall window (metres): 1.0 x 1.3 m frame, deep reveal with the sky behind. Faces +Z; origin = bounding-box centre.
const W = 1.0
const H = 1.3
const FR = 0.06 // frame bar width
const FD = 0.08 // frame depth
const REVEAL = 0.22 // depth from frame to the sky
const SILL_D = 0.16
const TOTAL_D = REVEAL + SILL_D
const Z0 = TOTAL_D / 2 - SILL_D // frame front face, so the box is centred

type Time = "day" | "sunset" | "night"
const SKY: Record<Time, { stops: string[]; sun: string; light: string; intensity: number }> = {
  day: { stops: ["#3D8BEA", "#7DB7F2", "#CFE6FA"], sun: "#FFF6DA", light: "#FFF3E0", intensity: 3 },
  sunset: { stops: ["#2B2A63", "#C4587A", "#FFB37A"], sun: "#FFE2B0", light: "#FFB27A", intensity: 2.4 },
  night: { stops: ["#05070F", "#0E1A3A", "#24345E"], sun: "#E8EEFF", light: "#8FA6FF", intensity: 0.8 },
}

function skyTexture(time: Time) {
  const s = SKY[time]
  const c = document.createElement("canvas")
  c.width = 512
  c.height = 640
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 0, 0, 640)
  s.stops.forEach((col, i) => grad.addColorStop(i / (s.stops.length - 1), col))
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 640)
  if (time === "night")
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`
      g.fillRect(Math.random() * 512, Math.random() * 420, 1.6, 1.6)
    }
  // sun / moon with glow
  const [sx, sy, sr] = time === "day" ? [360, 150, 34] : time === "sunset" ? [180, 430, 50] : [380, 120, 22]
  const glow = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5)
  glow.addColorStop(0, s.sun)
  glow.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = glow
  g.fillRect(0, 0, 512, 640)
  g.fillStyle = s.sun
  g.beginPath()
  g.arc(sx, sy, sr, 0, Math.PI * 2)
  g.fill()
  // clouds
  if (time !== "night") {
    g.fillStyle = time === "day" ? "rgba(255,255,255,0.85)" : "rgba(255,210,190,0.55)"
    for (const [cx, cy, k] of [
      [110, 200, 1],
      [300, 290, 0.8],
      [420, 360, 0.6],
    ])
      for (let i = 0; i < 6; i++) {
        g.beginPath()
        g.ellipse(cx + (i - 2.5) * 22 * k, cy + Math.sin(i * 1.7) * 8 * k, 34 * k, 18 * k, 0, 0, Math.PI * 2)
        g.fill()
      }
  }
  // distant skyline
  g.fillStyle = time === "night" ? "#03050b" : time === "sunset" ? "#2a1f3d" : "#6f8fae"
  let x = 0
  let i = 0
  while (x < 512) {
    const bw = 24 + ((i * 37) % 40)
    const bh = 40 + ((i * 53) % 110)
    g.fillRect(x, 640 - bh, bw - 3, bh)
    if (time === "night") {
      g.fillStyle = "#ffd58a"
      for (let k = 0; k < 6; k++) if ((i + k) % 3 === 0) g.fillRect(x + 4 + ((k * 7) % (bw - 10)), 640 - bh + 8 + k * 12, 3, 4)
      g.fillStyle = "#03050b"
    }
    x += bw
    i++
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * Wall window with a deep plaster reveal, a bright sky (day, sunset or night) and a soft light spilling into the room.
 * Tap the glass to raise or lower the roller blind.
 */
export default function Window({
  time = "day",
  open,
  onChange,
  frameColor = "#F2F0EB",
}: {
  time?: Time
  /** Blind up (true) or down */
  open?: boolean
  onChange?: (open: boolean) => void
  frameColor?: string
}) {
  const env = useRoomEnv()
  const t = SKY[time] ? time : "day"
  const [inner, setInner] = useState(true)
  const isOpen = open ?? inner
  const toggle = () => {
    if (open === undefined) setInner(!isOpen)
    onChange?.(!isOpen)
  }
  const sky = useMemo(() => skyTexture(t), [t])
  useEffect(() => () => sky.dispose(), [sky])

  const blind = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const drop = useRef(isOpen ? 0 : 1) // 0 = rolled up, 1 = fully down
  const innerH = H - 2 * FR
  useFrame((_, dt) => {
    drop.current += ((isOpen ? 0.04 : 1) - drop.current) * Math.min(1, dt * 2.5)
    if (blind.current) {
      blind.current.scale.y = Math.max(0.001, drop.current)
      blind.current.position.y = innerH / 2 - (innerH * drop.current) / 2
    }
    if (light.current) light.current.intensity = SKY[t].intensity * (1 - drop.current * 0.85)
  })

  const paint = <meshPhysicalMaterial color={frameColor} roughness={0.4} clearcoat={0.25} clearcoatRoughness={0.5} envMap={env} />
  const plaster = <meshStandardMaterial color="#E7E3DC" roughness={0.95} side={THREE.DoubleSide} />
  const bar = (key: string, pos: [number, number, number], size: [number, number, number]) => (
    <RoundedBox key={key} args={size} radius={0.006} smoothness={2} position={pos}>
      {paint}
    </RoundedBox>
  )

  return (
    <group>
      {/* reveal: four plaster sides between the frame and the sky */}
      <group position={[0, 0, Z0 - REVEAL / 2]}>
        <mesh position={[0, H / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W, REVEAL]} />
          {plaster}
        </mesh>
        <mesh position={[0, -H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W, REVEAL]} />
          {plaster}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * W) / 2, 0, 0]} rotation={[0, (-s * Math.PI) / 2, 0]}>
            <planeGeometry args={[REVEAL, H]} />
            {plaster}
          </mesh>
        ))}
      </group>
      {/* sky */}
      <mesh position={[0, 0, Z0 - REVEAL]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>
      {/* frame + mullions */}
      <group position={[0, 0, Z0 - FD / 2]}>
        {bar("t", [0, H / 2 - FR / 2, 0], [W, FR, FD])}
        {bar("b", [0, -H / 2 + FR / 2, 0], [W, FR, FD])}
        {bar("l", [-W / 2 + FR / 2, 0, 0], [FR, H - 2 * FR + 0.002, FD])}
        {bar("r", [W / 2 - FR / 2, 0, 0], [FR, H - 2 * FR + 0.002, FD])}
        {bar("mv", [0, 0, -0.01], [0.035, H - 2 * FR, FD * 0.6])}
        {bar("mh", [0, 0.08, -0.01], [W - 2 * FR, 0.035, FD * 0.6])}
        {/* glass (tap target) */}
        <mesh position={[0, 0, -0.012]} onClick={toggle}>
          <planeGeometry args={[W - 2 * FR, H - 2 * FR]} />
          <meshPhysicalMaterial color="#dfefff" transparent opacity={0.1} roughness={0.04} clearcoat={1} envMap={env} depthWrite={false} />
        </mesh>
        {/* roller blind: tube + fabric that scales down from the top */}
        <mesh position={[0, H / 2 - FR - 0.02, FD / 2 - 0.01]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, W - 2 * FR, 20]} />
          <meshPhysicalMaterial color="#e9e6df" roughness={0.6} envMap={env} />
        </mesh>
        <group ref={blind} position={[0, 0, FD / 2 - 0.012]}>
          <mesh>
            <planeGeometry args={[W - 2 * FR - 0.01, H - 2 * FR]} />
            <meshPhysicalMaterial color="#EDE6D8" roughness={1} sheen={0.6} side={THREE.DoubleSide} transparent opacity={0.94} />
          </mesh>
        </group>
      </group>
      {/* sill */}
      <RoundedBox args={[W + 0.1, 0.03, SILL_D + FD]} radius={0.008} smoothness={2} position={[0, -H / 2 - 0.015 + 0.001, Z0 + SILL_D / 2 - FD / 2]}>
        {paint}
      </RoundedBox>
      <pointLight ref={light} position={[0, 0.1, Z0 + 0.6]} color={SKY[t].light} intensity={SKY[t].intensity} distance={4} decay={1.5} />
    </group>
  )
}
