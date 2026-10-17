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

// Real-world size (metres), direct-drive DJ deck. Origin = bounding-box centre; front faces +Z.
const W = 0.453
const D = 0.353
const PLINTH_H = 0.06
const FOOT_H = 0.012
const H = FOOT_H + PLINTH_H + 0.05 // + tonearm
const TOP = -H / 2 + FOOT_H + PLINTH_H
const PLATTER = { x: -0.045, z: 0.005, r: 0.166, h: 0.014 }
const RECORD_R = 0.152
const PIVOT = { x: 0.155, z: -0.105 }
const ARM_L = 0.23
const ARM_REST = 0
const ARM_PLAY = -0.5 // radians: stylus lands ~13 cm from the spindle
const RPM_33 = (33.333 / 60) * Math.PI * 2

type Finish = "silver" | "black"

function recordTexture(label: string, labelColor: string) {
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  const m = 256
  g.fillStyle = "#0b0b0c"
  g.fillRect(0, 0, 512, 512)
  for (let r = 70; r < 252; r += 1.5) {
    g.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`
    g.beginPath()
    g.arc(m, m, r, 0, Math.PI * 2)
    g.stroke()
  }
  // track gaps
  for (const r of [110, 150, 190, 225]) {
    g.strokeStyle = "rgba(0,0,0,0.9)"
    g.lineWidth = 3
    g.beginPath()
    g.arc(m, m, r, 0, Math.PI * 2)
    g.stroke()
  }
  g.fillStyle = labelColor
  g.beginPath()
  g.arc(m, m, 62, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = "#fff6e8"
  g.textAlign = "center"
  g.font = "700 22px Helvetica, Arial, sans-serif"
  g.fillText(label.slice(0, 14).toUpperCase(), m, m - 22)
  g.font = "500 13px Helvetica, Arial, sans-serif"
  g.fillText("SIDE A  -  33⅓ RPM", m, m + 34)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Strobe dots around the platter rim (cylinder side UVs: u around, v up). */
function strobeTexture() {
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = 32
  const g = c.getContext("2d")!
  g.fillStyle = "#b9bcc1"
  g.fillRect(0, 0, 1024, 32)
  g.fillStyle = "#3a3c40"
  for (let i = 0; i < 180; i++) g.fillRect(i * (1024 / 180), 4, 2.5, 10)
  for (let i = 0; i < 183; i++) g.fillRect(i * (1024 / 183), 18, 2.5, 10)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A small lo-fi groove on the shared Tone transport: Am7-Dm7-G7-Cmaj7 keys, bass, kick, snare and vinyl hiss. */
function startGroove() {
  const out = new Tone.Volume(-8).toDestination()
  const warm = new Tone.Filter(1600, "lowpass").connect(out)
  const keys = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.35, release: 1.4 },
    volume: -12,
  }).connect(warm)
  const bass = new Tone.MonoSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.4 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, baseFrequency: 200, octaves: 2 },
    volume: -8,
  }).connect(out)
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.35, sustain: 0 }, volume: -8 }).connect(out)
  const snareF = new Tone.Filter(2200, "bandpass").connect(out)
  const snare = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.002, decay: 0.16, sustain: 0 }, volume: -14 }).connect(snareF)
  const hissF = new Tone.Filter(4000, "highpass").connect(out)
  const hiss = new Tone.Noise({ type: "pink", volume: -40 }).connect(hissF).start()
  const chords = [
    ["A3", "C4", "E4", "G4"],
    ["D3", "F3", "A3", "C4"],
    ["G3", "B3", "D4", "F4"],
    ["C3", "E3", "G3", "B3"],
  ]
  const roots = ["A1", "D2", "G1", "C2"]
  const tr = Tone.getTransport()
  const id = tr.scheduleRepeat((time) => {
    const beat = Math.round(tr.getTicksAtTime(time) / tr.PPQ)
    const bar = Math.floor(beat / 4) % 4
    const b = beat % 4
    if (b === 0) keys.triggerAttackRelease(chords[bar], "2n.", time)
    if (b === 0 || b === 2) {
      bass.triggerAttackRelease(roots[bar], "8n", time)
      kick.triggerAttackRelease("C1", "8n", time)
    }
    if (b === 1 || b === 3) snare.triggerAttackRelease(0.16, time)
  }, "4n")
  if (tr.state !== "started") tr.start()
  return () => {
    tr.clear(id)
    hiss.stop()
    ;[keys, bass, kick, snare, snareF, hiss, hissF, warm, out].forEach((n) => n.dispose())
  }
}

/**
 * Direct-drive turntable. Press START/STOP (or the record) to play: the platter spins up like the real thing,
 * the tonearm swings onto the record, and a lo-fi groove plays on the shared Tone transport.
 */
export default function Turntable({
  playing,
  onChange,
  onPress,
  finish = "silver",
  label = "Spatial Sessions",
  labelColor = "#C8102E",
}: {
  playing?: boolean
  onChange?: (playing: boolean) => void
  onPress?: () => void
  finish?: Finish
  /** Text on the record label */
  label?: string
  labelColor?: string
}) {
  const env = useRoomEnv()
  const [inner, setInner] = useState(false)
  const on = playing ?? inner

  useEffect(() => (on ? startGroove() : undefined), [on])

  const toggle = async () => {
    await Tone.start() // browsers only allow audio after a user gesture
    if (playing === undefined) setInner(!on)
    onChange?.(!on)
    onPress?.()
  }

  const platter = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const speed = useRef(0)
  const strobeLed = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((_, dt) => {
    const target = on ? RPM_33 : 0
    // ~0.7 s spin-up, ~1.2 s brake
    speed.current += Math.sign(target - speed.current) * Math.min(Math.abs(target - speed.current), dt * (on ? 5 : 3))
    if (platter.current) platter.current.rotation.y -= speed.current * dt
    if (arm.current) {
      const goal = on ? ARM_PLAY : ARM_REST
      arm.current.rotation.y += (goal - arm.current.rotation.y) * Math.min(1, dt * 3)
    }
    strobeLed.current?.color.set(on ? "#ff4a2a" : "#3a1a14")
  })

  const tex = useMemo(() => ({ strobe: strobeTexture() }), [])
  const record = useMemo(() => recordTexture(label, labelColor), [label, labelColor])
  useEffect(() => () => tex.strobe.dispose(), [tex])
  useEffect(() => () => record.dispose(), [record])

  const body = finish === "black" ? "#1e1f22" : "#c4c6ca"
  const metal = { metalness: 0.9, roughness: 0.35, envMap: env }

  return (
    <group>
      {/* feet */}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.045), -H / 2 + FOOT_H / 2, sz * (D / 2 - 0.045)]}>
          <cylinderGeometry args={[0.032, 0.036, FOOT_H, 24]} />
          <meshPhysicalMaterial color="#141416" roughness={0.8} envMap={env} />
        </mesh>
      ))}
      {/* plinth */}
      <RoundedBox args={[W, PLINTH_H, D]} radius={0.01} smoothness={3} position={[0, TOP - PLINTH_H / 2, 0]}>
        <meshPhysicalMaterial color={body} {...metal} />
      </RoundedBox>
      <mesh position={[0, TOP - PLINTH_H + 0.006, 0]}>
        <boxGeometry args={[W + 0.001, 0.012, D + 0.001]} />
        <meshPhysicalMaterial color="#1a1b1d" roughness={0.6} envMap={env} />
      </mesh>

      {/* platter + record (spin together) */}
      <group position={[PLATTER.x, TOP, PLATTER.z]}>
        <mesh position={[0, 0.0005, 0]}>
          <cylinderGeometry args={[PLATTER.r + 0.006, PLATTER.r + 0.006, 0.001, 64]} />
          <meshStandardMaterial color="#0c0c0d" roughness={0.9} />
        </mesh>
        <group ref={platter}>
          <mesh position={[0, PLATTER.h / 2 + 0.001, 0]}>
            <cylinderGeometry args={[PLATTER.r, PLATTER.r, PLATTER.h, 72, 1, true]} />
            <meshPhysicalMaterial map={tex.strobe} {...metal} />
          </mesh>
          <mesh position={[0, PLATTER.h + 0.0012, 0]}>
            <cylinderGeometry args={[PLATTER.r, PLATTER.r, 0.002, 72]} />
            <meshStandardMaterial color="#141415" roughness={0.95} />
          </mesh>
          <mesh position={[0, PLATTER.h + 0.0032, 0]} onClick={toggle}>
            <cylinderGeometry args={[RECORD_R, RECORD_R, 0.002, 72]} />
            <meshPhysicalMaterial attach="material-0" color="#0b0b0c" roughness={0.3} clearcoat={1} envMap={env} />
            <meshPhysicalMaterial attach="material-1" map={record} roughness={0.28} clearcoat={1} clearcoatRoughness={0.15} envMap={env} />
            <meshPhysicalMaterial attach="material-2" color="#0b0b0c" roughness={0.3} envMap={env} />
          </mesh>
          <mesh position={[0, PLATTER.h + 0.01, 0]}>
            <cylinderGeometry args={[0.0036, 0.0036, 0.016, 16]} />
            <meshPhysicalMaterial color="#d9dbde" {...metal} />
          </mesh>
        </group>
      </group>

      {/* tonearm: pivot base, counterweight, arm tube, headshell */}
      <group position={[PIVOT.x, TOP, PIVOT.z]}>
        <mesh position={[0, 0.006, 0]}>
          <cylinderGeometry args={[0.032, 0.034, 0.012, 40]} />
          <meshPhysicalMaterial color="#2a2b2e" {...metal} />
        </mesh>
        <group ref={arm} position={[0, 0.034, 0]} rotation={[0, ARM_REST, 0]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.012, 0.03, 24]} />
            <meshPhysicalMaterial color="#d0d2d5" {...metal} />
          </mesh>
          <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.03, 32]} />
            <meshPhysicalMaterial color="#c9cbcf" {...metal} />
          </mesh>
          <mesh position={[0, 0, ARM_L / 2 - 0.015]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0045, 0.0045, ARM_L, 16]} />
            <meshPhysicalMaterial color="#e0e2e5" {...metal} />
          </mesh>
          <group position={[0, -0.004, ARM_L]} rotation={[0, 0.35, 0]}>
            <mesh>
              <boxGeometry args={[0.018, 0.005, 0.045]} />
              <meshPhysicalMaterial color="#1a1a1c" roughness={0.4} clearcoat={0.6} envMap={env} />
            </mesh>
            <mesh position={[0, -0.006, 0.006]}>
              <boxGeometry args={[0.012, 0.009, 0.018]} />
              <meshPhysicalMaterial color="#d23a32" roughness={0.4} clearcoat={0.6} envMap={env} />
            </mesh>
          </group>
        </group>
        {/* arm rest */}
        <mesh position={[0.0, 0.015, 0.16]}>
          <cylinderGeometry args={[0.004, 0.004, 0.03, 12]} />
          <meshPhysicalMaterial color="#1c1c1e" roughness={0.5} envMap={env} />
        </mesh>
      </group>

      {/* START/STOP button + strobe light (front left) */}
      <group position={[-W / 2 + 0.03, TOP, D / 2 - 0.03]}>
        <mesh visible={false} position={[0, 0.008, 0]} onClick={toggle}>
          <boxGeometry args={[0.044, 0.022, 0.034]} />
        </mesh>
        <RoundedBox args={[0.038, 0.006, 0.026]} radius={0.002} smoothness={2} position={[0, 0.003, 0]}>
          <meshPhysicalMaterial color="#d6d8db" {...metal} />
        </RoundedBox>
      </group>
      <mesh position={[-0.152, TOP + 0.002, 0.163]}>
        <cylinderGeometry args={[0.009, 0.009, 0.004, 20]} />
        <meshBasicMaterial ref={strobeLed} color="#3a1a14" toneMapped={false} />
      </mesh>
      {/* pitch fader (decor) */}
      <group position={[W / 2 - 0.035, TOP, 0.06]}>
        <mesh position={[0, 0.0004, 0]}>
          <boxGeometry args={[0.008, 0.001, 0.12]} />
          <meshStandardMaterial color="#0d0d0e" />
        </mesh>
        <RoundedBox args={[0.02, 0.01, 0.014]} radius={0.002} smoothness={2} position={[0, 0.005, 0]}>
          <meshPhysicalMaterial color="#d9dbde" {...metal} />
        </RoundedBox>
      </group>
    </group>
  )
}
