"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { MeshRefractionMaterial } from "@react-three/drei"

type Props = {
  /** Gem tint */
  color?: string
  /** Height in metres */
  size?: number
  /** Rainbow dispersion strength */
  dispersion?: number
  /** Turn speed */
  speed?: number
}

/** Small procedural studio environment (equirect): dark floor, bright sky band and two softboxes for sparkle. */
function envTexture() {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 128
  const g = c.getContext("2d")!
  const sky = g.createLinearGradient(0, 0, 0, 128)
  sky.addColorStop(0, "#EEF0F4")
  sky.addColorStop(0.35, "#7FE3FF")
  sky.addColorStop(0.5, "#9FE7D2")
  sky.addColorStop(0.55, "#15171E")
  sky.addColorStop(1, "#05060a")
  g.fillStyle = sky
  g.fillRect(0, 0, 256, 128)
  g.fillStyle = "#ffffff"
  g.fillRect(40, 30, 24, 40)
  g.fillRect(170, 22, 40, 18)
  const t = new THREE.CanvasTexture(c)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A cut gem (drei <MeshRefractionMaterial>) with real internal bounces and dispersion, lit by a generated environment. Hover turns it faster, tap flips it. */
export default function Crystal({ color = "#EEF0F4", size = 0.16, dispersion = 0.02, speed = 0.5 }: Props) {
  const env = useMemo(envTexture, [])
  useEffect(() => () => env.dispose(), [env])
  const mesh = useRef<THREE.Mesh>(null)
  const flip = useRef(0)
  const [hover, setHover] = useState(false)

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    m.rotation.y += dt * speed * (hover ? 3 : 1)
    m.rotation.x = THREE.MathUtils.damp(m.rotation.x, flip.current, 5, dt)
  })

  return (
    <mesh
      ref={mesh}
      scale={[size / 2, size / 2, size / 2]}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => (flip.current += Math.PI)}
    >
      {/* low-poly gem: the refraction shader raytraces it through a BVH, keep the triangle count small */}
      <octahedronGeometry args={[1, 0]} />
      <MeshRefractionMaterial envMap={env} color={color} bounces={2} ior={2.4} fresnel={0.6} aberrationStrength={dispersion} fastChroma toneMapped={false} />
    </mesh>
  )
}
