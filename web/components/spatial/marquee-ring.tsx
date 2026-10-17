"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

type Props = {
  /** Text on the big ring (repeats to fill it) */
  text?: string
  /** Text on the small inner ring; empty hides that ring */
  subtext?: string
  /** Big ring radius in metres */
  radius?: number
  primaryColor?: string
  secondaryColor?: string
  speed?: number
  paused?: boolean
  /** Glow and core brightness */
  intensity?: number
  /** Tap: reverses the spin, then calls this */
  onPress?: () => void
}

const FONT_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

/** Text looping around tilted rings that spin in opposite directions, with a glowing core. Hover speeds it up; tap reverses it. */
export default function MarqueeRing({
  text = "SPATIAL MOTION",
  subtext = "BUILD IN 3D",
  radius = 0.5,
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  speed = 1,
  paused = false,
  intensity = 1,
  onPress,
}: Props) {
  const shared = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
    }),
    [],
  )
  const core = useMemo(() => ({ ...shared, uPulse: { value: 0 } }), [shared])
  useEffect(() => {
    shared.uA.value.set(primaryColor).convertLinearToSRGB()
    shared.uB.value.set(secondaryColor).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, shared])

  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const s = useRef({ time: 0, hover: 0, hoverOn: 0, dir: 1, vel: 1 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const st = s.current
    st.hover += (st.hoverOn - st.hover) * (1 - Math.exp(-dt * 4))
    st.vel += (st.dir * (1 + st.hover * 1.8) - st.vel) * (1 - Math.exp(-dt * 3))
    if (!paused) {
      st.time += dt * speed
      if (outer.current) outer.current.rotation.y -= dt * speed * 0.32 * st.vel
      if (inner.current) inner.current.rotation.y += dt * speed * 0.5 * st.vel
    }
    shared.uTime.value = st.time
    shared.uIntensity.value = intensity
    core.uPulse.value = st.hover
  })

  return (
    <group
      onPointerOver={() => (s.current.hoverOn = 1)}
      onPointerOut={() => (s.current.hoverOn = 0)}
      onClick={() => {
        s.current.dir *= -1
        onPress?.()
      }}
    >
      <group rotation={[0.24, 0, -0.06]}>
        <group ref={outer}>
          <TextRing text={text} radius={radius} height={radius * 0.22} shared={shared} />
        </group>
      </group>
      {subtext.trim() !== "" && (
        <group rotation={[0.5, 0, 0.22]}>
          <group ref={inner}>
            <TextRing text={subtext} radius={radius * 0.68} height={radius * 0.12} shared={shared} swap />
          </group>
        </group>
      )}
      <mesh>
        <sphereGeometry args={[radius * 0.14, 32, 24]} />
        <shaderMaterial uniforms={core} vertexShader={CORE_VERT} fragmentShader={CORE_FRAG} />
      </mesh>
    </group>
  )
}

type Shared = { uTime: { value: number }; uIntensity: { value: number }; uA: { value: THREE.Color }; uB: { value: THREE.Color } }

function TextRing({ text, radius, height, shared, swap = false }: { text: string; radius: number; height: number; shared: Shared; swap?: boolean }) {
  const strip = useMemo(() => buildStrip(text), [text])
  useEffect(() => () => strip.texture.dispose(), [strip])
  const repeat = Math.max(1, Math.round((Math.PI * 2 * radius) / (strip.aspect * height)))
  const back = useMemo(() => ({ ...shared, uMap: { value: strip.texture }, uRepeat: { value: repeat }, uBack: { value: 1 }, uSwap: { value: swap ? 1 : 0 } }), [shared, strip, repeat, swap])
  const front = useMemo(() => ({ ...back, uBack: { value: 0 } }), [back])
  return (
    <>
      <mesh renderOrder={1}>
        <cylinderGeometry args={[radius, radius, height, 128, 1, true]} />
        <shaderMaterial uniforms={back} vertexShader={RING_VERT} fragmentShader={RING_FRAG} side={THREE.BackSide} transparent depthWrite={false} />
      </mesh>
      <mesh renderOrder={2}>
        <cylinderGeometry args={[radius, radius, height, 128, 1, true]} />
        <shaderMaterial uniforms={front} vertexShader={RING_VERT} fragmentShader={RING_FRAG} side={THREE.FrontSide} transparent depthWrite={false} />
      </mesh>
    </>
  )
}

/** One copy of "TEXT  •  " in a canvas; the shader repeats it around the ring. */
function buildStrip(text: string) {
  const unit = `${text.trim()}   •   `
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  let px = 96
  const setFont = () => {
    ctx.font = `700 ${px}px ${FONT_STACK}`
    ctx.letterSpacing = `${Math.round(px * 0.08)}px`
  }
  setFont()
  const w0 = ctx.measureText(unit).width
  if (w0 > 4000) {
    px = Math.floor((px * 4000) / w0)
    setFont()
  }
  canvas.width = Math.max(1, Math.ceil(ctx.measureText(unit).width))
  canvas.height = Math.ceil(px * 1.3)
  setFont() // resizing the canvas resets its state
  ctx.fillStyle = "#fff"
  ctx.textBaseline = "middle"
  ctx.fillText(unit, 0, canvas.height / 2 + px * 0.04)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = 8
  return { texture, aspect: canvas.width / canvas.height }
}

const RING_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const RING_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uRepeat;
uniform float uBack;
uniform float uSwap;
uniform float uTime;
uniform float uIntensity;
uniform vec3 uA;
uniform vec3 uB;
varying vec2 vUv;
void main() {
  float a = texture2D(uMap, vec2(vUv.x * uRepeat, vUv.y)).r;
  float g = 0.5 + 0.5 * sin(vUv.x * 6.2831 * 2.0 + uTime * 0.7);
  vec3 col = mix(uA, uB, abs(uSwap - g));
  float edge = smoothstep(0.05, 0.0, vUv.y) + smoothstep(0.95, 1.0, vUv.y);
  vec3 c = mix(col * 0.35, col + 0.12, a) + col * edge * 0.8;
  float alpha = max(mix(0.06, 1.0, a), edge * 0.7 * uIntensity);
  alpha *= mix(1.0, 0.2, uBack);
  gl_FragColor = vec4(c * mix(1.0, 0.7, uBack), alpha);
}
`

const CORE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const CORE_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uPulse;
uniform float uIntensity;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec3 N = normalize(vN);
  float ndv = clamp(dot(N, normalize(-vView)), 0.0, 1.0);
  vec3 col = mix(uB, uA, 0.5 + 0.5 * N.y);
  col = col * (0.35 + 0.65 * ndv) + mix(uA, vec3(1.0), 0.5) * pow(1.0 - ndv, 2.0) * (0.8 + uPulse);
  col *= (0.9 + 0.1 * sin(uTime * 2.0)) * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`
