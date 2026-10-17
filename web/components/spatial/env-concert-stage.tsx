"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const BG = "#06070a"
const WARM = "#F2B48A"
const BLUE = "#3B82F6"
const TRUSS_Y = 3.6
// Spot fixtures on the two truss bars: [x, z]. Colours: tint (mint by default), warm, blue.
const SPOTS: [number, number][] = [[-1.7, -2.4], [1.9, -2.4], [0.3, -3.4]]
// three r155+ lights are physical; these factors keep the mockup's legacy-light look (PI for sky/sun, ~2x PI for points).
const SUN = Math.PI
const POINT = Math.PI * 2

/** Soft white radial falloff, tinted per use by the material colour. */
function glowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, "rgba(255,255,255,1)")
  gr.addColorStop(0.4, "rgba(255,255,255,.35)")
  gr.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/** Dark concert stage: platform, speaker boxes, two truss bars and three swaying coloured spot beams. */
export default function EnvConcertStage({ intensity = 1, tint = "#9FE7D2" }: Props) {
  const pivots = useRef<(THREE.Group | null)[]>([])
  const glows = useRef<(THREE.Mesh | null)[]>([])
  const { glowTex, cone } = useMemo(() => ({ glowTex: glowTexture(), cone: new THREE.ConeGeometry(0.75, TRUSS_Y, 32, 1, true) }), [])
  useEffect(() => () => (glowTex.dispose(), cone.dispose()), [glowTex, cone])
  const colors = [tint, WARM, BLUE]

  useFrame(({ clock }) => {
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t = clock.elapsedTime
    SPOTS.forEach(([x], i) => {
      const p = pivots.current[i]
      const g = glows.current[i]
      if (!p || !g) return
      p.rotation.z = Math.sin(t * 0.5 + x) * 0.12
      g.position.x = x + Math.tan(p.rotation.z) * TRUSS_Y // floor pool follows the beam
    })
  })

  const glowMat = (color: string, opacity: number) => (
    <meshBasicMaterial map={glowTex} color={color} transparent opacity={opacity * intensity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
  )

  return (
    <group>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 4, 14]} />
      <hemisphereLight args={["#a9b4d0", "#0b0c10", 0.55 * SUN * intensity]} />
      <directionalLight position={[1.5, 3, 1.5]} intensity={0.6 * SUN * intensity} />
      <pointLight position={[-1.6, 2.2, -2.0]} color={tint} intensity={1.2 * POINT * intensity} distance={7} decay={2} />
      <pointLight position={[1.8, 2.2, -1.8]} color={WARM} intensity={1.2 * POINT * intensity} distance={7} decay={2} />

      {/* floor, back wall, stage platform, speaker boxes, truss bars */}
      <mesh rotation-x={-Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#0d0e13" roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh position={[0, 3.5, -5]} raycast={noRay}>
        <planeGeometry args={[16, 7]} />
        <meshStandardMaterial color="#101219" roughness={1} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.15, -3.6]} raycast={noRay}>
        <boxGeometry args={[7, 0.3, 2.4]} />
        <meshStandardMaterial color="#13151c" roughness={0.55} metalness={0.15} />
      </mesh>
      {[-2.9, 2.9].map((x) => (
        <mesh key={x} position={[x, 1.1, -3.4]} raycast={noRay}>
          <boxGeometry args={[0.7, 1.6, 0.6]} />
          <meshStandardMaterial color="#0f1116" roughness={0.55} metalness={0.15} />
        </mesh>
      ))}
      {[-2.4, -3.4].map((z) => (
        <mesh key={z} position={[0, TRUSS_Y, z]} raycast={noRay}>
          <boxGeometry args={[7.5, 0.07, 0.07]} />
          <meshStandardMaterial color="#2a2e38" roughness={0.55} metalness={0.6} />
        </mesh>
      ))}

      {/* spots: fixture + open additive cone on a swaying pivot, floor pool and a soft glow on the back wall */}
      {SPOTS.map(([x, z], i) => (
        <group key={x}>
          <group ref={(g) => { pivots.current[i] = g }} position={[x, TRUSS_Y, z]}>
            <mesh position={[0, -0.06, 0]} raycast={noRay}>
              <cylinderGeometry args={[0.07, 0.09, 0.16, 16]} />
              <meshStandardMaterial color="#22262f" roughness={0.55} metalness={0.15} />
            </mesh>
            <mesh geometry={cone} position={[0, -TRUSS_Y / 2, 0]} raycast={noRay}>
              <meshBasicMaterial color={colors[i]} transparent opacity={0.07 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </group>
          <mesh ref={(m) => { glows.current[i] = m }} position={[x, 0.006, z]} rotation-x={-Math.PI / 2} raycast={noRay}>
            <planeGeometry args={[2.2, 2.2]} />
            {glowMat(colors[i], 0.5)}
          </mesh>
          <mesh position={[x * 1.4, 2.6, -4.98]} raycast={noRay}>
            <planeGeometry args={[4, 4]} />
            {glowMat(colors[i], 0.16)}
          </mesh>
        </group>
      ))}
    </group>
  )
}
