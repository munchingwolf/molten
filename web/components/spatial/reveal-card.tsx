"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import { Container, Text, type VanillaContainer } from "@react-three/uikit"

type Props = {
  /** Small label above the title */
  eyebrow?: string
  title?: string
  body?: string
  /** Border trace, eyebrow and glow colour */
  primaryColor?: string
  /** Second border colour and corner glow */
  secondaryColor?: string
  speed?: number
  paused?: boolean
  /** Glow strength */
  intensity?: number
  /** Tap: folds and replays the reveal, then calls this */
  onPress?: () => void
}

const W = 300
const H = 200
const PX = 0.0018
const CARD = new THREE.Vector2(W * PX, H * PX)
const MARGIN = 0.04

/** Card that unfolds toward you with a spring when it first comes into view: the border traces itself, a sheen sweeps across, text fades in line by line. Tap to replay. */
export default function RevealCard({
  eyebrow = "New",
  title = "Spatial Motion",
  body = "Cards that unfold into place the moment they enter your view. Tap to replay the reveal.",
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  speed = 1,
  paused = false,
  intensity = 1,
  onPress,
}: Props) {
  const still = useThree((s) => s.frameloop) !== "always" // static previews show the open card
  const camera = useThree((s) => s.camera)
  const group = useRef<THREE.Group>(null)
  const parts = [useRef<VanillaContainer>(null), useRef<VanillaContainer>(null), useRef<VanillaContainer>(null)]
  const shown = useRef([-1, -1, -1])
  const u = useMemo(
    () => ({
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uBase: { value: new THREE.Color("#101218").convertLinearToSRGB() },
      uTime: { value: 0 },
      uTrace: { value: 0 },
      uSweep: { value: 0 },
      uHover: { value: 0 },
      uIntensity: { value: 1 },
      uSize: { value: new THREE.Vector2(CARD.x + MARGIN * 2, CARD.y + MARGIN * 2) },
      uCard: { value: CARD.clone() },
    }),
    [],
  )
  useEffect(() => {
    u.uA.value.set(primaryColor).convertLinearToSRGB()
    u.uB.value.set(secondaryColor).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, u])

  const done = still || paused
  const s = useRef({
    phase: done ? "open" : "waiting",
    t: done ? 10 : 0, // seconds since the reveal started
    fold: 0,
    v: done ? 1 : 0,
    dv: 0,
    hover: 0,
    hoverOn: 0,
    clock: 0,
  })
  const ndc = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const st = s.current
    const dt = Math.min(delta, 0.05) * (paused ? 0 : speed)
    st.clock += dt
    if (st.phase === "waiting" && group.current) {
      // reveal on first sight: the card's centre is on screen and in front of the camera
      group.current.getWorldPosition(ndc).project(camera)
      if (Math.abs(ndc.x) < 0.95 && Math.abs(ndc.y) < 0.95 && ndc.z < 1) {
        st.phase = "open"
        st.t = 0
      }
    }
    if (st.phase === "folding") {
      st.fold += dt
      if (st.fold > 0.4) {
        st.phase = "open"
        st.t = 0
      }
    }
    if (st.phase === "open") st.t += dt
    const target = st.phase === "open" ? 1 : 0
    st.dv += (130 * (target - st.v) - 11 * st.dv) * dt
    st.v += st.dv * dt
    st.hover += (st.hoverOn - st.hover) * (1 - Math.exp(-Math.min(delta, 0.05) * 6))
    const v = st.v
    if (group.current) {
      group.current.scale.set(0.85 + 0.15 * THREE.MathUtils.clamp(v, 0, 1), Math.max(0.02, v), 1)
      group.current.rotation.x = (1 - v) * -1.1
      group.current.position.set(0, (1 - v) * -0.05, st.hover * 0.02)
    }
    const open = st.phase === "open" ? st.t : 0
    const fades = [smooth(0.25, 0.5, open), smooth(0.35, 0.65, open), smooth(0.5, 0.85, open)]
    fades.forEach((f, i) => {
      if (Math.abs(f - shown.current[i]) < 0.01) return
      shown.current[i] = f
      parts[i].current?.setProperties({ opacity: f })
    })
    u.uTime.value = st.clock
    u.uTrace.value = smooth(0.1, 1.0, open)
    u.uSweep.value = open
    u.uHover.value = st.hover
    u.uIntensity.value = intensity
  })

  return (
    <group
      ref={group}
      onPointerOver={() => (s.current.hoverOn = 1)}
      onPointerOut={() => (s.current.hoverOn = 0)}
      onClick={() => {
        s.current.phase = "folding"
        s.current.fold = 0
        onPress?.()
      }}
    >
      <mesh renderOrder={-1}>
        <planeGeometry args={[CARD.x + MARGIN * 2, CARD.y + MARGIN * 2]} />
        <shaderMaterial uniforms={u} vertexShader={PLATE_VERT} fragmentShader={PLATE_FRAG} transparent premultipliedAlpha />
      </mesh>
      <group position={[0, 0, 0.002]}>
        <Container pixelSize={PX} width={W} height={H} padding={22} flexDirection="column" justifyContent="space-between" overflow="hidden">
          <Container ref={parts[0]} flexDirection="row" alignItems="center" gap={7}>
            <Container width={7} height={7} borderRadius={3.5} backgroundColor={primaryColor} />
            <Text fontSize={11} fontWeight="semi-bold" color={primaryColor} letterSpacing={1.2}>
              {eyebrow.toUpperCase()}
            </Text>
          </Container>
          <Container flexDirection="column" gap={8}>
            <Container ref={parts[1]}>
              <Text fontSize={25} fontWeight="bold" color="#EEF0F4">
                {title}
              </Text>
            </Container>
            <Container ref={parts[2]}>
              <Text fontSize={13} color="#9AA0AD">
                {body}
              </Text>
            </Container>
          </Container>
        </Container>
      </group>
    </group>
  )
}

