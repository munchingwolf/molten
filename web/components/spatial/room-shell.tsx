"use client"

import { useMemo } from "react"
import { CanvasTexture, FrontSide, RepeatWrapping, SRGBColorSpace } from "three"

type Props = {
  width?: number
  depth?: number
  height?: number
  wall?: string
  floor?: "oak" | "walnut" | "concrete"
  window?: boolean
  ceiling?: boolean
}

const floors = new Map<string, CanvasTexture>()
/** Generated floor: staggered planks with grain and tone variation, or trowelled concrete. Tiles every metre. */
function floorTexture(kind: NonNullable<Props["floor"]>) {
  let t = floors.get(kind)
  if (t) return t
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  if (kind === "concrete") {
    g.fillStyle = "#9C9A95"
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 9000; i++) {
      const v = 120 + rnd() * 60
      g.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.08 + rnd() * 0.1})`
      g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1 + rnd() * 3)
    }
  } else {
    const base = kind === "oak" ? [196, 158, 112] : [104, 70, 46]
    const plank = 512 / 6 // six planks per metre
    for (let row = 0; row < 6; row++) {
      let x = -rnd() * 300
      while (x < 512) {
        const len = 220 + rnd() * 260
        const k = 0.86 + rnd() * 0.24
        g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`
        g.fillRect(x, row * plank, len, plank)
        for (let s = 0; s < 14; s++) {
          // grain streaks along the plank
          g.strokeStyle = `rgba(60,36,18,${0.05 + rnd() * 0.08})`
          g.lineWidth = 0.6 + rnd()
          const y = row * plank + rnd() * plank
          g.beginPath()
          g.moveTo(x, y)
          g.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 6, x + len * 0.7, y + (rnd() - 0.5) * 6, x + len, y + (rnd() - 0.5) * 4)
          g.stroke()
        }
        g.fillStyle = "rgba(40,24,12,0.55)" // seam between plank ends
        g.fillRect(x, row * plank, 1.5, plank)
        x += len
      }
      g.fillStyle = "rgba(40,24,12,0.5)"
      g.fillRect(0, row * plank, 512, 1.5)
    }
  }
  t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  floors.set(kind, t)
  return t
}

let sky: CanvasTexture | undefined
/** Daylight seen through the window: a soft sky gradient with a hazy horizon. */
function skyTexture() {
  if (sky) return sky
  const c = document.createElement("canvas")
  c.width = 16
  c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, "#9CC3F0")
  grad.addColorStop(0.62, "#DCEBF8")
  grad.addColorStop(0.66, "#F4F1E8")
  grad.addColorStop(1, "#C9D4C2")
  g.fillStyle = grad
  g.fillRect(0, 0, 16, 256)
  sky = new CanvasTexture(c)
  sky.colorSpace = SRGBColorSpace
  return sky
}

/**
 * A room you can build in: floor, three walls and an optional ceiling, sized in metres around its origin (the floor centre).
 * Walls only render from inside, so from outside you look in like a dollhouse; inside a headset you're enclosed.
 * Daylight window on the back wall, baseboards, recessed downlights when the ceiling is on. Floor = surface, walls = wall mounts.
 */
export default function RoomShell({ width = 4, depth = 4, height = 2.7, wall = "#EEEAE3", floor = "oak", window: hasWindow = true, ceiling = false }: Props) {
  const tex = useMemo(() => {
    const t = floorTexture(floor).clone()
    t.repeat.set(width, depth)
    t.needsUpdate = true
    return t
  }, [floor, width, depth])
  const w2 = width / 2
  const d2 = depth / 2
  const winW = Math.min(1.8, width * 0.45)
  const winH = Math.min(1.3, height * 0.48)
  const winY = Math.min(height - winH / 2 - 0.35, 1.45)

  const wallMat = <meshStandardMaterial color={wall} roughness={0.92} side={FrontSide} />
  return (
    <group>
      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={tex} roughness={floor === "concrete" ? 0.85 : 0.55} />
      </mesh>
      {/* Back wall faces +z; side walls face inward. */}
      <mesh position={[0, height / 2, -d2]}>
        <planeGeometry args={[width, height]} />
        {wallMat}
      </mesh>
      <mesh position={[-w2, height / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[depth, height]} />
        {wallMat}
      </mesh>
      <mesh position={[w2, height / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[depth, height]} />
        {wallMat}
      </mesh>
      {/* Baseboards */}
      {[
        { p: [0, 0.05, -d2 + 0.006] as const, r: 0, l: width },
        { p: [-w2 + 0.006, 0.05, 0] as const, r: Math.PI / 2, l: depth },
        { p: [w2 - 0.006, 0.05, 0] as const, r: -Math.PI / 2, l: depth },
      ].map((b, i) => (
        <mesh key={i} position={b.p} rotation-y={b.r}>
          <boxGeometry args={[b.l, 0.1, 0.012]} />
          <meshStandardMaterial color="#F7F5F1" roughness={0.6} />
        </mesh>
      ))}
      {hasWindow && (
        <group position={[0, winY, -d2 + 0.004]}>
          <mesh>
            <planeGeometry args={[winW, winH]} />
            <meshBasicMaterial map={skyTexture()} toneMapped={false} />
          </mesh>
          {/* Frame and mullions */}
          {[
            [0, winH / 2, winW + 0.08, 0.05],
            [0, -winH / 2, winW + 0.08, 0.06],
            [-winW / 2, 0, 0.05, winH],
            [winW / 2, 0, 0.05, winH],
            [0, 0, 0.03, winH],
            [0, winH * 0.12, winW, 0.025],
          ].map(([x, y, w, h], i) => (
            <mesh key={i} position={[x, y, 0.012]}>
              <boxGeometry args={[w, h, 0.03]} />
              <meshStandardMaterial color="#FBFAF7" roughness={0.5} />
            </mesh>
          ))}
          <pointLight position={[0, 0, 0.6]} intensity={1.4} distance={Math.max(width, depth) * 1.2} decay={2} color="#EEF4FF" />
        </group>
      )}
      {ceiling && (
        <group position-y={height}>
          <mesh rotation-x={Math.PI / 2}>
            <planeGeometry args={[width, depth]} />
            <meshStandardMaterial color="#F4F2EE" roughness={0.95} side={FrontSide} />
          </mesh>
          {/* Recessed downlights on a grid. */}
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * width * 0.22, sz * depth * 0.22] as const)).map(([x, z], i) => (
            <group key={i} position={[x, -0.002, z]}>
              <mesh rotation-x={Math.PI / 2}>
                <circleGeometry args={[0.05, 32]} />
                <meshBasicMaterial color="#FFF4E0" toneMapped={false} />
              </mesh>
              <pointLight position={[0, -0.15, 0]} intensity={0.9} distance={height * 1.8} decay={2} color="#FFE9C8" />
            </group>
          ))}
        </group>
      )}
    </group>
  )
}
