"use client"

import { useEffect, useMemo } from "react"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const BG = "#16110e"
const WARM = "#F2B48A"
const BULBS = [-1.3, 1.1]
// three r155+ lights are physical; these factors keep the mockup's legacy-light look (PI for sky/sun, ~2x PI for points).
const SUN = Math.PI
const POINT = Math.PI * 2

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  draw(c.getContext("2d")!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function makeTextures() {
  // Dark walnut planks: 8 per 3 m tile (37.5 cm wide) with staggered butt joints.
  const planks = canvasTexture(512, 512, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#3b2b20" : "#35271d"
      g.fillRect(0, i * 64, 512, 64)
      g.fillStyle = "#21180f"
      g.fillRect(0, i * 64, 512, 2)
      g.fillRect((i * 197) % 512, i * 64, 2, 64)
    }
  })
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping
  planks.repeat.set(8, 8)
  // Sunset through the window: dusk gradient, a city silhouette with lit windows, then the frame bars.
  const view = canvasTexture(512, 288, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 288)
    gr.addColorStop(0, "#2b2344")
    gr.addColorStop(0.55, "#8a5a6b")
    gr.addColorStop(1, WARM)
    g.fillStyle = gr
    g.fillRect(0, 0, 512, 288)
    for (let i = 0; i < 16; i++) {
      const h = 40 + ((i * 53) % 90)
      g.fillStyle = "#1a1420"
      g.fillRect(i * 32, 288 - h, 30, h)
      g.fillStyle = WARM
      if (i % 3) g.fillRect(i * 32 + 10, 288 - h + 14, 4, 4)
    }
    g.fillStyle = "#16110e"
    for (const x of [0, 170, 340, 502]) g.fillRect(x, 0, 10, 288)
    for (const y of [0, 140, 278]) g.fillRect(0, y, 512, 10)
  })
  const glow = canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    gr.addColorStop(0, "rgba(255,255,255,1)")
    gr.addColorStop(0.4, "rgba(255,255,255,.35)")
    gr.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = gr
    g.fillRect(0, 0, 128, 128)
  })
  return { planks, view, glow }
}

/** Warm evening loft: plank floor, dark warm walls, a sunset window over a city skyline, a rug and two hanging bulbs. */
export default function EnvStudioLoft({ intensity = 1, tint = "#ffd9b5" }: Props) {
  const tex = useMemo(makeTextures, [])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])

  return (
    <group>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 4, 14]} />
      {/* tint = sky colour of the room fill */}
      <hemisphereLight args={[tint, "#2a1d14", 0.85 * SUN * intensity]} />
      <directionalLight position={[1.5, 3, 1.5]} intensity={0.6 * SUN * intensity} />
      <pointLight position={[-1.6, 2.2, -2.0]} color="#ffc58a" intensity={1.2 * POINT * intensity} distance={7} decay={2} />
      <pointLight position={[1.8, 2.2, -1.8]} color={WARM} intensity={1.2 * POINT * intensity} distance={7} decay={2} />

      {/* floor + rug */}
      <mesh rotation-x={-Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial map={tex.planks} roughness={0.8} metalness={0} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, -1.1]} raycast={noRay}>
        <planeGeometry args={[2.6, 1.8]} />
        <meshStandardMaterial color="#4a3326" roughness={1} metalness={0} />
      </mesh>

      {/* back wall with the sunset window, and the two side walls */}
      <mesh position={[0, 3, -4.6]} raycast={noRay}>
        <planeGeometry args={[16, 6]} />
        <meshStandardMaterial color="#2c221c" roughness={1} metalness={0.15} />
      </mesh>
      <mesh position={[0.6, 2.0, -4.58]} raycast={noRay}>
        <planeGeometry args={[3.4, 1.9]} />
        <meshBasicMaterial map={tex.view} toneMapped={false} />
      </mesh>
      {[-4.2, 4.2].map((x) => (
        <mesh key={x} position={[x, 3, 0]} rotation-y={(-Math.sign(x) * Math.PI) / 2} raycast={noRay}>
          <planeGeometry args={[12, 6]} />
          <meshStandardMaterial color="#261d18" roughness={1} metalness={0.15} />
        </mesh>
      ))}

      {/* hanging bulbs: cord, bulb and an additive glow sprite */}
      {BULBS.map((x) => (
        <group key={x} position={[x, 0, -1.9]}>
          <mesh position={[0, 3.4, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.004, 0.004, 1.3, 6]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
          <mesh position={[0, 2.7, 0]} raycast={noRay}>
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshBasicMaterial color="#FFD7A8" toneMapped={false} />
          </mesh>
          <sprite position={[0, 2.7, 0]} scale={[0.7, 0.7, 1]} raycast={noRay}>
            <spriteMaterial map={tex.glow} color={WARM} transparent opacity={0.6 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </group>
  )
}
