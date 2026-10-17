"use client"

import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"

const ENV_KEY = Symbol.for("spatial.roomEnv")
/** Neutral studio reflections, built once per renderer and shared by every Spatial component, so metal reads as metal in any scene. */
function useRoomEnv() {
  const gl = useThree((s) => s.gl)
  return useMemo(() => {
    const cache = gl as unknown as Record<symbol, THREE.Texture | undefined>
    if (!cache[ENV_KEY]) {
      const pmrem = new THREE.PMREMGenerator(gl)
      const room = new RoomEnvironment()
      cache[ENV_KEY] = pmrem.fromScene(room, 0.04).texture
      room.dispose()
      pmrem.dispose()
    }
    return cache[ENV_KEY]
  }, [gl])
}

function woodTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  g.fillStyle = "#fff"
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(70,40,15,${0.05 + Math.random() * 0.12})`
    g.lineWidth = 0.6 + Math.random() * 2
    const x = Math.random() * 256
    g.beginPath()
    g.moveTo(x, 0)
    for (let y = 0; y <= 256; y += 16) g.lineTo(x + Math.sin(y * 0.02 + i) * 3, y)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Real-world 5-shelf bookcase (metres). Origin = bounding-box centre; front faces +Z.
const W = 0.8
const H = 1.8
const D = 0.3
const T = 0.018 // board thickness
const PLINTH = 0.06
const ROWS = 5
const BAY = (H - PLINTH - T * (ROWS + 1)) / ROWS
const SPINES = ["#7A2E2E", "#2E4A7A", "#C9A227", "#2F5D50", "#D8D2C4", "#3B3B3F", "#A0522D", "#5B4B8A", "#E07A5F", "#1F3A4D", "#8C8C7A", "#B23A48"]

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

type Book = { x: number; y: number; z: number; w: number; h: number; d: number; tilt: number; color: string }

/** Books per shelf: an upright run, sometimes a leaning book, sometimes a short horizontal stack. Deterministic. */
function layoutBooks(): Book[] {
  const r = seeded(42)
  const out: Book[] = []
  for (let row = 0; row < ROWS; row++) {
    const floor = -H / 2 + PLINTH + T + row * (BAY + T)
    let x = -W / 2 + T + 0.01
    const end = W / 2 - T - (row % 2 ? 0.2 : 0.12) // leave air at the end of each run
    while (x < end) {
      const w = 0.018 + r() * 0.03
      const h = Math.min(BAY - 0.03, 0.17 + r() * 0.13)
      const d = 0.15 + r() * 0.08
      if (x + w > end) break
      out.push({ x: x + w / 2, y: floor + h / 2, z: -D / 2 + 0.02 + d / 2, w, h, d, tilt: 0, color: SPINES[Math.floor(r() * SPINES.length)] })
      x += w + 0.001
    }
    // one leaning book closing the run
    if (row % 2 === 0) {
      const h = Math.min(BAY - 0.04, 0.24)
      const tilt = 0.32 // top rests against the run
      out.push({ x: x + 0.012 + (Math.sin(tilt) * h) / 2, y: floor + (Math.cos(tilt) * h) / 2 + 0.004, z: -D / 2 + 0.13, w: 0.024, h, d: 0.17, tilt, color: SPINES[(row * 5) % SPINES.length] })
    } else {
      // short horizontal stack at the far end
      for (let k = 0; k < 3; k++) {
        const th = 0.025 + r() * 0.015
        out.push({ x: W / 2 - T - 0.1, y: floor + th / 2 + k * 0.042, z: -D / 2 + 0.13, w: 0.19 - k * 0.015, h: th, d: 0.15, tilt: 0, color: SPINES[Math.floor(r() * SPINES.length)] })
      }
    }
  }
  return out
}

/** Wooden 5-shelf bookcase filled with books. Its top is a placement surface. */
export default function Bookshelf({ color = "#8A5A36" }: { color?: string }) {
  const env = useRoomEnv()
  const grain = useMemo(woodTexture, [])
  useEffect(() => () => grain.dispose(), [grain])
  const books = useMemo(layoutBooks, [])
  const inst = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    books.forEach((b, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.tilt)
      inst.current?.setMatrixAt(i, m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d)))
      inst.current?.setColorAt(i, c.set(b.color))
    })
    if (inst.current) {
      inst.current.instanceMatrix.needsUpdate = true
      if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true
      inst.current.computeBoundingSphere()
    }
  }, [books])

  const wood = <meshPhysicalMaterial color={color} map={grain} roughness={0.55} clearcoat={0.3} clearcoatRoughness={0.4} envMap={env} />
  const board = (key: string, pos: [number, number, number], size: [number, number, number]) => (
    <mesh key={key} position={pos}>
      <boxGeometry args={size} />
      {wood}
    </mesh>
  )

  return (
    <group>
      {board("l", [-W / 2 + T / 2, -T / 2, 0], [T, H - T, D])}
      {board("r", [W / 2 - T / 2, -T / 2, 0], [T, H - T, D])}
      {board("top", [0, H / 2 - T / 2, 0], [W, T, D])}
      {board("plinth", [0, -H / 2 + PLINTH / 2, 0.01], [W - 2 * T, PLINTH, D - 0.02])}
      {Array.from({ length: ROWS }, (_, i) => board(`s${i}`, [0, -H / 2 + PLINTH + T / 2 + i * (BAY + T), 0], [W - 2 * T, T, D - 0.01]))}
      {/* back panel */}
      <mesh position={[0, 0, -D / 2 + 0.003]}>
        <boxGeometry args={[W - 2 * T, H - T, 0.006]} />
        <meshPhysicalMaterial color={color} map={grain} roughness={0.7} envMap={env} />
      </mesh>
      <instancedMesh ref={inst} args={[undefined, undefined, books.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial roughness={0.75} sheen={0.3} envMap={env} />
      </instancedMesh>
    </group>
  )
}
