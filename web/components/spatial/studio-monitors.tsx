"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import * as Tone from "tone"

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

// One cabinet, real 5" nearfield size (metres). Front faces +Z.
const CW = 0.17
const CH = 0.285
const CD = 0.222
const WOOFER_Y = -0.035
const TWEETER_Y = 0.085
const TOE_IN = 0.2 // radians each cabinet turns toward the listener

type Finish = "black" | "white"
const FINISH: Record<Finish, { cab: string; cone: string; baffle: string }> = {
  black: { cab: "#141416", cone: "#eeece6", baffle: "#0f0f11" },
  white: { cab: "#e9e8e4", cone: "#1b1b1d", baffle: "#dedcd7" },
}

/** Woofer cone profile, revolved around Y then turned to face +Z. */
function coneGeometry() {
  const pts = [
    new THREE.Vector2(0.016, -0.014),
    new THREE.Vector2(0.03, -0.009),
    new THREE.Vector2(0.045, -0.004),
    new THREE.Vector2(0.055, 0),
  ]
  const g = new THREE.LatheGeometry(pts, 40)
  g.rotateX(Math.PI / 2)
  return g
}

type CabinetProps = {
  finish: Finish
  env: THREE.Texture
  cone: THREE.BufferGeometry
  wooferRef: (g: THREE.Group | null) => void
  ledRef: (m: THREE.MeshBasicMaterial | null) => void
  on: boolean
  onPower: () => void
}

function Cabinet({ finish, env, cone, wooferRef, ledRef, on, onPower }: CabinetProps) {
  const f = FINISH[finish]
  const front = CD / 2
  return (
    <group>
      <RoundedBox args={[CW, CH, CD]} radius={0.014} smoothness={4}>
        <meshPhysicalMaterial color={f.cab} roughness={0.55} clearcoat={0.15} clearcoatRoughness={0.6} envMap={env} />
      </RoundedBox>
      {/* front baffle */}
      <RoundedBox args={[CW - 0.006, CH - 0.006, 0.004]} radius={0.0018} smoothness={2} position={[0, 0, front - 0.0015]}>
        <meshPhysicalMaterial color={f.baffle} roughness={0.35} clearcoat={0.6} envMap={env} />
      </RoundedBox>
      {/* woofer: frame ring, rubber surround, cone, dust cap - the moving part pulses with the master output */}
      <group position={[0, WOOFER_Y, front + 0.001]}>
        <mesh>
          <torusGeometry args={[0.064, 0.0045, 10, 48]} />
          <meshPhysicalMaterial color="#202124" metalness={0.6} roughness={0.4} envMap={env} />
        </mesh>
        <group ref={wooferRef}>
          <mesh position={[0, 0, -0.002]}>
            <torusGeometry args={[0.058, 0.0045, 10, 48]} />
            <meshPhysicalMaterial color="#111112" roughness={0.8} envMap={env} />
          </mesh>
          <mesh geometry={cone} position={[0, 0, -0.002]}>
            <meshPhysicalMaterial color={f.cone} roughness={0.85} side={THREE.DoubleSide} envMap={env} />
          </mesh>
          <mesh position={[0, 0, -0.016]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.019, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial color={f.cone} roughness={0.5} clearcoat={0.5} envMap={env} />
          </mesh>
        </group>
      </group>
      {/* tweeter in a shallow waveguide */}
      <group position={[0, TWEETER_Y, front + 0.001]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.002]}>
          <cylinderGeometry args={[0.042, 0.034, 0.006, 40, 1, true]} />
          <meshPhysicalMaterial color="#1a1a1c" roughness={0.45} side={THREE.DoubleSide} envMap={env} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.02, 0.004, 10, 36]} />
          <meshPhysicalMaterial color="#232326" metalness={0.5} roughness={0.4} envMap={env} />
        </mesh>
        <mesh scale={[1, 0.7, 1]} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.013, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#c8cbd0" metalness={0.9} roughness={0.35} envMap={env} />
        </mesh>
      </group>
      {/* power LED + its button (≥2 cm hit target) */}
      <mesh position={[0, -CH / 2 + 0.022, front + 0.0015]}>
        <circleGeometry args={[0.0028, 16]} />
        <meshBasicMaterial ref={ledRef} color={on ? "#ffffff" : "#2a2a2c"} toneMapped={false} />
      </mesh>
      <mesh visible={false} position={[0, -CH / 2 + 0.022, front + 0.006]} onClick={onPower}>
        <boxGeometry args={[0.03, 0.022, 0.012]} />
      </mesh>
    </group>
  )
}

/**
 * A pair of 5" nearfield studio monitors. The woofers really move with everything playing through the speakers
 * (Tone.js master output). Tap the power LED to switch them off, which mutes the room.
 */
export default function StudioMonitors({
  finish = "black",
  spacing = 0.6,
  on,
  onChange,
}: {
  finish?: Finish
  /** Distance between the two cabinet centres, metres */
  spacing?: number
  /** Power. Off mutes the master output. */
  on?: boolean
  onChange?: (on: boolean) => void
}) {
  const env = useRoomEnv()
  const [inner, setInner] = useState(true)
  const power = on ?? inner
  const cone = useMemo(coneGeometry, [])
  useEffect(() => () => cone.dispose(), [cone])

  const meter = useRef<Tone.Meter | null>(null)
  useEffect(() => {
    const m = new Tone.Meter({ smoothing: 0.55 })
    const out = Tone.getDestination()
    out.connect(m)
    meter.current = m
    return () => {
      out.disconnect(m)
      m.dispose()
      meter.current = null
    }
  }, [])

  // Off = mute the room; restore on power-on or unmount, only if we were the ones muting.
  const muted = useRef(false)
  useEffect(() => {
    const d = Tone.getDestination()
    if (!power) {
      d.mute = true
      muted.current = true
    } else if (muted.current) {
      d.mute = false
      muted.current = false
    }
  }, [power])
  useEffect(
    () => () => {
      if (muted.current) Tone.getDestination().mute = false
    },
    [],
  )

  const woofers = useRef<(THREE.Group | null)[]>([])
  const leds = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const level = useRef(0)
  useFrame(() => {
    let v = 0
    if (power && meter.current) {
      const g = meter.current.getValue()
      const db = Array.isArray(g) ? Math.max(...g) : g
      v = Math.min(1, Math.max(0, (db + 42) / 42))
      v = v * v // punchier: quiet passages barely move, kicks thump
    }
    level.current += (v - level.current) * 0.5
    for (const w of woofers.current) {
      if (!w) continue
      w.position.z = level.current * 0.006
      w.scale.setScalar(1 + level.current * 0.025)
    }
    for (const l of leds.current) l?.color.set(power ? "#ffffff" : "#2a2a2c").multiplyScalar(power ? 0.75 + level.current * 0.6 : 1)
  })

  const toggle = () => {
    if (on === undefined) setInner(!power)
    onChange?.(!power)
  }

  const s = Math.min(1.5, Math.max(0.2, spacing))
  return (
    <group>
      {[-1, 1].map((side, i) => (
        <group key={side} position={[(side * s) / 2, 0, 0]} rotation={[0, -side * TOE_IN, 0]}>
          <Cabinet
            finish={finish}
            env={env}
            cone={cone}
            on={power}
            onPower={toggle}
            wooferRef={(g) => {
              woofers.current[i] = g
            }}
            ledRef={(m) => {
              leds.current[i] = m
            }}
          />
        </group>
      ))}
    </group>
  )
}
