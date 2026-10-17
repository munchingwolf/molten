"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import * as Tone from "tone"
import { AdditiveBlending, Object3D, Quaternion, Vector3, type Group, type InstancedMesh, type MeshBasicMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = {
  /** Face showing, 1–6. Set it to turn the die to that face. */
  value?: number
  onChange?: (face: number) => void
  color?: string
  pipColor?: string
  size?: number
}

const S = 0.07 // die edge, metres
const D = 0.017 // pip offset from the face centre
// Number on each face normal (opposite faces add up to 7).
const FACES: [number, [number, number, number]][] = [
  [1, [0, 0, 1]],
  [6, [0, 0, -1]],
  [2, [0, 1, 0]],
  [5, [0, -1, 0]],
  [3, [1, 0, 0]],
  [4, [-1, 0, 0]],
]
const LAYOUT: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
}
const PIPS = 21
const Z = new Vector3(0, 0, 1)
const X = new Vector3(1, 0, 0)

/** Rotation that turns face `n` toward the viewer, tilted so the top face shows too. */
function faceQuat(n: number, spin: number, out: Quaternion) {
  const [x, y, z] = FACES.find((f) => f[0] === n)![1]
  return out
    .setFromUnitVectors(new Vector3(x, y, z), Z)
    .premultiply(new Quaternion().setFromAxisAngle(Z, spin))
    .premultiply(new Quaternion().setFromAxisAngle(X, 0.32))
}

