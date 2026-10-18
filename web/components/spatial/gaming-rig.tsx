"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import {
  AdditiveBlending, CanvasTexture, CatmullRomCurve3, Color, ExtrudeGeometry, Object3D, Path, RepeatWrapping, Shape, SRGBColorSpace,
  TubeGeometry, Vector3, type Group, type InstancedMesh, type MeshBasicMaterial, type MeshStandardMaterial,
} from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

const MODES = ["rainbow", "pulse", "static"] as const
type Props = {
  /** RGB lighting effect. */
  mode?: (typeof MODES)[number]
  /** Colour used by the pulse and static modes. */
  color?: string
  /** Index into rainbow / pulse / static. Tap the case to cycle. */
  value?: number
  onChange?: (index: number) => void
}

// Real mid-tower: 47 cm tall, 44 cm deep (front is +X), 23 cm wide. The tempered-glass side faces +Z.
const H = 0.47
const D = 0.44
const W = 0.23
const FAN_X = 0.148
const FAN_Y = [0.128, 0, -0.128]

const texCache: Record<string, CanvasTexture> = {}
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  if (texCache[key]) return texCache[key]
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  draw(c.getContext("2d")!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(repeat[0], repeat[1])
  }
  return (texCache[key] = t)
}
const brushed = () =>
  canvasTex("brushed", 256, 256, (g) => {
    g.fillStyle = "#9a9a9a"
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 1600; i++) {
      const v = 110 + Math.floor(Math.random() * 110)
      g.strokeStyle = `rgba(${v},${v},${v},0.35)`
      g.lineWidth = Math.random() < 0.8 ? 1 : 2
      const y = Math.random() * 256
      const x = Math.random() * 256
      g.beginPath()
      g.moveTo(x - 120, y)
      g.lineTo(x + 40 + Math.random() * 160, y)
      g.stroke()
    }
  })
const perforated = (key: string, rx: number, ry: number) =>
  canvasTex(key, 64, 64, (g) => {
    g.fillStyle = "#2b2e35"
    g.fillRect(0, 0, 64, 64)
    g.fillStyle = "#050506"
    for (let y = 0; y < 64; y += 8)
      for (let x = (y / 8) % 2 ? 4 : 0; x < 64; x += 8) {
        g.beginPath()
        g.arc(x + 2, y + 4, 2.4, 0, Math.PI * 2)
        g.fill()
      }
  }, [rx, ry])
const glowTex = () =>
  canvasTex("glow", 128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, "rgba(255,255,255,0.9)")
    r.addColorStop(0.45, "rgba(255,255,255,0.35)")
    r.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
  })
const sheenTex = () =>
  canvasTex("sheen", 256, 256, (g) => {
    const l = g.createLinearGradient(0, 0, 256, 256)
    l.addColorStop(0, "rgba(255,255,255,0)")
    l.addColorStop(0.34, "rgba(255,255,255,0)")
    l.addColorStop(0.4, "rgba(255,255,255,0.55)")
    l.addColorStop(0.47, "rgba(255,255,255,0.08)")
    l.addColorStop(0.55, "rgba(255,255,255,0.25)")
    l.addColorStop(0.6, "rgba(255,255,255,0)")
    l.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = l
    g.fillRect(0, 0, 256, 256)
  })
