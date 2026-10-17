"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as Tone from "tone"
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, Object3D, Vector3, type Group, type InstancedMesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = {
  /** Open or closed. */
  value?: boolean
  onChange?: (open: boolean) => void
  /** Wood colour. */
  color?: string
  /** Metal trim colour. */
  trim?: string
  /** Treasure glow colour. */
  glow?: string
  size?: number
}

const W = 0.3 // body width, metres
const H = 0.12 // body height
const DEPTH = 0.18
const R = DEPTH / 2 // lid radius
const Y0 = -(H + R) / 2 // bottom, so the closed chest is centred on the origin
const TOP = Y0 + H
const OPEN = -1.95 // lid angle when open (radians)
const BANDS = [-0.105, 0.105]
const MOTES = 80
const COINS: [number, number, number][] = [
  [-0.08, 0.004, 0.02],
  [-0.03, 0.008, -0.03],
  [0.02, 0.006, 0.035],
  [0.07, 0.009, -0.01],
  [0.1, 0.004, 0.04],
]

function beamTexture() {
  const c = document.createElement("canvas")
  c.width = 4
  c.height = 128
  const g = c.getContext("2d")!
  const grd = g.createLinearGradient(0, 0, 0, 128)
  grd.addColorStop(0, "rgba(255,255,255,0)")
  grd.addColorStop(1, "rgba(255,255,255,1)")
  g.fillStyle = grd
  g.fillRect(0, 0, 4, 128)
  return new CanvasTexture(c)
}

