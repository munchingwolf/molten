"use client"

import { useEffect, useMemo, useRef } from "react"
import * as Tone from "tone"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Instance, Instances } from "@react-three/drei"
import { AdditiveBlending, Color, Object3D, Vector3, type Group, type InstancedMesh, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { notes?: string[]; colors?: string[]; onPress?: (note: string) => void; onChange?: (index: number) => void }

const NOTES = ["C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6"]
const COLORS = ["#F2A0A0", "#F2B48A", "#F2D58A", "#B9E39A", "#9FE7D2", "#8FD3EC", "#9DB5F5", "#C3A6F2"]
const W = 0.034 // bar width, metres
const STEP = 0.043 // bar pitch
const T = 0.012 // bar thickness
const LONG = 0.2 // first (lowest) bar
const SHORT = 0.13 // last bar
const NODE = 0.276 // rails sit at the bars' nodal points, this fraction of length from centre
const RAIL_Z = -T / 2 - 0.007
const SPARKS = 120
const PER_HIT = 14
const LIFE = 0.5 // spark seconds

type Bar = { z: number; zv: number; r: number; rv: number; glow: number }
type Spark = { age: number; p: Vector3; v: Vector3 }

/** 37 cm xylophone, one octave (C5-C6): poke or click a bar to play it. */
export default function Xylophone({ notes = NOTES, colors = COLORS, onPress, onChange }: Props) {
  const n = notes.length
  const root = useRef<Group>(null)
  const bodies = useRef<(Group | null)[]>([])
  const skins = useRef<(MeshStandardMaterial | null)[]>([])
  const sparks = useRef<InstancedMesh>(null)
  const synth = useRef<Tone.PolySynth<Tone.FMSynth> | null>(null)
  const st = useRef({ hover: -1, alive: 0, next: 0 })
  const bars = useMemo<Bar[]>(() => Array.from({ length: n }, () => ({ z: 0, zv: 0, r: 0, rv: 0, glow: 0 })), [n])
  const pool = useMemo<Spark[]>(() => Array.from({ length: SPARKS }, () => ({ age: LIFE, p: new Vector3(), v: new Vector3() })), [])
  const tmp = useMemo(() => ({ o: new Object3D(), c: new Color(), v: new Vector3() }), [])

  const layout = useMemo(() => {
    const x = (i: number) => (i - (n - 1) / 2) * STEP
    const len = (i: number) => (n > 1 ? LONG + ((SHORT - LONG) * i) / (n - 1) : LONG)
    // Rails follow the nodes, so they converge left->right like a real frame.
    const node = (xx: number) => NODE * (n > 1 ? LONG + ((SHORT - LONG) * (xx - x(0))) / (x(n - 1) - x(0)) : LONG)
    const xl = x(0) - STEP * 0.75
    const xr = x(n - 1) + STEP * 0.75
    const pegs = Array.from({ length: n + 1 }, (_, i) => x(i) - STEP / 2).flatMap((px) => [
      [px, node(px)],
      [px, -node(px)],
    ])
    return { x, len, node, xl, xr, pegs }
  }, [n])
  const geometries = useMemo(() => Array.from({ length: n }, (_, i) => new RoundedBoxGeometry(W, layout.len(i), T, 3, 0.004)), [n, layout])
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])
  useEffect(
    () => () => {
      synth.current?.dispose()
      synth.current = null
    },
    [],
  )

  const color = (i: number) => colors[i % colors.length] ?? COLORS[i % COLORS.length]

  const hit = async (i: number, e: ThreeEvent<PointerEvent>) => {
    const b = bars[i]
    const g = root.current
    if (!b || !g) return
    const p = g.worldToLocal(tmp.v.copy(e.point))
    b.zv -= 0.09 // dip back ~4 mm...
    b.rv -= (p.y / (layout.len(i) / 2)) * 1.2 // ...and rock away from where it was struck
    b.glow = 1
    tmp.c.set(color(i))
    const m = sparks.current
    for (let k = 0; k < PER_HIT; k++) {
      const idx = st.current.next++ % SPARKS
      const s = pool[idx]
      s.age = 0
      s.p.copy(p)
      const a = Math.random() * Math.PI * 2
      const spread = 0.15 + Math.random() * 0.35
      s.v.set(Math.cos(a) * spread, Math.sin(a) * spread + 0.1, 0.25 + Math.random() * 0.35)
      m?.setColorAt(idx, tmp.c)
    }
    if (m?.instanceColor) m.instanceColor.needsUpdate = true
    st.current.alive = LIFE
    onPress?.(notes[i])
    onChange?.(i)
    await Tone.start()
    if (!synth.current) {
      synth.current = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 4,
        modulationIndex: 6,
        oscillator: { type: "sine" },
        modulation: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 },
        modulationEnvelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.05 },
        volume: -10,
      }).toDestination()
      synth.current.maxPolyphony = 16
    }
    synth.current.triggerAttackRelease(notes[i], 0.6, Tone.now())
  }

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    for (let i = 0; i < n; i++) {
      const b = bars[i]
      // Low damping so a struck bar wobbles a few times before settling.
      b.zv += (420 * -b.z - 9 * b.zv) * dt
      b.z += b.zv * dt
      b.rv += (380 * -b.r - 8 * b.rv) * dt
      b.r += b.rv * dt
      b.glow *= Math.exp(-dt * 5)
      const body = bodies.current[i]
      if (body) {
        body.position.z = b.z
        body.rotation.x = b.r
      }
      const skin = skins.current[i]
      if (skin) skin.emissiveIntensity = 0.3 + (s.hover === i ? 0.15 : 0) + b.glow * 1.1
    }
    const m = sparks.current
    if (!m) return
    m.visible = s.alive > 0
    if (s.alive <= 0) return
    s.alive -= dt
    for (let i = 0; i < SPARKS; i++) {
      const p = pool[i]
      if (p.age < LIFE) {
        p.age += dt
        p.v.y -= 1.2 * dt
        p.v.multiplyScalar(Math.exp(-dt * 3))
        p.p.addScaledVector(p.v, dt)
      }
      const k = Math.max(0, 1 - p.age / LIFE)
      tmp.o.position.copy(p.p)
      tmp.o.scale.setScalar(k)
      tmp.o.updateMatrix()
      m.setMatrixAt(i, tmp.o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  const { x, len, node, xl, xr, pegs } = layout
  const rails = [1, -1].map((sy) => {
    const [y0, y1] = [sy * node(xl), sy * node(xr)]
    return { pos: [(xl + xr) / 2, (y0 + y1) / 2, RAIL_Z] as [number, number, number], length: Math.hypot(xr - xl, y1 - y0), angle: Math.atan2(y1 - y0, xr - xl) }
  })

  return (
    <group ref={root} rotation={[-0.35, 0, 0]}>
      {/* Frame: two converging rails, end posts, pegs between the bars */}
      {rails.map((r, i) => (
        <mesh key={i} position={r.pos} rotation={[0, 0, r.angle]}>
          <boxGeometry args={[r.length, 0.012, 0.014]} />
          <meshStandardMaterial color="#15171E" emissive="#15171E" emissiveIntensity={0.35} roughness={0.55} metalness={0.2} />
        </mesh>
      ))}
      {[xl, xr].map((px) => (
        <mesh key={px} position={[px, 0, RAIL_Z - 0.002]}>
          <boxGeometry args={[0.014, node(px) * 2 + 0.024, 0.018]} />
          <meshStandardMaterial color="#15171E" emissive="#15171E" emissiveIntensity={0.35} roughness={0.55} metalness={0.2} />
        </mesh>
      ))}
      <Instances limit={pegs.length}>
        <cylinderGeometry args={[0.0024, 0.0024, 0.016, 8]} />
        <meshStandardMaterial color="#6B7180" emissive="#6B7180" emissiveIntensity={0.3} roughness={0.35} metalness={0.6} />
        {pegs.map(([px, py], i) => (
          <Instance key={i} position={[px, py, RAIL_Z + 0.01]} rotation={[Math.PI / 2, 0, 0]} />
        ))}
      </Instances>
      {/* Bars */}
      {notes.map((note, i) => (
        <group key={i} position={[x(i), 0, 0]}>
          <group
            ref={(g) => {
              bodies.current[i] = g
            }}
          >
            <mesh geometry={geometries[i]}>
              <meshStandardMaterial
                ref={(m) => {
                  skins.current[i] = m
                }}
                color={color(i)}
                emissive={color(i)}
                emissiveIntensity={0.3}
                roughness={0.35}
                metalness={0.05}
              />
            </mesh>
          </group>
          {/* Static hit box per bar: the bar moves when struck, the hit surface must not, so fast repeats all land. */}
          <mesh
            visible={false}
            position={[0, 0, 0.004]}
            onPointerDown={(e) => hit(i, e)}
            onPointerOver={() => (st.current.hover = i)}
            onPointerOut={() => {
              if (st.current.hover === i) st.current.hover = -1
            }}
          >
            <boxGeometry args={[STEP, len(i), T + 0.008]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={sparks} args={[undefined, undefined, SPARKS]} visible={false} frustumCulled={false}>
        <octahedronGeometry args={[0.004, 0]} />
        <meshBasicMaterial toneMapped={false} transparent blending={AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}
