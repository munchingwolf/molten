"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

type Props = {
  /** Orb radius in metres */
  radius?: number
  primaryColor?: string
  secondaryColor?: string
  speed?: number
  paused?: boolean
  /** Brightness of the orb, halo and rings */
  intensity?: number
  /** Tap: sends out a shockwave, then calls this */
  onPress?: () => void
}

/** Glowing aurora orb: flowing gradient bands inside a glass-like sphere, a soft halo and two orbit rings. Pulses on hover. */
export default function GradientOrb({
  radius = 0.26,
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  speed = 1,
  paused = false,
  intensity = 1,
  onPress,
}: Props) {
  const orb = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uIntensity: { value: 1 },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uC: { value: new THREE.Color() },
    }),
    [],
  )
  const halo = useMemo(
    () => ({
      uTime: { value: 0 },
      uPing: { value: 1 },
      uAlpha: { value: 0.6 },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
    }),
    [],
  )
  const ring = useMemo(
    () => ({ uTime: { value: 0 }, uAlpha: { value: 0.8 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() } }),
    [],
  )
  useEffect(() => {
    const a = new THREE.Color(primaryColor)
    const b = new THREE.Color(secondaryColor)
    // third aurora tone: the primary hue swung toward violet and deepened
    const c = a.clone().offsetHSL(0.36, 0, -0.12)
    for (const x of [orb, halo, ring]) {
      x.uA.value.copy(a).convertLinearToSRGB()
      x.uB.value.copy(b).convertLinearToSRGB()
    }
    orb.uC.value.copy(c).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, orb, halo, ring])

  const body = useRef<THREE.Group>(null)
  const rings = useRef<THREE.Group>(null)
  const s = useRef({ time: 0, hover: 0, hoverOn: 0, pulse: 0, pulseV: 0, ping: 1 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const st = s.current
    if (!paused) st.time += dt * speed
    // springy pulse toward the hover state
    st.pulseV += (170 * (st.hoverOn - st.pulse) - 14 * st.pulseV) * dt
    st.pulse += st.pulseV * dt
    st.ping = Math.min(1, st.ping + dt * 1.2)
    const breathe = paused ? 0 : Math.sin(st.time * 2) * 0.015
    body.current?.scale.setScalar(1 + breathe + st.pulse * 0.07)
    if (rings.current && !paused) rings.current.rotation.y += dt * speed * (0.25 + st.pulse * 0.6)
    orb.uTime.value = halo.uTime.value = ring.uTime.value = st.time
    orb.uPulse.value = Math.max(0, st.pulse)
    orb.uIntensity.value = intensity
    halo.uPing.value = st.ping
    halo.uAlpha.value = (0.55 + 0.35 * Math.max(0, st.pulse)) * intensity
    ring.uAlpha.value = (0.7 + 0.3 * Math.max(0, st.pulse)) * intensity
  })

  return (
    <group
      onPointerOver={() => (s.current.hoverOn = 1)}
      onPointerOut={() => (s.current.hoverOn = 0)}
      onClick={() => {
        s.current.ping = 0
        onPress?.()
      }}
    >
      <group ref={body}>
        <mesh>
          <sphereGeometry args={[radius, 64, 48]} />
          <shaderMaterial uniforms={orb} vertexShader={ORB_VERT} fragmentShader={ORB_FRAG} />
        </mesh>
        <mesh renderOrder={-1} raycast={() => null}>
          <planeGeometry args={[radius * 5, radius * 5]} />
          <shaderMaterial
            uniforms={halo}
            vertexShader={HALO_VERT}
            fragmentShader={HALO_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      <group ref={rings}>
        <mesh rotation={[1.25, 0, 0.35]}>
          <torusGeometry args={[radius * 1.45, 0.0035, 8, 180]} />
          <shaderMaterial
            uniforms={ring}
            vertexShader={RING_VERT}
            fragmentShader={RING_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh rotation={[1.9, 0.5, -0.4]}>
          <torusGeometry args={[radius * 1.7, 0.0025, 8, 180]} />
          <shaderMaterial
            uniforms={ring}
            vertexShader={RING_VERT}
            fragmentShader={RING_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
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

const ORB_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vObjN;
varying vec3 vN;
varying vec3 vView;
void main() {
  float a = uTime * 0.2;
  vec3 n = normalize(position);
  vObjN = vec3(n.x * cos(a) - n.z * sin(a), n.y, n.x * sin(a) + n.z * cos(a));
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const ORB_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uTime;
uniform float uPulse;
uniform float uIntensity;
varying vec3 vObjN;
varying vec3 vN;
varying vec3 vView;
${NOISE}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(-vView);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float t = uTime * 0.25 * (1.0 + uPulse);
  vec3 p = vObjN * 1.4;
  float n1 = snoise(p + vec3(0.0, t, t * 0.6));
  float n2 = snoise(p * 1.8 + vec3(n1 * 0.9, -t * 0.8, 0.0));
  float bands = sin((vObjN.y * 3.0 + n2 * 1.6 + t * 2.0) * 3.14159);
  vec3 col = mix(uC, uA, smoothstep(-0.6, 0.7, n2));
  col = mix(col, uB, smoothstep(0.2, 0.95, n1 * 0.5 + bands * 0.35));
  col *= 0.45 + 0.75 * pow(ndv, 0.8);
  col += mix(uA, vec3(1.0), 0.4) * pow(1.0 - ndv, 2.4) * (0.9 + uPulse);
  col += pow(max(dot(reflect(-V, N), normalize(vec3(-0.4, 0.7, 0.6))), 0.0), 40.0) * 0.6;
  col *= uIntensity * (1.0 + 0.3 * uPulse);
  gl_FragColor = vec4(col, 1.0);
}
`

const HALO_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // always faces the viewer
  float scale = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * scale;
  gl_Position = projectionMatrix * mv;
}
`

const HALO_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uPing;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float ang = atan(p.y, p.x);
  vec3 col = mix(uA, uB, 0.5 + 0.5 * sin(ang * 2.0 + uTime * 0.8));
  float glow = exp(-max(r - 0.38, 0.0) * 7.0) * smoothstep(1.0, 0.55, r);
  float ringR = 0.4 + uPing * 0.6;
  float ping = exp(-pow((r - ringR) * 26.0, 2.0)) * (1.0 - uPing) * 1.5;
  gl_FragColor = vec4(col, (glow * 0.55 + ping) * uAlpha);
}
`

const RING_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const RING_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float u = vUv.x;
  float dash = smoothstep(0.35, 0.5, fract(u * 36.0 - uTime * 0.6)) * smoothstep(0.95, 0.8, fract(u * 36.0 - uTime * 0.6));
  float comet = pow(fract(u - uTime * 0.12), 6.0);
  vec3 col = mix(uA, uB, 0.5 + 0.5 * sin(u * 6.2831 + uTime));
  gl_FragColor = vec4(col + comet * 0.6, (0.25 * dash + comet) * uAlpha);
}
`
