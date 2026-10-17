"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Group, MeshBasicMaterial } from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import * as Tone from "tone"

const BG = "#0B0C10"
const SURFACE = "#15171E"
const BORDER = "#242833"
const BORDER2 = "#323745"
const RAISED = "#3A4050"
const TEXT = "#EEF0F4"
const MUTED = "#9AA0AD"
const FAINT = "#6B7180"
const ACCENT = "#9FE7D2"
const WARM = "#F2B48A"

const W = 0.1 // plate, metres
const H = 0.4
const FRONT = 0.006
const TRAVEL = 0.15
const FADER_X = -0.012
const FADER_Y = -0.07
const CAP = [0.04, 0.022, 0.016] as const
const PAN_Y = 0.12
const KNOB_R = 0.016
const MUTE_Y = 0.05
const SWEEP = 1.5 * Math.PI
const SEGS = 12

const angle = (t: number) => 1.25 * Math.PI - t * SWEEP // knob angle for 0-1, CCW from +x
/** Fader position (0-1) -> gain in dB, on a 40-log10 taper: 0.75 ≈ -5 dB, 0.5 ≈ -12 dB. */
const toDb = (v: number) => 40 * Math.log10(Math.max(0, v))

type Props = {
  volume?: number
  pan?: number
  mute?: boolean
  onVolumeChange?: (v: number) => void
  onPanChange?: (v: number) => void
  onMuteChange?: (v: boolean) => void
  label?: string
  color?: string
}

/**
 * 10 x 40 cm channel strip: 3D fader (`volume` 0-1), pan knob (`pan` -1...1, double-click to centre), mute button and a
 * post-fader mini meter of the master output. Each value is controlled via its prop, or uncontrolled.
 * Wire volume/pan/mute to a synth or loop player (same props) to mix it.
 */