/** 30 cm treasure chest. Tap to open: the lid springs back, gold glows, a light beam rises and motes drift up. Tap again to close. */
export default function TreasureChest({ value, onChange, color = "#7A4A2A", trim = "#E8B44C", glow = "#FFD98A", size = 1 }: Props) {
  const [inner, setInner] = useState(false)
  const open = value ?? inner
  const lid = useRef<Group>(null)
  const body = useRef<Group>(null)
  const beam = useRef<MeshBasicMaterial>(null)
  const pile = useRef<MeshStandardMaterial>(null)
  const keyhole = useRef<MeshBasicMaterial>(null)
  const motes = useRef<InstancedMesh>(null)
  const sfx = useRef<{ chime: Tone.PolySynth; thud: Tone.MembraneSynth } | null>(null)
  const st = useRef({ a: 0, av: 0, sq: 0, sqv: 0, glow: 0, idle: 0, burst: false, slam: false })
  const geometry = useMemo(() => new RoundedBoxGeometry(W, H, DEPTH, 2, 0.01), [])
  const texture = useMemo(() => (typeof document === "undefined" ? null : beamTexture()), [])
  const wood = useMemo(() => new Color(color), [color])
  const parts = useMemo(() => Array.from({ length: MOTES }, () => ({ p: new Vector3(), v: new Vector3(), life: 0, max: 1 })), [])
  const dummy = useMemo(() => new Object3D(), [])
  useEffect(
    () => () => {
      geometry.dispose()
      texture?.dispose()
      sfx.current?.chime.dispose()
      sfx.current?.thud.dispose()
    },
    [geometry, texture],
  )
  useLayoutEffect(() => {
    if (motes.current) motes.current.count = 0
  }, [])

  const kit = async () => {
    await Tone.start()
    sfx.current ??= {
      chime: new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 0.5, sustain: 0, release: 0.3 }, volume: -16 }).toDestination(),
      thud: new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 4, envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -6 }).toDestination(),
    }
    return sfx.current
  }

  const toggle = () => {
    const next = !open
    const s = st.current
    s.sqv = -2.2 // squash before the lid moves
    s.idle = 0
    if (next) {
      s.burst = true
      void kit().then(({ chime }) => {
        const now = Tone.now()
        ;["C5", "E5", "G5", "C6", "E6", "G6"].forEach((n, i) => chime.triggerAttackRelease(n, 0.4, now + 0.05 + i * 0.06))
      })
    } else {
      s.slam = true
      void kit()
    }
    if (value === undefined) setInner(next)
    onChange?.(next)
  }

  useFrame((state, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    // Lid: under-damped spring so it flings open and wobbles on its hinge.
    s.av += (140 * ((open ? OPEN : 0) - s.a) - 9 * s.av) * dt
    s.a += s.av * dt
    if (s.a > 0) {
      if (s.slam && sfx.current) sfx.current.thud.triggerAttackRelease("C2", 0.2, Tone.now(), Math.min(1, 0.3 + s.av / 10))
      s.slam = false
      s.a = 0
      s.av = -s.av * 0.3
    }
    // While closed it rattles now and then, as if something inside wants out.
    s.idle += dt
    if (!open && s.idle > 3.2 + Math.random() * 2) {
      s.idle = 0
      s.av -= 2.4
    }
    if (lid.current) lid.current.rotation.x = s.a
    s.sqv += (-380 * s.sq - 14 * s.sqv) * dt
    s.sq += s.sqv * dt
    if (body.current) {
      body.current.scale.set(1 - s.sq * 0.4, 1 + s.sq, 1 - s.sq * 0.4)
      body.current.position.y = Y0 * -s.sq // keep the bottom planted
    }
    const opened = Math.min(1, s.a / OPEN)
    s.glow += (opened - s.glow) * (1 - Math.exp(-dt * 6))
    if (beam.current) {
      beam.current.visible = s.glow > 0.01 // skip the transparent fill when closed (Quest fill rate)
      beam.current.opacity = s.glow * (0.32 + Math.sin(state.clock.elapsedTime * 3) * 0.05)
    }
    if (pile.current) pile.current.emissiveIntensity = 0.25 + s.glow * 1.1
    if (keyhole.current) keyhole.current.opacity = (1 - s.glow) * (0.45 + Math.sin(state.clock.elapsedTime * 3.2) * 0.35)

    // Motes: a burst on open, then a gentle stream while open.
    const m = motes.current
    if (!m) return
    let alive = 0
    parts.forEach((q, i) => {
      q.life -= dt
      if (q.life <= 0 && (s.burst || (open && s.glow > 0.6 && Math.random() < dt * 3))) {
        q.p.set((Math.random() - 0.5) * (W - 0.06), TOP + 0.01, (Math.random() - 0.5) * (DEPTH - 0.06))
        q.v.set((Math.random() - 0.5) * 0.15, s.burst ? 0.35 + Math.random() * 0.45 : 0.06 + Math.random() * 0.1, (Math.random() - 0.5) * 0.15)
        q.life = q.max = s.burst ? 0.8 + Math.random() * 0.8 : 1.4 + Math.random() * 1.2
      }
      if (q.life > 0) {
        alive++
        q.v.multiplyScalar(1 - dt * 1.4)
        q.v.y += 0.05 * dt
        q.p.addScaledVector(q.v, dt)
      }
      const k = Math.max(0, q.life / q.max)
      dummy.position.copy(q.p)
      dummy.rotation.set(q.life * 4, q.life * 3, 0)
      dummy.scale.setScalar(Math.sin(k * Math.PI) + 0.0001)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    s.burst = false
    m.count = alive ? MOTES : 0
    if (alive) m.instanceMatrix.needsUpdate = true
  })

  const trimMat = <meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={0.35} roughness={0.35} metalness={0.2} />

  return (
    <group scale={size}>
      <group ref={body}>
        <mesh geometry={geometry} position={[0, Y0 + H / 2, 0]}>
          <meshStandardMaterial color={wood} emissive={wood} emissiveIntensity={0.3} roughness={0.8} />
        </mesh>
        {/* gold inside, only visible when the lid is up */}
        <mesh position={[0, TOP + 0.002, 0]}>
          <boxGeometry args={[W - 0.03, 0.006, DEPTH - 0.03]} />
          <meshStandardMaterial ref={pile} color={glow} emissive={glow} emissiveIntensity={0.25} roughness={0.4} />
        </mesh>
        {COINS.map(([x, y, z], i) => (
          <mesh key={i} position={[x, TOP + y, z]} rotation={[0.4 + i * 0.3, i, 0.2 * i]}>
            <cylinderGeometry args={[0.016, 0.016, 0.004, 16]} />
            <meshStandardMaterial color={trim} emissive={glow} emissiveIntensity={0.6} roughness={0.3} />
          </mesh>
        ))}
        {BANDS.map((x) => (
          <mesh key={x} position={[x, Y0 + H / 2, 0]}>
            <boxGeometry args={[0.014, H + 0.004, DEPTH + 0.004]} />
            {trimMat}
          </mesh>
        ))}
        <mesh position={[0, TOP - 0.028, DEPTH / 2 + 0.004]}>
          <boxGeometry args={[0.05, 0.05, 0.008]} />
          {trimMat}
        </mesh>
        <mesh position={[0, TOP - 0.026, DEPTH / 2 + 0.0085]}>
          <circleGeometry args={[0.0065, 16]} />
          <meshBasicMaterial color="#0B0C10" />
        </mesh>
        <mesh position={[0, TOP - 0.026, DEPTH / 2 + 0.009]} scale={1.9}>
          <circleGeometry args={[0.0065, 16]} />
          <meshBasicMaterial ref={keyhole} color="#9FE7D2" transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* lid hinges on the back top edge */}
        <group ref={lid} position={[0, TOP, -R]}>
          <mesh position={[0, 0, R]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[R, R, W, 24, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={wood} emissive={wood} emissiveIntensity={0.3} roughness={0.8} />
          </mesh>
          {BANDS.map((x) => (
            <mesh key={x} position={[x, 0, R]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[R + 0.003, R + 0.003, 0.014, 24, 1, false, 0, Math.PI]} />
              {trimMat}
            </mesh>
          ))}
          <mesh position={[0, 0.012, DEPTH + 0.004]}>
            <boxGeometry args={[0.03, 0.026, 0.008]} />
            {trimMat}
          </mesh>
        </group>
      </group>
      {/* light beam rising out of the chest */}
      <mesh position={[0, TOP + 0.16, 0]}>
        <cylinderGeometry args={[0.17, 0.11, 0.32, 24, 1, true]} />
        <meshBasicMaterial ref={beam} color={glow} alphaMap={texture} transparent opacity={0} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <instancedMesh ref={motes} args={[undefined, undefined, MOTES]} frustumCulled={false}>
        <octahedronGeometry args={[0.0045, 0]} />
        <meshBasicMaterial color={glow} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {/* Static hit box around the closed chest; the lid and body animate inside it. */}
      <mesh visible={false} onClick={toggle}>
        <boxGeometry args={[W + 0.02, H + R + 0.02, DEPTH + 0.03]} />
      </mesh>
    </group>
  )
}
