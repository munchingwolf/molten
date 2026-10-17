"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity } from "@react-three/uikit"
import { Check } from "@react-three/uikit-lucide"
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, Object3D, Vector3, type Group, type InstancedMesh, type MeshBasicMaterial } from "three"
import * as Tone from "tone"

const PX = 0.002 // metres per uikit pixel
const W = 250
const PAD = 14
const HEAD = 52
const ROW = 46 // px: 9.2 cm rows for fingertips
const BOX = 24
const WARM = "#F2B48A"
const SPARKS = 48
const LIFE = 1.3 // seconds
const DEFAULT_OBJECTIVES = ["Find the key", "Open the chest", "Defeat the slime"]

type Props = {
  title?: string
  objectives?: string[]
  /** Number of objectives done; setting it from outside checks the first N. */
  value?: number
  color?: string
  onChange?: (count: number) => void
  onComplete?: () => void
}

type Sfx = { tick: Tone.Synth; chime: Tone.PolySynth }

// Soft rounded-rect glow, drawn once and tinted by the material colour.
function glowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  g.shadowColor = "white"
  g.shadowBlur = 60
  g.fillStyle = "white"
  g.beginPath()
  g.roundRect(96, 96, 320, 320, 40)
  g.fill()
  return new CanvasTexture(c)
}

