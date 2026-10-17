"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
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

// Real-world size (metres), MPC-style. Origin = centre of the bounding box; front faces +Z.
const W = 0.3
const D = 0.3
const BODY_H = 0.042
const PAD = 0.042
const GAP = 0.007
const PAD_H = 0.008
const H = BODY_H + PAD_H
const TOP = -H / 2 + BODY_H
const GRID_X = 0.042 // centre of the 4x4 grid
const GRID_Z = 0.046
const padPos = (i: number): [number, number] => {
  const r = Math.floor(i / 4) // row 0 = front, like MPC pad 1 bottom-left
  const c = i % 4
  return [GRID_X + (c - 1.5) * (PAD + GAP), GRID_Z + (1.5 - r) * (PAD + GAP)]
}
const SCREEN = { x: -0.04, z: -0.103, w: 0.17, d: 0.066 }
const PLATE = W - 0.012
const BUTTONS: [string, number][] = [["PLAY", 0.118], ["STOP", 0.084], ["TAP TEMPO", 0.05]]
const ROW_NAMES = ["KICK", "SNARE", "HAT", "CLAP"]
const ROW_COLORS = ["#FF5A36", "#FFB020", "#36E2C8", "#B37CFF"]

// Default beat: pad index -> 16th-note steps
const PATTERN: [number, number[]][] = [
  [0, [0, 3, 8, 10]],
  [4, [4, 12]],
  [8, [0, 2, 4, 6, 8, 10, 12]],
  [10, [14]],
  [12, [12]],
]

type Voices = { hit: (pad: number, time: number) => void; dispose: () => void }

function makeVoices(): Voices {
  const out = new Tone.Volume(-2).toDestination()
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -4 }).connect(out)
  const snNoise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 }, volume: -12 }).connect(out)
  const snBody = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 }, volume: -10 }).connect(out)
  const hatF = new Tone.Filter({ frequency: 8000, type: "highpass", Q: 1 }).connect(out)
  const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -14 }).connect(hatF)
  const clapF = new Tone.Filter({ frequency: 1500, type: "bandpass", Q: 1.5 }).connect(out)
  const clap = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 }, volume: -4 }).connect(clapF)
  return {
    hit: (pad, t) => {
      const v = pad % 4 // column = variation
      const row = Math.floor(pad / 4)
      if (row === 0) kick.triggerAttackRelease(["C1", "D1", "F1", "A1"][v], "8n", t)
      else if (row === 1) {
        snNoise.envelope.decay = [0.15, 0.12, 0.22, 0.3][v]
        snNoise.triggerAttackRelease(0.15, t)
        snBody.triggerAttackRelease(["E2", "G2", "A2", "C3"][v], 0.1, t)
      } else if (row === 2) {
        const len = [0.04, 0.06, 0.18, 0.35][v]
        hat.envelope.decay = len
        hat.triggerAttackRelease(len, t)
      } else {
        clapF.frequency.setValueAtTime([1200, 1500, 1900, 2600][v], t)
        clap.triggerAttackRelease(0.2, t)
      }
    },
    dispose: () => [kick, snNoise, snBody, hat, hatF, clap, clapF, out].forEach((n) => n.dispose()),
  }
}

