"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Coins } from "@react-three/uikit-lucide"
import * as Tone from "tone"
import { AdditiveBlending, CanvasTexture, Color, Object3D, Vector3, type Group, type InstancedMesh, type MeshBasicMaterial } from "three"

type Props = {
  /** Coins collected so far. */
  value?: number
  onChange?: (count: number) => void
  color?: string
  /** Seconds before the coin comes back. */
  respawn?: number
  size?: number
  showCount?: boolean
}

const R = 0.045 // coin radius, metres
const T = 0.009 // coin thickness
const SPARKS = 48

function haloTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, "rgba(255,255,255,0.85)")
  grd.addColorStop(0.3, "rgba(255,255,255,0.3)")
  grd.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

/** 9 cm spinning coin. Touch it with a fingertip (or click / pinch) to collect: it zips up, sparkles and dings, then respawns. `value` counts coins. */
export default function CoinPickup({ value, onChange, color = "#FFC94D", respawn = 1.4, size = 1, showCount = true }: Props) {
  const [inner, setInner] = useState(0)
  const count = value ?? inner
  const coin = useRef<Group>(null)
  const plus = useRef<Group>(null)
  const chip = useRef<Group>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const sparks = useRef<((at: Vector3) => void) | null>(null)
  const st = useRef({ phase: "idle" as "idle" | "collect" | "gone", t: 0, pt: 9, spin: 3, s: 1, sv: 0, hover: 0, c: 1, cv: 0, at: new Vector3() })
  const synth = useRef<Tone.Synth | null>(null)
  const texture = useMemo(() => (typeof document === "undefined" ? null : haloTexture()), [])
  const shades = useMemo(() => {
    const base = new Color(color)
    return { face: base, rim: base.clone().multiplyScalar(0.72), stamp: base.clone().lerp(new Color("#FFF4D0"), 0.35) }
  }, [color])
  useEffect(
    () => () => {
      texture?.dispose()
      synth.current?.dispose()
    },
    [texture],
  )

  const ding = async () => {
    await Tone.start()
    synth.current ??= new Tone.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.001, decay: 0.25, sustain: 0.05, release: 0.15 }, volume: -20 }).toDestination()
    const now = Tone.now()
    synth.current.triggerAttackRelease("B5", 0.07, now)
    synth.current.triggerAttackRelease("E6", 0.32, now + 0.075)
  }

  const collect = () => {
    const s = st.current
    if (s.phase !== "idle") return
    s.phase = "collect"
    s.t = 0
    s.pt = 0
    s.cv = 6 // kick the counter chip
    void ding()
    const n = count + 1
    if (value === undefined) setInner(n)
    onChange?.(n)
  }
  // A fingertip only has to touch it; mouse and rays press.
  const near = (e: ThreeEvent<PointerEvent>) => {
    st.current.hover = 1
    if (e.pointerType === "touch" && e.distance < 0.025) collect()
  }

  useFrame((state, delta) => {
    const s = st.current
    const g = coin.current
    if (!g) return
    const dt = Math.min(delta, 1 / 30)
    s.t += dt
    s.pt += dt
    if (s.phase === "idle") {
      s.sv += (380 * (1 + s.hover * 0.12 - s.s) - 14 * s.sv) * dt // pops in with overshoot after respawn, swells on hover
      s.s += s.sv * dt
      s.spin += (3 + s.hover * 6 - s.spin) * (1 - Math.exp(-dt * 6))
      g.position.y = Math.sin(state.clock.elapsedTime * 2.2) * 0.012
    } else if (s.phase === "collect") {
      const k = Math.min(1, s.t / 0.42)
      s.spin = 30
      g.position.y += (0.17 * (1 - (1 - k) ** 3) - g.position.y) * 0.5
      s.s = k < 0.3 ? 1 + k * 1.2 : 1.36 * (1 - (k - 0.3) / 0.7)
      if (k >= 1) {
        s.phase = "gone"
        s.t = 0
        sparks.current?.(s.at.set(0, g.position.y, 0))
      }
    } else if (s.t > respawn) {
      s.phase = "idle"
      s.t = 0
      s.s = 0
      s.sv = 0
    }
    g.rotation.y += s.spin * dt
    g.scale.setScalar(Math.max(0.0001, s.s))

    if (halo.current) halo.current.opacity = s.phase === "gone" ? 0 : Math.min(1, (0.3 + s.hover * 0.25) * Math.max(0, s.s) + (s.phase === "collect" ? 0.4 : 0))
    if (plus.current) {
      const on = s.pt < 0.9
      plus.current.visible = on
      if (on) {
        plus.current.position.y = 0.09 + (1 - (1 - Math.min(1, s.pt / 0.9)) ** 2) * 0.12
        plus.current.scale.setScalar(Math.min(1, s.pt * 9) * (1 - Math.max(0, (s.pt - 0.6) / 0.3)) + 0.0001)
      }
    }
    if (chip.current) {
      s.cv += (-300 * (s.c - 1) - 12 * s.cv) * dt
      s.c += s.cv * dt
      chip.current.scale.setScalar(s.c)
    }
  })

  return (
    <group scale={size}>
      <mesh position={[0, 0, -0.02]} scale={0.24}>
        <planeGeometry />
        <meshBasicMaterial ref={halo} map={texture} color={color} transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={coin}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R, R, T, 32]} />
          <meshStandardMaterial color={shades.rim} emissive={shades.rim} emissiveIntensity={0.45} roughness={0.35} metalness={0.25} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R * 0.74, R * 0.74, T * 1.3, 32]} />
          <meshStandardMaterial color={shades.face} emissive={shades.face} emissiveIntensity={0.4} roughness={0.3} metalness={0.25} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.009, 0.036, T * 1.6]} />
          <meshStandardMaterial color={shades.stamp} emissive={shades.stamp} emissiveIntensity={0.5} roughness={0.3} />
        </mesh>
      </group>
      <group ref={plus} visible={false}>
        <Container pixelSize={0.002} pointerEvents="none">
          <Text fontSize={20} fontWeight="bold" color={color}>
            +1
          </Text>
        </Container>
      </group>
      {showCount && (
        <group ref={chip} position={[0, -0.095, 0]}>
          <Container pixelSize={0.002} pointerEvents="none" flexDirection="row" alignItems="center" gap={6} paddingX={10} paddingY={4} borderRadius={12} backgroundColor="#15171E" borderWidth={1} borderColor="#323745">
            <Coins width={14} height={14} color={color} />
            <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4">{`× ${count}`}</Text>
          </Container>
        </group>
      )}
      <Sparks api={sparks} color={color} />
      {/* Static hit sphere (≥ 2 cm): the coin bobs and flies, the target must not. */}
      <mesh
        visible={false}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => (st.current.hover = 0)}
        onPointerDown={collect}
      >
        <sphereGeometry args={[0.065, 12, 8]} />
      </mesh>
    </group>
  )
}

/** One instanced burst of additive sparks; `api.current(at)` fires it. */
function Sparks({ api, color }: { api: RefObject<((at: Vector3) => void) | null>; color: string }) {
  const mesh = useRef<InstancedMesh>(null)
  const parts = useMemo(() => Array.from({ length: SPARKS }, () => ({ p: new Vector3(), v: new Vector3(), life: 0, max: 1 })), [])
  const dummy = useMemo(() => new Object3D(), [])
  const alive = useRef(false)
  useLayoutEffect(() => {
    if (mesh.current) mesh.current.count = 0
  }, [])
  useEffect(() => {
    api.current = (at) => {
      for (const q of parts) {
        q.p.copy(at)
        q.v.set(Math.random() * 2 - 1, Math.random() * 1.6 - 0.3, Math.random() * 2 - 1).normalize().multiplyScalar(0.35 + Math.random() * 0.55)
        q.life = q.max = 0.45 + Math.random() * 0.45
      }
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
      q.v.y -= 1.6 * dt
      q.v.multiplyScalar(1 - dt * 2)
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
      <meshBasicMaterial color={color} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  )
}
