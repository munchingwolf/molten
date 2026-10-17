"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text, withOpacity } from "@react-three/uikit"

type Item = { title?: string; subtitle?: string; color?: string }

type Props = {
  /** 1–7 cards; each takes a title, subtitle and optional colour */
  items?: Item[]
  /** Colour of the first card (cards blend toward secondary) */
  primaryColor?: string
  /** Colour of the last card */
  secondaryColor?: string
  speed?: number
  paused?: boolean
  /** Glow and parallax strength */
  intensity?: number
  /** Called with the tapped card's index, or -1 when the fan closes */
  onSelect?: (index: number) => void
}

const DEFAULT_ITEMS: Item[] = [
  { title: "Portals", subtitle: "Doors between scenes" },
  { title: "Aurora", subtitle: "Ribbons of light" },
  { title: "Kinetic", subtitle: "Type that moves" },
  { title: "Particles", subtitle: "Galaxies you can touch" },
  { title: "Liquid", subtitle: "Buttons that wobble" },
]
const CARD_W = 0.22
const CARD_H = 0.3
const MARGIN = 0.03

type Shared = { time: number; selected: number; hovered: number; px: number; py: number; lastMove: number }

/** A fan of glossy cards that hover and drift with parallax. Tap one and it springs forward; tap it again (or the space around) to put it back. */
export default function FloatingCards({
  items = DEFAULT_ITEMS,
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  speed = 1,
  paused = false,
  intensity = 1,
  onSelect,
}: Props) {
  const list = (items.length ? items : DEFAULT_ITEMS).slice(0, 7)
  const root = useRef<THREE.Group>(null)
  const st = useRef<Shared>({ time: 0, selected: -1, hovered: -1, px: 0, py: 0, lastMove: -10 })
  const pointer = useRef({ x: 0, y: 0 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const s = st.current
    if (!paused) s.time += dt * speed
    s.lastMove += dt
    const tx = s.lastMove < 0.8 ? pointer.current.x : 0
    const ty = s.lastMove < 0.8 ? pointer.current.y : 0
    const k = 1 - Math.exp(-dt * 4)
    s.px += (tx * intensity - s.px) * k
    s.py += (ty * intensity - s.py) * k
    if (root.current) {
      root.current.rotation.y = s.px * 0.14
      root.current.rotation.x = -s.py * 0.08
    }
  })

  const select = (i: number) => {
    const s = st.current
    s.selected = s.selected === i ? -1 : i
    onSelect?.(s.selected)
  }

  return (
    <group
      ref={root}
      onPointerMove={(e) => {
        if (!root.current) return
        const p = root.current.worldToLocal(e.point.clone())
        pointer.current.x = THREE.MathUtils.clamp(p.x / 0.5, -1, 1)
        pointer.current.y = THREE.MathUtils.clamp(p.y / 0.3, -1, 1)
        st.current.lastMove = 0
      }}
    >
      {/* invisible backdrop: parallax between cards, tap empty space to close */}
      <mesh
        position={[0, 0, -0.25]}
        onClick={(e) => {
          if (isNearest(e) && st.current.selected >= 0) select(st.current.selected)
        }}
      >
        <planeGeometry args={[1.6, 0.9]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {list.map((item, i) => (
        <Card
          key={i}
          item={item}
          index={i}
          count={list.length}
          color={item.color ?? mixHex(primaryColor, secondaryColor, list.length > 1 ? i / (list.length - 1) : 0)}
          shared={st}
          intensity={intensity}
          onTap={() => select(i)}
        />
      ))}
    </group>
  )
}

/** R3F delivers clicks to every object under the ray; only act for the one in front. */
function isNearest(e: ThreeEvent<MouseEvent | PointerEvent>) {
  const first = e.intersections?.[0]?.object
  if (!first) return true
  for (let o: THREE.Object3D | null = first; o; o = o.parent) if (o === e.eventObject) return true
  return false
}

function mixHex(a: string, b: string, t: number) {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()
}

const SHAPES = ["torus", "icosa", "octa", "knot", "dodeca"] as const

function Card({
  item,
  index,
  count,
  color,
  shared,
  intensity,
  onTap,
}: {
  item: Item
  index: number
  count: number
  color: string
  shared: React.RefObject<Shared>
  intensity: number
  onTap: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const icon = useRef<THREE.Mesh>(null)
  const plate = useMemo(
    () => ({
      uColor: { value: new THREE.Color() },
      uBase: { value: new THREE.Color("#15171E").convertLinearToSRGB() },
      uTime: { value: 0 },
      uActive: { value: 0 },
      uHover: { value: 0 },
      uDim: { value: 0 },
      uPhase: { value: index * 0.21 },
      uIntensity: { value: 1 },
      uSize: { value: new THREE.Vector2(CARD_W + MARGIN * 2, CARD_H + MARGIN * 2) },
      uCard: { value: new THREE.Vector2(CARD_W, CARD_H) },
    }),
    [index],
  )
  useEffect(() => {
    plate.uColor.value.set(color).convertLinearToSRGB()
  }, [color, plate])

  // one spring per channel: x, y, z, rotY, rotZ, scale
  const spring = useRef({ v: [0, 0, 0, 0, 0, 1], dv: [0, 0, 0, 0, 0, 0], active: 0, hover: 0, dim: 0 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = shared.current
    const sp = spring.current
    const t = s.time
    const off = index - (count - 1) / 2
    const half = Math.max(1, (count - 1) / 2)
    const active = s.selected === index
    const any = s.selected >= 0
    let x = off * 0.19
    let y = -Math.abs(off) * 0.015
    let z = -Math.abs(off) * 0.06
    let ry = -off * 0.16
    let rz = -off * 0.035
    let sc = 1
    // small orbits so the fan never sits still
    x += Math.cos(t * 0.6 + index * 1.7) * 0.008
    y += Math.sin(t * 1.1 + index * 1.3) * 0.014
    rz += Math.sin(t * 0.8 + index) * 0.02
    // parallax: centre cards shift more than the edges
    const depth = 1 - (Math.abs(off) / half) * 0.5
    x += s.px * 0.04 * depth
    y += s.py * 0.025 * depth
    if (any && active) {
      x = 0
      y = 0.01
      z = 0.26
      ry = 0
      rz = 0
      sc = 1.12
    } else if (any) {
      x *= 1.35
      z -= 0.12
      sc = 0.9
    }
    if (s.hovered === index && !active) {
      z += 0.03
      sc *= 1.04
    }
    const target = [x, y, z, ry, rz, sc]
    for (let c = 0; c < 6; c++) {
      sp.dv[c] += (150 * (target[c] - sp.v[c]) - 15 * sp.dv[c]) * dt
      sp.v[c] += sp.dv[c] * dt
    }
    const k = 1 - Math.exp(-dt * 6)
    sp.active += ((active ? 1 : 0) - sp.active) * k
    sp.hover += ((s.hovered === index ? 1 : 0) - sp.hover) * k
    sp.dim += ((any && !active ? 1 : 0) - sp.dim) * k
    if (group.current) {
      group.current.position.set(sp.v[0], sp.v[1], sp.v[2])
      group.current.rotation.set(0, sp.v[3], sp.v[4])
      group.current.scale.setScalar(sp.v[5])
    }
    if (icon.current) {
      icon.current.rotation.set(t * 0.7 + index, t * 0.9, 0)
      icon.current.position.z = 0.035 + sp.active * 0.05
      icon.current.scale.setScalar(1 + sp.active * 0.4 + sp.hover * 0.1)
    }
    plate.uTime.value = t
    plate.uActive.value = sp.active
    plate.uHover.value = sp.hover
    plate.uDim.value = sp.dim
    plate.uIntensity.value = intensity
  })

  const shape = SHAPES[index % SHAPES.length]
  return (
    <group
      ref={group}
      onClick={(e) => {
        if (isNearest(e)) onTap()
      }}
      onPointerMove={(e) => {
        if (isNearest(e)) shared.current.hovered = index
      }}
      onPointerOut={() => {
        if (shared.current.hovered === index) shared.current.hovered = -1
      }}
    >
      <mesh renderOrder={-1}>
        <planeGeometry args={[CARD_W + MARGIN * 2, CARD_H + MARGIN * 2]} />
        <shaderMaterial uniforms={plate} vertexShader={PLATE_VERT} fragmentShader={PLATE_FRAG} transparent premultipliedAlpha />
      </mesh>
      <mesh ref={icon} position={[0.04, 0.045, 0.035]}>
        {shape === "torus" && <torusGeometry args={[0.03, 0.011, 12, 40]} />}
        {shape === "icosa" && <icosahedronGeometry args={[0.036, 0]} />}
        {shape === "octa" && <octahedronGeometry args={[0.038, 0]} />}
        {shape === "knot" && <torusKnotGeometry args={[0.024, 0.008, 64, 8]} />}
        {shape === "dodeca" && <dodecahedronGeometry args={[0.034, 0]} />}
        <shaderMaterial uniforms={plate} vertexShader={ICON_VERT} fragmentShader={ICON_FRAG} />
      </mesh>
      <group position={[0, 0, 0.002]}>
        <Container pixelSize={0.001} width={220} height={300} padding={18} flexDirection="column" justifyContent="space-between">
          <Container flexDirection="row">
            <Container backgroundColor={withOpacity(color, 0.18)} borderRadius={6} paddingX={8} paddingY={3}>
              <Text fontSize={11} fontWeight="semi-bold" color={color}>
                {String(index + 1).padStart(2, "0")}
              </Text>
            </Container>
          </Container>
          <Container flexDirection="column" gap={4}>
            <Text fontSize={24} fontWeight="bold" color="#EEF0F4">
              {item.title ?? `Card ${index + 1}`}
            </Text>
            <Text fontSize={12} color="#9AA0AD">
              {item.subtitle ?? ""}
            </Text>
          </Container>
        </Container>
      </group>
    </group>
  )
}

const PLATE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const PLATE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uBase;
uniform float uTime;
uniform float uActive;
uniform float uHover;
uniform float uDim;
uniform float uPhase;
uniform float uIntensity;
uniform vec2 uSize;
uniform vec2 uCard;
varying vec2 vUv;

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = sdBox(p, uCard * 0.5, 0.018);
  float aa = fwidth(d) * 1.2;
  float fill = 1.0 - smoothstep(-aa, aa, d);
  vec2 cuv = p / uCard + 0.5;
  float g = clamp(cuv.y * 0.85 + (1.0 - cuv.x) * 0.25, 0.0, 1.0);
  vec3 base = mix(uBase, uColor * 0.5, g * g);
  float sweep = fract(uTime * 0.12 + uPhase) * 3.0 - 1.0;
  float sd = cuv.x + cuv.y * 0.6 - sweep;
  base += exp(-sd * sd * 60.0) * 0.22 * mix(uColor, vec3(1.0), 0.6);
  base += uColor * 0.12 * smoothstep(0.6, 0.0, length(cuv - vec2(0.15, 0.95)));
  base *= 1.0 - 0.45 * uDim;
  float border = (1.0 - smoothstep(0.0, aa * 1.5, abs(d + 0.0015) - 0.0008)) * (0.3 + 0.7 * max(uActive, uHover));
  float glow = exp(-max(d, 0.0) * 70.0) * (1.0 - fill) * (0.12 + 0.75 * uActive) * uIntensity;
  vec3 col = base * fill + mix(uColor, vec3(1.0), 0.4) * border + uColor * glow;
  float alpha = clamp(max(fill * 0.97, glow + border), 0.0, 1.0);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha);
}
`

const ICON_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const ICON_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uDim;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(-vView);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 L = normalize(vec3(-0.4, 0.8, 0.5));
  vec3 c = uColor * (0.2 + 0.55 * max(dot(N, L), 0.0));
  c += mix(uColor, vec3(1.0), 0.5) * pow(1.0 - ndv, 2.0) * 1.1 * uIntensity;
  c += pow(max(dot(reflect(-V, N), L), 0.0), 30.0) * 0.6;
  gl_FragColor = vec4(c * (1.0 - 0.4 * uDim), 1.0);
}
`
