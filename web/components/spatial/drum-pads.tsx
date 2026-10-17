"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
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

// Spatial mixer bus: a convention on globalThis, not shared code, so this file stays copy-pasteable.
type SpatialBus = { ch: Record<number, Tone.Channel>; meter: Record<number, Tone.Meter> }
function mixerChannel(n: number) {
  const g = globalThis as typeof globalThis & { __spatialMixer?: SpatialBus }
  const bus = (g.__spatialMixer ??= { ch: {}, meter: {} })
  if (!bus.ch[n]) {
    bus.ch[n] = new Tone.Channel().toDestination()
    bus.meter[n] = new Tone.Meter({ normalRange: true, smoothing: 0.8 })
    bus.ch[n].connect(bus.meter[n])
  }
  return bus.ch[n]
}


// Real-world size (metres). Origin = centre-bottom; front faces +Z. The body tilts toward the user (`tilt`) on a rear leg.
const S = 0.28 // body width and depth
const T = 0.035 // body thickness
const PAD = 0.054
const PITCH = 0.064
const PAD_H = 0.016
const PAD_Y = 0.025 // pad centre above the body centre
const padXZ = (i: number): [number, number] => [((i % 4) - 1.5) * PITCH, (1.5 - Math.floor(i / 4)) * PITCH] // row 0 = nearest the user
const padBase = (i: number) => 0.5 + (((i % 4) + Math.floor(i / 4)) % 3) * 0.18 // resting glow varies a little, like real backlit silicone
const VOICES = ["kick", "snare", "clap", "hat", "openhat", "rim", "tomlo", "tomhi", "cowbell", "shaker", "perc", "crash", "bass1", "bass2", "bass3", "bass4"] as const
const NAMES = ["KICK", "SNARE", "CLAP", "HAT", "OPEN HAT", "RIM", "TOM LO", "TOM HI", "COWBELL", "SHAKER", "CLAVE", "CRASH", "808 C", "808 D#", "808 F", "808 G"]
const BASS = ["C1", "D#1", "F1", "G1"]

type Kit = { hit: (i: number, vel: number) => void; out: Tone.Volume; dispose: () => void }

