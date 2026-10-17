"use client"

import { useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
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

// Real-world floor lamp (metres). Built from the floor up, then shifted so the bounding box is centred.
const TOTAL_H = 1.6
const BASE_R = 0.15
const POLE_TOP = 1.32
const SHADE = { y: 1.45, h: 0.3, rTop: 0.19, rBot: 0.23 }

/** Brass floor lamp with a linen drum shade. Tap the shade or pull the chain to switch the light on or off. */
export default function FloorLamp({
  on,
  onChange,
  color = "#FFD7A1",
  shadeColor = "#EFE6D6",
}: {
  on?: boolean
  onChange?: (on: boolean) => void
  /** Light colour */
  color?: string
  shadeColor?: string
}) {
  const env = useRoomEnv()
  const [inner, setInner] = useState(true)
  const lit = on ?? inner
  const toggle = () => {
    if (on === undefined) setInner(!lit)
    onChange?.(!lit)
  }

  // Ease the bulb up and down like a warm filament.
  const level = useRef(lit ? 1 : 0)
  const light = useRef<THREE.PointLight>(null)
  const shade = useRef<THREE.MeshPhysicalMaterial>(null)
  const bulb = useRef<THREE.MeshBasicMaterial>(null)
  const chain = useRef<THREE.Group>(null)
  const tug = useRef(0)
  useFrame((_, dt) => {
    level.current += ((lit ? 1 : 0) - level.current) * Math.min(1, dt * 8)
    const l = level.current
    if (light.current) light.current.intensity = 3.2 * l
    if (shade.current) shade.current.emissiveIntensity = 0.9 * l
    bulb.current?.color.set(color).multiplyScalar(0.25 + 0.85 * l)
    tug.current = Math.max(0, tug.current - dt * 4)
    if (chain.current) chain.current.position.y = -tug.current * 0.02
  })

  const brass = { color: "#C9A05A", metalness: 0.9, roughness: 0.35, envMap: env }
  return (
    <group position={[0, -TOTAL_H / 2, 0]}>
      {/* weighted base */}
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[BASE_R - 0.01, BASE_R, 0.024, 48]} />
        <meshPhysicalMaterial {...brass} />
      </mesh>
      <mesh position={[0, 0.028, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.012, 32]} />
        <meshPhysicalMaterial {...brass} />
      </mesh>
      {/* pole + bulb holder */}
      <mesh position={[0, (0.03 + POLE_TOP) / 2, 0]}>
        <cylinderGeometry args={[0.011, 0.011, POLE_TOP - 0.03, 20]} />
        <meshPhysicalMaterial {...brass} />
      </mesh>
      <mesh position={[0, POLE_TOP + 0.02, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.04, 20]} />
        <meshPhysicalMaterial color="#2a2a2c" roughness={0.5} envMap={env} />
      </mesh>
      {/* shade spider arms */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 0.1, SHADE.y + SHADE.h / 2 - 0.01, Math.cos(a) * 0.1]} rotation={[0, a - Math.PI / 2, Math.PI / 2]}>
            <cylinderGeometry args={[0.0025, 0.0025, 0.2, 6]} />
            <meshPhysicalMaterial {...brass} />
          </mesh>
        )
      })}
      <mesh position={[0, POLE_TOP + 0.1, 0]}>
        <sphereGeometry args={[0.04, 24, 16]} />
        <meshBasicMaterial ref={bulb} color={color} toneMapped={false} />
      </mesh>
      {/* linen drum shade (tap target), glowing from within */}
      <mesh position={[0, SHADE.y, 0]} onClick={toggle}>
        <cylinderGeometry args={[SHADE.rTop, SHADE.rBot, SHADE.h, 48, 1, true]} />
        <meshPhysicalMaterial
          ref={shade}
          color={shadeColor}
          emissive={color}
          emissiveIntensity={lit ? 0.9 : 0}
          roughness={1}
          sheen={0.5}
          sheenRoughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* pull chain */}
      <group ref={chain}>
        <mesh position={[0.06, SHADE.y - SHADE.h / 2 - 0.05, 0.06]}>
          <cylinderGeometry args={[0.0015, 0.0015, 0.1, 6]} />
          <meshPhysicalMaterial {...brass} />
        </mesh>
        <mesh position={[0.06, SHADE.y - SHADE.h / 2 - 0.105, 0.06]}>
          <sphereGeometry args={[0.008, 12, 8]} />
          <meshPhysicalMaterial {...brass} />
        </mesh>
        <mesh
          visible={false}
          position={[0.06, SHADE.y - SHADE.h / 2 - 0.1, 0.06]}
          onClick={() => {
            tug.current = 1
            toggle()
          }}
        >
          <sphereGeometry args={[0.02, 8, 6]} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, POLE_TOP + 0.1, 0]} color={color} intensity={lit ? 3.2 : 0} distance={4.5} decay={2} />
    </group>
  )
}