export default function MixerStrip({
  volume,
  pan,
  mute,
  onVolumeChange,
  onPanChange,
  onMuteChange,
  label = "Ch 1",
  color = ACCENT,
}: Props) {
  const [inner, setInner] = useState({ volume: 0.8, pan: 0, mute: false })
  const [hot, setHot] = useState<"fader" | "pan" | "mute" | null>(null)
  const [active, setActive] = useState<"fader" | "pan" | null>(null)
  const [pressed, setPressed] = useState(false)
  const root = useRef<Group>(null)
  const drag = useRef<{ kind: "fader" | "pan"; id: number; y: number; v: number; offset: number } | null>(null)
  const meter = useRef<Tone.Meter | null>(null)
  const segs = useRef<(MeshBasicMaterial | null)[]>([])
  const lit = useRef(-1)

  const vol = Math.min(1, Math.max(0, volume ?? inner.volume))
  const pn = Math.min(1, Math.max(-1, pan ?? inner.pan))
  const muted = mute ?? inner.mute

  const plate = useMemo(() => new RoundedBoxGeometry(W, H, 0.012, 4, 0.01), [])
  const cap = useMemo(() => new RoundedBoxGeometry(CAP[0], CAP[1], CAP[2], 4, 0.004), [])
  const btn = useMemo(() => new RoundedBoxGeometry(0.06, 0.026, 0.01, 4, 0.005), [])
  useEffect(() => () => (plate.dispose(), cap.dispose(), btn.dispose()), [plate, cap, btn])

  useEffect(() => {
    const m = new Tone.Meter({ normalRange: true, smoothing: 0.8 })
    const out = Tone.getDestination()
    out.connect(m)
    meter.current = m
    return () => {
      out.disconnect(m)
      m.dispose()
      meter.current = null
    }
  }, [])

  useFrame(() => {
    const m = meter.current
    if (!m) return
    const g = m.getValue()
    // Post-fader: master level, plus this strip's gain, silenced by mute. -48...0 dB -> 0...1.
    const db = Tone.gainToDb(Array.isArray(g) ? Math.max(...g) : g) + (muted ? -Infinity : toDb(vol))
    const n = Math.round(Math.min(1, Math.max(0, (db + 48) / 48)) * SEGS)
    if (n === lit.current) return
    lit.current = n
    segs.current.forEach((mat, i) => mat?.color.set(i < n ? (i < SEGS - 3 ? color : WARM) : BORDER))
  })

  const setVol = (n: number) => {
    const c = Math.min(1, Math.max(0, n))
    setInner((s) => ({ ...s, volume: c }))
    onVolumeChange?.(c)
  }
  const setPan = (n: number) => {
    const c = Math.min(1, Math.max(-1, n))
    setInner((s) => ({ ...s, pan: c }))
    onPanChange?.(c)
  }
  const toggleMute = () => {
    void Tone.start() // first touch unlocks audio for every component
    setInner((s) => ({ ...s, mute: !muted }))
    onMuteChange?.(!muted)
    setPressed(true)
  }

  // Local y inside the strip, so drags still work when the Studio rotates or scales it.
  const localY = (e: ThreeEvent<PointerEvent>) => (root.current ? root.current.worldToLocal(e.point.clone()).y : e.point.y)
  const faderT = (e: ThreeEvent<PointerEvent>) => (localY(e) - FADER_Y) / TRAVEL + 0.5

  const downFader = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const p = faderT(e)
    const onCap = Math.abs(p - vol) <= CAP[1] / 2 / TRAVEL
    drag.current = { kind: "fader", id: e.pointerId, y: 0, v: 0, offset: onCap ? p - vol : 0 }
    if (!onCap) setVol(p)
    setActive("fader")
  }
  const downPan = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { kind: "pan", id: e.pointerId, y: localY(e), v: pn, offset: 0 }
    setActive("pan")
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (d.kind === "fader") setVol(faderT(e) - d.offset)
    else setPan(d.v + ((localY(e) - d.y) / 0.12) * 2) // 12 cm of drag sweeps L->R
  }
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    setActive(null)
  }
  const hover = (k: "fader" | "pan" | "mute") => ({
    onPointerOver: () => setHot(k),
    onPointerOut: () => setHot((h) => (h === k ? null : h)),
  })

  const db = toDb(vol)
  const t = (pn + 1) / 2
  const a = angle(t)
  const [arcStart, arcLen] = [Math.min(a, Math.PI / 2), Math.abs(a - Math.PI / 2)] // arc grows from centre (top)
  const faderLit = active === "fader" || hot === "fader"
  const panLit = active === "pan" || hot === "pan"

  return (
    <group ref={root}>
      <mesh geometry={plate}>
        <meshStandardMaterial color={SURFACE} roughness={0.75} metalness={0.1} />
      </mesh>

      <group position={[0, H / 2 - 0.024, FRONT + 0.001]}>
        <Container pixelSize={0.002} pointerEvents="none">
          <Text fontSize={14} fontWeight="bold" color={TEXT}>
            {label}
          </Text>
        </Container>
      </group>

      {/* pan knob */}
      <group position={[0, PAN_Y, FRONT]}>
        <mesh position={[0, 0, 0.0005]}>
          <ringGeometry args={[KNOB_R + 0.004, KNOB_R + 0.0065, 48, 1, -0.25 * Math.PI, SWEEP]} />
          <meshBasicMaterial color={BORDER2} />
        </mesh>
        {arcLen > 0.01 && (
          <mesh position={[0, 0, 0.0008]}>
            <ringGeometry args={[KNOB_R + 0.004, KNOB_R + 0.0065, 32, 1, arcStart, arcLen]} />
            <meshBasicMaterial color={color} />
          </mesh>
        )}
        <group rotation={[0, 0, a - Math.PI / 2]}>
          <mesh position={[0, 0, 0.007]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[KNOB_R, KNOB_R * 1.08, 0.014, 40]} />
            <meshStandardMaterial
              color={panLit ? RAISED : BORDER2}
              metalness={0.35}
              roughness={0.4}
              emissive={color}
              emissiveIntensity={active === "pan" ? 0.2 : 0}
            />
          </mesh>
          <mesh position={[0, KNOB_R * 0.6, 0.0145]}>
            <boxGeometry args={[0.0025, KNOB_R * 0.7, 0.001]} />
            <meshBasicMaterial color={panLit ? color : TEXT} />
          </mesh>
        </group>
        <mesh
          visible={false}
          position={[0, 0, 0.008]}
          onPointerDown={downPan}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onDoubleClick={() => setPan(0)}
          {...hover("pan")}
        >
          <boxGeometry args={[0.05, 0.05, 0.016]} />
        </mesh>
      </group>
      <group position={[0, PAN_Y - 0.033, FRONT + 0.001]}>
        <Container pixelSize={0.002} pointerEvents="none">
          <Text fontSize={11} color={panLit ? color : MUTED}>
            {Math.abs(pn) < 0.01 ? "PAN C" : `PAN ${pn < 0 ? "L" : "R"}${Math.round(Math.abs(pn) * 100)}`}
          </Text>
        </Container>
      </group>

      {/* mute */}
      <group position={[0, MUTE_Y, FRONT + 0.005 - (pressed ? 0.004 : 0)]}>
        <mesh geometry={btn}>
          <meshStandardMaterial
            color={muted ? WARM : hot === "mute" ? BORDER2 : BORDER}
            roughness={0.5}
            emissive={WARM}
            emissiveIntensity={muted ? 0.35 : 0}
          />
        </mesh>
        <group position={[0, 0, 0.0055]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={11} fontWeight="bold" color={muted ? BG : MUTED}>
              MUTE
            </Text>
          </Container>
        </group>
      </group>
      <mesh
        visible={false}
        position={[0, MUTE_Y, 0.01]}
        onPointerDown={toggleMute}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onPointerOver={() => setHot("mute")}
        onPointerOut={() => {
          setPressed(false)
          setHot((h) => (h === "mute" ? null : h))
        }}
      >
        <boxGeometry args={[0.064, 0.03, 0.016]} />
      </mesh>

      {/* fader */}
      <group position={[FADER_X, FADER_Y, FRONT]}>
        <mesh position={[0, 0, 0.0005]}>
          <boxGeometry args={[0.007, TRAVEL + 0.01, 0.001]} />
          <meshBasicMaterial color={BG} />
        </mesh>
        <mesh position={[0, -TRAVEL / 2 + (vol * TRAVEL) / 2, 0.0012]} scale={[1, Math.max(vol * TRAVEL, 1e-4), 1]}>
          <boxGeometry args={[0.0028, 1, 0.001]} />
          <meshBasicMaterial color={color} transparent opacity={muted ? 0.25 : faderLit ? 1 : 0.7} />
        </mesh>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} position={[-0.019, -TRAVEL / 2 + (i / 10) * TRAVEL, 0.0005]}>
            <boxGeometry args={[i % 5 ? 0.006 : 0.01, 0.0012, 0.001]} />
            <meshBasicMaterial color={i % 5 ? BORDER2 : FAINT} />
          </mesh>
        ))}
        <group position={[0, -TRAVEL / 2 + vol * TRAVEL, CAP[2] / 2]}>
          <mesh geometry={cap}>
            <meshStandardMaterial
              color={faderLit ? RAISED : BORDER2}
              metalness={0.35}
              roughness={0.38}
              emissive={color}
              emissiveIntensity={active === "fader" ? 0.22 : 0}
            />
          </mesh>
          <mesh position={[0, 0, CAP[2] / 2 + 0.0004]}>
            <boxGeometry args={[CAP[0] - 0.008, 0.0026, 0.0008]} />
            <meshBasicMaterial color={faderLit ? color : TEXT} />
          </mesh>
        </group>
        <mesh
          visible={false}
          position={[0, 0, 0.009]}
          onPointerDown={downFader}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          {...hover("fader")}
        >
          <boxGeometry args={[0.05, TRAVEL + CAP[1], 0.018]} />
        </mesh>
      </group>

      {/* post-fader mini meter */}
      <group position={[0.03, FADER_Y, FRONT + 0.0005]}>
        <mesh>
          <boxGeometry args={[0.012, TRAVEL + 0.006, 0.001]} />
          <meshBasicMaterial color={BG} />
        </mesh>
        {Array.from({ length: SEGS }, (_, i) => (
          <mesh key={i} position={[0, -TRAVEL / 2 + ((i + 0.5) / SEGS) * TRAVEL, 0.0008]}>
            <boxGeometry args={[0.008, TRAVEL / SEGS - 0.003, 0.001]} />
            <meshBasicMaterial
              ref={(m) => {
                segs.current[i] = m
              }}
              color={BORDER}
            />
          </mesh>
        ))}
      </group>

      <group position={[0, -H / 2 + 0.022, FRONT + 0.001]}>
        <Container pixelSize={0.002} pointerEvents="none">
          <Text fontSize={13} fontWeight="bold" color={muted ? WARM : faderLit ? color : TEXT}>
            {muted ? "MUTED" : vol <= 0.001 ? "-inf dB" : `${db.toFixed(1)} dB`}
          </Text>
        </Container>
      </group>
    </group>
  )
}
