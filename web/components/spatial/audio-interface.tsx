"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
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

// Real-world size (metres): a 2-in USB audio interface. Origin = bounding-box centre; front panel faces +Z.
const W = 0.175
const H = 0.044
const D = 0.1
const FRONT = D / 2 + 0.002
const clamp = (v: number) => Math.min(1, Math.max(0, v))

function frontTexture() {
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = Math.round((1024 * (H - 0.006)) / (W - 0.006))
  const g = c.getContext("2d")!
  const s = 1024 / (W - 0.006)
  const px = (x: number) => (x + (W - 0.006) / 2) * s
  const py = (y: number) => ((H - 0.006) / 2 - y) * s
  g.fillStyle = "#141416"
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = "#c9ccd1"
  g.textAlign = "center"
  g.font = "600 15px Helvetica, Arial, sans-serif"
  g.fillText("INPUT 1", px(-0.066), py(-0.0155))
  g.fillText("INPUT 2", px(-0.036), py(-0.0155))
  g.fillText("GAIN 1", px(-0.006), py(-0.0155))
  g.fillText("GAIN 2", px(0.022), py(-0.0155))
  g.fillText("MONITOR", px(0.052), py(-0.0155))
  g.fillText("PHONES", px(0.077), py(-0.0155))
  g.font = "800 15px Helvetica, Arial, sans-serif"
  g.fillText("SPATIAL 2i2", px(0.008), py(0.0158))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

type KnobProps = {
  x: number
  r: number
  t: number
  onSet: (t: number) => void
  root: RefObject<THREE.Group | null>
  env: THREE.Texture
  halo?: (m: THREE.MeshBasicMaterial | null) => void
}

/** Front-panel knob. Drag up/right (mouse, ray or fingertip) to turn up. */
function Knob({ x, r, t, onSet, root, env, halo }: KnobProps) {
  const drag = useRef<{ p: THREE.Vector3; t: number } | null>(null)
  const local = (e: ThreeEvent<PointerEvent>) => root.current!.worldToLocal(e.point.clone())
  return (
    <group position={[x, 0.002, FRONT]}>
      <mesh
        visible={false}
        position={[0, 0, 0.008]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={(e) => {
          ;(e.target as Element).setPointerCapture(e.pointerId)
          drag.current = { p: local(e), t }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const p = local(e)
          onSet(clamp(drag.current.t + (p.x - drag.current.p.x + p.y - drag.current.p.y) / 0.05))
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <cylinderGeometry args={[Math.max(0.0115, r + 0.003), Math.max(0.0115, r + 0.003), 0.02, 16]} />
      </mesh>
      {halo && (
        <mesh position={[0, 0, 0.0005]}>
          <torusGeometry args={[r + 0.0032, 0.0011, 6, 40]} />
          <meshBasicMaterial ref={halo} color="#0f2a14" toneMapped={false} />
        </mesh>
      )}
      <group rotation={[0, 0, Math.PI * 0.75 - t * Math.PI * 1.5]}>
        <mesh position={[0, 0, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.92, r, 0.012, 32]} />
          <meshPhysicalMaterial color="#17181a" roughness={0.45} clearcoat={0.6} envMap={env} />
        </mesh>
        <mesh position={[0, r * 0.6, 0.0122]}>
          <boxGeometry args={[0.0012, r * 0.7, 0.0005]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  )
}

/**
 * Two-input USB audio interface with gain halos that light green/amber/red from the live master level,
 * and a MONITOR knob that really sets the speaker volume (Tone.js). Every knob is 0-1, controlled-or-uncontrolled.
 */
export default function AudioInterface({
  gain1,
  gain2,
  monitor,
  onGain1Change,
  onGain2Change,
  onMonitorChange,
  color = "#B3121F",
}: {
  gain1?: number
  gain2?: number
  /** Speaker volume, 0-1 (0.8 = unity). */
  monitor?: number
  onGain1Change?: (v: number) => void
  onGain2Change?: (v: number) => void
  onMonitorChange?: (v: number) => void
  /** Anodised case colour */
  color?: string
}) {
  const env = useRoomEnv()
  const root = useRef<THREE.Group>(null)
  const [inner, setInner] = useState({ gain1: 0.6, gain2: 0.45, monitor: 0.8 })
  const g1 = clamp(gain1 ?? inner.gain1)
  const g2 = clamp(gain2 ?? inner.gain2)
  const mon = clamp(monitor ?? inner.monitor)
  const touched = useRef(monitor !== undefined)

  const set = (k: "gain1" | "gain2" | "monitor", v: number, ext: number | undefined, cb?: (v: number) => void) => {
    if (ext === undefined) setInner((s) => ({ ...s, [k]: v }))
    cb?.(v)
  }
  // Only touch the global output once someone turns MONITOR (or binds it), so placing the interface never changes the room's volume.
  useEffect(() => {
    if (!touched.current && monitor === undefined) return
    const d = Tone.getDestination()
    d.volume.rampTo(mon < 0.01 ? -80 : Math.min(6, 40 * Math.log10(mon / 0.8)), 0.05)
  }, [mon, monitor])

  const meter = useRef<Tone.Meter | null>(null)
  useEffect(() => {
    const m = new Tone.Meter({ smoothing: 0.7 })
    const out = Tone.getDestination()
    out.connect(m)
    meter.current = m
    return () => {
      out.disconnect(m)
      m.dispose()
      meter.current = null
    }
  }, [])

  const halos = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const usb = useRef<THREE.MeshBasicMaterial>(null)
  const gains = useRef([g1, g2])
  gains.current = [g1, g2]
  useFrame(({ clock }) => {
    const raw = meter.current?.getValue()
    const db = Array.isArray(raw) ? Math.max(...raw) : (raw ?? -Infinity)
    const lvl = clamp((db + 48) / 48)
    halos.current.forEach((m, i) => {
      if (!m) return
      const v = clamp(lvl * gains.current[i] * 1.6)
      const c = v > 0.92 ? "#ff3b30" : v > 0.75 ? "#ffb020" : "#2bd96b"
      m.color.set(v < 0.05 ? "#0f2a14" : c).multiplyScalar(v < 0.05 ? 1 : 0.4 + v * 0.9)
    })
    usb.current?.color.set("#2bd96b").multiplyScalar(0.7 + Math.sin(clock.elapsedTime * 2) * 0.05)
  })

  const front = useMemo(frontTexture, [])
  useEffect(() => () => front.dispose(), [front])

  return (
    <group ref={root}>
      <RoundedBox args={[W, H, D]} radius={0.006} smoothness={3}>
        <meshPhysicalMaterial color={color} metalness={0.85} roughness={0.4} envMap={env} />
      </RoundedBox>
      {/* black front panel */}
      <RoundedBox args={[W - 0.004, H - 0.004, 0.004]} radius={0.0015} smoothness={2} position={[0, 0, D / 2]}>
        <meshPhysicalMaterial color="#121214" roughness={0.4} clearcoat={0.5} envMap={env} />
      </RoundedBox>
      <mesh position={[0, 0, FRONT + 0.0001]}>
        <planeGeometry args={[W - 0.006, H - 0.006]} />
        <meshPhysicalMaterial map={front} roughness={0.4} clearcoat={0.5} envMap={env} />
      </mesh>
      {/* combo XLR/jack inputs */}
      {[-0.066, -0.036].map((x) => (
        <group key={x} position={[x, 0.002, FRONT]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0115, 0.0115, 0.003, 32]} />
            <meshPhysicalMaterial color="#b8bbc0" metalness={0.9} roughness={0.35} envMap={env} />
          </mesh>
          <mesh position={[0, 0, 0.0016]}>
            <circleGeometry args={[0.0095, 32]} />
            <meshStandardMaterial color="#050506" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.0018]}>
            <ringGeometry args={[0.003, 0.0042, 24]} />
            <meshPhysicalMaterial color="#9a9da2" metalness={0.9} roughness={0.35} envMap={env} />
          </mesh>
        </group>
      ))}
      <Knob x={-0.006} r={0.0085} t={g1} onSet={(v) => set("gain1", v, gain1, onGain1Change)} root={root} env={env} halo={(m) => void (halos.current[0] = m)} />
      <Knob x={0.022} r={0.0085} t={g2} onSet={(v) => set("gain2", v, gain2, onGain2Change)} root={root} env={env} halo={(m) => void (halos.current[1] = m)} />
      <Knob
        x={0.052}
        r={0.0125}
        t={mon}
        onSet={(v) => {
          touched.current = true
          set("monitor", v, monitor, onMonitorChange)
        }}
        root={root}
        env={env}
      />
      {/* headphone jack */}
      <group position={[0.077, 0.002, FRONT]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.003, 24]} />
          <meshPhysicalMaterial color="#c4c7cc" metalness={0.9} roughness={0.35} envMap={env} />
        </mesh>
        <mesh position={[0, 0, 0.0016]}>
          <circleGeometry args={[0.0033, 20]} />
          <meshStandardMaterial color="#050506" />
        </mesh>
      </group>
      {/* USB power LED */}
      <mesh position={[0.074, 0.0155, FRONT + 0.0003]}>
        <circleGeometry args={[0.0013, 12]} />
        <meshBasicMaterial ref={usb} color="#2bd96b" toneMapped={false} />
      </mesh>
      {/* rubber feet */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.015), -H / 2 - 0.0005, sz * (D / 2 - 0.015)]}>
            <cylinderGeometry args={[0.006, 0.006, 0.001, 16]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  )
}
