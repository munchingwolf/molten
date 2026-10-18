"use client"

import { useMemo, useRef, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import { CanvasTexture, Color, ExtrudeGeometry, Shape, SRGBColorSpace, type Group, type MeshBasicMaterial, type MeshStandardMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = {
  /** Light bar colour. */
  color?: string
  /** Shell colour (soft-touch plastic). */
  shell?: string
  onPress?: (button: string) => void
}

// Real controller: 16 cm wide, face toward +Z (lay it on a desk with rotation [-PI/2, 0, 0]).
const FACE = 0.0205
const GLYPHS: [string, string, number, number][] = [
  ["A", "#3DDC84", 0, -1],
  ["B", "#FF5A5A", 1, 0],
  ["X", "#4C8DFF", -1, 0],
  ["Y", "#FFC93D", 0, 1],
]

const texCache: Record<string, CanvasTexture> = {}
function letterTex(letter: string, color: string) {
  const key = letter + color
  if (texCache[key]) return texCache[key]
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  g.font = "900 84px sans-serif"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillStyle = color
  g.fillText(letter, 64, 70)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return (texCache[key] = t)
}
function knurlTex() {
  if (texCache.knurl) return texCache.knurl
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  g.fillStyle = "#2a2c32"
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = "#101114"
  g.lineWidth = 3
  for (let a = 0; a < 36; a++) {
    const r = (a / 36) * Math.PI * 2
    g.beginPath()
    g.moveTo(64 + Math.cos(r) * 46, 64 + Math.sin(r) * 46)
    g.lineTo(64 + Math.cos(r) * 63, 64 + Math.sin(r) * 63)
    g.stroke()
  }
  g.fillStyle = "#1c1d22"
  g.beginPath()
  g.arc(64, 64, 40, 0, Math.PI * 2)
  g.fill()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return (texCache.knurl = t)
}

type Geo = { body: ExtrudeGeometry; bumper: RoundedBoxGeometry; trigger: RoundedBoxGeometry; arm: RoundedBoxGeometry; pill: RoundedBoxGeometry; bar: RoundedBoxGeometry }
let geo: Geo | undefined
function getGeo(): Geo {
  if (geo) return geo
  // Silhouette: flat top with shoulders, grips that sweep down into rounded lobes.
  const s = new Shape()
  s.moveTo(0, 0.036)
  s.bezierCurveTo(0.03, 0.038, 0.055, 0.042, 0.068, 0.03)
  s.bezierCurveTo(0.08, 0.017, 0.082, -0.02, 0.076, -0.042)
  s.bezierCurveTo(0.07, -0.064, 0.049, -0.07, 0.04, -0.056)
  s.bezierCurveTo(0.032, -0.044, 0.026, -0.03, 0.012, -0.026)
  s.bezierCurveTo(0.006, -0.025, -0.006, -0.025, -0.012, -0.026)
  s.bezierCurveTo(-0.026, -0.03, -0.032, -0.044, -0.04, -0.056)
  s.bezierCurveTo(-0.049, -0.07, -0.07, -0.064, -0.076, -0.042)
  s.bezierCurveTo(-0.082, -0.02, -0.08, 0.017, -0.068, 0.03)
  s.bezierCurveTo(-0.055, 0.042, -0.03, 0.038, 0, 0.036)
  const body = new ExtrudeGeometry(s, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.0085, bevelSize: 0.0075, bevelSegments: 6, curveSegments: 28 })
  body.translate(0, 0, -0.012)
  geo = {
    body,
    bumper: new RoundedBoxGeometry(0.03, 0.008, 0.016, 3, 0.0035),
    trigger: new RoundedBoxGeometry(0.024, 0.012, 0.018, 3, 0.005),
    arm: new RoundedBoxGeometry(0.0088, 0.0104, 0.0045, 2, 0.0018),
    pill: new RoundedBoxGeometry(0.0075, 0.004, 0.003, 2, 0.0014),
    bar: new RoundedBoxGeometry(0.05, 0.0028, 0.003, 2, 0.0012),
  }
  return geo
}

type Slot = { group: Group | null; axis: "z" | "y"; p: number; v: number; glow: number; down: boolean; mats: { m: MeshStandardMaterial; base: number }[] }

/**
 * Premium game controller at real size: sculpted soft-touch grips, two knurled thumbsticks, a d-pad, ABXY with coloured glyphs,
 * bumpers, triggers and a light bar. Press any button: it dips and lights, the pad rumbles, the light bar flashes, onPress(name) fires.
 */
export default function Gamepad({ color = "#7C9CFF", shell = "#1d1e23", onPress }: Props) {
  const g = getGeo()
  const body = useRef<Group>(null)
  const bar = useRef<MeshBasicMaterial>(null)
  const slots = useRef(new Map<string, Slot>())
  const fx = useRef({ shake: 0, flash: 0, flashColor: new Color(), base: new Color(color), c: new Color() })
  fx.current.base.set(color)

  const slot = (name: string, axis: "z" | "y" = "z") => {
    let s = slots.current.get(name)
    if (!s) slots.current.set(name, (s = { group: null, axis, p: 0, v: 0, glow: 0, down: false, mats: [] }))
    return s
  }
  const api = useMemo(() => ({
    slot,
    mat: (name: string, base: number) => (m: MeshStandardMaterial | null) => {
      const s = slot(name)
      if (m && !s.mats.some((x) => x.m === m)) s.mats.push({ m, base })
    },
    down: (name: string, glyph: string) => {
      const s = slot(name)
      if (s.down) return
      s.down = true
      fx.current.shake = 1
      fx.current.flash = 1
      fx.current.flashColor.set(glyph)
      onPress?.(name)
    },
    up: (name: string) => void (slot(name).down = false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [onPress])

  useFrame((state, dt) => {
    const h = Math.min(dt, 1 / 30)
    const t = state.clock.elapsedTime
    let moving = false
    for (const s of slots.current.values()) {
      const target = s.down ? 1 : 0
      s.v += ((target - s.p) * 1400 - s.v * 46) * h
      s.p += s.v * h
      s.glow += (target - s.glow) * (1 - Math.exp(-h * (s.down ? 30 : 5)))
      if (s.group) {
        if (s.axis === "z") s.group.position.z = -s.p * 0.0022
        else s.group.position.y = -s.p * 0.0025
      }
      for (const { m, base } of s.mats) m.emissiveIntensity = base + s.glow * 1.8
      if (Math.abs(target - s.p) + Math.abs(s.v) + Math.abs(target - s.glow) > 1e-3) moving = true
    }
    const f = fx.current
    f.shake *= Math.exp(-h * 9)
    f.flash *= Math.exp(-h * 4)
    if (body.current) {
      body.current.position.x = Math.sin(t * 97) * 0.0011 * f.shake
      body.current.position.y = Math.sin(t * 71) * 0.0006 * f.shake
      body.current.rotation.z = Math.sin(t * 83) * 0.014 * f.shake
    }
    if (bar.current) bar.current.color.copy(f.base).lerp(f.flashColor, f.flash).multiplyScalar(1 + f.flash * 0.6)
    if (moving || f.shake > 1e-3 || f.flash > 1e-3) state.invalidate()
  })

  const softTouch = <meshPhysicalMaterial color={shell} roughness={0.82} metalness={0} sheen={0.6} sheenRoughness={0.8} sheenColor="#6a6f7c" />
  return (
    <group ref={body}>
      <mesh geometry={g.body}>{softTouch}</mesh>
      {/* Light bar along the top edge. */}
      <mesh geometry={g.bar} position={[0, 0.0292, FACE + 0.0008]}>
        <meshBasicMaterial ref={bar} color={color} toneMapped={false} />
      </mesh>

      {/* Bumpers on the shoulders, triggers behind them. */}
      {([["LB", -1], ["RB", 1]] as const).map(([name, sx]) => (
        <Btn key={name} name={name} axis="y" glyph={color} api={api} pos={[sx * 0.05, 0.041, 0.003]} rot={[0, 0, -sx * 0.18]}>
          <mesh geometry={g.bumper}>
            <meshStandardMaterial ref={api.mat(name, 0)} color="#2a2c33" roughness={0.45} metalness={0.3} emissive={color} emissiveIntensity={0} />
          </mesh>
        </Btn>
      ))}
      {([["LT", -1], ["RT", 1]] as const).map(([name, sx]) => (
        <Btn key={name} name={name} axis="y" glyph={color} api={api} pos={[sx * 0.054, 0.043, -0.012]} rot={[0.3, 0, -sx * 0.18]}>
          <mesh geometry={g.trigger}>
            <meshStandardMaterial ref={api.mat(name, 0)} color="#16171b" roughness={0.7} emissive={color} emissiveIntensity={0} />
          </mesh>
        </Btn>
      ))}

      {/* D-pad in a recessed well. */}
      <mesh position={[-0.048, 0.012, FACE - 0.0009]}>
        <circleGeometry args={[0.0175, 40]} />
        <meshStandardMaterial color="#121317" roughness={0.6} />
      </mesh>
      {([["Up", 0, 1], ["Down", 0, -1], ["Left", -1, 0], ["Right", 1, 0]] as const).map(([name, dx, dy]) => (
        <Btn key={name} name={name} glyph="#E8EAF0" api={api} pos={[-0.048 + dx * 0.0082, 0.012 + dy * 0.0082, FACE + 0.0012]} rot={[0, 0, dx ? Math.PI / 2 : 0]}>
          <mesh geometry={g.arm}>
            <meshStandardMaterial ref={api.mat(name, 0)} color="#33363e" roughness={0.38} metalness={0.5} emissive="#C8D2FF" emissiveIntensity={0} />
          </mesh>
        </Btn>
      ))}
      <mesh position={[-0.048, 0.012, FACE + 0.0012]}>
        <boxGeometry args={[0.0088, 0.0088, 0.0045]} />
        <meshStandardMaterial color="#33363e" roughness={0.38} metalness={0.5} />
      </mesh>

      {/* ABXY: smoked caps, coloured glyphs that glow when pressed. */}
      {GLYPHS.map(([name, col, dx, dy]) => (
        <group key={name}>
          <mesh position={[0.048 + dx * 0.0115, 0.012 + dy * 0.0115, FACE - 0.0009]}>
            <circleGeometry args={[0.0068, 32]} />
            <meshStandardMaterial color="#0e0f12" roughness={0.6} />
          </mesh>
          <Btn name={name} glyph={col} api={api} pos={[0.048 + dx * 0.0115, 0.012 + dy * 0.0115, FACE + 0.0016]}>
            <mesh rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.0056, 0.0058, 0.0042, 32]} />
              <meshPhysicalMaterial ref={api.mat(name, 0.04)} color="#1a1b20" roughness={0.18} clearcoat={1} clearcoatRoughness={0.08} emissive={col} emissiveIntensity={0.04} />
            </mesh>
            <mesh position={[0, 0, 0.00215]}>
              <circleGeometry args={[0.0052, 32]} />
              <meshStandardMaterial ref={api.mat(name, 0.7)} map={letterTex(name, col)} emissiveMap={letterTex(name, col)} emissive="#ffffff" emissiveIntensity={0.7} transparent depthWrite={false} />
            </mesh>
          </Btn>
        </group>
      ))}

      {/* Centre buttons: view, menu and the glowing home button. */}
      {([["View", -0.014], ["Menu", 0.014]] as const).map(([name, x]) => (
        <Btn key={name} name={name} glyph="#E8EAF0" api={api} pos={[x, 0.0125, FACE + 0.0004]}>
          <mesh geometry={g.pill}>
            <meshStandardMaterial ref={api.mat(name, 0)} color="#2b2d34" roughness={0.4} metalness={0.4} emissive="#E8EAF0" emissiveIntensity={0} />
          </mesh>
        </Btn>
      ))}
      <Btn name="Home" glyph={color} api={api} pos={[0, 0.0195, FACE + 0.0004]}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.0058, 0.0058, 0.003, 32]} />
          <meshStandardMaterial ref={api.mat("Home", 0.35)} color="#15161a" roughness={0.3} metalness={0.3} emissive={color} emissiveIntensity={0.35} />
        </mesh>
      </Btn>

      {/* Thumbsticks: knurled rubber caps on brushed collars. */}
      {([["L3", -0.026], ["R3", 0.026]] as const).map(([name, x]) => (
        <group key={name} position={[x, -0.014, FACE - 0.0006]}>
          <mesh>
            <torusGeometry args={[0.0118, 0.0016, 10, 40]} />
            <meshStandardMaterial color="#3c3f47" metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.0112, 40]} />
            <meshStandardMaterial color="#08090b" roughness={0.8} />
          </mesh>
          <Btn name={name} glyph={color} api={api} pos={[0, 0, 0]}>
            <mesh position={[0, 0, 0.004]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.0042, 0.0048, 0.008, 20]} />
              <meshStandardMaterial color="#202227" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.0095]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.0095, 0.0092, 0.0032, 40]} />
              <meshStandardMaterial ref={api.mat(name, 0)} color="#1f2126" roughness={0.9} emissive={color} emissiveIntensity={0} />
            </mesh>
            <mesh position={[0, 0, 0.0112]}>
              <circleGeometry args={[0.0092, 40]} />
              <meshStandardMaterial map={knurlTex()} roughness={0.95} />
            </mesh>
          </Btn>
        </group>
      ))}
    </group>
  )
}

type Api = {
  slot: (name: string, axis?: "z" | "y") => Slot
  down: (name: string, glyph: string) => void
  up: (name: string) => void
}
function Btn({ name, glyph, api, pos, rot = [0, 0, 0], axis = "z", children }: {
  name: string; glyph: string; api: Api; pos: [number, number, number]; rot?: [number, number, number]; axis?: "z" | "y"; children: ReactNode
}) {
  return (
    <group position={pos} rotation={rot}>
      <group
        ref={(g) => void (api.slot(name, axis).group = g)}
        onPointerDown={() => api.down(name, glyph)}
        onPointerUp={() => api.up(name)}
        onPointerCancel={() => api.up(name)}
        onPointerOut={() => api.up(name)}
      >
        {children}
      </group>
    </group>
  )
}