/** 7 cm die. Press it (poke, pinch or click) to roll: it tosses, tumbles, bounces with a clack and settles on a random face. */
export default function Dice({ value, onChange, color = "#EEF0F4", pipColor = "#0B0C10", size = 1 }: Props) {
  const [inner, setInner] = useState(5)
  const face = Math.min(6, Math.max(1, Math.round(value ?? inner)))
  const [rolling, setRolling] = useState(false)
  const die = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const pips = useRef<InstancedMesh>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const ringMesh = useRef<Group>(null)
  const chip = useRef<Group>(null)
  const clack = useRef<Tone.MembraneSynth | null>(null)
  const geometry = useMemo(() => new RoundedBoxGeometry(S, S, S, 3, 0.012), [])
  const st = useRef({
    phase: "idle" as "idle" | "air" | "settle",
    y: 0,
    vy: 0,
    w: new Vector3(),
    q: faceQuat(face, 0, new Quaternion()),
    target: new Quaternion(),
    dq: new Quaternion(),
    axis: new Vector3(),
    t: 0,
    result: face,
    silent: false,
    sq: 0,
    sqv: 0,
    hover: 0,
    hs: 1,
    flash: 0,
    c: 1,
    cv: 0,
  })
  useEffect(
    () => () => {
      geometry.dispose()
      clack.current?.dispose()
    },
    [geometry],
  )

  useLayoutEffect(() => {
    const m = pips.current
    if (!m) return
    const o = new Object3D()
    const n = new Vector3()
    const u = new Vector3()
    const v = new Vector3()
    let i = 0
    for (const [k, [x, y, z]] of FACES) {
      n.set(x, y, z)
      u.set(0, 1, 0).cross(n)
      if (u.lengthSq() < 0.5) u.set(1, 0, 0)
      u.normalize()
      v.crossVectors(n, u)
      for (const [a, b] of LAYOUT[k]) {
        o.position.copy(n).multiplyScalar(S / 2 + 0.0006).addScaledVector(u, a * D).addScaledVector(v, b * D)
        o.quaternion.setFromUnitVectors(Z, n)
        o.updateMatrix()
        m.setMatrixAt(i++, o.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
  }, [])

  // Turn to a face set from outside (no onChange echo).
  useEffect(() => {
    const s = st.current
    if (value === undefined || s.phase !== "idle" || face === s.result) return
    s.result = face
    s.silent = true
    faceQuat(face, 0, s.target)
    s.phase = "settle"
    s.t = 0
  }, [value, face])

  const tock = async (v: number) => {
    await Tone.start()
    clack.current ??= new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 3, envelope: { attack: 0.001, decay: 0.07, sustain: 0 }, volume: -8 }).toDestination()
    clack.current.triggerAttackRelease(["G4", "A4", "C5"][Math.floor(Math.random() * 3)], 0.05, Tone.now(), Math.min(1, 0.25 + v * 0.45))
  }

  const roll = () => {
    const s = st.current
    if (s.phase === "air") return
    void Tone.start() // unlock audio inside the gesture; the first clack comes later
    s.phase = "air"
    s.vy = 1.55
    s.w.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(14 + Math.random() * 8)
    s.result = 1 + Math.floor(Math.random() * 6)
    s.silent = false
    s.sqv = 3 // little hop of anticipation
    setRolling(true)
  }

  useFrame((_, delta) => {
    const s = st.current
    const g = die.current
    if (!g || !spin.current) return
    const dt = Math.min(delta, 1 / 30)
    if (s.phase === "air") {
      s.vy -= 7 * dt
      s.y += s.vy * dt
      const speed = s.w.length()
      if (speed > 0) s.q.premultiply(s.dq.setFromAxisAngle(s.axis.copy(s.w).divideScalar(speed), speed * dt))
      if (s.y <= 0 && s.vy < 0) {
        const impact = -s.vy
        s.y = 0
        void tock(impact)
        s.sqv = -impact * 2.4
        s.vy = impact * 0.45
        s.w.multiplyScalar(0.55).add(s.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6))
        if (s.vy < 0.28) {
          s.vy = 0
          s.phase = "settle"
          s.t = 0
          faceQuat(s.result, Math.floor(Math.random() * 4) * (Math.PI / 2), s.target)
        }
      }
    } else if (s.phase === "settle") {
      s.t += dt
      s.q.slerp(s.target, 1 - Math.exp(-dt * 16))
      if (s.t > 0.32) {
        s.q.copy(s.target)
        s.phase = "idle"
        s.flash = 1
        s.cv = 7
        setRolling(false)
        if (!s.silent) {
          if (value === undefined) setInner(s.result)
          onChange?.(s.result)
        }
      }
    }
    // squash spring on landings, hover swell
    s.sqv += (-420 * s.sq - 18 * s.sqv) * dt
    s.sq += s.sqv * dt
    s.hs += (1 + s.hover * 0.06 - s.hs) * (1 - Math.exp(-dt * 12))
    g.position.y = s.y + (S / 2) * s.sq // squash keeps the bottom on the floor
    spin.current.quaternion.copy(s.q)
    g.scale.set(s.hs * (1 - s.sq * 0.5), s.hs * (1 + s.sq), s.hs * (1 - s.sq * 0.5))

    s.flash = Math.max(0, s.flash - dt * 2.2)
    if (ring.current && ringMesh.current) {
      ring.current.opacity = s.flash * 0.8
      ringMesh.current.scale.setScalar(1 + (1 - s.flash) * 0.6)
    }
    if (chip.current) {
      s.cv += (-300 * (s.c - 1) - 12 * s.cv) * dt
      s.c += s.cv * dt
      chip.current.scale.setScalar(s.c)
    }
  })

  return (
    <group scale={size}>
      {/* Outer group squashes along world Y; inner group tumbles. */}
      <group ref={die}>
        <group ref={spin}>
          <mesh geometry={geometry}>
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.35} />
          </mesh>
          <instancedMesh ref={pips} args={[undefined, undefined, PIPS]}>
            <circleGeometry args={[0.0062, 16]} />
            <meshBasicMaterial color={pipColor} />
          </instancedMesh>
        </group>
      </group>
      <group ref={ringMesh}>
        <mesh>
          <ringGeometry args={[0.062, 0.066, 32]} />
          <meshBasicMaterial ref={ring} color="#9FE7D2" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <group ref={chip} position={[0, -0.085, 0]}>
        <Container pixelSize={0.002} pointerEvents="none" paddingX={10} paddingY={3} borderRadius={10} backgroundColor="#15171E" borderWidth={1} borderColor="#323745">
          <Text fontSize={14} fontWeight="semi-bold" color={rolling ? "#9AA0AD" : "#9FE7D2"}>
            {rolling ? "rolling…" : `${face}`}
          </Text>
        </Container>
      </group>
      {/* Static hit box: the die jumps and spins, the press target stays put. */}
      <mesh
        visible={false}
        onPointerDown={roll}
        onPointerOver={() => (st.current.hover = 1)}
        onPointerOut={() => (st.current.hover = 0)}
      >
        <boxGeometry args={[0.1, 0.1, 0.1]} />
      </mesh>
    </group>
  )
}
