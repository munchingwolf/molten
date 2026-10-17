"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import * as Tone from "tone"

const TRAVEL = 0.012 // metres the cap can sink
const FIRE = 0.8 // fraction of travel that clicks
const RESET = 0.3 // fraction it must come back above to re-arm
const S = 0.07 // cap size
const NEAR = 0.05 // a pointer origin closer than this is a fingertip, so depth follows it

type Props = {
  label?: string
  color?: string
  /** Play a short click on press */
  sound?: boolean
  onPress?: () => void
}

/**
 * 7 cm hand-tracking button: the cap follows your fingertip down (12 mm of travel) and clicks at 80 % depth,
 * then re-arms once you lift. Mouse or ray presses push it fully. Clicks audibly, since hands get no haptics.
 */
export default function PokeButtonDemo({ label = "Push", color = "#9FE7D2", sound = true, onPress }: Props) {
  const [hover, setHover] = useState(false)
  const [count, setCount] = useState(0)
  const cap = useRef<THREE.Group>(null)
  const root = useRef<THREE.Group>(null)
  const st = useRef({ target: 0, armed: true, active: false })
  const click = useRef<Tone.MembraneSynth | null>(null)
  const geo = useMemo(() => new RoundedBoxGeometry(S, S, 0.02, 4, 0.01), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => () => geo.dispose(), [geo])

  useEffect(() => {
    const s = new Tone.MembraneSynth({ pitchDecay: 0.004, octaves: 3, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume: -10 }).toDestination()
    click.current = s
    return () => {
      s.dispose()
      click.current = null
    }
  }, [])

  const setDepth = (d: number) => {
    const s = st.current
    s.target = Math.max(0, Math.min(TRAVEL, d))
    if (s.armed && s.target >= TRAVEL * FIRE) {
      s.armed = false
      if (sound) {
        void Tone.start() // the press itself is the user gesture that unlocks audio
        click.current?.triggerAttackRelease("C5", 0.04, Tone.now())
      }
      setCount((c) => c + 1)
      onPress?.()
    } else if (!s.armed && s.target <= TRAVEL * RESET) s.armed = true
  }

  // Fingertip depth below the cap's rest surface, in the button's own space; null for far pointers (ray, mouse).
  const depthOf = (e: ThreeEvent<PointerEvent>) => {
    const origin = (e as unknown as { pointerPosition?: THREE.Vector3 }).pointerPosition
    if (!origin || !root.current) return null
    root.current.worldToLocal(tmp.copy(origin))
    if (Math.abs(tmp.x) > S || Math.abs(tmp.y) > S || tmp.z > NEAR) return null
    return 0.01 - tmp.z // cap front sits at z = 0.01
  }

  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    st.current.active = true
    setDepth(depthOf(e) ?? TRAVEL)
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!st.current.active) return
    const d = depthOf(e)
    if (d !== null) setDepth(d)
  }
  const up = () => {
    st.current.active = false
    setDepth(0)
  }

  useFrame((_, dt) => {
    const g = cap.current
    if (g) g.position.z += (-st.current.target - g.position.z) * Math.min(1, dt * 40)
  })

  return (
    <group ref={root}>
      {/* Static hit box at the cap's rest surface: the cap moves, the hit surface must not. */}
      <mesh
        visible={false}
        position={[0, 0, 0.004]}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[S, S, 0.012]} />
      </mesh>
      <mesh position={[0, 0, -0.016]}>
        <boxGeometry args={[S + 0.024, S + 0.024, 0.012]} />
        <meshStandardMaterial color="#15171E" roughness={0.7} />
      </mesh>
      <group ref={cap}>
        <mesh geometry={geo}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.3 : 0.08} roughness={0.45} />
        </mesh>
        <group position={[0, 0, 0.0105]}>
          <Container pixelSize={0.002} flexDirection="column" alignItems="center" pointerEvents="none">
            <Text fontSize={15} fontWeight="semi-bold" color="#06221B">
              {label}
            </Text>
            <Text fontSize={10} color="#06221B">
              {String(count)}
            </Text>
          </Container>
        </group>
      </group>
    </group>
  )
}
