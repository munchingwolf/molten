"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as Tone from "tone"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { AdditiveBlending, CanvasTexture, Plane, Vector3, type Group, type MeshBasicMaterial, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { value?: boolean; color?: string; label?: string; onChange?: (on: boolean) => void }

const OFF = -0.5 // rad about X: top leans back
const ON = 1.1 // rad: pulled toward the user and down
const ARM = 0.1 // pivot to knob centre, metres
const KNOB = 0.021 // knob radius (4.2 cm grab target)
const PY = -0.035 // pivot height
const PZ = 0.08 // pivot stand-off from the plate

// Soft round glow, drawn once; tinted by the material colour.
function glowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, "rgba(255,255,255,1)")
  grad.addColorStop(0.35, "rgba(255,255,255,0.35)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

type Sfx = { body: Tone.MembraneSynth; grit: Tone.NoiseSynth }

/** 25 cm wall lever: grab the knob and pull it down (or just tap it) to switch on; the lamp glows when on. */
export default function LeverSwitch({ value, color = "#9FE7D2", label = "Power", onChange }: Props) {
  const [inner, setInner] = useState(false)
  const on = value ?? inner
  const root = useRef<Group>(null)
  const arm = useRef<Group>(null)
  const knob = useRef<MeshStandardMaterial>(null)
  const lamp = useRef<MeshStandardMaterial>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const sfx = useRef<Sfx | null>(null)
  const drag = useRef<{ y: number; a: number; moved: boolean } | null>(null)
  const st = useRef({ a: OFF, av: 0, goal: OFF, hover: 0, hoverTarget: 0, lamp: 0 })
  const tmp = useMemo(() => ({ plane: new Plane(), n: new Vector3(), hit: new Vector3() }), [])
  const plate = useMemo(() => new RoundedBoxGeometry(0.1, 0.25, 0.016, 4, 0.006), [])
  const cheek = useMemo(() => new RoundedBoxGeometry(0.01, 0.05, 0.082, 2, 0.003), [])
  const bar = useMemo(() => new RoundedBoxGeometry(0.014, ARM, 0.012, 2, 0.004), [])
  const texture = useMemo(() => (typeof document === "undefined" ? null : glowTexture()), [])
  useEffect(() => () => (plate.dispose(), cheek.dispose(), bar.dispose(), texture?.dispose()), [plate, cheek, bar, texture])
  useEffect(
    () => () => {
      sfx.current?.body.dispose()
      sfx.current?.grit.dispose()
      sfx.current = null
    },
    [],
  )

  const clunk = async (next: boolean) => {
    await Tone.start()
    sfx.current ??= {
      body: new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 3, envelope: { attack: 0.001, decay: 0.28, sustain: 0 }, volume: -6 }).toDestination(),
      grit: new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 }, volume: -10 }).toDestination(),
    }
    const t = Tone.now()
    sfx.current.body.triggerAttackRelease(next ? "A1" : "E1", 0.2, t)
    sfx.current.grit.triggerAttackRelease(0.07, t)
  }

  const set = (next: boolean) => {
    if (next === on) return
    if (value === undefined) setInner(next)
    onChange?.(next)
    void clunk(next)
  }

  // Pointer height on the wall plane: rays keep tracking off the knob; fingertips already report a good point.
  const pointerY = (e: ThreeEvent<PointerEvent>) =>
    e.pointerType === "touch" || !e.ray ? e.point.y : (e.ray.intersectPlane(tmp.plane, tmp.hit)?.y ?? e.point.y)

  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    if (root.current) tmp.n.set(0, 0, 1).transformDirection(root.current.matrixWorld)
    tmp.plane.setFromNormalAndCoplanarPoint(tmp.n, e.point)
    drag.current = { y: e.point.y, a: st.current.a, moved: false }
    st.current.goal = st.current.a
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    const a = Math.min(ON + 0.12, Math.max(OFF - 0.12, d.a - (pointerY(e) - d.y) / ARM))
    if (Math.abs(a - d.a) > 0.06) d.moved = true
    st.current.goal = a
  }
  const up = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    set(d.moved ? st.current.goal > (OFF + ON) / 2 : !on) // a plain tap toggles
  }

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    const dragging = drag.current !== null
    const goal = dragging ? s.goal : on ? ON : OFF
    // Stiff and damped while held; loose on release so it slams home and overshoots.
    const [k, c] = dragging ? [700, 50] : [360, 11]
    s.av += (k * (goal - s.a) - c * s.av) * dt
    s.a += s.av * dt
    if (arm.current) arm.current.rotation.x = s.a
    s.hover += ((dragging ? 1 : s.hoverTarget) - s.hover) * (1 - Math.exp(-dt * 12))
    if (knob.current) knob.current.emissiveIntensity = 0.25 + s.hover * 0.3
    s.lamp += ((on ? 1 : 0) - s.lamp) * (1 - Math.exp(-dt * (on ? 14 : 5)))
    if (lamp.current) lamp.current.emissiveIntensity = 0.12 + s.lamp * 2
    if (halo.current) halo.current.opacity = s.lamp * 0.85
  })

  return (
    <group ref={root}>
      <mesh geometry={plate}>
        <meshStandardMaterial color="#15171E" emissive="#15171E" emissiveIntensity={0.35} roughness={0.55} metalness={0.2} />
      </mesh>
      {/* Lamp */}
      <group position={[0, 0.09, 0.008]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.011, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial ref={lamp} color="#242833" emissive={color} emissiveIntensity={0.12} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.004]}>
          <planeGeometry args={[0.1, 0.1]} />
          <meshBasicMaterial ref={halo} map={texture} color={color} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {/* Pivot bracket */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={cheek} position={[sx * 0.021, PY, 0.008 + 0.041]}>
          <meshStandardMaterial color="#242833" emissive="#242833" emissiveIntensity={0.3} roughness={0.45} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, PY, PZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0075, 0.0075, 0.056, 16]} />
        <meshStandardMaterial color="#323745" emissive="#323745" emissiveIntensity={0.3} roughness={0.35} metalness={0.6} />
      </mesh>
      {/* Arm + knob, rotating about X at the pivot */}
      <group ref={arm} position={[0, PY, PZ]} rotation={[OFF, 0, 0]}>
        <mesh geometry={bar} position={[0, ARM / 2, 0]}>
          <meshStandardMaterial color="#323745" emissive="#323745" emissiveIntensity={0.3} roughness={0.35} metalness={0.6} />
        </mesh>
        <mesh position={[0, ARM, 0]}>
          <sphereGeometry args={[KNOB, 32, 16]} />
          <meshStandardMaterial ref={knob} color="#D9DCE3" emissive="#D9DCE3" emissiveIntensity={0.25} roughness={0.4} />
        </mesh>
        <mesh
          visible={false}
          position={[0, ARM, 0]}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerOver={() => (st.current.hoverTarget = 1)}
          onPointerOut={() => (st.current.hoverTarget = 0)}
        >
          <sphereGeometry args={[0.034, 12, 8]} />
        </mesh>
      </group>
      <group position={[0, -0.098, 0.0085]}>
        <Container pixelSize={0.002} pointerEvents="none" flexDirection="column" alignItems="center">
          <Text fontSize={11} fontWeight="semi-bold" color="#EEF0F4">
            {label}
          </Text>
          <Text fontSize={9} color={on ? color : "#6B7180"}>
            {on ? "ON" : "OFF"}
          </Text>
        </Container>
      </group>
    </group>
  )
}
