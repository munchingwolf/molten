"use client"

import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as Tone from "tone"
import { Color, DoubleSide, Euler, Object3D, Vector3, type Group, type InstancedMesh } from "three"

type Props = {
  /** Pieces per burst (max 300). */
  count?: number
  colors?: string[]
  /** Launch speed multiplier. */
  power?: number
  /** Change this number to fire a burst from code (e.g. bind it to a score). */
  trigger?: number
  /** Show the party popper you tap. Off = invisible, fire with `trigger`. */
  popper?: boolean
  onPress?: () => void
}

const MAX = 300
const MOUTH = new Vector3(0, -0.014, -0.004) // popper mouth (after its tilt), where pieces launch
const PALETTE = ["#9FE7D2", "#F2B48A", "#FF8FB1", "#7AB8FF", "#FFC94D", "#EEF0F4"]
const FLECKS: [number, number, number][] = [
  [-0.07, 0.05, 0],
  [-0.03, 0.09, 0.01],
  [0.02, 0.07, 0],
  [0.06, 0.1, -0.01],
  [0.08, 0.04, 0.01],
  [-0.05, 0.13, 0],
  [0.0, 0.15, 0.01],
]

type Piece = { p: Vector3; v: Vector3; r: Euler; w: Vector3; life: number; max: number; size: number; phase: number }