const logoTex = () =>
  canvasTex("logo", 256, 256, (g) => {
    g.fillStyle = "#0a0b0e"
    g.beginPath()
    g.arc(128, 128, 126, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = "#3b3f48"
    g.lineWidth = 4
    g.beginPath()
    g.arc(128, 128, 112, 0, Math.PI * 2)
    g.stroke()
    // Two offset chevrons: the Spatial mark.
    g.fillStyle = "#f2f4f8"
    g.beginPath()
    g.moveTo(70, 92); g.lineTo(150, 92); g.lineTo(186, 120); g.lineTo(106, 120); g.closePath()
    g.moveTo(70, 136); g.lineTo(150, 136); g.lineTo(186, 164); g.lineTo(106, 164); g.closePath()
    g.fill()
    g.font = "bold 22px sans-serif"
    g.textAlign = "center"
    g.fillStyle = "#8a909c"
    g.fillText("SPATIAL", 128, 204)
  })
const textTex = (key: string, text: string, color: string, italic = false) =>
  canvasTex(key, 512, 64, (g) => {
    g.font = `${italic ? "italic " : ""}900 40px sans-serif`
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillStyle = color
    g.fillText(text, 256, 34)
  })
const finsTex = () =>
  canvasTex("fins", 128, 16, (g) => {
    g.fillStyle = "#0c0d10"
    g.fillRect(0, 0, 128, 16)
    g.fillStyle = "#30333a"
    for (let x = 0; x < 128; x += 3) g.fillRect(x, 0, 1, 16)
  }, [6, 1])

function roundRect(p: Shape | Path, w: number, h: number, r: number) {
  const x = -w / 2
  const y = -h / 2
  p.moveTo(x + r, y)
  p.lineTo(x + w - r, y)
  p.quadraticCurveTo(x + w, y, x + w, y + r)
  p.lineTo(x + w, y + h - r)
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  p.lineTo(x + r, y + h)
  p.quadraticCurveTo(x, y + h, x, y + h - r)
  p.lineTo(x, y + r)
  p.quadraticCurveTo(x, y, x + r, y)
}

type Geo = Record<"frame" | "blade" | "tubeA" | "tubeB" | "top" | "front" | "shroud" | "gpu" | "glass" | "pillar", ExtrudeGeometry | TubeGeometry | RoundedBoxGeometry>
let geo: Geo | undefined
function getGeo(): Geo {
  if (geo) return geo
  // 120 mm fan frame: rounded square with a round throat, soft bevel.
  const sq = new Shape()
  roundRect(sq, 0.12, 0.12, 0.01)
  const hole = new Path()
  hole.absarc(0, 0, 0.0575, 0, Math.PI * 2, true)
  sq.holes.push(hole)
  const frame = new ExtrudeGeometry(sq, { depth: 0.019, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 40 })
  frame.translate(0, 0, -0.0095)
  // Swept blade, radius along +X; each instance is pitched and spun around the hub.
  const b = new Shape()
  b.moveTo(0.018, -0.007)
  b.quadraticCurveTo(0.042, -0.018, 0.0555, -0.004)
  b.quadraticCurveTo(0.052, 0.014, 0.032, 0.017)
  b.quadraticCurveTo(0.022, 0.01, 0.018, 0.007)
  const blade = new ExtrudeGeometry(b, { depth: 0.0014, bevelEnabled: false, curveSegments: 10 })
  const tube = (dx: number) =>
    new TubeGeometry(new CatmullRomCurve3([
      new Vector3(-0.087 + dx, 0.108, -0.075), new Vector3(-0.095 + dx, 0.145, -0.05),
      new Vector3(-0.12 + dx, 0.175, -0.03), new Vector3(-0.15 + dx, 0.19, -0.03),
    ]), 24, 0.0055, 10)
  geo = {
    frame, blade, tubeA: tube(0), tubeB: tube(0.026),
    top: new RoundedBoxGeometry(D, 0.014, W, 3, 0.005),
    front: new RoundedBoxGeometry(0.018, H - 0.012, W, 3, 0.006),
    shroud: new RoundedBoxGeometry(0.29, 0.075, W - 0.012, 3, 0.006),
    gpu: new RoundedBoxGeometry(0.27, 0.046, 0.12, 3, 0.006),
    glass: new RoundedBoxGeometry(D - 0.026, H - 0.034, 0.004, 2, 0.0018),
    pillar: new RoundedBoxGeometry(0.012, H - 0.012, 0.012, 2, 0.004),
  }
  return geo
}

/** RGB colour for light element k at time t: rainbow wave, breathing pulse, or static, washed toward white by the tap flash. */
function rgb(out: Color, mode: number, base: Color, k: number, t: number, flash: number, white: Color) {
  if (mode === 0) out.setHSL((((t * 0.11 + k * 0.085) % 1) + 1) % 1, 0.95, 0.56)
  else if (mode === 1) out.copy(base).multiplyScalar(0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * 2.4 - k * 0.45)) ** 2)
  else out.copy(base)
  if (flash > 0.002) out.lerp(white, flash * 0.85)
  return out
}

const dummy = new Object3D()
const WHITE = new Color("#ffffff")
const TMP = new Color()

/**
 * Desktop gaming PC tower at real size: brushed aluminium and a tempered-glass side over a lit interior (GPU, RAM, AIO pump,
 * three spinning RGB fans). Tap the case to cycle rainbow / pulse / static (value/onChange): the lights flash, the fans spin up.
 */
