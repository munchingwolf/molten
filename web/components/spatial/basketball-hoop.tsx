"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import * as Tone from "tone"
import { AdditiveBlending, Color, MeshBasicMaterial, Object3D, Vector3, type Group, type InstancedMesh } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = {
  /** Baskets scored. */
  value?: number
  onChange?: (score: number) => void
  /** Fires on every shot. */
  onPress?: () => void
  /** Chance a shot goes in, 0-1. */
  accuracy?: number
  color?: string
  ballColor?: string
}

const BZ = -0.1 // backboard centre z, metres
const BY = 0.17 // backboard centre y
const RY = 0.08 // rim height
const RR = 0.075 // rim radius
const RZ = BZ + 0.006 + 0.012 + RR // rim centre z (just in front of the board)
const BR = 0.045 // ball radius
const REST = new Vector3(0, -0.22, 0.12)
const FLIGHT = 0.75 // seconds from tap to rim
const ARC = 0.3 // extra height of the arc
const SPARKS = 60
const EDGES: [number, number, number, number][] = [
  [0, BY + 0.118, 0.36, 0.004],
  [0, BY - 0.118, 0.36, 0.004],
  [-0.178, BY, 0.004, 0.24],
  [0.178, BY, 0.004, 0.24],
]
const SQUARE: [number, number, number, number][] = [
  [0, RY + 0.095, 0.12, 0.004],
  [0, RY + 0.012, 0.12, 0.004],
  [-0.058, RY + 0.0535, 0.004, 0.087],
  [0.058, RY + 0.0535, 0.004, 0.087],
]

type Kit = { swish: Tone.NoiseSynth; band: Tone.Filter; chime: Tone.PolySynth; clang: Tone.MetalSynth; thump: Tone.MembraneSynth }

