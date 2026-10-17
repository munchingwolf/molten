"use client"

import { useMemo } from "react"
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

// Real-world size (metres). Built from the floor of the stand up, then shifted so the bounding box is centred.
const TOTAL_H = 0.316
const POLE_TOP = 0.277
const SADDLE_R = 0.045
const BAND_R = 0.08
const BAND_Y = 0.218
const CUP_X = 0.085
const CUP_Y = 0.145

/** Desk headphone stand with a pair of closed-back studio headphones resting on it. Decor. */
export default function HeadphonesStand({ color = "#1C1D20", standColor = "#A9ACB2" }: { color?: string; standColor?: string }) {
  const env = useRoomEnv()
  const metal = { metalness: 0.9, roughness: 0.35, envMap: env }
  return (
    <group position={[0, -TOTAL_H / 2, 0]}>
      {/* stand */}
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.065, 0.067, 0.012, 48]} />
        <meshPhysicalMaterial color={standColor} {...metal} />
      </mesh>
      <mesh position={[0, 0.0005, 0]}>
        <cylinderGeometry args={[0.062, 0.062, 0.001, 32]} />
        <meshStandardMaterial color="#111" roughness={1} />
      </mesh>
      <mesh position={[0, (0.012 + POLE_TOP - 0.005) / 2, 0]}>
        <cylinderGeometry args={[0.0075, 0.0075, POLE_TOP - 0.005 - 0.012, 20]} />
        <meshPhysicalMaterial color={standColor} {...metal} />
      </mesh>
      <mesh position={[0, POLE_TOP - SADDLE_R, 0]}>
        <torusGeometry args={[SADDLE_R, 0.009, 12, 32, Math.PI]} />
        <meshPhysicalMaterial color="#2a2522" roughness={0.6} clearcoat={0.3} envMap={env} />
      </mesh>

      {/* headphones */}
      <mesh position={[0, BAND_Y, 0]} rotation={[0, 0, -0.1 * Math.PI]}>
        <torusGeometry args={[BAND_R, 0.011, 10, 48, Math.PI * 1.2]} />
        <meshPhysicalMaterial color={color} roughness={0.55} clearcoat={0.25} sheen={0.5} envMap={env} />
      </mesh>
      <mesh position={[0, BAND_Y, 0]} rotation={[0, 0, -0.1 * Math.PI]} scale={[1.17, 1.17, 1]}>
        <torusGeometry args={[BAND_R, 0.004, 6, 48, Math.PI * 1.2]} />
        <meshPhysicalMaterial color="#c9ccd1" {...metal} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * CUP_X, CUP_Y, 0]}>
          {/* slider + yoke */}
          <mesh position={[-s * 0.006, 0.05, 0]}>
            <boxGeometry args={[0.004, 0.03, 0.009]} />
            <meshPhysicalMaterial color="#c9ccd1" {...metal} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.03, 40]} />
            <meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.7} clearcoatRoughness={0.2} envMap={env} />
          </mesh>
          <mesh position={[s * 0.0155, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.034, 0.034, 0.002, 40]} />
            <meshPhysicalMaterial color="#b9bcc1" {...metal} />
          </mesh>
          {/* ear cushion */}
          <mesh position={[-s * 0.019, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.032, 0.012, 12, 40]} />
            <meshPhysicalMaterial color="#141416" roughness={0.75} sheen={0.6} sheenRoughness={0.6} envMap={env} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