/** Printed legend on the top plate. Canvas top = back of the unit. */
function plateTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 1024
  const g = c.getContext("2d")!
  const px = (x: number) => ((x + PLATE / 2) / PLATE) * 1024
  g.fillStyle = "#ffffff"
  g.fillRect(0, 0, 1024, 1024)
  for (let y = 0; y < 1024; y += 2) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`
    g.fillRect(0, y, 1024, 1)
  }
  g.fillStyle = "#1a1b1e"
  g.font = "800 34px Helvetica, Arial, sans-serif"
  g.fillText("SPATIAL", px(-0.137), px(-0.035))
  g.font = "500 20px Helvetica, Arial, sans-serif"
  g.fillText("MPC-16", px(-0.137), px(-0.035) + 28)
  g.font = "600 22px Helvetica, Arial, sans-serif"
  g.textAlign = "center"
  for (const [label, z] of BUTTONS) g.fillText(label, px(-0.105), px(z) + 52)
  g.textAlign = "left"
  ROW_NAMES.forEach((n, r) => {
    const z = GRID_Z + (1.5 - r) * (PAD + GAP)
    g.save()
    g.translate(px(0.137) + 24, px(z) + 30)
    g.rotate(-Math.PI / 2)
    g.fillText(n, 0, 0)
    g.restore()
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function drawScreen(g: CanvasRenderingContext2D, step: number, on: boolean, bpm: number, lastPad: number | null) {
  const { width: w, height: h } = g.canvas
  g.fillStyle = "#06090b"
  g.fillRect(0, 0, w, h)
  g.fillStyle = "#e9f4f2"
  g.font = "700 22px ui-monospace, Menlo, monospace"
  g.fillText("BEAT 01", 14, 30)
  g.textAlign = "right"
  g.fillText(`${Math.round(bpm)} BPM`, w - 14, 30)
  g.textAlign = "left"
  g.font = "500 16px ui-monospace, Menlo, monospace"
  g.fillStyle = on ? "#36E28A" : "#7d8a8c"
  g.fillText(on ? "PLAYING" : "STOPPED", 14, 54)
  g.fillStyle = "#7d8a8c"
  if (lastPad !== null) g.fillText(`PAD ${lastPad + 1} ${ROW_NAMES[Math.floor(lastPad / 4)]}`, 130, 54)
  // 16-step lanes
  const lanes: [number, number[]][] = [PATTERN[0], PATTERN[1], [8, [...PATTERN[2][1], 14]], PATTERN[4]]
  const cw = (w - 28) / 16
  lanes.forEach(([, steps], r) => {
    for (let s = 0; s < 16; s++) {
      const x = 14 + s * cw
      const y = 68 + r * 17
      const hit = steps.includes(s)
      g.fillStyle = on && s === step ? "#ffffff" : hit ? ROW_COLORS[r] : s % 4 === 0 ? "#22292c" : "#161b1d"
      g.fillRect(x + 1, y, cw - 3, 13)
    }
  })
}

/**
 * MPC-style drum machine: a 4x4 grid of light-up pads (rows = kick, snare, hat, clap; columns = variations)
 * and a PLAY button that runs a built-in beat on the shared Tone transport. Pads glow when hit, by hand or by the sequencer.
 */
export default function DrumMachine({
  playing,
  onChange,
  onPress,
  color,
}: {
  playing?: boolean
  onChange?: (playing: boolean) => void
  /** Fires with the pad index (0-15) on every hand hit. */
  onPress?: (pad: number) => void
  /** One glow colour for every pad (default: a colour per row). */
  color?: string
}) {
  const env = useRoomEnv()
  const [inner, setInner] = useState(false)
  const on = playing ?? inner
  const [step, setStep] = useState(-1)
  const [lastPad, setLastPad] = useState<number | null>(null)
  const voices = useRef<Voices | null>(null)
  const lit = useRef(new Float32Array(16))
  const pressed = useRef(new Uint8Array(16))
  const padMats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([])
  const padMeshes = useRef<(THREE.Mesh | null)[]>([])

  useEffect(() => {
    const v = makeVoices()
    voices.current = v
    return () => {
      v.dispose()
      voices.current = null
    }
  }, [])

  // Built-in pattern, locked to the global transport grid so it stays in time with other components.
  useEffect(() => {
    if (!on) return
    const tr = Tone.getTransport()
    const id = tr.scheduleRepeat((time) => {
      const s = Math.round(tr.getTicksAtTime(time) / (tr.PPQ / 4)) % 16
      for (const [pad, steps] of PATTERN)
        if (steps.includes(s)) {
          voices.current?.hit(pad, time)
          Tone.getDraw().schedule(() => (lit.current[pad] = 1), time)
        }
      Tone.getDraw().schedule(() => setStep(s), time)
    }, "16n")
    if (tr.state !== "started") tr.start()
    return () => {
      tr.clear(id)
      setStep(-1)
    }
  }, [on])

  const hit = (i: number) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    voices.current?.hit(i, Tone.now())
    lit.current[i] = 1
    pressed.current[i] = 1
    setLastPad(i)
    onPress?.(i)
  }
  const release = (i: number) => (pressed.current[i] = 0)
  const lastTap = useRef(0)
  const [tapFlash, setTapFlash] = useState(false)
  const tap = () => {
    const now = performance.now() / 1000
    const gap = now - lastTap.current
    lastTap.current = now
    if (gap > 0.25 && gap < 2) Tone.getTransport().bpm.value = Math.round(60 / gap)
    setTapFlash(true)
    setTimeout(() => setTapFlash(false), 100)
  }
  const toggle = async () => {
    await Tone.start()
    if (playing === undefined) setInner(!on)
    onChange?.(!on)
  }

  useFrame((_, dt) => {
    for (let i = 0; i < 16; i++) {
      lit.current[i] = Math.max(pressed.current[i] ? 0.6 : 0, lit.current[i] - dt * 4)
      const m = padMats.current[i]
      if (m) m.emissiveIntensity = 0.06 + lit.current[i] * 2.2
      const mesh = padMeshes.current[i]
      if (mesh) mesh.position.y = TOP + PAD_H / 2 - (pressed.current[i] ? 0.003 : 0)
    }
  })

  const padGeo = useMemo(() => new RoundedBoxGeometry(PAD, PAD_H, PAD, 3, 0.004), [])
  const plate = useMemo(plateTexture, [])
  const screen = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 400
    c.height = 156
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return { g: c.getContext("2d")!, tex }
  }, [])
  const [bpm, setBpm] = useState(120)
  useEffect(() => {
    const id = setInterval(() => setBpm(Tone.getTransport().bpm.value), 500)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    drawScreen(screen.g, step, on, bpm, lastPad)
    screen.tex.needsUpdate = true
  }, [screen, step, on, bpm, lastPad])
  useEffect(
    () => () => {
      padGeo.dispose()
      plate.dispose()
      screen.tex.dispose()
    },
    [padGeo, plate, screen],
  )

  const btn = (x: number, z: number, active: boolean, ledColor: string, onClick?: () => void) => (
    <group key={z} position={[x, TOP, z]}>
      <mesh visible={false} position={[0, 0.008, 0]} onClick={onClick}>
        <boxGeometry args={[0.034, 0.02, 0.026]} />
      </mesh>
      <RoundedBox args={[0.03, 0.006, 0.02]} radius={0.002} smoothness={2} position={[0, 0.003, 0]}>
        <meshPhysicalMaterial color="#2c2e33" roughness={0.6} clearcoat={0.3} envMap={env} />
      </RoundedBox>
      <mesh position={[-0.009, 0.0062, -0.004]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.0018, 12]} />
        <meshBasicMaterial color={active ? ledColor : "#3a2a26"} toneMapped={false} />
      </mesh>
    </group>
  )

  return (
    <group>
      {/* body */}
      <RoundedBox args={[W, BODY_H, D]} radius={0.008} smoothness={3} position={[0, -H / 2 + BODY_H / 2, 0]}>
        <meshPhysicalMaterial color="#232428" roughness={0.5} clearcoat={0.45} clearcoatRoughness={0.3} envMap={env} />
      </RoundedBox>
      {/* brushed top plate */}
      <mesh position={[0, TOP + 0.0003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PLATE, PLATE]} />
        <meshPhysicalMaterial color="#8d9097" map={plate} metalness={0.9} roughness={0.35} envMap={env} />
      </mesh>
      {/* pad well */}
      <mesh position={[GRID_X, TOP + 0.0006, GRID_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4 * PAD + 4 * GAP, 4 * PAD + 4 * GAP]} />
        <meshStandardMaterial color="#0d0e10" roughness={0.9} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => {
        const [x, z] = padPos(i)
        const glow = color ?? ROW_COLORS[Math.floor(i / 4)]
        return (
          <group key={i}>
            {/* Static hit box: the pad sinks on press, the hit surface must not, or a poke would re-trigger. */}
            <mesh
              visible={false}
              position={[x, TOP + 0.012, z]}
              onPointerDown={() => hit(i)}
              onPointerUp={() => release(i)}
              onPointerCancel={() => release(i)}
              onPointerOut={() => release(i)}
            >
              <boxGeometry args={[PAD, 0.024, PAD]} />
            </mesh>
            <mesh
              ref={(m) => {
                padMeshes.current[i] = m
              }}
              geometry={padGeo}
              position={[x, TOP + PAD_H / 2, z]}
            >
              <meshPhysicalMaterial
                ref={(m) => {
                  padMats.current[i] = m
                }}
                color="#4a4b50"
                roughness={0.85}
                sheen={0.4}
                emissive={glow}
                emissiveIntensity={0.06}
                envMap={env}
              />
            </mesh>
          </group>
        )
      })}
      {/* screen */}
      <mesh position={[SCREEN.x, TOP + 0.0008, SCREEN.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SCREEN.w + 0.008, SCREEN.d + 0.008]} />
        <meshStandardMaterial color="#0a0a0b" roughness={0.3} />
      </mesh>
      <mesh position={[SCREEN.x, TOP + 0.0012, SCREEN.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SCREEN.w, SCREEN.d]} />
        <meshBasicMaterial map={screen.tex} toneMapped={false} />
      </mesh>
      {/* data encoder (decor) */}
      <group position={[0.105, TOP, -0.103]}>
        <mesh position={[0, 0.009, 0]}>
          <cylinderGeometry args={[0.022, 0.023, 0.018, 40]} />
          <meshPhysicalMaterial color="#1a1b1e" roughness={0.5} clearcoat={0.5} envMap={env} />
        </mesh>
        <mesh position={[0, 0.0185, 0]}>
          <cylinderGeometry args={[0.017, 0.017, 0.002, 40]} />
          <meshPhysicalMaterial color="#c9ccd1" metalness={0.9} roughness={0.35} envMap={env} />
        </mesh>
      </group>
      {/* transport column */}
      {BUTTONS.map(([label, z]) =>
        label === "PLAY"
          ? btn(-0.105, z, on, "#36E28A", toggle)
          : label === "STOP"
            ? btn(-0.105, z, !on, "#FF5A36", () => on && void toggle())
            : btn(-0.105, z, tapFlash, "#FFB020", tap),
      )}
    </group>
  )
}