/** 36 cm mini hoop with a ball. Tap the ball to shoot an arc at the rim: swish, sparks and a point, or a clang off the rim. */
export default function BasketballHoop({ value, onChange, onPress, accuracy = 0.8, color = "#9FE7D2", ballColor = "#E8743B" }: Props) {
  const [inner, setInner] = useState(0)
  const score = value ?? inner
  const [streak, setStreak] = useState(0)
  const ball = useRef<Group>(null)
  const net = useRef<Group>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const sparks = useRef<((at: Vector3, c: string) => void) | null>(null)
  const sfx = useRef<Kit | null>(null)
  const board = useMemo(() => new RoundedBoxGeometry(0.36, 0.24, 0.012, 2, 0.006), [])
  const lines = useMemo(() => new MeshBasicMaterial({ color, toneMapped: false }), [color])
  const base = useMemo(() => new Color(color), [color])
  const st = useRef({
    phase: "ready" as "ready" | "flight" | "drop" | "miss" | "gone",
    t: 0,
    make: true,
    side: 1,
    pos: REST.clone(),
    from: REST.clone(),
    to: new Vector3(),
    vel: new Vector3(),
    bs: 1,
    bsv: 0,
    w: 0,
    wv: 0,
    flash: 0,
    streak: 0,
  })
  useEffect(() => () => (board.dispose(), lines.dispose()), [board, lines])
  useEffect(
    () => () => {
      const k = sfx.current
      if (k) [k.swish, k.band, k.chime, k.clang, k.thump].forEach((n) => n.dispose())
      sfx.current = null
    },
    [],
  )

  const kit = async () => {
    await Tone.start()
    if (!sfx.current) {
      const band = new Tone.Filter({ type: "bandpass", frequency: 2600, Q: 0.8 }).toDestination()
      sfx.current = {
        band,
        swish: new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.02, decay: 0.22, sustain: 0 }, volume: -10 }).connect(band),
        chime: new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.2 }, volume: -14 }).toDestination(),
        clang: new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.35, release: 0.05 }, harmonicity: 5.1, modulationIndex: 16, resonance: 1800, octaves: 1, volume: -26 }).toDestination(),
        thump: new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 3, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -12 }).toDestination(),
      }
    }
    return sfx.current
  }

  const shoot = () => {
    const s = st.current
    if (s.phase !== "ready") return
    s.phase = "flight"
    s.t = 0
    s.make = Math.random() < accuracy
    s.side = Math.random() < 0.5 ? -1 : 1
    s.from.copy(REST)
    s.to.set(s.make ? 0 : s.side * (RR - 0.004), RY + 0.012, RZ)
    void kit().then((k) => k.thump.triggerAttackRelease("A1", 0.1, Tone.now()))
    onPress?.()
  }

  const scored = () => {
    const s = st.current
    s.streak++
    s.flash = 1
    s.wv = 9
    const hot = s.streak >= 3
    sparks.current?.(s.pos, hot ? "#F2B48A" : color)
    void kit().then((k) => {
      const now = Tone.now()
      k.swish.triggerAttackRelease(0.22, now)
      k.chime.triggerAttackRelease(["C6", "E6"], 0.25, now + 0.08)
      k.chime.triggerAttackRelease(hot ? ["G6", "C7"] : ["G6"], 0.35, now + 0.16)
    })
    setStreak(s.streak)
    const n = score + 1
    if (value === undefined) setInner(n)
    onChange?.(n)
  }

  useFrame((state, delta) => {
    const s = st.current
    const b = ball.current
    if (!b) return
    const dt = Math.min(delta, 1 / 30)
    s.t += dt
    if (s.phase === "flight") {
      const k = Math.min(1, s.t / FLIGHT)
      s.pos.lerpVectors(s.from, s.to, k)
      s.pos.y += 4 * ARC * k * (1 - k)
      b.rotation.x -= dt * 10
      if (k >= 1) {
        s.t = 0
        if (s.make) {
          s.phase = "drop"
          s.vel.set(0, -1, 0)
          scored()
        } else {
          s.phase = "miss"
          s.vel.set(s.side * 0.55, 0.8, 0.45)
          s.wv = 3
          s.streak = 0
          setStreak(0)
          void kit().then((kk) => kk.clang.triggerAttackRelease(220, 0.3, Tone.now()))
        }
      }
    } else if (s.phase === "drop" || s.phase === "miss") {
      s.vel.y -= 6 * dt
      s.pos.addScaledVector(s.vel, dt)
      b.rotation.x -= dt * 6
      if (s.pos.y < REST.y - 0.06) {
        s.phase = "gone"
        s.t = 0
      }
    } else if (s.phase === "gone" && s.t > 0.3) {
      s.phase = "ready"
      s.pos.copy(REST)
      s.bs = 0
      s.bsv = 0
    }
    // ball pops back in on a spring; idle bob invites a tap
    s.bsv += (320 * ((s.phase === "gone" ? 0 : 1) - s.bs) - 14 * s.bsv) * dt
    s.bs += s.bsv * dt
    b.position.copy(s.pos)
    if (s.phase === "ready") b.position.y += Math.sin(state.clock.elapsedTime * 2.4) * 0.008
    b.scale.setScalar(Math.max(0.0001, s.bs))
    if (halo.current) halo.current.opacity = s.phase === "ready" ? 0.18 + Math.sin(state.clock.elapsedTime * 3) * 0.08 : 0

    // net wobble + board flash
    s.wv += (-260 * s.w - 7 * s.wv) * dt
    s.w += s.wv * dt
    if (net.current) net.current.scale.set(1 - s.w * 0.06, 1 + s.w * 0.12, 1 - s.w * 0.06)
    s.flash = Math.max(0, s.flash - dt * 1.8)
    lines.color.copy(base).lerp(WHITE, s.flash * 0.8)
  })

  const hot = streak >= 3

  return (
    <group>
      {/* backboard, frame, target square, pole */}
      <mesh geometry={board} position={[0, BY, BZ]}>
        <meshStandardMaterial color="#1A1D25" emissive="#1A1D25" emissiveIntensity={0.5} roughness={0.4} transparent opacity={0.92} />
      </mesh>
      {EDGES.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, BZ + 0.007]}>
          <boxGeometry args={[w, h, 0.003]} />
          <meshBasicMaterial color="#EEF0F4" toneMapped={false} />
        </mesh>
      ))}
      {SQUARE.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, BZ + 0.007]} material={lines}>
          <boxGeometry args={[w, h, 0.003]} />
        </mesh>
      ))}
      <mesh position={[0, -0.12, BZ - 0.02]}>
        <cylinderGeometry args={[0.008, 0.008, 0.34, 12]} />
        <meshStandardMaterial color="#323745" emissive="#323745" emissiveIntensity={0.4} roughness={0.5} />
      </mesh>
      <group position={[0, BY + 0.062, BZ + 0.008]}>
        <Container pixelSize={0.002} pointerEvents="none" flexDirection="column" alignItems="center">
          <Text fontSize={9} fontWeight="semi-bold" letterSpacing={1} color={hot ? "#F2B48A" : "#9AA0AD"}>
            {hot ? `ON FIRE x${streak}` : "SCORE"}
          </Text>
          <Text fontSize={24} fontWeight="bold" color={hot ? "#F2B48A" : "#EEF0F4"}>{`${score}`}</Text>
        </Container>
      </group>
      {/* rim, bracket, net */}
      <mesh position={[0, RY, RZ]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RR, 0.005, 8, 32]} />
        <meshStandardMaterial color="#FF7A3D" emissive="#FF7A3D" emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, RY, (BZ + RZ - RR) / 2 + 0.003]}>
        <boxGeometry args={[0.04, 0.01, 0.016]} />
        <meshStandardMaterial color="#FF7A3D" emissive="#FF7A3D" emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      <group ref={net} position={[0, RY, RZ]}>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[RR, 0.048, 0.1, 12, 3, true]} />
          <meshBasicMaterial color="#EEF0F4" wireframe transparent opacity={0.6} toneMapped={false} />
        </mesh>
      </group>
      {/* ball */}
      <mesh position={[REST.x, REST.y, REST.z - 0.03]} scale={0.16}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial ref={halo} color={color} transparent opacity={0.2} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={ball} position={REST}>
        <mesh>
          <sphereGeometry args={[BR, 24, 16]} />
          <meshStandardMaterial color={ballColor} emissive={ballColor} emissiveIntensity={0.35} roughness={0.7} />
        </mesh>
        {[
          [Math.PI / 2, 0],
          [0, 0],
          [0, Math.PI / 2],
        ].map(([rx, ry], i) => (
          <mesh key={i} rotation={[rx, ry, 0]}>
            <torusGeometry args={[BR * 1.004, 0.0014, 4, 32]} />
            <meshBasicMaterial color="#2A1A12" />
          </mesh>
        ))}
      </group>
      <Sparks api={sparks} />
      {/* Static hit sphere on the ball's rest spot (≥ 2 cm). */}
      <mesh visible={false} position={REST} onPointerDown={shoot}>
        <sphereGeometry args={[0.07, 12, 8]} />
      </mesh>
    </group>
  )
}

