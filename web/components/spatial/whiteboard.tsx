"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace, Vector3, type Mesh } from "three"
import { Container, Text } from "@react-three/uikit"

type Props = { ink?: string }

const W = 0.96 // writing surface, metres
const H = 0.62
const PX = 1024 // canvas width; height follows the board's aspect
const PY = Math.round((PX * H) / W)
const PAPER = "#F7F8FA"

const p = new Vector3()

/** 1 m whiteboard. Draw on it with a fingertip, a pinch-drag or the mouse; tap a marker to change colour, tap the eraser to wipe it. */
export default function Whiteboard({ ink = "#1B1E26" }: Props) {
  const inks = [ink, "#2E6BE6", "#E5484D"]
  const [active, setActive] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const [wiping, setWiping] = useState(false)
  const surface = useRef<Mesh>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const dirty = useRef(false)

  const { canvas, ctx, tex } = useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = PX
    canvas.height = PY
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, PX, PY)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 4
    return { canvas, ctx, tex }
  }, [])
  useEffect(() => () => tex.dispose(), [tex])

  // Upload at most once per frame, however many move events arrive.
  useFrame(() => {
    if (!dirty.current) return
    dirty.current = false
    tex.needsUpdate = true
  })

  const toCanvas = (e: ThreeEvent<PointerEvent>) => {
    surface.current!.worldToLocal(p.copy(e.point))
    return { x: (p.x / W + 0.5) * PX, y: (0.5 - p.y / H) * PY }
  }

  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const pt = toCanvas(e)
    ctx.fillStyle = inks[active]
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
    last.current = pt
    dirty.current = true
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!last.current) return
    const pt = toCanvas(e)
    ctx.strokeStyle = inks[active]
    ctx.lineWidth = 7
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    last.current = pt
    dirty.current = true
  }
  const up = () => {
    last.current = null
  }

  const wipe = () => {
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    dirty.current = true
    setWiping(true)
    setTimeout(() => setWiping(false), 150)
  }

  return (
    <group>
      {/* Aluminium frame */}
      <mesh position={[0, 0, -0.006]}>
        <boxGeometry args={[W + 0.04, H + 0.04, 0.02]} />
        <meshStandardMaterial color="#AEB3BD" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Writing surface */}
      <mesh
        ref={surface}
        position={[0, 0, 0.0052]}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={tex} roughness={0.3} metalness={0} />
      </mesh>
      {/* Marker tray */}
      <group position={[0, -H / 2 - 0.0125, 0.02]}>
        <mesh>
          <boxGeometry args={[0.56, 0.01, 0.06]} />
          <meshStandardMaterial color="#AEB3BD" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.01, 0.029]}>
          <boxGeometry args={[0.56, 0.02, 0.004]} />
          <meshStandardMaterial color="#AEB3BD" metalness={0.6} roughness={0.35} />
        </mesh>
        {inks.map((c, i) => {
          const lifted = i === active || hover === i
          return (
            <group
              key={i}
              position={[-0.2 + i * 0.075, lifted ? 0.022 : 0.014, 0.004]}
              onClick={() => setActive(i)}
              onPointerOver={() => setHover(i)}
              onPointerOut={() => setHover(null)}
            >
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.008, 0.008, 0.09, 16]} />
                <meshStandardMaterial color="#EEF0F4" roughness={0.4} />
              </mesh>
              <mesh position={[0.052, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.0085, 0.0085, 0.024, 16]} />
                <meshStandardMaterial color={c} roughness={0.35} emissive={c} emissiveIntensity={i === active ? 0.35 : 0} />
              </mesh>
              {/* Generous invisible hit box for fingertips */}
              <mesh visible={false}>
                <boxGeometry args={[0.12, 0.03, 0.04]} />
              </mesh>
            </group>
          )
        })}
        {/* Eraser: tap to wipe the board */}
        <group
          position={[0.19, wiping ? 0.014 : 0.019, 0.004]}
          onClick={wipe}
          onPointerOver={() => setHover(9)}
          onPointerOut={() => setHover(null)}
        >
          <mesh>
            <boxGeometry args={[0.11, 0.028, 0.045]} />
            <meshStandardMaterial color={hover === 9 ? "#2A2F3A" : "#15171E"} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.016, 0]}>
            <boxGeometry args={[0.108, 0.006, 0.043]} />
            <meshStandardMaterial color="#9AA0AD" roughness={1} />
          </mesh>
          <group position={[0, 0.002, 0.0232]}>
            <Container pixelSize={0.0008} paddingX={8}>
              <Text fontSize={16} fontWeight="bold" color="#9FE7D2">
                Clear
              </Text>
            </Container>
          </group>
        </group>
      </group>
    </group>
  )
}