function makeKit(): Kit {
  const out = new Tone.Volume(0)
  const comp = new Tone.Compressor({ threshold: -16, ratio: 4, attack: 0.003, release: 0.12 }).connect(out)
  const nodes: Tone.ToneAudioNode[] = [out, comp]
  const add = <N extends Tone.ToneAudioNode>(n: N, to: Tone.InputNode = comp) => {
    n.connect(to)
    nodes.push(n)
    return n
  }
  const kick = add(new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 7, envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.1 }, volume: 2 }))
  const click = add(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.0005, decay: 0.006, sustain: 0 }, volume: -16 }), add(new Tone.Filter(3000, "highpass")))
  const snBody = add(new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2.5, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -6 }))
  const snNoise = add(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.17, sustain: 0 }, volume: -8 }), add(new Tone.Filter(1400, "highpass")))
  const clapF = add(new Tone.Filter({ frequency: 1300, type: "bandpass", Q: 1.1 }))
  const clap = add(new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.012, sustain: 0 }, volume: 2 }), clapF)
  const clapTail = add(new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.002, decay: 0.24, sustain: 0 }, volume: -1 }), clapF)
  const hat = add(new Tone.MetalSynth({ harmonicity: 5.1, modulationIndex: 32, resonance: 5200, octaves: 1.4, envelope: { attack: 0.001, decay: 0.05, release: 0.02 }, volume: -18 }))
  const open = add(new Tone.MetalSynth({ harmonicity: 5.1, modulationIndex: 32, resonance: 4800, octaves: 1.4, envelope: { attack: 0.001, decay: 0.45, release: 0.2 }, volume: -20 }))
  const rim = add(new Tone.MembraneSynth({ pitchDecay: 0.006, octaves: 2, envelope: { attack: 0.0005, decay: 0.045, sustain: 0 }, volume: -6 }))
  const tom = add(new Tone.MembraneSynth({ pitchDecay: 0.09, octaves: 3, envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.2 }, volume: -2 }))
  const tomHi = add(new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 }, volume: -3 }))
  const bellF = add(new Tone.Filter({ frequency: 1100, type: "bandpass", Q: 2.2 }))
  const bellOpts = { oscillator: { type: "square" as const }, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.05 }, volume: -8 }
  const bellA = add(new Tone.Synth(bellOpts), bellF)
  const bellB = add(new Tone.Synth(bellOpts), bellF)
  const shaker = add(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.012, decay: 0.07, sustain: 0 }, volume: -12 }), add(new Tone.Filter(6500, "highpass")))
  const clave = add(new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.0005, decay: 0.05, sustain: 0, release: 0.02 }, volume: -4 }))
  const crash = add(new Tone.MetalSynth({ harmonicity: 4.1, modulationIndex: 40, resonance: 7000, octaves: 1.8, envelope: { attack: 0.002, decay: 1.6, release: 0.8 }, volume: -22 }))
  const sweepF = add(new Tone.AutoFilter({ frequency: 0.6, baseFrequency: 600, octaves: 4, type: "sine" }).start())
  const sweep = add(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.01, decay: 1.4, sustain: 0 }, volume: -20 }), sweepF)
  const drive = add(new Tone.Distortion({ distortion: 0.35, wet: 0.45 })) // harmonics so the 808 reads on small speakers
  const bass = add(new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 1.6, oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 1.1, sustain: 0.15, release: 0.4 }, volume: 1 }), drive)

  return {
    out,
    hit: (i, v) => {
      const t = Tone.immediate() // no lookahead: a pad must speak the instant it is touched
      switch (VOICES[i]) {
        case "kick":
          kick.triggerAttackRelease("C1", 0.35, t, v)
          click.triggerAttackRelease(0.006, t, v)
          break
        case "snare":
          snBody.triggerAttackRelease("G2", 0.1, t, v)
          snNoise.triggerAttackRelease(0.17, t, v)
          break
        case "clap":
          ;[0, 0.011, 0.022].forEach((d) => clap.triggerAttackRelease(0.01, t + d, v))
          clapTail.triggerAttackRelease(0.24, t + 0.03, v)
          break
        case "hat":
          open.triggerRelease(t) // closed hat chokes the open one, like a real kit
          hat.triggerAttackRelease(320, 0.05, t, v)
          break
        case "openhat":
          open.triggerAttackRelease(320, 0.45, t, v)
          break
        case "rim":
          rim.triggerAttackRelease("E5", 0.04, t, v)
          break
        case "tomlo":
          tom.triggerAttackRelease("G2", 0.4, t, v)
          break
        case "tomhi":
          tomHi.triggerAttackRelease("D3", 0.3, t, v)
          break
        case "cowbell":
          bellA.triggerAttackRelease(540, 0.3, t, v)
          bellB.triggerAttackRelease(800, 0.3, t, v)
          break
        case "shaker":
          shaker.triggerAttackRelease(0.08, t, v)
          break
        case "perc":
          clave.triggerAttackRelease(2500, 0.04, t, v)
          break
        case "crash":
          crash.triggerAttackRelease(260, 1.6, t, v)
          sweep.triggerAttackRelease(1.4, t, v)
          break
        default:
          bass.triggerAttackRelease(BASS[i - 12], 0.9, t, v)
      }
    },
    dispose: () => nodes.forEach((n) => n.dispose()),
  }
}