const WHITE = new Color("#FFFFFF")

/** One instanced burst of additive sparks; `api.current(at, colour)` fires it. */
function Sparks({ api }: { api: RefObject<((at: Vector3, c: string) => void) | null> }) {
  const mesh = useRef<InstancedMesh>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  const parts = useMemo(() => Array.from({ length: SPARKS }, () => ({ p: new Vector3(), v: new Vector3(), life: 0, max: 1 })), [])
  const dummy = useMemo(() => new Object3D(), [])
  const alive = useRef(false)
  useLayoutEffect(() => {
    if (mesh.current) mesh.current.count = 0
  }, [])
  useEffect(() => {
    api.current = (at, c) => {
      for (const q of parts) {
        q.p.copy(at)
        const a = Math.random() * Math.PI * 2
        q.v.set(Math.cos(a) * 0.5, 0.2 + Math.random() * 0.6, Math.sin(a) * 0.5).multiplyScalar(0.5 + Math.random() * 0.7)
        q.life = q.max = 0.5 + Math.random() * 0.5
      }
      mat.current?.color.set(c)
      alive.current = true
      if (mesh.current) mesh.current.count = SPARKS
    }
  }, [api, parts])
  useFrame((_, delta) => {
    const m = mesh.current
    if (!m || !alive.current) return
    const dt = Math.min(delta, 1 / 30)
    let any = false
    parts.forEach((q, i) => {
      q.life = Math.max(0, q.life - dt)
      if (q.life > 0) any = true
      q.v.y -= 1.8 * dt
      q.v.multiplyScalar(1 - dt * 1.8)
      q.p.addScaledVector(q.v, dt)
      dummy.position.copy(q.p)
      dummy.rotation.set(q.life * 9, q.life * 6, 0)
      dummy.scale.setScalar(q.life / q.max + 0.0001)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    if (!any) {
      alive.current = false
      m.count = 0
    }
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
      <octahedronGeometry args={[0.006, 0]} />
      <meshBasicMaterial ref={mat} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  )
}