/** 50 cm quest card: tap objectives to tick them off; finishing all flashes warm, chimes and bursts sparks. */
export default function QuestTracker({ title = "The Lost Chest", objectives = DEFAULT_OBJECTIVES, value, color = "#9FE7D2", onChange, onComplete }: Props) {
  const n = objectives.length
  const H = PAD * 2 + HEAD + n * ROW
  const [done, setDone] = useState(() => objectives.map((_, i) => i < (value ?? 0)))
  const count = done.filter(Boolean).length
  const complete = n > 0 && count === n
  const key = objectives.join("\n")
  // New objectives: start over.
  useEffect(() => setDone(objectives.map((_, i) => i < (value ?? 0))), [key])
  // `value` changed from outside: check the first N.
  useEffect(() => {
    if (value !== undefined) setDone((d) => (d.filter(Boolean).length === value ? d : d.map((_, i) => i < value)))
  }, [value])

  const body = useRef<Group>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const sparks = useRef<InstancedMesh>(null)
  const press = useRef(-1) // row being pressed, for the checkbox squash
  const st = useRef({ s: 1, v: 0, flash: 0, life: 0 })
  const parts = useMemo(() => Array.from({ length: SPARKS }, () => ({ p: new Vector3(), v: new Vector3(), r: 0 })), [])
  const dummy = useMemo(() => new Object3D(), [])
  const texture = useMemo(() => (typeof document === "undefined" ? null : glowTexture()), [])
  const hoverTint = useMemo(() => withOpacity("#EEF0F4", 0.05), [])
  const sfx = useRef<Sfx | null>(null)
  useEffect(
    () => () => {
      texture?.dispose()
      sfx.current?.tick.dispose()
      sfx.current?.chime.dispose()
    },
    [texture],
  )
  useEffect(() => {
    const m = sparks.current
    if (!m) return
    const tints = [new Color(WARM), new Color("#FFC94D"), new Color(color)]
    for (let i = 0; i < SPARKS; i++) m.setColorAt(i, tints[i % 3])
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [color])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.v += (380 * (1 - s.s) - 16 * s.v) * dt
    s.s += s.v * dt
    s.flash = Math.max(0, s.flash - dt * 1.4)
    body.current?.scale.setScalar(s.s)
    if (halo.current) halo.current.opacity = Math.min(1, Math.max(s.flash, complete ? 0.16 : 0))
    const m = sparks.current
    if (!m) return
    m.visible = s.life > 0
    if (s.life <= 0) return
    s.life -= dt
    const k = Math.max(0, s.life / LIFE)
    for (let i = 0; i < SPARKS; i++) {
      const q = parts[i]
      q.v.y -= 1.8 * dt // gravity
      q.p.addScaledVector(q.v, dt)
      q.r += dt * 9
      dummy.position.copy(q.p)
      dummy.rotation.set(0, 0, q.r)
      dummy.scale.setScalar(k)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  async function play(kind: "check" | "uncheck" | "complete") {
    await Tone.start()
    sfx.current ??= {
      tick: new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.04 }, volume: -14 }).toDestination(),
      chime: new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.5 }, volume: -12 }).toDestination(),
    }
    const s = sfx.current
    const t = Tone.now()
    s.tick.triggerAttackRelease(kind === "uncheck" ? "E5" : "A5", 0.03, t)
    if (kind === "complete") ["C6", "E6", "G6", "C7"].forEach((note, i) => s.chime.triggerAttackRelease(note, 0.4, t + 0.08 + i * 0.08))
  }

  const toggle = (i: number) => {
    const next = done.map((d, j) => (j === i ? !d : d))
    const c = next.filter(Boolean).length
    setDone(next)
    onChange?.(c)
    if (c === n && !complete) {
      const s = st.current
      s.flash = 1.4
      s.v += 4 // panel pop
      s.life = LIFE
      for (const q of parts) {
        q.p.set((Math.random() - 0.5) * W * PX, H * PX * 0.5, 0.01)
        q.v.set((Math.random() - 0.5) * 0.9, 0.35 + Math.random() * 0.8, 0.1 + Math.random() * 0.3)
        q.r = Math.random() * 6
      }
      void play("complete")
      onComplete?.()
    } else void play(next[i] ? "check" : "uncheck")
  }

  return (
    <group>
      <mesh position={[0, 0, -0.004]} scale={[W * PX * 1.6, H * PX * 1.6, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={halo} map={texture} color={WARM} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={body}>
        <Container
          pixelSize={PX}
          width={W}
          height={H}
          padding={PAD}
          flexDirection="column"
          borderRadius={16}
          backgroundColor="#15171E"
          borderWidth={1.5}
          borderColor={complete ? WARM : "#242833"}
          borderBend={0.3}
        >
          <Container height={HEAD} flexShrink={0} flexDirection="column" gap={8} pointerEvents="none">
            <Container flexDirection="row" justifyContent="space-between" alignItems="flex-end">
              <Container flexDirection="column" gap={2}>
                <Text fontSize={9} fontWeight="semi-bold" letterSpacing={1} color="#6B7180">
                  QUEST
                </Text>
                <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4">
                  {title}
                </Text>
              </Container>
              <Text fontSize={12} fontWeight="semi-bold" color={complete ? WARM : color}>
                {complete ? "Complete" : `${count}/${n}`}
              </Text>
            </Container>
            <Container height={4} flexShrink={0} borderRadius={2} backgroundColor="#242833">
              <Container width={`${n ? (count / n) * 100 : 0}%`} height={4} borderRadius={2} backgroundColor={complete ? WARM : color} />
            </Container>
          </Container>
          {objectives.map((o, i) => (
            <Container
              key={i}
              height={ROW}
              flexShrink={0}
              flexDirection="row"
              alignItems="center"
              paddingLeft={BOX + 14}
              paddingRight={8}
              borderRadius={10}
              hover={{ backgroundColor: hoverTint }}
              onPointerDown={() => (press.current = i)}
              onPointerUp={() => (press.current = -1)}
              onPointerOut={() => (press.current = -1)}
              onClick={() => toggle(i)}
            >
              <Container>
                <Text fontSize={13} color={done[i] ? "#6B7180" : "#EEF0F4"}>
                  {o}
                </Text>
                {done[i] && <Container positionType="absolute" positionLeft={0} positionRight={0} positionTop="50%" height={1.5} backgroundColor="#6B7180" />}
              </Container>
            </Container>
          ))}
        </Container>
        {objectives.map((_, i) => (
          <CheckBox
            key={i}
            i={i}
            on={!!done[i]}
            color={color}
            press={press}
            x={(PAD + 6 + BOX / 2 - W / 2) * PX}
            y={(H / 2 - PAD - HEAD - ROW * (i + 0.5)) * PX}
          />
        ))}
      </group>
      <instancedMesh ref={sparks} args={[undefined, undefined, SPARKS]} visible={false} frustumCulled={false}>
        <planeGeometry args={[0.007, 0.012]} />
        <meshBasicMaterial side={DoubleSide} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

function CheckBox({ i, on, color, press, x, y }: { i: number; on: boolean; color: string; press: { current: number }; x: number; y: number }) {
  const g = useRef<Group>(null)
  const st = useRef({ s: 1, v: 0, r: 0, rv: 0, was: on })
  useEffect(() => {
    const s = st.current
    if (s.was === on) return
    s.was = on
    s.v += on ? 9 : -4 // pop when checked, dip when cleared
    if (on) s.rv -= 4
  }, [on])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.v += (420 * ((press.current === i ? 0.85 : 1) - s.s) - 16 * s.v) * dt
    s.s += s.v * dt
    s.rv += (320 * -s.r - 14 * s.rv) * dt
    s.r += s.rv * dt
    if (g.current) {
      g.current.scale.setScalar(s.s)
      g.current.rotation.z = s.r
    }
  })

  return (
    <group position={[x, y, 0.004]}>
      <group ref={g}>
        <Container
          pixelSize={PX}
          width={BOX}
          height={BOX}
          borderRadius={7}
          borderWidth={2}
          borderColor={on ? color : "#323745"}
          backgroundColor={on ? color : "#101218"}
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          {on && <Check width={16} height={16} color="#06221B" />}
        </Container>
      </group>
    </group>
  )
}
