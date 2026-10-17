"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react"
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

// Real-world size (metres): a compact 8-channel desk mixer. Origin = bounding-box centre; front faces +Z.
const W = 0.46
const D = 0.34
const BODY_H = 0.045
const H = BODY_H + 0.016
const TOP = -H / 2 + BODY_H
const N = 8
const STRIP = 0.042
const chX = (i: number) => -W / 2 + 0.046 + i * STRIP
const MASTER_X = 0.17
const METER_X = 0.205
const Z_TOP = 0.005 // fader at max
const TRAVEL = 0.1
const capZ = (v: number) => Z_TOP + (1 - v) * TRAVEL
const Z = { lcd: -0.142, gain: -0.11, pan: -0.076, mute: -0.04 }
const LEDS = 12
const DEFAULT_LABELS = "KICK,SNARE,HATS,CLAP,BASS,KEYS,VOX,FX"
const PW = W - 0.012 // printed top plate, inside the rounded edge
const PD = D - 0.012
const clamp = (v: number) => Math.min(1, Math.max(0, v))
const faderDb = (v: number) => (v < 0.01 ? -60 : Math.max(-60, Math.min(6, 40 * Math.log10(v / 0.8)))) // 0.8 = unity
const TEMPO = { x: 0.163, z: -0.072, r: 0.019 }
const BPM_LCD = { z: -0.04, w: 0.05, d: 0.014 }
const CH_LEDS = 10
const chLedX = (i: number) => chX(i) + 0.0145