const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

const PLATE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const PLATE_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uBase;
uniform float uTime;
uniform float uTrace;
uniform float uSweep;
uniform float uHover;
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
  float d = sdBox(p, uCard * 0.5, 0.022);
  float aa = fwidth(d) * 1.2;
  float fill = 1.0 - smoothstep(-aa, aa, d);
  vec2 cuv = p / uCard + 0.5;

  vec3 base = uBase;
  base += uA * 0.16 * smoothstep(0.75, 0.0, length((cuv - vec2(0.1, 1.0)) * vec2(1.0, 1.4)));
  base += uB * 0.1 * smoothstep(0.7, 0.0, length((cuv - vec2(1.0, 0.0)) * vec2(1.0, 1.4)));
  float sx = uSweep * 1.8 - 0.4;
  float sd = cuv.x * 0.8 + cuv.y * 0.4 - sx;
  base += exp(-sd * sd * 80.0) * 0.22;

  // border traces itself from the top centre down both sides
  float along = abs(atan(p.x, p.y)) / 3.14159;
  float ring = 1.0 - smoothstep(0.0, aa * 1.5, abs(d + 0.001) - 0.0009);
  float drawn = step(along, uTrace);
  float tracing = step(0.001, uTrace) * step(uTrace, 0.999);
  float head = exp(-pow((along - uTrace) * 18.0, 2.0)) * tracing;
  // once traced, a beam keeps orbiting the edge
  float pos = atan(p.y, p.x) / 6.2831;
  float beam = exp(-pow((fract(pos - uTime * 0.12 + 0.5) - 0.5) * 14.0, 2.0)) * step(0.999, uTrace);
  vec3 borderCol = mix(uA, uB, 0.5 + 0.5 * sin(along * 6.0 + uTime));
  float bAmt = ring * (drawn * (0.35 + 0.4 * uHover) + head * 1.5 + beam * 1.2);
  float glow = exp(-max(d, 0.0) * 70.0) * (1.0 - fill) * (beam * 0.6 + head * 0.8 + 0.12 * uHover) * uIntensity;

  vec3 col = base * fill + borderCol * (bAmt + glow);
  float alpha = clamp(max(fill * 0.95, bAmt + glow), 0.0, 1.0);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha);
}
`
