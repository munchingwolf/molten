"use client"

import { useEffect, useMemo } from "react"
import { useThree } from "@react-three/fiber"
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

// Real-world framed print, 60 x 80 cm (metres). Hangs on a wall: faces +Z, origin = bounding-box centre.
const W = 0.6
const H = 0.8
const DEPTH = 0.03
const FRAME = 0.03
const MAT = 0.07

type Palette = "sunset" | "ocean" | "forest" | "dusk" | "mono"
const PALETTES: Record<Palette, string[]> = {
  sunset: ["#2B1B3D", "#B2456E", "#F28C6A", "#FBD38D", "#FFF1D6"],
  ocean: ["#06283D", "#1363DF", "#47B5FF", "#9FE7D2", "#EAF6FF"],
  forest: ["#1B2E25", "#2F5D50", "#7BA05B", "#E3C16F", "#F4EEDC"],
  dusk: ["#0B0C10", "#2E2A5C", "#7C5CBF", "#F2B48A", "#FDE8D7"],
  mono: ["#111111", "#3A3A3A", "#8A8A8A", "#CFCFCF", "#F5F5F5"],
}

function seeded(seed: number) {
  let s = Math.max(1, Math.floor(seed * 9973) % 2147483647)
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

/** Procedural poster: graded sky, a sun disc and layered ridgelines, with paper grain. */
function artTexture(palette: Palette, seed: number) {
  const [deep, mid, warm, glow, paper] = PALETTES[palette]
  const r = seeded(seed)
  const c = document.createElement("canvas")
  c.width = 600
  c.height = 840
  const g = c.getContext("2d")!
  const w = c.width
  const h = c.height
  const sky = g.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, deep)
  sky.addColorStop(0.45, mid)
  sky.addColorStop(0.75, warm)
  sky.addColorStop(1, glow)
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  // sun
  const sx = w * (0.3 + r() * 0.4)
  const sy = h * (0.35 + r() * 0.15)
  const sr = w * (0.14 + r() * 0.08)
  const sun = g.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 2.4)
  sun.addColorStop(0, paper)
  sun.addColorStop(0.35, glow)
  sun.addColorStop(1, "rgba(0,0,0,0)")
  g.fillStyle = sun
  g.fillRect(0, 0, w, h)
  g.fillStyle = paper
  g.beginPath()
  g.arc(sx, sy, sr, 0, Math.PI * 2)
  g.fill()
  // ridgelines, back to front
  const layers = [warm, mid, deep, "#000000"]
  layers.forEach((col, i) => {
    const base = h * (0.55 + i * 0.11)
    const amp = 40 + r() * 50
    const f1 = 0.004 + r() * 0.006
    const f2 = 0.015 + r() * 0.02
    const ph = r() * 10
    g.fillStyle = col
    g.globalAlpha = i === 3 ? 0.55 : 0.9
    g.beginPath()
    g.moveTo(0, h)
    for (let x = 0; x <= w; x += 6) g.lineTo(x, base - Math.sin(x * f1 + ph) * amp - Math.sin(x * f2 + ph * 2) * amp * 0.25)
    g.lineTo(w, h)
    g.fill()
  })
  g.globalAlpha = 1
  // paper grain
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"
    g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Framed art print (60 x 80 cm) with a procedural landscape in one of five palettes. Change `seed` for a new composition. */
export default function WallArt({
  palette = "sunset",
  seed = 3,
  frameColor = "#1A1A1C",
}: {
  palette?: Palette
  seed?: number
  frameColor?: string
}) {
  const env = useRoomEnv()
  const art = useMemo(() => artTexture(PALETTES[palette] ? palette : "sunset", seed), [palette, seed])
  useEffect(() => () => art.dispose(), [art])
  const bar = (key: string, pos: [number, number, number], size: [number, number, number]) => (
    <RoundedBox key={key} args={size} radius={0.004} smoothness={2} position={pos}>
      <meshPhysicalMaterial color={frameColor} roughness={0.45} clearcoat={0.5} clearcoatRoughness={0.3} envMap={env} />
    </RoundedBox>
  )
  return (
    <group>
      {bar("t", [0, H / 2 - FRAME / 2, 0], [W, FRAME, DEPTH])}
      {bar("b", [0, -H / 2 + FRAME / 2, 0], [W, FRAME, DEPTH])}
      {bar("l", [-W / 2 + FRAME / 2, 0, 0], [FRAME, H - 2 * FRAME + 0.002, DEPTH])}
      {bar("r", [W / 2 - FRAME / 2, 0, 0], [FRAME, H - 2 * FRAME + 0.002, DEPTH])}
      {/* backing board + passe-partout mat */}
      <mesh position={[0, 0, -DEPTH / 2 + 0.003]}>
        <boxGeometry args={[W - 2 * FRAME, H - 2 * FRAME, 0.004]} />
        <meshStandardMaterial color="#d8d4cc" roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[W - 2 * FRAME, H - 2 * FRAME]} />
        <meshPhysicalMaterial color="#F4F1EA" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0, 0.0045]}>
        <planeGeometry args={[W - 2 * FRAME - 2 * MAT, H - 2 * FRAME - 2 * MAT]} />
        <meshPhysicalMaterial map={art} roughness={0.85} />
      </mesh>
      {/* glazing: faint reflections only */}
      <mesh position={[0, 0, 0.009]}>
        <planeGeometry args={[W - 2 * FRAME, H - 2 * FRAME]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.06} roughness={0.05} metalness={0} clearcoat={1} envMap={env} depthWrite={false} />
      </mesh>
    </group>
  )
}
