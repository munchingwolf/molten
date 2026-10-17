"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, CylinderGeometry, SRGBColorSpace, type Group, type Mesh } from "three"
import { Container, Text } from "@react-three/uikit"

type Props = { value?: number; onChange?: (v: number) => void; duration?: number; label?: string }

const W = 0.5 // rail length, metres
const PW = 300 // card, px at pixelSize 0.002 -> 60 x 19 cm
const PH = 96
const RAIL_Y = -0.03
const Z = 0.014 // rail floats 1.4 cm in front of the card

let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated matcap gives the rail and thumb the same soft top-light everywhere.
function getMatcap() {
  if (matcap) return matcap
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 30, 0, 64, 30, 90)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.5, "#d0d3da")
  grad.addColorStop(1, "#2f323a")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  matcap = new CanvasTexture(c)
  matcap.colorSpace = SRGBColorSpace
  return matcap
}

const clock = (s: number) => {
  const t = Math.max(0, Math.round(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}

/** 50 cm timeline. Drag the thumb or tap the rail to scrub; hover the rail to preview a time. `value` is 0-1, controlled or uncontrolled. */
export default function TimelineScrubber({ value, onChange, duration = 225, label = "Timeline" }: Props) {
  const [inner, setInner] = useState(0.35)
  const v = Math.min(1, Math.max(0, value ?? inner))
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const grp = useRef<Group>(null)
  const fill = useRef<Mesh>(null)
  const thumb = useRef<Group>(null)
  const shown = useRef(v)
  const mc = useMemo(getMatcap, [])
  const rod = useMemo(() => new CylinderGeometry(1, 1, 1, 20).rotateZ(Math.PI / 2), [])
  useEffect(() => () => rod.dispose(), [rod])
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0

  const set = (n: number) => {
    const c = Math.min(1, Math.max(0, n))
    if (value === undefined) setInner(c)
    onChange?.(c)
  }
  const toT = (e: ThreeEvent<PointerEvent>) => {
    const x = grp.current ? grp.current.worldToLocal(e.point.clone()).x : 0
    return Math.min(1, Math.max(0, (x + W / 2) / W))
  }

  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setDragging(true)
    set(toT(e))
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const t = toT(e)
    if (dragging) set(t)
    setHoverX(t)
  }
  const up = () => setDragging(false)

  useFrame((state, delta) => {
    const s = shown.current + (v - shown.current) * (1 - Math.exp(-Math.min(delta, 0.05) * 22))
    shown.current = Math.abs(v - s) < 1e-4 ? v : s
    const x = -W / 2 + shown.current * W
    if (fill.current) {
      fill.current.scale.x = Math.max(shown.current * W, 0.0001)
      fill.current.position.x = -W / 2 + (shown.current * W) / 2
    }
    if (thumb.current) {
      thumb.current.position.x = x
      const k = dragging ? 1.35 : hoverX !== null ? 1.15 : 1
      thumb.current.scale.setScalar(thumb.current.scale.x + (k - thumb.current.scale.x) * 0.25)
    }
    if (shown.current !== v) state.invalidate()
  })

  const tip = dragging ? v : hoverX
  return (
    <group ref={grp}>
      <Container
        pixelSize={0.002}
        width={PW}
        height={PH}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="flex-start"
        paddingX={25}
        paddingY={16}
        borderRadius={16}
        backgroundColor="#15171E"
        borderWidth={1.5}
        borderColor={dragging ? "#9FE7D2" : "#323745"}
      >
        <Text fontSize={13} fontWeight="medium" color="#9AA0AD">
          {label}
        </Text>
        <Container flexDirection="row" gap={4}>
          <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4">
            {clock(v * total)}
          </Text>
          <Text fontSize={14} color="#6B7180">
            {`/ ${clock(total)}`}
          </Text>
        </Container>
      </Container>
      <group position={[0, RAIL_Y, Z]}>
        <mesh geometry={rod} scale={[W, 0.0045, 0.0045]}>
          <meshMatcapMaterial matcap={mc} color="#323745" />
        </mesh>
        <mesh ref={fill} geometry={rod} scale={[0.0001, 0.0052, 0.0052]}>
          <meshMatcapMaterial matcap={mc} color="#9FE7D2" />
        </mesh>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} position={[-W / 2 + (i / 10) * W, -0.014, -0.004]}>
            <boxGeometry args={[0.0015, i % 5 === 0 ? 0.009 : 0.005, 0.0015]} />
            <meshBasicMaterial color={i % 5 === 0 ? "#6B7180" : "#3A3F4E"} />
          </mesh>
        ))}
        {hoverX !== null && !dragging && (
          <mesh position={[-W / 2 + hoverX * W, 0, 0]}>
            <boxGeometry args={[0.0018, 0.026, 0.0018]} />
            <meshBasicMaterial color="#9AA0AD" />
          </mesh>
        )}
        <group ref={thumb} position={[-W / 2 + v * W, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.011, 24, 24]} />
            <meshMatcapMaterial matcap={mc} color="#EEF0F4" />
          </mesh>
          <mesh>
            <torusGeometry args={[0.0135, 0.0018, 8, 32]} />
            <meshBasicMaterial color={dragging || hoverX !== null ? "#9FE7D2" : "#3A3F4E"} toneMapped={false} />
          </mesh>
        </group>
        {tip !== null && (
          <group position={[-W / 2 + tip * W, 0.034, 0.004]}>
            <Container
              pixelSize={0.002}
              pointerEvents="none"
              paddingX={8}
              paddingY={4}
              borderRadius={7}
              backgroundColor="#0B0C10"
              borderWidth={1}
              borderColor="#9FE7D2"
            >
              <Text fontSize={12} fontWeight="semi-bold" color="#EEF0F4">
                {clock(tip * total)}
              </Text>
            </Container>
          </group>
        )}
        {/* Rail hit box: 54 x 5 cm, so a fingertip or ray finds it easily. Pointer capture keeps the drag alive off the rail. */}
        <mesh
          visible={false}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerOut={() => setHoverX(null)}
        >
          <boxGeometry args={[W + 0.04, 0.05, 0.04]} />
        </mesh>
      </group>
    </group>
  )
}