export default function GamingRig({ mode = "rainbow", color = "#7C5CFF", value, onChange }: Props) {
  const [local, setLocal] = useState(() => Math.max(0, MODES.indexOf(mode)))
  useEffect(() => setLocal(Math.max(0, MODES.indexOf(mode))), [mode])
  const idx = (((value ?? local) % 3) + 3) % 3
  const g = getGeo()
  const root = useRef<Group>(null)
  const rotors = useRef<(Group | null)[]>([])
  const rings = useRef<(MeshBasicMaterial | null)[]>([])
  const glows = useRef<(MeshBasicMaterial | null)[]>([])
  const blades = useRef<(MeshStandardMaterial | null)[]>([])
  const lights = useRef<(MeshBasicMaterial | null)[]>([])
  const ram = useRef<InstancedMesh>(null)
  const ramBody = useRef<InstancedMesh>(null)
  const live = useRef({ idx, base: new Color(color), flash: 0, boost: 0, py: 0, vy: 0, hover: 0, hoverT: 0 })
  live.current.idx = idx
  live.current.base.set(color)

  useLayoutEffect(() => {
    for (let i = 0; i < 4; i++) {
      dummy.position.set(0.005 + i * 0.0095, 0.075, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      ram.current?.setMatrixAt(i, dummy.matrix)
      ramBody.current?.setMatrixAt(i, dummy.matrix)
    }
    if (ram.current) ram.current.instanceMatrix.needsUpdate = true
    if (ramBody.current) ramBody.current.instanceMatrix.needsUpdate = true
  }, [])

  useFrame((state, dt) => {
    const L = live.current
    const t = state.clock.elapsedTime
    const h = Math.min(dt, 0.05)
    L.flash *= Math.exp(-h * 3.2)
    L.boost *= Math.exp(-h * 1.4)
    L.hover += (L.hoverT - L.hover) * (1 - Math.exp(-h * 8))
    // Spring "thunk" when tapped.
    L.vy += (-L.py * 700 - L.vy * 20) * h
    L.py += L.vy * h
    if (root.current) root.current.position.y = L.py
    const spin = (8 + L.boost * 46 + L.hover * 4) * h
    for (let i = 0; i < 3; i++) {
      const r = rotors.current[i]
      if (r) r.rotation.z -= spin * (1 + i * 0.04)
      rgb(TMP, L.idx, L.base, i, t, L.flash, WHITE)
      rings.current[i]?.color.copy(TMP)
      const gl = glows.current[i]
      if (gl) {
        gl.color.copy(TMP)
        gl.opacity = 0.42 + L.hover * 0.2 + L.flash * 0.3
      }
      blades.current[i]?.emissive.copy(TMP).multiplyScalar(0.4)
    }
    const rm = ram.current
    if (rm) {
      for (let i = 0; i < 4; i++) rm.setColorAt(i, rgb(TMP, L.idx, L.base, 3 + i, t, L.flash, WHITE))
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true
    }
    for (let j = 0; j < lights.current.length; j++) lights.current[j]?.color.copy(rgb(TMP, L.idx, L.base, 7 + j, t, L.flash, WHITE))
    state.invalidate() // the fans never stop
  })

  const tap = () => {
    const n = (idx + 1) % 3
    setLocal(n)
    onChange?.(n)
    const L = live.current
    L.flash = 1
    L.boost = 1
    L.vy = -0.16
  }

  const alu = <meshStandardMaterial map={brushed()} color="#3a3d44" metalness={0.55} roughness={0.38} />
  const zBack = -W / 2
  return (
    <group onClick={tap} onPointerOver={() => (live.current.hoverT = 1)} onPointerOut={() => (live.current.hoverT = 0)}>
      <group ref={root}>
        {/* Chassis: brushed top/bottom, perforated front, motherboard tray, rear, glass pillar, rubber feet. */}
        <mesh geometry={g.top} position={[0, H / 2 - 0.007, 0]}>{alu}</mesh>
        <mesh position={[0.03, H / 2 + 0.0005, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.3, 0.16]} />
          <meshStandardMaterial map={perforated("perfTop", 9, 5)} roughness={0.7} metalness={0.3} />
        </mesh>
        <mesh geometry={g.top} position={[0, -H / 2 + 0.019, 0]}>{alu}</mesh>
        <mesh geometry={g.front} position={[D / 2 - 0.009, 0.006, 0]}>
          <meshStandardMaterial map={perforated("perfFront", 7, 14)} roughness={0.65} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.006, zBack + 0.003]}>
          <boxGeometry args={[D - 0.02, H - 0.026, 0.006]} />
          <meshStandardMaterial color="#121418" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[-D / 2 + 0.005, 0.006, 0]}>
          <boxGeometry args={[0.01, H - 0.026, W - 0.004]} />
          <meshStandardMaterial color="#17191e" roughness={0.55} metalness={0.4} />
        </mesh>
        <mesh geometry={g.pillar} position={[-D / 2 + 0.006, 0.006, W / 2 - 0.006]}>{alu}</mesh>
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
          <mesh key={`${sx}${sz}`} position={[sx * (D / 2 - 0.04), -H / 2 + 0.006, sz * (W / 2 - 0.03)]}>
            <cylinderGeometry args={[0.014, 0.016, 0.012, 20]} />
            <meshStandardMaterial color="#0b0b0d" roughness={0.95} />
          </mesh>
        ))}
        {/* Power button with an RGB ring. */}
        <mesh position={[D / 2 - 0.045, H / 2 + 0.002, 0.06]}>
          <cylinderGeometry args={[0.008, 0.008, 0.004, 24]} />
          <meshStandardMaterial map={brushed()} color="#c9ccd2" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[D / 2 - 0.045, H / 2 + 0.0035, 0.06]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.0095, 0.0013, 8, 32]} />
          <meshBasicMaterial ref={(m) => void (lights.current[3] = m)} toneMapped={false} />
        </mesh>

        {/* Motherboard with VRM heatsinks and a chipset cover. */}
        <mesh position={[-0.065, 0.04, zBack + 0.009]}>
          <boxGeometry args={[0.27, 0.3, 0.004]} />
          <meshStandardMaterial color="#0d0f12" roughness={0.55} metalness={0.2} />
        </mesh>
        <mesh position={[-0.135, 0.09, zBack + 0.018]}>
          <boxGeometry args={[0.014, 0.075, 0.014]} />
          <meshStandardMaterial map={brushed()} color="#5a5e66" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[-0.085, 0.152, zBack + 0.018]}>
          <boxGeometry args={[0.07, 0.014, 0.014]} />
          <meshStandardMaterial map={brushed()} color="#5a5e66" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[-0.02, -0.105, zBack + 0.014]}>
          <boxGeometry args={[0.07, 0.04, 0.006]} />
          <meshStandardMaterial map={brushed()} color="#8c9099" metalness={0.75} roughness={0.3} />
        </mesh>

        {/* Top radiator and the AIO's sleeved tubes. */}
        <mesh position={[-0.065, H / 2 - 0.028, -0.02]}>
          <boxGeometry args={[0.27, 0.026, 0.13]} />
          <meshStandardMaterial map={finsTex()} roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh geometry={g.tubeA}>
          <meshStandardMaterial color="#0f1013" roughness={0.9} />
        </mesh>
        <mesh geometry={g.tubeB}>
          <meshStandardMaterial color="#0f1013" roughness={0.9} />
        </mesh>
        {/* AIO pump: mirror-black cap, logo, RGB halo. */}
        <group position={[-0.075, 0.075, zBack + 0.011]}>
          <mesh position={[0, 0, 0.015]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.036, 0.038, 0.03, 48]} />
            <meshPhysicalMaterial color="#0c0d10" roughness={0.18} metalness={0.4} clearcoat={1} clearcoatRoughness={0.05} />
          </mesh>
          <mesh position={[0, 0, 0.0305]}>
            <circleGeometry args={[0.031, 48]} />
            <meshBasicMaterial map={logoTex()} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <torusGeometry args={[0.0335, 0.0024, 10, 64]} />
            <meshBasicMaterial ref={(m) => void (lights.current[0] = m)} toneMapped={false} />
          </mesh>
        </group>

        {/* RAM: instanced heat spreaders with instanced light bars. */}
        <group position={[0, 0, zBack + 0.026]}>
          <instancedMesh ref={ramBody} args={[undefined, undefined, 4]}>
            <boxGeometry args={[0.0065, 0.13, 0.03]} />
            <meshStandardMaterial map={brushed()} color="#2c2f36" metalness={0.65} roughness={0.35} />
          </instancedMesh>
          <instancedMesh ref={ram} args={[undefined, undefined, 4]} position={[0, 0, 0.0185]}>
            <boxGeometry args={[0.0058, 0.125, 0.007]} />
            <meshBasicMaterial toneMapped={false} />
          </instancedMesh>
        </group>

        {/* GPU: gunmetal shroud, silver backplate, RGB edge strip and badge. */}
        <group position={[-0.065, -0.06, -0.04]}>
          <mesh geometry={g.gpu}>
            <meshStandardMaterial map={brushed()} color="#2b2e35" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.0245, 0]}>
            <boxGeometry args={[0.264, 0.003, 0.114]} />
            <meshStandardMaterial map={brushed()} color="#b9bdc6" metalness={0.8} roughness={0.28} />
          </mesh>
          <mesh position={[0.02, 0.011, 0.0605]}>
            <boxGeometry args={[0.2, 0.004, 0.002]} />
            <meshBasicMaterial ref={(m) => void (lights.current[1] = m)} toneMapped={false} />
          </mesh>
          <mesh position={[-0.05, -0.007, 0.0607]}>
            <planeGeometry args={[0.12, 0.015]} />
            <meshBasicMaterial map={textTex("gpuLabel", "VECTOR X9", "#d9dde4", true)} transparent depthWrite={false} />
          </mesh>
          <mesh position={[0.07, 0.03, 0.02]}>
            <boxGeometry args={[0.02, 0.012, 0.008]} />
            <meshStandardMaterial color="#0a0a0c" roughness={0.8} />
          </mesh>
        </group>

        {/* PSU shroud with an etched mark. */}
        <mesh geometry={g.shroud} position={[-0.065, -H / 2 + 0.065, 0]}>
          <meshStandardMaterial map={brushed()} color="#1c1e23" metalness={0.5} roughness={0.42} />
        </mesh>
        <mesh position={[-0.065, -H / 2 + 0.065, W / 2 - 0.0055]}>
          <planeGeometry args={[0.14, 0.0175]} />
          <meshBasicMaterial map={textTex("shroudLabel", "S P A T I A L", "#6b7180")} transparent depthWrite={false} />
        </mesh>

        {/* Front RGB light strip just behind the glass. */}
        <mesh position={[D / 2 - 0.024, 0.006, W / 2 - 0.009]}>
          <boxGeometry args={[0.004, H - 0.07, 0.004]} />
          <meshBasicMaterial ref={(m) => void (lights.current[2] = m)} toneMapped={false} />
        </mesh>

        {FAN_Y.map((y, i) => (
          <group key={i} position={[FAN_X, y, 0.0]}>
            <mesh geometry={g.frame}>
              <meshStandardMaterial color="#141519" roughness={0.78} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0, -0.016]} raycast={() => null}>
              <planeGeometry args={[0.2, 0.2]} />
              <meshBasicMaterial ref={(m) => void (glows.current[i] = m)} map={glowTex()} transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, 0.0115]}>
              <torusGeometry args={[0.0585, 0.0024, 10, 72]} />
              <meshBasicMaterial ref={(m) => void (rings.current[i] = m)} toneMapped={false} />
            </mesh>
            {[0, 1, 2, 3].map((s) => (
              <mesh key={s} position={[0, 0, -0.008]} rotation-z={(s * Math.PI) / 2 + Math.PI / 4}>
                <boxGeometry args={[0.004, 0.115, 0.003]} />
                <meshStandardMaterial color="#141519" roughness={0.8} />
              </mesh>
            ))}
            <group ref={(r) => void (rotors.current[i] = r)}>
              <mesh rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.019, 0.019, 0.013, 32]} />
                <meshStandardMaterial color="#1a1b20" roughness={0.6} />
              </mesh>
              <mesh position={[0, 0, 0.0068]}>
                <circleGeometry args={[0.016, 32]} />
                <meshBasicMaterial map={logoTex()} />
              </mesh>
              <Blades geometry={g.blade as ExtrudeGeometry} matRef={(m) => void (blades.current[i] = m)} />
            </group>
          </group>
        ))}

        {/* Tempered glass side panel and its reflection streak. */}
        <mesh geometry={g.glass} position={[0, 0.006, W / 2 - 0.002]} renderOrder={2}>
          <meshPhysicalMaterial color="#cdd6e2" transparent opacity={0.14} roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0.02} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.006, W / 2 + 0.0006]} renderOrder={3} raycast={() => null}>
          <planeGeometry args={[D - 0.03, H - 0.04]} />
          <meshBasicMaterial map={sheenTex()} transparent opacity={0.28} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

function Blades({ geometry, matRef }: { geometry: ExtrudeGeometry; matRef: (m: MeshStandardMaterial | null) => void }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    for (let i = 0; i < 9; i++) {
      dummy.position.set(0, 0, -0.004)
      dummy.rotation.set(0.42, 0, (i * Math.PI * 2) / 9, "ZYX") // pitch the blade, then spin it round the hub
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, 9]}>
      <meshStandardMaterial ref={matRef} color="#aeb5c2" transparent opacity={0.62} roughness={0.3} metalness={0} />
    </instancedMesh>
  )
}
