"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"

type Props = {
  /** Ribbon length in metres */
  width?: number
  primaryColor?: string
  secondaryColor?: string
  speed?: number
  paused?: boolean
  /** Brightness */
  intensity?: number
  /** Tap: a surge of light runs along the ribbons, then calls this */
  onPress?: () => void
}

const RIBBONS = [
  { seed: 0.0, y: 0.07, z: -0.05, sx: 1.0, colors: [0, 1, 2] },
  { seed: 0.37, y: -0.01, z: 0.0, sx: 0.92, colors: [2, 0, 1] },
  { seed: 0.71, y: -0.09, z: 0.05, sx: 0.84, colors: [1, 2, 0] },
] as const

/** Three twisting ribbons of aurora light, streaked like a curtain. They ripple where you hover; tap sends a surge along them. */
export default function AuroraRibbon({
  width = 1.4,
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
      uHover: { value: new THREE.Vector2() },
      uSurge: { value: -1 },
    }),
    [],
  )
  const palette = useMemo(() => [new THREE.Color(), new THREE.Color(), new THREE.Color()], [])
  const ribbons = useMemo(
    () =>
      RIBBONS.map((r) => ({
        ...shared,
        uSeed: { value: r.seed },
        uA: { value: palette[r.colors[0]] },
        uB: { value: palette[r.colors[1]] },
        uC: { value: palette[r.colors[2]] },
      })),
    [shared, palette],
  )
  useEffect(() => {
    const a = new THREE.Color(primaryColor)
    palette[0].copy(a).convertLinearToSRGB()
    palette[1].set(secondaryColor).convertLinearToSRGB()
    // third tone: primary swung toward violet
    palette[2].copy(a).offsetHSL(0.36, 0, -0.08).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, palette])

  const group = useRef<THREE.Group>(null)
  const s = useRef({ time: 0, x: 0, on: 0, amt: 0, surge: -1 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const st = s.current
    if (!paused) st.time += dt * speed
    st.amt += (st.on - st.amt) * (1 - Math.exp(-dt * 5))
    if (st.surge > -1) st.surge = st.surge > 1.4 ? -1 : st.surge + dt * 1.1
    shared.uTime.value = st.time
    shared.uIntensity.value = intensity
    shared.uHover.value.set(st.x / width, st.amt)
    shared.uSurge.value = st.surge
  })

  const track = (e: ThreeEvent<PointerEvent>) => {
    if (!group.current) return
    s.current.x = group.current.worldToLocal(e.point.clone()).x
    s.current.on = 1
  }

  return (
    <group ref={group}>
      {RIBBONS.map((r, i) => (
        <mesh key={i} position={[0, r.y, r.z]} scale={[width * r.sx, 1, 1]} frustumCulled={false} raycast={() => null}>
          {/* unit-length strip, scaled to `width`; 220x6 segments ≈ 2.6k triangles */}
          <planeGeometry args={[1, 0.3, 220, 6]} />
          <shaderMaterial
            uniforms={ribbons[i]}
            vertexShader={RIBBON_VERT}
            fragmentShader={RIBBON_FRAG}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      <mesh
        position={[0, 0, 0.1]}
        onPointerOver={track}
        onPointerMove={track}
        onPointerOut={() => (s.current.on = 0)}
        onClick={() => {
          s.current.surge = -0.3
          onPress?.()
        }}
      >
        <planeGeometry args={[width * 1.05, 0.55]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

const RIBBON_VERT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform vec2 uHover;
varying vec2 vUv;
varying float vFacing;
void main() {
  vUv = uv;
  // x runs -0.5..0.5 along the strip (mesh scale stretches it); y is across
  float x = position.x * 1.4;
  float y = position.y;
  float t = uTime * 0.6 + uSeed * 10.0;
  float sy = sin(x * 2.4 + t) * 0.09 + sin(x * 5.3 - t * 1.3 + uSeed) * 0.03;
  float sz = cos(x * 2.0 + t * 0.8) * 0.14;
  float tw = sin(x * 1.7 - t * 0.7 + uSeed * 2.0) * 1.1 + 0.5;
  vec3 p = vec3(position.x, sy + cos(tw) * y, sz + sin(tw) * y);
  float h = uHover.y * exp(-pow((position.x - uHover.x) / 0.12, 2.0));
  p.y += h * sin(x * 30.0 - uTime * 9.0) * 0.025;
  p.z += h * 0.05;
  vFacing = abs(cos(tw));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const RIBBON_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform float uSurge;
varying vec2 vUv;
varying float vFacing;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float along = vUv.x;
  float across = vUv.y;
  float t = uTime;
  float s1 = noise(vec2(along * 38.0 + t * 0.5 + uSeed * 7.0, across * 1.2 - t * 0.2));
  float s2 = noise(vec2(along * 85.0 - t * 0.8, across * 0.8 + uSeed * 5.0));
  float streaks = 0.35 + 0.65 * s1 * (0.6 + 0.8 * s2);
  float curtain = pow(1.0 - across, 1.6) * smoothstep(0.0, 0.06, across);
  float ends = smoothstep(0.0, 0.14, along) * smoothstep(1.0, 0.86, along);
  vec3 col = mix(uA, uB, smoothstep(0.15, 0.85, along + 0.18 * sin(t * 0.35 + across * 3.0 + uSeed * 6.0)));
  col = mix(col, uC, smoothstep(0.45, 1.0, across) * 0.8);
  float line = exp(-across * 38.0) * 0.9;
  float surge = exp(-pow((along - uSurge) * 9.0, 2.0));
  float bright = (curtain * streaks + line) * ends * (0.55 + 0.45 * vFacing) * uIntensity * (1.0 + surge * 2.0);
  gl_FragColor = vec4(col * bright + vec3(surge * bright * 0.3), 1.0);
}
`
