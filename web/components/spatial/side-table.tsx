"use client"

import { useEffect, useMemo } from "react"
import { useThree } from "@react-three/fiber"
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

/** Grayscale end-grain rings + straight grain; tinted by the material colour. */
function woodTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  g.fillStyle = "#fff"
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(70,40,15,${0.05 + Math.random() * 0.12})`
    g.lineWidth = 0.8 + Math.random() * 2.5
    const y = Math.random() * 512
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * 0.012 + i * 0.7) * 6)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Real-world round side table (metres). Built from the floor up, then shifted so the bounding box is centred.
const R = 0.25
const TOP_T = 0.024
const HEIGHT = 0.55
const SPLAY = 0.12 // leg tilt, radians

/** Round oak side table on three splayed legs. Its top is a placement surface. */
export default function SideTable({ color = "#B5835A" }: { color?: string }) {
  const env = useRoomEnv()
  const grain = useMemo(woodTexture, [])
  useEffect(() => () => grain.dispose(), [grain])
  const wood = <meshPhysicalMaterial color={color} map={grain} roughness={0.5} clearcoat={0.4} clearcoatRoughness={0.35} envMap={env} />
  const legLen = (HEIGHT - TOP_T) / Math.cos(SPLAY)
  return (
    <group position={[0, -HEIGHT / 2, 0]}>
      <mesh position={[0, HEIGHT - TOP_T / 2, 0]}>
        <cylinderGeometry args={[R, R - 0.004, TOP_T, 64]} />
        {wood}
      </mesh>
      {/* apron ring under the top */}
      <mesh position={[0, HEIGHT - TOP_T - 0.02, 0]}>
        <cylinderGeometry args={[R * 0.62, R * 0.62, 0.04, 48, 1, true]} />
        <meshPhysicalMaterial color={color} map={grain} roughness={0.55} side={THREE.DoubleSide} envMap={env} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        const r = R * 0.55
        return (
          // Pivot each leg at its top so the foot splays outward.
          <group key={i} position={[Math.sin(a) * r, HEIGHT - TOP_T, Math.cos(a) * r]} rotation={[0, a, 0]}>
            <group rotation={[-SPLAY, 0, 0]}>
              <mesh position={[0, -legLen / 2, 0]}>
                <cylinderGeometry args={[0.018, 0.011, legLen, 16]} />
                {wood}
              </mesh>
            </group>
          </group>
        )
      })}
    </group>
  )
}