/** Printed legend on the anodised top. Canvas top = back of the desk. */
function panelTexture() {
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = Math.round((1024 * PD) / PW)
  const g = c.getContext("2d")!
  const s = 1024 / PW
  const px = (x: number) => (x + PW / 2) * s
  const pz = (z: number) => (z + PD / 2) * s
  g.fillStyle = "#2b2d32"
  g.fillRect(0, 0, c.width, c.height)
  for (let y = 0; y < c.height; y += 2) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`
    g.fillRect(0, y, c.width, 1)
  }
  g.fillStyle = "#d9dce1"
  g.strokeStyle = "#d9dce1"
  g.textAlign = "center"
  const strip = (x: number, label: string, master = false) => {
    // fader slot + ticks
    g.fillStyle = "#08090a"
    g.fillRect(px(x) - 3, pz(Z_TOP - 0.006), 6, (TRAVEL + 0.012) * s)
    g.fillStyle = "#d9dce1"
    for (let k = 0; k <= 10; k++) {
      const y = pz(Z_TOP + (k / 10) * TRAVEL)
      const len = k % 5 === 0 ? 12 : 7
      g.fillRect(px(x) - 14 - len + 6, y - 1, len, 2)
      g.fillRect(px(x) + 8, y - 1, len, 2)
    }
    g.font = "600 13px Helvetica, Arial, sans-serif"
    g.fillText(label, px(x), pz(Z_TOP + TRAVEL + 0.02))
    if (master) return
    g.font = "500 11px Helvetica, Arial, sans-serif"
    g.fillText("GAIN", px(x), pz(Z.gain) + 0.016 * s)
    g.fillText("PAN", px(x), pz(Z.pan) + 0.016 * s)
    g.fillText("MUTE", px(x), pz(Z.mute) + 0.016 * s)
  }
  for (let i = 0; i < N; i++) strip(chX(i), String(i + 1))
  strip(MASTER_X, "MAIN", true)
  // fader scale beside channel 1
  g.font = "500 10px Helvetica, Arial, sans-serif"
  g.textAlign = "right"
  ;[["+10", 0], ["0", 0.25], ["-10", 0.5], ["-30", 0.75], ["-∞", 1]].forEach(([t, k]) =>
    g.fillText(t as string, px(chX(0) - 0.017), pz(Z_TOP + (k as number) * TRAVEL) + 4),
  )
  g.textAlign = "left"
  g.font = "800 22px Helvetica, Arial, sans-serif"
  g.fillText("SPATIAL", px(MASTER_X - 0.035), pz(-0.15))
  g.font = "500 13px Helvetica, Arial, sans-serif"
  g.fillText("MX-8 MIXING CONSOLE", px(MASTER_X - 0.035), pz(-0.15) + 18)
  g.textAlign = "center"
  g.font = "700 14px Helvetica, Arial, sans-serif"
  g.fillText("TEMPO", px(TEMPO.x), pz(TEMPO.z - TEMPO.r - 0.009))
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * 0.75 + (k / 12) * Math.PI * 1.5
    const r0 = (TEMPO.r + 0.002) * s
    const r1 = (TEMPO.r + (k % 6 === 0 ? 0.006 : 0.0042)) * s
    g.lineWidth = k % 6 === 0 ? 3 : 2
    g.beginPath()
    g.moveTo(px(TEMPO.x) + Math.cos(a) * r0, pz(TEMPO.z) + Math.sin(a) * r0)
    g.lineTo(px(TEMPO.x) + Math.cos(a) * r1, pz(TEMPO.z) + Math.sin(a) * r1)
    g.stroke()
  }
  g.fillStyle = "#08090a"
  g.fillRect(px(TEMPO.x - BPM_LCD.w / 2 - 0.002), pz(BPM_LCD.z - BPM_LCD.d / 2 - 0.002), (BPM_LCD.w + 0.004) * s, (BPM_LCD.d + 0.004) * s)
  g.fillStyle = "#d9dce1"
  g.textAlign = "left"
  g.font = "500 13px Helvetica, Arial, sans-serif"
  g.fillText("L", px(METER_X - 0.008), pz(-0.012) + 14)
  g.fillText("R", px(METER_X + 0.004), pz(-0.012) + 14)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function lcdTexture(labels: string[]) {
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = 48
  const g = c.getContext("2d")!
  g.fillStyle = "#050607"
  g.fillRect(0, 0, 1024, 48)
  const cw = 1024 / N
  g.font = "700 22px ui-monospace, Menlo, monospace"
  g.textAlign = "center"
  labels.forEach((l, i) => {
    g.fillStyle = "#0c2a3a"
    g.fillRect(i * cw + 6, 4, cw - 12, 40)
    g.fillStyle = "#bfe9ff"
    g.fillText(l.slice(0, 6).toUpperCase(), i * cw + cw / 2, 32)
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

type FaderProps = { x: number; v: number; set: (v: number) => void; root: RefObject<THREE.Group | null>; capColor: string; env: THREE.Texture }

function Fader({ x, v, set, root, capColor, env }: FaderProps) {
  const drag = useRef<{ p: THREE.Vector3; v: number } | null>(null)
  const local = (e: ThreeEvent<PointerEvent>) => root.current!.worldToLocal(e.point.clone())
  const z = capZ(v)
  return (
    <group position={[x, TOP, z]}>
      <mesh
        visible={false}
        position={[0, 0.01, 0]}
        onPointerDown={(e) => {
          ;(e.target as Element).setPointerCapture(e.pointerId)
          drag.current = { p: local(e), v }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const p = local(e)
          set(clamp(drag.current.v + (drag.current.p.z - p.z + p.y - drag.current.p.y) / TRAVEL)) // away or up = louder
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <boxGeometry args={[0.03, 0.03, 0.032]} />
      </mesh>
      <mesh position={[0, 0.003, 0]}>
        <boxGeometry args={[0.004, 0.006, 0.006]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <RoundedBox args={[0.016, 0.012, 0.024]} radius={0.003} smoothness={2} position={[0, 0.011, 0]}>
        <meshPhysicalMaterial color={capColor} roughness={0.35} clearcoat={0.6} envMap={env} />
      </RoundedBox>
      <mesh position={[0, 0.0172, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.014, 0.0016]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function bpmTexture() {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 72
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return { g: c.getContext("2d")!, t }
}

type TempoKnobProps = { bpm: number; set: (bpm: number) => void; root: RefObject<THREE.Group | null>; env: THREE.Texture }

/** Big TEMPO knob (60-180 BPM). Drag up, away or right to speed up. */
function TempoKnob({ bpm, set, root, env }: TempoKnobProps) {
  const [hover, setHover] = useState(false)
  const t = (bpm - 60) / 120
  const drag = useRef<{ p: THREE.Vector3; t: number } | null>(null)
  const local = (e: ThreeEvent<PointerEvent>) => root.current!.worldToLocal(e.point.clone())
  const up = () => (drag.current = null)
  return (
    <group position={[TEMPO.x, TOP, TEMPO.z]}>
      <mesh
        visible={false}
        position={[0, 0.012, 0]}
        onPointerDown={(e) => {
          ;(e.target as Element).setPointerCapture(e.pointerId)
          drag.current = { p: local(e), t }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const p = local(e)
          const d = p.y - drag.current.p.y + (drag.current.p.z - p.z) + (p.x - drag.current.p.x)
          set(Math.round(60 + clamp(drag.current.t + d / 0.12) * 120))
        }}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <cylinderGeometry args={[TEMPO.r + 0.004, TEMPO.r + 0.004, 0.03, 20]} />
      </mesh>
      <group rotation={[0, Math.PI * 0.75 - t * Math.PI * 1.5, 0]}>
        <mesh position={[0, 0.009, 0]}>
          <cylinderGeometry args={[TEMPO.r - 0.001, TEMPO.r, 0.018, 48]} />
          <meshPhysicalMaterial color={hover ? "#2c303b" : "#1c1f28"} roughness={0.45} clearcoat={0.5} envMap={env} />
        </mesh>
        <mesh position={[0, 0.0185, 0]}>
          <cylinderGeometry args={[TEMPO.r - 0.004, TEMPO.r - 0.003, 0.002, 48]} />
          <meshPhysicalMaterial color="#c9ccd3" metalness={0.9} roughness={0.3} envMap={env} />
        </mesh>
        <mesh position={[0, 0.0198, -(TEMPO.r - 0.009)]}>
          <boxGeometry args={[0.002, 0.0008, 0.009]} />
          <meshBasicMaterial color="#9FE7D2" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * 8-channel mixing console: channel faders with mute buttons + LEDs, LCD scribble strips, and a MAIN fader that sets
 * the real master volume (Tone.js), with a live stereo meter. `values` (8 numbers, 0-1) and `muted` are controlled-or-uncontrolled.
 * Channel n's fader + mute drive the shared mixer bus channel n (`globalThis.__spatialMixer`), and its LEDs show that channel's level.
 * The TEMPO knob sets the shared Tone transport BPM.
 */
export default function MixingConsole({
  values,
  onChange,
  muted,
  onMuteChange,
  master,
  onMasterChange,
  labels = DEFAULT_LABELS,
  tempo,
  onTempoChange,
}: {
  values?: number[]
  onChange?: (values: number[]) => void
  muted?: boolean[]
  onMuteChange?: (muted: boolean[]) => void
  /** MAIN fader 0-1 (0.8 = unity gain). Moves the real master output. */
  master?: number
  onMasterChange?: (v: number) => void
  /** Comma-separated scribble-strip names */
  labels?: string
  /** BPM 60-180. Also sets the shared Tone transport tempo. */
  tempo?: number
  onTempoChange?: (bpm: number) => void
}) {
  const env = useRoomEnv()
  const root = useRef<THREE.Group>(null)
  const [innerVals, setInnerVals] = useState(() => [0.8, 0.72, 0.6, 0.65, 0.78, 0.55, 0.7, 0.5])
  const [innerMute, setInnerMute] = useState(() => Array<boolean>(N).fill(false))
  const [innerMaster, setInnerMaster] = useState(0.8)
  const vals = Array.from({ length: N }, (_, i) => clamp(values?.[i] ?? innerVals[i]))
  const mutes = Array.from({ length: N }, (_, i) => muted?.[i] ?? innerMute[i])
  const main = clamp(master ?? innerMaster)

  const setVal = (i: number, v: number) => {
    const next = vals.slice()
    next[i] = v
    if (values === undefined) setInnerVals(next)
    onChange?.(next)
  }
  const toggleMute = (i: number) => {
    const next = mutes.slice()
    next[i] = !next[i]
    if (muted === undefined) setInnerMute(next)
    onMuteChange?.(next)
  }
  // Only touch the global output once someone moves MAIN (or binds it), so placing a console never changes the room's volume.
  const touched = useRef(master !== undefined)
  const setMain = (v: number) => {
    touched.current = true
    if (master === undefined) setInnerMaster(v)
    onMasterChange?.(v)
  }
  useEffect(() => {
    if (!touched.current && master === undefined) return
    const d = Tone.getDestination()
    if (main < 0.01) d.volume.rampTo(-80, 0.05)
    else d.volume.rampTo(Math.min(6, 40 * Math.log10(main / 0.8)), 0.05)
  }, [main, master])

  // Faders + mutes drive the shared mixer bus, so instruments on channel n really get mixed.
  const volKey = vals.join()
  const muteKey = mutes.join()
  useEffect(() => {
    vals.forEach((v, i) => {
      const ch = mixerChannel(i + 1)
      ch.volume.rampTo(faderDb(v), 0.05)
      ch.mute = mutes[i]
    })
  }, [volKey, muteKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // TEMPO: controlled by `tempo`, else local; only writes the transport once bound or turned, so placing a console keeps the room's tempo.
  const [innerTempo, setInnerTempo] = useState(() => Math.round(Tone.getTransport().bpm.value))
  const bpm = Math.min(180, Math.max(60, Math.round(tempo ?? innerTempo)))
  const tempoTouched = useRef(tempo !== undefined)
  const setTempo = (b: number) => {
    if (b === bpm) return
    tempoTouched.current = true
    if (tempo === undefined) setInnerTempo(b)
    onTempoChange?.(b)
  }
  useEffect(() => {
    if (tempoTouched.current || tempo !== undefined) Tone.getTransport().bpm.value = bpm
  }, [bpm, tempo])
  const bpmLcd = useMemo(bpmTexture, [])
  useEffect(() => {
    const { g, t } = bpmLcd
    g.fillStyle = "#0B0C10"
    g.fillRect(0, 0, 256, 72)
    g.fillStyle = "#9FE7D2"
    g.font = "700 46px ui-monospace, Menlo, monospace"
    g.textAlign = "right"
    g.fillText(String(bpm), 160, 54)
    g.fillStyle = "#9AA0AD"
    g.font = "600 24px ui-monospace, Menlo, monospace"
    g.textAlign = "left"
    g.fillText("BPM", 174, 54)
    t.needsUpdate = true
  }, [bpmLcd, bpm])
  useEffect(() => () => bpmLcd.t.dispose(), [bpmLcd])

  const panel = useMemo(panelTexture, [])
  const lcd = useMemo(() => lcdTexture(labels.split(",").map((s) => s.trim())), [labels])
  useEffect(() => () => panel.dispose(), [panel])
  useEffect(() => () => lcd.dispose(), [lcd])

  // Decorative gain/pan knobs: two instanced meshes, 16 each.
  const knobs = useRef<THREE.InstancedMesh>(null)
  const marks = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const one = new THREE.Vector3(1, 1, 1)
    for (let i = 0; i < N * 2; i++) {
      const x = chX(i % N)
      const z = i < N ? Z.gain : Z.pan
      const a = i < N ? 0.6 - ((i * 37) % 10) / 10 : 0
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a)
      knobs.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, TOP + 0.006, z), q, one))
      const tip = new THREE.Vector3(0, 0, -0.0045).applyQuaternion(q)
      marks.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x + tip.x, TOP + 0.0122, z + tip.z), q, one))
    }
    if (knobs.current) knobs.current.instanceMatrix.needsUpdate = true
    if (marks.current) marks.current.instanceMatrix.needsUpdate = true
  }, [])

  // Live stereo meter on the master output.
  const meter = useRef<Tone.Meter | null>(null)
  useEffect(() => {
    const m = new Tone.Meter({ channelCount: 2, smoothing: 0.8 })
    const out = Tone.getDestination()
    out.connect(m)
    meter.current = m
    return () => {
      out.disconnect(m)
      m.dispose()
      meter.current = null
    }
  }, [])
  const leds = useRef<THREE.InstancedMesh>(null)
  const ledColor = useMemo(() => new THREE.Color(), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    for (let c = 0; c < 2; c++)
      for (let k = 0; k < LEDS; k++) {
        leds.current?.setMatrixAt(c * LEDS + k, m.makeTranslation(METER_X + (c ? 0.006 : -0.006), TOP + 0.001, -0.022 - k * 0.0085))
        leds.current?.setColorAt(c * LEDS + k, ledColor.set("#1d1f22"))
      }
    if (leds.current) leds.current.instanceMatrix.needsUpdate = true
  }, [ledColor])
  const chLeds = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    for (let i = 0; i < N; i++)
      for (let k = 0; k < CH_LEDS; k++) {
        chLeds.current?.setMatrixAt(i * CH_LEDS + k, m.makeTranslation(chLedX(i), TOP + 0.0008, capZ(0) - 0.004 - k * 0.0098))
        chLeds.current?.setColorAt(i * CH_LEDS + k, ledColor.set("#1d1f22"))
      }
    if (chLeds.current) chLeds.current.instanceMatrix.needsUpdate = true
  }, [ledColor])
  const chLit = useRef(Array<number>(N).fill(-1))
  const lit = useRef([-1, -1])
  useFrame(() => {
    const bus = (globalThis as typeof globalThis & { __spatialMixer?: SpatialBus }).__spatialMixer
    let chChanged = false
    for (let i = 0; i < N; i++) {
      const g = bus?.meter[i + 1]?.getValue()
      const lvl = typeof g === "number" ? g : 0
      const n = lvl > 0 ? Math.round(clamp((Tone.gainToDb(lvl) + 48) / 48) * CH_LEDS) : 0
      if (n === chLit.current[i]) continue
      chLit.current[i] = n
      chChanged = true
      for (let k = 0; k < CH_LEDS; k++)
        chLeds.current?.setColorAt(i * CH_LEDS + k, ledColor.set(k >= n ? "#1d1f22" : k < 7 ? "#9FE7D2" : k < 9 ? "#F2B48A" : "#ff4a3a"))
    }
    if (chChanged && chLeds.current?.instanceColor) chLeds.current.instanceColor.needsUpdate = true

    const g = meter.current?.getValue()
    const db = Array.isArray(g) ? g : [g ?? -Infinity, g ?? -Infinity]
    let changed = false
    for (let c = 0; c < 2; c++) {
      const n = Math.round(clamp((db[c] + 48) / 48) * LEDS)
      if (n === lit.current[c]) continue
      lit.current[c] = n
      changed = true
      for (let k = 0; k < LEDS; k++)
        leds.current?.setColorAt(c * LEDS + k, ledColor.set(k >= n ? "#1d1f22" : k < 8 ? "#26e07a" : k < 10 ? "#ffc23a" : "#ff4a3a"))
    }
    if (changed && leds.current?.instanceColor) leds.current.instanceColor.needsUpdate = true
  })

  return (
    <group ref={root}>
      <RoundedBox args={[W, BODY_H, D]} radius={0.008} smoothness={3} position={[0, -H / 2 + BODY_H / 2, 0]}>
        <meshPhysicalMaterial color="#1c1d21" roughness={0.45} clearcoat={0.4} envMap={env} />
      </RoundedBox>
      <mesh position={[0, TOP + 0.0003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PW, PD]} />
        <meshPhysicalMaterial map={panel} metalness={0.6} roughness={0.45} envMap={env} />
      </mesh>
      {/* scribble strips */}
      <mesh position={[(chX(0) + chX(N - 1)) / 2, TOP + 0.0008, Z.lcd]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[N * STRIP, 0.016]} />
        <meshBasicMaterial map={lcd} toneMapped={false} />
      </mesh>
      <instancedMesh ref={knobs} args={[undefined, undefined, N * 2]}>
        <cylinderGeometry args={[0.0075, 0.0085, 0.012, 20]} />
        <meshPhysicalMaterial color="#26272b" roughness={0.5} clearcoat={0.5} envMap={env} />
      </instancedMesh>
      <instancedMesh ref={marks} args={[undefined, undefined, N * 2]}>
        <boxGeometry args={[0.0012, 0.0005, 0.0055]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh ref={chLeds} args={[undefined, undefined, N * CH_LEDS]}>
        <boxGeometry args={[0.003, 0.0012, 0.0062]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* TEMPO knob + BPM readout */}
      <TempoKnob bpm={bpm} set={setTempo} root={root} env={env} />
      <mesh position={[TEMPO.x, TOP + 0.0008, BPM_LCD.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BPM_LCD.w, BPM_LCD.d]} />
        <meshBasicMaterial map={bpmLcd.t} toneMapped={false} />
      </mesh>
      <instancedMesh ref={leds} args={[undefined, undefined, 2 * LEDS]}>
        <boxGeometry args={[0.008, 0.0012, 0.006]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {vals.map((v, i) => (
        <group key={i}>
          <Fader x={chX(i)} v={v} set={(n) => setVal(i, n)} root={root} capColor="#d3d6da" env={env} />
          {/* mute button + LED */}
          <group position={[chX(i), TOP, Z.mute]}>
            <mesh visible={false} position={[0, 0.008, 0]} onClick={() => toggleMute(i)}>
              <boxGeometry args={[0.032, 0.02, 0.024]} />
            </mesh>
            <RoundedBox args={[0.026, 0.007, 0.016]} radius={0.002} smoothness={2} position={[0, 0.0035, 0]}>
              <meshPhysicalMaterial color={mutes[i] ? "#5a1d1d" : "#34363b"} roughness={0.5} clearcoat={0.4} envMap={env} />
            </RoundedBox>
            <mesh position={[0, 0.0073, -0.003]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.0022, 12]} />
              <meshBasicMaterial color={mutes[i] ? "#ff3b30" : "#3b1a18"} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
      <Fader x={MASTER_X} v={main} set={setMain} root={root} capColor="#d23a32" env={env} />
    </group>
  )
}
