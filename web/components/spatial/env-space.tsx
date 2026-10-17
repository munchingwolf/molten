"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

const PLANET: [number, number, number] = [-45, 12, -90]
// Sun sits behind-right of the viewer so components (facing the viewer) are front-lit.
const SUN = new THREE.Vector3(30, 20, 25)

const FRESNEL_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`
const FRESNEL_FRAG = /* glsl */ `
uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
void main() {
  gl_FragColor = vec4(uColor, pow(1.0 - abs(dot(vN, vV)), 3.0));
  #include <colorspace_fragment>
}`

const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

/** Deep space: star field, ringed gas giant with atmosphere, nebula glow, floating hex platform. */
export default function EnvSpace({ intensity = 1, tint = "#6c5cff" }: Props) {
  const planet = useRef<THREE.Mesh>(null)

  const { stars, ringGeo, bands, glow } = useMemo(() => {
    const r = rand(3)
    const n = 2200
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1
      const th = r() * Math.PI * 2
      const d = 140 + r() * 60
      const s = Math.sqrt(1 - u * u)
      pos.set([Math.cos(th) * s * d, u * d, Math.sin(th) * s * d], i * 3)
      c.setHSL(r() < 0.7 ? 0.6 : 0.08, 0.35, 0.55 + r() * 0.45).toArray(col, i * 3)
    }
    const stars = new THREE.BufferGeometry()
    stars.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    stars.setAttribute("color", new THREE.BufferAttribute(col, 3))

    // Planet ring: radial bands via vertex colour on concentric ring segments.
    const ringGeo = new THREE.RingGeometry(33, 46, 96, 6)
    const rp = ringGeo.attributes.position
    const rc = new Float32Array(rp.count * 3)
    const pattern = [0.15, 0.8, 0.45, 1, 0.3, 0.7, 0.1]
    for (let i = 0; i < rp.count; i++) {
      const k = pattern[Math.round(((Math.hypot(rp.getX(i), rp.getY(i)) - 33) / 13) * 6)]
      rc.fill(k, i * 3, i * 3 + 3)
    }
    ringGeo.setAttribute("color", new THREE.BufferAttribute(rc, 3))

    // Gas-giant bands and a soft radial glow, drawn on small canvases (no downloads).
    const bc = document.createElement("canvas")
    bc.width = 4
    bc.height = 256
    const bx = bc.getContext("2d")!
    for (let y = 0; y < 256; y += 3 + Math.floor(r() * 8)) {
      bx.fillStyle = `hsl(${18 + r() * 22}, ${35 + r() * 25}%, ${32 + r() * 30}%)`
      bx.fillRect(0, y, 4, 12)
    }
    const bands = new THREE.CanvasTexture(bc)
    bands.colorSpace = THREE.SRGBColorSpace

    const gc = document.createElement("canvas")
    gc.width = gc.height = 128
    const gx = gc.getContext("2d")!
    const grad = gx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, "rgba(255,255,255,1)")
    grad.addColorStop(0.35, "rgba(255,255,255,0.35)")
    grad.addColorStop(1, "rgba(255,255,255,0)")
    gx.fillStyle = grad
    gx.fillRect(0, 0, 128, 128)
    const glow = new THREE.CanvasTexture(gc)
    return { stars, ringGeo, bands, glow }
  }, [])
  useEffect(() => () => [stars, ringGeo, bands, glow].forEach((o) => o.dispose()), [stars, ringGeo, bands, glow])

  const atmo = useMemo(() => ({ uColor: { value: new THREE.Color("#ffcf9a") } }), [])

  // Planet turns slowly on its own axis (no camera-relative motion, so no vection).
  useFrame((_, dt) => {
    if (planet.current) planet.current.rotation.y += dt * 0.01
  })

  const nebulae: { p: [number, number, number]; s: number; c: string }[] = [
    { p: [60, 25, -120], s: 130, c: tint },
    { p: [90, -10, -90], s: 90, c: "#ff4f9a" },
    { p: [30, 50, -130], s: 80, c: "#2fb5ff" },
  ]
  const sunGlow = SUN.clone().normalize().multiplyScalar(150)

  return (
    <group>
      <color attach="background" args={["#03040a"]} />
      <fog attach="fog" args={["#03040a", 60, 220]} />
      <ambientLight color="#4a5078" intensity={0.7 * intensity} />
      <directionalLight position={SUN.toArray()} color="#fff4e6" intensity={2.4 * intensity} />

      <points geometry={stars} raycast={noRay}>
        <pointsMaterial size={2.2} sizeAttenuation={false} vertexColors fog={false} toneMapped={false} />
      </points>

      {nebulae.map((n, i) => (
        <mesh key={i} position={n.p} ref={(m) => { m?.lookAt(0, 1.5, 0) }} raycast={noRay}>
          <planeGeometry args={[n.s, n.s]} />
          <meshBasicMaterial map={glow} color={n.c} transparent opacity={0.32 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={sunGlow} ref={(m) => { m?.lookAt(0, 1.5, 0) }} raycast={noRay}>
        <planeGeometry args={[28, 28]} />
        <meshBasicMaterial map={glow} color="#fff2d8" transparent blending={THREE.AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
      </mesh>

      <group position={PLANET} rotation={[0.35, 0, 0.25]}>
        <mesh ref={planet} raycast={noRay}>
          <sphereGeometry args={[26, 48, 32]} />
          <meshLambertMaterial map={bands} fog={false} />
        </mesh>
        <mesh scale={1.06} raycast={noRay}>
          <sphereGeometry args={[26, 48, 32]} />
          <shaderMaterial uniforms={atmo} vertexShader={FRESNEL_VERT} fragmentShader={FRESNEL_FRAG} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh geometry={ringGeo} rotation-x={-Math.PI / 2} raycast={noRay}>
          <meshBasicMaterial color="#d9c3a0" vertexColors transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} fog={false} />
        </mesh>
      </group>

      {/* Floating hex platform, top face at y = 0 */}
      <mesh position={[0, -0.25, 0]} raycast={noRay}>
        <cylinderGeometry args={[10, 8.8, 0.5, 6]} />
        <meshLambertMaterial color="#1b1f2a" />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation-x={-Math.PI / 2} raycast={noRay}>
        <ringGeometry args={[9.7, 10, 6, 1, Math.PI / 6]} />
        <meshBasicMaterial color={tint} toneMapped={false} />
      </mesh>
      {[1.85, 4.6, 7.4].map((r) => (
        <mesh key={r} position={[0, 0.003, 0]} rotation-x={-Math.PI / 2} raycast={noRay}>
          <ringGeometry args={[r, r + 0.05, 72]} />
          <meshBasicMaterial color={tint} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, -0.51, 0]} rotation-x={Math.PI / 2} raycast={noRay}>
        <circleGeometry args={[6, 6, Math.PI / 6]} />
        <meshBasicMaterial color={tint} transparent opacity={0.5 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