/** Party popper (~12 cm). Tap it (or change `trigger`) to fire up to 300 fluttering confetti pieces with a pop. */
export default function ConfettiBurst({ count = 180, colors = PALETTE, power = 1, trigger, popper = true, onPress }: Props) {
  const n = Math.max(1, Math.min(MAX, Math.round(count)))
  const mesh = useRef<InstancedMesh>(null)
  const body = useRef<Group>(null)
  const st = useRef({ alive: false, k: 0, kv: 0, t: 0 })
  const sfx = useRef<{ pop: Tone.NoiseSynth; filter: Tone.Filter; bells: Tone.PolySynth } | null>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const pieces = useMemo<Piece[]>(
    () => Array.from({ length: MAX }, () => ({ p: new Vector3(), v: new Vector3(), r: new Euler(), w: new Vector3(), life: 0, max: 1, size: 1, phase: 0 })),
    [],
  )
  const palette = colors.length ? colors : PALETTE
  const paletteKey = palette.join(",")

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const c = new Color()
    for (let i = 0; i < MAX; i++) m.setColorAt(i, c.set(palette[i % palette.length]))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.count = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteKey])
  useEffect(
    () => () => {
      if (!sfx.current) return
      sfx.current.pop.dispose()
      sfx.current.filter.dispose()
      sfx.current.bells.dispose()
    },
    [],
  )

  const sound = async () => {
    await Tone.start()
    if (!sfx.current) {
      const filter = new Tone.Filter({ type: "highpass", frequency: 900 }).toDestination()
      sfx.current = {
        filter,
        pop: new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 }, volume: -6 }).connect(filter),
        bells: new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.2 }, volume: -20 }).toDestination(),
      }
    }
    const now = Tone.now()
    sfx.current.pop.triggerAttackRelease(0.09, now)
    ;["E6", "G6", "C7", "G6", "E7"].forEach((note, i) => sfx.current?.bells.triggerAttackRelease(note, 0.25, now + 0.06 + i * 0.045 + Math.random() * 0.02))
  }

  const burst = (withSound: boolean) => {
    const s = st.current
    for (let i = 0; i < n; i++) {
      const q = pieces[i]
      const spread = Math.random() * 0.55
      const turn = Math.random() * Math.PI * 2
      q.p.copy(MOUTH)
      // cone around up, leaning toward the viewer
      q.v.set(Math.sin(spread) * Math.cos(turn), Math.cos(spread), Math.sin(spread) * Math.sin(turn) + 0.25).multiplyScalar(power * (1.3 + Math.random() * 1.3))
      q.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      q.w.set(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7)
      q.life = q.max = 2.2 + Math.random() * 1.2
      q.size = 0.7 + Math.random() * 0.6
      q.phase = Math.random() * 6
    }
    s.alive = true
    s.t = 0
    s.kv = -5 // popper recoil
    if (mesh.current) mesh.current.count = n
    if (withSound) void sound()
    onPress?.()
  }

  // Fire when `trigger` changes (not on mount). Sound only if audio is already unlocked.
  const last = useRef(trigger)
  useEffect(() => {
    if (trigger === last.current) return
    last.current = trigger
    burst(Tone.getContext().state === "running")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.kv += (-320 * s.k - 12 * s.kv) * dt
    s.k += s.kv * dt
    if (body.current) {
      body.current.position.y = s.k * 0.02
      body.current.scale.set(1 - s.k * 0.15, 1 + s.k * 0.25, 1 - s.k * 0.15)
    }
    const m = mesh.current
    if (!m || !s.alive) return
    s.t += dt
    let any = false
    for (let i = 0; i < n; i++) {
      const q = pieces[i]
      q.life -= dt
      if (q.life > 0) {
        any = true
        q.v.y -= 2.4 * dt
        q.v.multiplyScalar(Math.exp(-2.6 * dt)) // heavy air drag: fast pop, then a slow flutter down
        q.p.addScaledVector(q.v, dt)
        q.p.x += Math.sin(s.t * 5 + q.phase) * 0.04 * dt
        q.r.x += q.w.x * dt
        q.r.y += q.w.y * dt
        q.r.z += q.w.z * dt
      }
      dummy.position.copy(q.p)
      dummy.rotation.copy(q.r)
      dummy.scale.setScalar(Math.max(0, Math.min(1, q.life / 0.5)) * q.size + 0.0001)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    if (!any) {
      s.alive = false
      m.count = 0
    }
  })

  return (
    <group>
      {popper && (
        <group rotation={[0.3, 0, 0]}>
          <group ref={body}>
            <mesh position={[0, -0.06, 0]}>
              <cylinderGeometry args={[0.034, 0.011, 0.09, 24, 1, true]} />
              <meshStandardMaterial color="#F2B48A" emissive="#F2B48A" emissiveIntensity={0.35} roughness={0.5} side={DoubleSide} />
            </mesh>
            {[-0.08, -0.055, -0.03].map((y) => (
              <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.011 + (0.023 * (y + 0.105)) / 0.09 + 0.0012, 0.0025, 6, 24]} />
                <meshStandardMaterial color="#9FE7D2" emissive="#9FE7D2" emissiveIntensity={0.4} roughness={0.4} />
              </mesh>
            ))}
            <mesh position={[0, -0.0155, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.032, 24]} />
              <meshBasicMaterial color="#0B0C10" />
            </mesh>
            <mesh position={[0, -0.108, 0]}>
              <sphereGeometry args={[0.013, 16, 12]} />
              <meshStandardMaterial color="#F2B48A" emissive="#F2B48A" emissiveIntensity={0.35} roughness={0.5} />
            </mesh>
          </group>
          {/* a few resting flecks so a still preview reads as confetti */}
          {FLECKS.map(([x, y, z], i) => (
            <mesh key={i} position={[x, y - 0.03, z]} rotation={[i, i * 1.7, i * 0.6]}>
              <planeGeometry args={[0.012, 0.007]} />
              <meshBasicMaterial color={palette[i % palette.length]} side={DoubleSide} toneMapped={false} />
            </mesh>
          ))}
          {/* Static hit box, a bit larger than the popper. */}
          <mesh visible={false} position={[0, -0.06, 0]} onPointerDown={() => burst(true)}>
            <boxGeometry args={[0.09, 0.13, 0.09]} />
          </mesh>
        </group>
      )}
      <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <planeGeometry args={[0.012, 0.007]} />
        <meshBasicMaterial side={DoubleSide} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
