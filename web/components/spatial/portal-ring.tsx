"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"

type Props = {
  /** Ring radius in metres */
  radius?: number
  /** Ring and outer swirl colour */
  primaryColor?: string
  /** Inner swirl colour */
  secondaryColor?: string
  speed?: number
  paused?: boolean
  /** Glow strength */
  intensity?: number
  /** Tap the portal: it flashes open, then calls this (switch scenes here) */
  onPress?: () => void
}

const SPARKS = 180
const noRaycast = () => null

/** Neon portal: a glowing ring around a swirling tunnel, gyroscope rings and orbiting sparks. A door between scenes. */
export default function PortalRing({
  radius = 0.42,
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  speed = 1,
  paused = false,
  intensity = 1,
  onPress,
}: Props) {
  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uBoost: { value: 0 },
      uFlash: { value: 0 },
      uIntensity: { value: 1 },
      uAlpha: { value: 0.5 },
      uRadius: { value: 0.42 },
      uViewH: { value: 600 },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
    }),
    [],
  )
  useEffect(() => {
    u.uA.value.set(primaryColor).convertLinearToSRGB()
    u.uB.value.set(secondaryColor).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, u])

  const sparks = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    const r = new Float32Array(SPARKS * 4)
    for (let i = 0; i < r.length; i++) r[i] = Math.random()
    g.setAttribute("aRand", new THREE.BufferAttribute(r, 4))
    return g
  }, [])
  useEffect(() => () => sparks.dispose(), [sparks])

  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const sway = useRef<THREE.Group>(null)
  const gyroA = useRef<THREE.Mesh>(null)
  const gyroB = useRef<THREE.Mesh>(null)
  const s = useRef({ time: 0, hover: 0, hoverOn: 0, flash: 0 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const st = s.current
    if (!paused) {
      const boost = 1 + st.hover * 1.5 + st.flash * 4
      st.time += dt * speed * boost
      if (gyroA.current) gyroA.current.rotation.x += dt * speed * 0.6
      if (gyroB.current) gyroB.current.rotation.y += dt * speed * 0.45
      if (sway.current) {
        sway.current.rotation.x = Math.sin(st.time * 0.4) * 0.08
        sway.current.rotation.y = Math.cos(st.time * 0.33) * 0.1
      }
    }
    st.hover += (st.hoverOn - st.hover) * (1 - Math.exp(-dt * 5))
    st.flash *= Math.exp(-dt * 2.5)
    u.uTime.value = st.time
    u.uBoost.value = st.hover
    u.uFlash.value = st.flash
    u.uIntensity.value = intensity
    u.uAlpha.value = (0.45 + 0.3 * st.hover) * intensity
    u.uRadius.value = radius
    u.uViewH.value = size.height * dpr * 0.5
  })

  return (
    <group ref={sway}>
      <mesh position={[0, 0, -0.01]} renderOrder={-1} raycast={noRaycast}>
        <planeGeometry args={[radius * 3, radius * 3]} />
        <shaderMaterial uniforms={u} vertexShader={UV_VERT} fragmentShader={HALO_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <group
        onPointerOver={() => (s.current.hoverOn = 1)}
        onPointerOut={() => (s.current.hoverOn = 0)}
        onClick={() => {
          s.current.flash = 1
          onPress?.()
        }}
      >
        <mesh>
          <circleGeometry args={[radius * 0.985, 96]} />
          <shaderMaterial uniforms={u} vertexShader={UV_VERT} fragmentShader={SWIRL_FRAG} transparent depthWrite={false} />
        </mesh>
        <mesh>
          <torusGeometry args={[radius, 0.016, 20, 160]} />
          <shaderMaterial uniforms={u} vertexShader={NEON_VERT} fragmentShader={NEON_FRAG} />
        </mesh>
      </group>
      <mesh ref={gyroA} raycast={noRaycast}>
        <torusGeometry args={[radius * 1.12, 0.003, 6, 160]} />
        <shaderMaterial uniforms={u} vertexShader={UV_VERT} fragmentShader={DASH_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={gyroB} rotation={[0, 0, 0.6]} raycast={noRaycast}>
        <torusGeometry args={[radius * 1.2, 0.0025, 6, 160]} />
        <shaderMaterial uniforms={u} vertexShader={UV_VERT} fragmentShader={DASH_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <points geometry={sparks} frustumCulled={false} raycast={noRaycast}>
        <shaderMaterial uniforms={u} vertexShader={SPARK_VERT} fragmentShader={SPARK_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}

const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

const UV_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SWIRL_FRAG = /* glsl */ `
uniform float uTime;
uniform float uBoost;
uniform float uFlash;
uniform float uIntensity;
uniform vec3 uA;
uniform vec3 uB;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float z = 0.3 / max(r, 0.03);
  float tw = a + z * 0.9 - uTime * 0.6;
  vec3 q = vec3(cos(tw) * 1.2, sin(tw) * 1.2, z * 0.8 - uTime * 1.4);
  float n = snoise(q) * 0.6 + snoise(q * 2.3 + 3.1) * 0.4;
  float arms = 0.5 + 0.5 * sin(tw * 3.0 + n * 2.0);
  float streak = smoothstep(0.05, 0.9, n * 0.5 + 0.5) * arms;
  vec3 col = mix(uB, uA, clamp(smoothstep(0.25, 0.95, r) + 0.25 * n, 0.0, 1.0));
  float bright = streak * smoothstep(0.02, 0.5, r) * (0.7 + 0.8 * uBoost + 1.5 * uFlash);
  float throat = exp(-r * r * 60.0);
  vec3 c = col * bright * 1.3;
  c += vec3(1.0) * throat * (0.8 + uFlash);
  c += uA * smoothstep(0.7, 1.0, r) * 0.6;
  c += mix(vec3(0.02, 0.03, 0.05), uB * 0.12, r);
  c += mix(uA, vec3(1.0), 0.5) * uFlash * 0.5;
  float edge = smoothstep(1.0, 0.97, r);
  gl_FragColor = vec4(c * uIntensity, edge);
}
`

const NEON_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const NEON_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uBoost;
uniform float uFlash;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  float ndv = abs(dot(normalize(vN), normalize(-vView)));
  float u = vUv.x;
  vec3 col = mix(uA, uB, 0.5 + 0.5 * sin(u * 12.566 - uTime * 1.5));
  float pulse = pow(0.5 + 0.5 * sin(u * 18.85 - uTime * 4.0), 8.0);
  vec3 c = col * (0.75 + 0.6 * uBoost) + vec3(1.0) * pow(ndv, 3.0) * (0.7 + uFlash) + col * pulse * 0.8;
  gl_FragColor = vec4(c * uIntensity, 1.0);
}
`

const HALO_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uAlpha;
uniform float uFlash;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float d = r - 0.6667;
  float glow = exp(-abs(d) * 12.0) * 0.7 + exp(-d * d * 900.0) * 0.6;
  vec3 col = mix(uA, uB, 0.5 + 0.5 * sin(atan(p.y, p.x) * 2.0 - uTime));
  gl_FragColor = vec4(col, glow * smoothstep(1.0, 0.8, r) * (uAlpha + uFlash));
}
`

const DASH_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float f = fract(vUv.x * 48.0 - uTime * 0.5);
  float dash = smoothstep(0.2, 0.35, f) * smoothstep(0.8, 0.65, f);
  float comet = pow(fract(vUv.x + uTime * 0.15), 8.0);
  vec3 col = mix(uA, uB, vUv.x);
  gl_FragColor = vec4(col + comet * 0.5, (0.22 * dash + comet * 0.9) * uAlpha * 1.4);
}
`

const SPARK_VERT = /* glsl */ `
uniform float uTime;
uniform float uRadius;
uniform float uFlash;
uniform float uViewH;
uniform vec3 uA;
uniform vec3 uB;
attribute vec4 aRand;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float ang = aRand.x * 6.2831 + uTime * (0.25 + aRand.y * 0.5);
  float r = uRadius * (1.0 + (aRand.z - 0.5) * 0.14) + uFlash * aRand.w * 0.3;
  vec3 p = vec3(cos(ang) * r, sin(ang) * r, (aRand.w - 0.5) * 0.08);
  vColor = mix(uA, uB, aRand.y);
  vAlpha = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 3.0 + aRand.z * 40.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float sz = 0.006 * (0.6 + aRand.w * 1.2) * (1.0 + uFlash);
  gl_PointSize = max(1.0, sz * projectionMatrix[1][1] * uViewH / max(-mv.z, 0.05));
  gl_Position = projectionMatrix * mv;
}
`

const SPARK_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor + a * 0.3, a * a * vAlpha);
}
`
