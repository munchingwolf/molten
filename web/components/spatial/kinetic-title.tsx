"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"

type Props = {
  /** Headline, one line (up to 32 characters) */
  text?: string
  /** Letter face colour */
  primaryColor?: string
  /** Extrusion colour */
  secondaryColor?: string
  /** Letter size (em) in metres */
  size?: number
  /** The title scales down to fit this width, in metres */
  maxWidth?: number
  /** Extrusion layers: more = deeper letters */
  depth?: number
  speed?: number
  paused?: boolean
  /** Breathing, sheen and hover strength */
  intensity?: number
  /** Tap: replays the intro, then calls this */
  onPress?: () => void
}

const FONT_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

/** Big extruded headline: letters flip up one by one with a trailing echo, then breathe. Hover lifts the letters under the pointer. */
export default function KineticTitle({
  text = "SPATIAL",
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  size = 0.28,
  maxWidth = 1.3,
  depth = 14,
  speed = 1,
  paused = false,
  intensity = 1,
  onPress,
}: Props) {
  const still = useThree((s) => s.frameloop) !== "always" // static previews show the settled title
  const layers = Math.max(1, Math.min(24, Math.round(depth)))
  const title = useMemo(() => buildTitle(text || " ", size, maxWidth, layers), [text, size, maxWidth, layers])
  useEffect(
    () => () => {
      title.geometry.dispose()
      title.texture.dispose()
    },
    [title],
  )

  const u = useMemo(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uTime: { value: 0 },
      uLayers: { value: 1 },
      uDepth: { value: 0.0035 },
      uSkew: { value: new THREE.Vector2(0.0011, -0.0014) },
      uEm: { value: 0.28 },
      uIntensity: { value: 1 },
      uHover: { value: new THREE.Vector2() },
      uHalfWidth: { value: 3 },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
    }),
    [],
  )
  const glow = useMemo(() => ({ uA: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 0.3 } }), [])
  useEffect(() => {
    u.uA.value.set(primaryColor).convertLinearToSRGB()
    u.uB.value.set(secondaryColor).convertLinearToSRGB()
    glow.uA.value.set(primaryColor).lerp(new THREE.Color(secondaryColor), 0.35).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, u, glow])

  const group = useRef<THREE.Group>(null)
  const time = useRef(still || paused ? 30 : 0)
  const hover = useRef({ x: 0, on: 0, amt: 0 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (!paused) time.current += dt * speed
    const h = hover.current
    const k = 1 - Math.exp(-dt * 8)
    h.amt += (h.on - h.amt) * k
    // extrusion leans away from the pointer while hovering
    const lean = h.on ? THREE.MathUtils.clamp(-h.x / (title.width / 2), -1, 1) : 0.75
    u.uSkew.value.x += (lean * 0.0015 - u.uSkew.value.x) * k
    u.uMap.value = title.texture
    u.uTime.value = time.current
    u.uLayers.value = layers
    u.uEm.value = title.em
    u.uHalfWidth.value = title.width / 2 / title.em
    u.uIntensity.value = intensity
    u.uHover.value.set(h.x, h.amt * Math.min(intensity, 1.5))
    glow.uTime.value = time.current
    glow.uAlpha.value = 0.22 * intensity
  })

  const track = (e: ThreeEvent<PointerEvent>) => {
    if (!group.current) return
    hover.current.x = group.current.worldToLocal(e.point.clone()).x
    hover.current.on = 1
  }

  return (
    <group ref={group}>
      <mesh position={[0, 0, -0.08]} renderOrder={-1}>
        <planeGeometry args={[title.width * 1.3, title.em * 2.4]} />
        <shaderMaterial
          uniforms={glow}
          vertexShader={GLOW_VERT}
          fragmentShader={GLOW_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh geometry={title.geometry} frustumCulled={false}>
        <shaderMaterial uniforms={u} vertexShader={TITLE_VERT} fragmentShader={TITLE_FRAG} side={THREE.DoubleSide} />
      </mesh>
      {/* invisible hit area: hover anywhere over the title, tap to replay */}
      <mesh
        position={[0, 0, 0.01]}
        onPointerOver={track}
        onPointerMove={track}
        onPointerOut={() => (hover.current.on = 0)}
        onClick={() => {
          time.current = 0
          onPress?.()
        }}
      >
        <planeGeometry args={[title.width * 1.06, title.em * 1.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Draws each glyph into a canvas strip and builds one quad per glyph per extrusion layer. */
function buildTitle(text: string, em: number, maxWidth: number, layers: number) {
  const chars = Array.from(text.slice(0, 32))
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  const font = (px: number) => `800 ${px}px ${FONT_STACK}`
  let px = 160
  ctx.font = font(px)
  const stripWidth = () => chars.reduce((w, c) => w + Math.ceil(ctx.measureText(c).width) + 2 * Math.ceil(px * 0.14), 0)
  const w0 = stripWidth()
  if (w0 > 4000) {
    px = Math.floor((px * 4000) / w0)
    ctx.font = font(px)
  }
  const pad = Math.ceil(px * 0.14)
  const cellH = Math.ceil(px * 1.32)
  const base = Math.round(px * 0.98)
  const widths = chars.map((c) => Math.ceil(ctx.measureText(c).width))
  const adv = chars.map((_, i) => ctx.measureText(chars.slice(0, i).join("")).width) // keeps kerning
  const total = Math.max(1, ctx.measureText(chars.join("")).width)
  const cellX: number[] = []
  let x = 0
  for (const w of widths) {
    cellX.push(x)
    x += w + 2 * pad
  }
  canvas.width = Math.max(1, x)
  canvas.height = cellH
  ctx.font = font(px) // resizing the canvas resets its state
  ctx.fillStyle = "#fff"
  ctx.textBaseline = "alphabetic"
  chars.forEach((c, i) => ctx.fillText(c, cellX[i] + pad, base))
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4

  const s = Math.min(em / px, maxWidth / total) // metres per canvas pixel
  const visible = chars.map((c, i) => (c.trim() ? i : -1)).filter((i) => i >= 0)
  const n = visible.length
  const pos = new Float32Array(n * layers * 12)
  const uv = new Float32Array(n * layers * 8)
  const info = new Float32Array(n * layers * 12)
  const index = new Uint16Array(n * layers * 6)
  const yTop = (base - 0.36 * px) * s
  const yBot = (base - cellH - 0.36 * px) * s
  let q = 0
  for (let layer = 0; layer < layers; layer++)
    for (let k = 0; k < n; k++, q++) {
      const i = visible[k]
      const x0 = (adv[i] - pad - total / 2) * s
      const x1 = x0 + (widths[i] + 2 * pad) * s
      const u0 = cellX[i] / canvas.width
      const u1 = (cellX[i] + widths[i] + 2 * pad) / canvas.width
      const cx = (adv[i] + widths[i] / 2 - total / 2) * s
      pos.set([x0, yTop, 0, x1, yTop, 0, x0, yBot, 0, x1, yBot, 0], q * 12)
      uv.set([u0, 1, u1, 1, u0, 0, u1, 0], q * 8)
      for (let v = 0; v < 4; v++) info.set([k, cx, layer], q * 12 + v * 3)
      const b = q * 4
      index.set([b, b + 2, b + 1, b + 2, b + 3, b + 1], q * 6)
    }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 3))
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  return { geometry, texture, width: total * s, em: px * s }
}

const TITLE_VERT = /* glsl */ `
uniform float uTime;
uniform float uLayers;
uniform float uDepth;
uniform vec2 uSkew;
uniform float uEm;
uniform float uIntensity;
uniform vec2 uHover;
attribute vec3 aInfo;
varying vec2 vUv;
varying vec2 vPos;
varying float vLayer;

float backOut(float x) {
  float c1 = 1.70158;
  float c3 = c1 + 1.0;
  float y = x - 1.0;
  return 1.0 + c3 * y * y * y + c1 * y * y;
}

void main() {
  vUv = uv;
  float idx = aInfo.x;
  float layer = aInfo.z;
  vLayer = layer / max(uLayers - 1.0, 1.0);
  vPos = position.xy / uEm;

  // staggered intro: each letter 75 ms after the last, echo layers trail behind
  float start = idx * 0.075 + layer * 0.018;
  float p = clamp((uTime - start) / 0.9, 0.0, 1.0);
  float rise = 1.0 - backOut(p);
  float grow = smoothstep(0.0, 0.3, p);

  vec3 pos = position;
  vec2 pivot = vec2(aInfo.y, -0.36 * uEm);
  pos.xy = pivot + (pos.xy - pivot) * grow;
  pos += vec3(uSkew * layer, -uDepth * layer);

  // flip up about the baseline from lying on its back
  float ang = -rise * 1.5708;
  float c = cos(ang);
  float s = sin(ang);
  float ry = pos.y - pivot.y;
  float rz = pos.z;
  pos.y = pivot.y + ry * c - rz * s;
  pos.z = ry * s + rz * c;
  pos.y -= rise * 0.6 * uEm;

  // breathe once settled
  float settled = smoothstep(0.0, 0.6, uTime - start - 0.9);
  float wave = sin(uTime * 1.6 - idx * 0.55);
  pos.y += wave * 0.045 * uEm * uIntensity * settled;
  pos.z += (0.5 + 0.5 * wave) * 0.06 * uEm * uIntensity * settled;

  // letters near the pointer lift toward you
  float d = (aInfo.y - uHover.x) / uEm;
  float h = uHover.y * exp(-d * d * 1.2);
  pos.z += h * 0.4 * uEm;
  pos.y += h * 0.1 * uEm;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const TITLE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uIntensity;
uniform float uHalfWidth;
varying vec2 vUv;
varying vec2 vPos;
varying float vLayer;

void main() {
  float a = texture2D(uMap, vUv).r;
  if (a < 0.5) discard;
  vec3 col;
  if (vLayer < 0.001) {
    float g = clamp(vPos.y * 0.75 + 0.5, 0.0, 1.0);
    col = mix(mix(uB, uA, 0.4), uA, g);
    col = mix(col, vec3(1.0), 0.2 * g);
    float sx = mix(-uHalfWidth - 1.5, uHalfWidth + 1.5, fract(uTime * 0.16));
    float band = vPos.x + vPos.y * 0.5 - sx;
    col += exp(-band * band * 6.0) * 0.55 * uIntensity;
  } else {
    col = mix(uB, uB * 0.22 + uA * 0.06, vLayer) * (1.0 - 0.15 * vLayer);
  }
  gl_FragColor = vec4(col, 1.0);
}
`

const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const GLOW_FRAG = /* glsl */ `
uniform vec3 uA;
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * vec2(2.0, 2.0);
  float a = exp(-dot(p * vec2(1.4, 2.6), p * vec2(1.4, 2.6)) * 1.6);
  a *= uAlpha * (0.85 + 0.15 * sin(uTime * 1.6));
  gl_FragColor = vec4(uA, a);
}
`
