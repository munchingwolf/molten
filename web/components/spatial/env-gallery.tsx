"use client"

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

// Room: x -8..8, z -10..7, ceiling 4.5 m.
const W = 8
const BACK = -10
const FRONT = 7
const H = 4.5
const D = FRONT - BACK
const MID = (BACK + FRONT) / 2

/** Static instanced mesh: matrices are written once. */
function Inst({ items, children }: { items: THREE.Matrix4[]; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    items.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} raycast={noRay}>
      {children}
    </instancedMesh>
  )
}

const WALL = "#f3f2ee"

type Art = { p: [number, number, number]; ry: number; w: number; h: number; bg: string; fg: string; shape: "circle" | "bar" }
type Sculpt = { x: number; z: number; shape: "knot" | "ico" | "sphere" | "cone" | "box"; color: string }

/** Minimal white gallery: soft even light, framed abstract works and plinths with turning sculptures. */
export default function EnvGallery({ intensity = 1, tint = "#2f5bea" }: Props) {
  const sculptures = useRef<(THREE.Mesh | null)[]>([])

  const panels = useMemo(() => {
    const out: THREE.Matrix4[] = []
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
    for (let x = -4.5; x <= 4.5; x += 3) {
      for (let z = BACK + 2; z < FRONT - 1; z += 3.5) out.push(new THREE.Matrix4().compose(new THREE.Vector3(x, H - 0.01, z), q, new THREE.Vector3(1.6, 1.6, 1)))
    }
    return out
  }, [])

  const art: Art[] = [
    { p: [-4.2, 2, BACK + 0.03], ry: 0, w: 1.6, h: 1.1, bg: "#e9e4d8", fg: tint, shape: "circle" },
    { p: [0, 2.1, BACK + 0.03], ry: 0, w: 2.2, h: 1.4, bg: "#1b1b1e", fg: "#e8c547", shape: "bar" },
    { p: [4.2, 2, BACK + 0.03], ry: 0, w: 1.2, h: 1.6, bg: tint, fg: "#f4f1ea", shape: "circle" },
    { p: [-W + 0.03, 2, -5], ry: Math.PI / 2, w: 1.8, h: 1.2, bg: "#d7263d", fg: "#1b1b1e", shape: "bar" },
    { p: [-W + 0.03, 2, 1], ry: Math.PI / 2, w: 1.2, h: 1.2, bg: "#9fb8ad", fg: "#f4f1ea", shape: "circle" },
    { p: [W - 0.03, 2, -5], ry: -Math.PI / 2, w: 1.4, h: 1.8, bg: "#f4f1ea", fg: "#d7263d", shape: "bar" },
    { p: [W - 0.03, 2, 1], ry: -Math.PI / 2, w: 1.8, h: 1.2, bg: "#1b1b1e", fg: tint, shape: "circle" },
  ]
  // Plinths stay outside the component zone (|x| < 2.5, z -0.6..-2.5) and 1.5 m clear of the viewer.
  const plinths: Sculpt[] = [
    { x: -4, z: -6.5, shape: "knot", color: tint },
    { x: 0, z: -7.8, shape: "ico", color: "#c9c6bf" },
    { x: 4, z: -6.5, shape: "sphere", color: "#e8c547" },
    { x: -5.5, z: -1.5, shape: "cone", color: "#1b1b1e" },
    { x: 5.5, z: -1.5, shape: "box", color: "#d7263d" },
  ]

  useFrame((_, dt) => {
    sculptures.current.forEach((m) => {
      if (m) m.rotation.y += dt * 0.25
    })
  })

  return (
    <group>
      <color attach="background" args={[WALL]} />
      <fog attach="fog" args={[WALL, 14, 45]} />
      <hemisphereLight args={["#ffffff", "#cfc9bf", 1.5 * intensity]} />
      <directionalLight position={[2, 8, 5]} intensity={1.1 * intensity} />

      {/* polished concrete floor, walls, ceiling */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, MID]} raycast={noRay}>
        <planeGeometry args={[2 * W, D]} />
        <meshLambertMaterial color="#cdcbc6" />
      </mesh>
      <mesh position={[0, H / 2, BACK]} raycast={noRay}>
        <planeGeometry args={[2 * W, H]} />
        <meshLambertMaterial color={WALL} />
      </mesh>
      <mesh position={[0, H / 2, FRONT]} rotation-y={Math.PI} raycast={noRay}>
        <planeGeometry args={[2 * W, H]} />
        <meshLambertMaterial color={WALL} />
      </mesh>
      <mesh position={[-W, H / 2, MID]} rotation-y={Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[D, H]} />
        <meshLambertMaterial color={WALL} />
      </mesh>
      <mesh position={[W, H / 2, MID]} rotation-y={-Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[D, H]} />
        <meshLambertMaterial color={WALL} />
      </mesh>
      <mesh position={[0, H, MID]} rotation-x={Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[2 * W, D]} />
        <meshLambertMaterial color="#f7f6f3" />
      </mesh>
      <Inst items={panels}>
        <planeGeometry />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </Inst>

      {/* dark baseboard shadow-gap along every wall */}
      {[
        { p: [0, 0.04, BACK + 0.01], s: [2 * W, 0.08, 0.02] },
        { p: [0, 0.04, FRONT - 0.01], s: [2 * W, 0.08, 0.02] },
        { p: [-W + 0.01, 0.04, MID], s: [0.02, 0.08, D] },
        { p: [W - 0.01, 0.04, MID], s: [0.02, 0.08, D] },
      ].map((b, i) => (
        <mesh key={i} position={b.p as [number, number, number]} raycast={noRay}>
          <boxGeometry args={b.s as [number, number, number]} />
          <meshLambertMaterial color="#5b5a57" />
        </mesh>
      ))}

      {/* framed abstract works */}
      {art.map((a, i) => (
        <group key={i} position={a.p} rotation-y={a.ry}>
          <mesh position={[0, 0, 0.02]} raycast={noRay}>
            <boxGeometry args={[a.w + 0.08, a.h + 0.08, 0.04]} />
            <meshLambertMaterial color="#2a2a2c" />
          </mesh>
          <mesh position={[0, 0, 0.041]} raycast={noRay}>
            <planeGeometry args={[a.w, a.h]} />
            <meshLambertMaterial color={a.bg} />
          </mesh>
          <mesh position={a.shape === "circle" ? [a.w * 0.12, a.h * 0.08, 0.042] : [-a.w * 0.18, 0, 0.042]} raycast={noRay}>
            {a.shape === "circle" ? <circleGeometry args={[Math.min(a.w, a.h) * 0.28, 40]} /> : <planeGeometry args={[a.w * 0.22, a.h * 0.78]} />}
            <meshLambertMaterial color={a.fg} />
          </mesh>
        </group>
      ))}

      {/* plinths + slowly turning sculptures */}
      {plinths.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.5, 0]} raycast={noRay}>
            <boxGeometry args={[0.6, 1, 0.6]} />
            <meshLambertMaterial color="#fbfbfa" />
          </mesh>
          <mesh ref={(m) => { sculptures.current[i] = m }} position={[0, 1.25, 0]} raycast={noRay}>
            {p.shape === "knot" && <torusKnotGeometry args={[0.13, 0.04, 64, 8]} />}
            {p.shape === "ico" && <icosahedronGeometry args={[0.2, 0]} />}
            {p.shape === "sphere" && <sphereGeometry args={[0.18, 24, 16]} />}
            {p.shape === "cone" && <coneGeometry args={[0.16, 0.42, 5]} />}
            {p.shape === "box" && <boxGeometry args={[0.26, 0.26, 0.26]} />}
            <meshLambertMaterial color={p.color} flatShading={p.shape !== "sphere"} />
          </mesh>
        </group>
      ))}

      {/* bench behind the viewer */}
      <mesh position={[0, 0.22, 3.6]} raycast={noRay}>
        <boxGeometry args={[2.2, 0.44, 0.5]} />
        <meshLambertMaterial color="#8a7a66" />
      </mesh>
    </group>
  )
}