/** Printed top face: dark satin with pad names in the gaps. Canvas top = back of the body. */
function deckTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 1024
  const g = c.getContext("2d")!
  const s = 1024 / S
  const px = (x: number) => (x + S / 2) * s
  g.fillStyle = "#1a1d25"
  g.fillRect(0, 0, 1024, 1024)
  for (let y = 0; y < 1024; y += 2) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.015})`
    g.fillRect(0, y, 1024, 1)
  }
  g.fillStyle = "#9AA0AD"
  g.font = "600 15px ui-monospace, Menlo, monospace"
  g.textAlign = "center"
  NAMES.forEach((n, i) => {
    const [x, z] = padXZ(i)
    g.fillText(n, px(x), px(z + PAD / 2) + 17)
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Soft radial falloff for the additive halo under the pads. */
function glowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, "rgba(255,255,255,1)")
  grad.addColorStop(0.45, "rgba(255,255,255,0.45)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

type Props = {
  /** Pad glow colour */
  color?: string
  /** Mixer channel this instrument plays into (1 = DRUMS in the Night Set) */
  channel?: number
  /** Output level 0-1 */
  volume?: number
  /** Tilt toward the user, radians (applied around local X). */
  tilt?: number
  /** Base URL of a sample kit (`<url>/kit.json` lists `voices` + `format`). Listed voices play the samples; the rest stay synthesized. */
  samples?: string
  /** Bindable value; ignored as input, exists so `onHit` can be wired. */
  hit?: string
  /** Fires on every hit as `voice:velocity:seq`, e.g. `kick:0.92:17` (seq makes equal hits distinct). */
  onHit?: (value: string) => void
  /** Fires with the voice name on every hit. */
  onPress?: (voice: string) => void
}

/**
 * 4x4 drum pad controller on a tilted stand: 16 backlit pads, each its own synthesized voice
 * (kit, percussion, crash, four 808 bass notes). Hit harder toward a pad's centre for more velocity.
 */
export default function DrumPads({ color = "#3B82F6", channel = 1, volume = 0.8, tilt = 0.5, samples, onHit, onPress }: Props) {
  const env = useRoomEnv()
  const kit = useRef<Kit | null>(null)
  const seq = useRef(0)
  const lit = useRef(new Float32Array(16))
  const press = useRef(new Float32Array(16))
  const pressed = useRef(new Uint8Array(16))
  const hover = useRef(new Uint8Array(16))
  const pads = useRef<(THREE.Mesh | null)[]>([])
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const halo = useRef<THREE.MeshBasicMaterial>(null)

  useEffect(() => {
    const k = makeKit()
    kit.current = k
    return () => {
      k.dispose()
      kit.current = null
    }
  }, [])
  useEffect(() => {
    const out = kit.current?.out
    if (!out) return
    out.disconnect()
    out.connect(mixerChannel(channel))
  }, [channel])
  useEffect(() => {
    const out = kit.current?.out
    if (!out) return
    out.mute = volume < 0.01
    if (volume >= 0.01) out.volume.rampTo(Tone.gainToDb(volume * volume) + 2, 0.05)
  }, [volume])

  // Optional sample kit: any voice it lists plays the sample; anything missing (or a failed load) falls back to the synth.
  const players = useRef<Record<string, { p: Tone.Player; t: number }>>({})
  useEffect(() => {
    const out = kit.current?.out
    if (!samples || !out) return
    let dead = false
    const made: Tone.Player[] = []
    fetch(`${samples}/kit.json`)
      .then((r) => r.json() as Promise<{ voices?: string[]; format?: string }>)
      .then((k) =>
        Promise.all(
          (k.voices ?? []).filter((v) => (VOICES as readonly string[]).includes(v)).map(async (v) => {
            const buf = await new Tone.ToneAudioBuffer().load(`${samples}/${v}.${k.format ?? "mp3"}`)
            if (dead) return
            const p = new Tone.Player(buf).connect(out)
            p.fadeOut = 0.008
            made.push(p)
            players.current[v] = { p, t: 0 }
          }),
        ),
      )
      .catch((err) => console.warn("drum-pads: sample kit failed, using synth voices", err))
    return () => {
      dead = true
      made.forEach((p) => p.dispose())
      players.current = {}
    }
  }, [samples])

  const down = (i: number, e: ThreeEvent<PointerEvent>) => {
    void Tone.start() // browsers stay silent until a user gesture resumes audio
    const p = e.object.worldToLocal(e.point.clone())
    const off = Math.min(1, Math.max(Math.abs(p.x), Math.abs(p.z)) / (PAD / 2))
    const vel = 1 - 0.4 * off * off // centre = full, edge = 0.6
    const s = players.current[VOICES[i]]
    if (s) {
      const t = Math.max(Tone.immediate(), s.t + 0.002) // Tone asserts each restart is strictly later
      s.t = t
      s.p.volume.setValueAtTime(Tone.gainToDb(vel), t)
      s.p.start(t)
    } else kit.current?.hit(i, vel)
    lit.current[i] = 0.6 + 0.4 * vel
    pressed.current[i] = 1
    seq.current++
    onHit?.(`${VOICES[i]}:${vel.toFixed(2)}:${seq.current}`)
    onPress?.(VOICES[i])
  }
  const up = (i: number) => (pressed.current[i] = 0)

  const geo = useMemo(() => new RoundedBoxGeometry(PAD, PAD_H, PAD, 3, 0.004), [])
  const tex = useMemo(() => ({ deck: deckTexture(), glow: glowTexture() }), [])
  useEffect(
    () => () => {
      geo.dispose()
      Object.values(tex).forEach((t) => t.dispose())
    },
    [geo, tex],
  )

  useFrame((_, dt) => {
    let flash = 0
    for (let i = 0; i < 16; i++) {
      lit.current[i] = Math.max(pressed.current[i] ? 0.4 : 0, lit.current[i] - dt * 3.2)
      press.current[i] += ((pressed.current[i] ? 1 : 0) - press.current[i]) * Math.min(1, dt * 30)
      flash = Math.max(flash, lit.current[i])
      const m = mats.current[i]
      if (m) m.emissiveIntensity = padBase(i) + hover.current[i] * 0.25 + lit.current[i] * 2.6
      const mesh = pads.current[i]
      if (mesh) mesh.position.y = PAD_Y - press.current[i] * 0.004
    }
    if (halo.current) halo.current.opacity = 0.55 + flash * 0.35
  })

  // Lift so the tilted body's front edge rests on the desk (y = 0).
  const lift = (T / 2) * Math.cos(tilt) + (S / 2) * Math.sin(tilt)
  return (
    <group position={[0, lift, 0]} rotation={[tilt, 0, 0]}>
      <RoundedBox args={[S, T, S]} radius={0.005} smoothness={3}>
        <meshStandardMaterial color="#1a1d25" roughness={0.55} metalness={0.15} envMap={env} envMapIntensity={0.6} />
      </RoundedBox>
      <mesh position={[0, T / 2 + 0.0006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[S - 0.006, S - 0.006]} />
        <meshStandardMaterial map={tex.deck} roughness={0.55} metalness={0.15} envMap={env} envMapIntensity={0.6} />
      </mesh>
      {/* rear leg: counter-rotated so it stands vertical and the unit rests on the desk */}
      <mesh position={[0, -0.071, -0.098]} rotation={[-tilt, 0, 0]}>
        <boxGeometry args={[0.24, 0.13, 0.03]} />
        <meshStandardMaterial color="#1a1d25" roughness={0.55} metalness={0.15} envMap={env} envMapIntensity={0.6} />
      </mesh>
      {/* additive halo under the pads */}
      <mesh position={[0, 0.019, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[0.42, 0.42]} />
        <meshBasicMaterial ref={halo} map={tex.glow} color={color} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {VOICES.map((v, i) => {
        const [x, z] = padXZ(i)
        return (
          <group key={v} position={[x, 0, z]}>
            <mesh
              ref={(m) => {
                pads.current[i] = m
              }}
              geometry={geo}
              position={[0, PAD_Y, 0]}
            >
              <meshStandardMaterial
                ref={(m) => {
                  mats.current[i] = m
                }}
                color={color}
                emissive={color}
                emissiveIntensity={padBase(i)}
                roughness={0.4}
                metalness={0.15}
              />
            </mesh>
            {/* Static hit box: the pad sinks on press, the hit surface must not, or a poke would re-trigger. */}
            <mesh
              visible={false}
              position={[0, PAD_Y + 0.004, 0]}
              onPointerDown={(e) => down(i, e)}
              onPointerUp={() => up(i)}
              onPointerCancel={() => up(i)}
              onPointerOut={() => {
                up(i)
                hover.current[i] = 0
              }}
              onPointerOver={() => (hover.current[i] = 1)}
            >
              <boxGeometry args={[PAD + 0.006, 0.024, PAD + 0.006]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
