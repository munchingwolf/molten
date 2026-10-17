"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"

type Props = {
  /** Blob radius in metres */
  radius?: number
  /** Main body colour */
  primaryColor?: string
  /** Shadow-side colour */
  secondaryColor?: string
  speed?: number
  paused?: boolean
  /** Displacement and iridescence strength */
  intensity?: number
  /** Tap / poke */
  onPress?: () => void
}

const SLOTS = 4

/** Glossy noise-displaced blob. It morphs on its own, gets agitated on hover, and ripples out from wherever you poke it. */
export default function MorphBlob({
  radius = 0.32,
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  speed = 1,
  paused = false,
  intensity = 1,
  onPress,
}: Props) {
  const mesh = useRef<THREE.Mesh>(null)
  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.09 },
      uFreq: { value: 1.6 },
      uRadius: { value: 0.32 },
      uRipples: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4(0, 0, 1, -100)) },
      uIntensity: { value: 1 },
      uGlow: { value: 0.2 },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
    }),
    [],
  )
  useEffect(() => {
    u.uA.value.set(primaryColor).convertLinearToSRGB()
    u.uB.value.set(secondaryColor).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, u])

  const s = useRef({ time: 0, hover: 0, hoverOn: 0, slot: 0, last: 0, sq: 0, sqV: 0 })

  const ripple = (dir: THREE.Vector3) => {
    const st = s.current
    u.uRipples.value[st.slot].set(dir.x, dir.y, dir.z, st.time)
    st.slot = (st.slot + 1) % SLOTS
    st.last = st.time
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const st = s.current
    if (!paused) {
      st.time += dt * speed
      // idle demo: a gentle self-poke every few seconds when nobody is touching it
      if (!st.hoverOn && st.time - st.last > 5)
        ripple(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0.8).normalize())
    }
    st.hover += (st.hoverOn - st.hover) * (1 - Math.exp(-dt * 5))
    // squash spring
    st.sqV += (-140 * st.sq - 9 * st.sqV) * dt
    st.sq += st.sqV * dt
    mesh.current?.scale.set(1 + st.sq * 0.5, 1 - st.sq, 1 + st.sq * 0.5)
    u.uTime.value = st.time
    u.uAmp.value = (0.085 + 0.07 * st.hover) * intensity
    u.uGlow.value = 0.15 + 0.45 * st.hover
    u.uRadius.value = radius
    u.uIntensity.value = intensity
  })

  const poke = (e: ThreeEvent<PointerEvent>) => {
    if (!mesh.current) return
    ripple(mesh.current.worldToLocal(e.point.clone()).normalize())
    s.current.sqV += 2.2
  }

  return (
    <mesh
      ref={mesh}
      onPointerOver={() => (s.current.hoverOn = 1)}
      onPointerOut={() => (s.current.hoverOn = 0)}
      onPointerDown={poke}
      onClick={() => onPress?.()}
    >
      {/* displaced in the shader (raycasts hit the undisplaced sphere); 120×72 ≈ 17k triangles */}
      <sphereGeometry args={[radius, 120, 72]} />
      <shaderMaterial uniforms={u} vertexShader={BLOB_VERT} fragmentShader={BLOB_FRAG} />
    </mesh>
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

const BLOB_VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uRadius;
uniform vec4 uRipples[4];
varying vec3 vN;
varying vec3 vView;
varying float vDisp;
varying vec3 vObj;
${NOISE}

float field(vec3 n) {
  float d = snoise(n * uFreq + vec3(0.0, uTime * 0.35, uTime * 0.22)) * uAmp;
  d += snoise(n * uFreq * 2.3 - vec3(uTime * 0.3)) * uAmp * 0.35;
  for (int i = 0; i < 4; i++) {
    float age = uTime - uRipples[i].w;
    if (age < 0.0 || age > 3.0) continue;
    float dist = acos(clamp(dot(n, uRipples[i].xyz), -1.0, 1.0));
    float front = age * 2.2;
    float env = exp(-age * 1.7) * smoothstep(front + 0.35, front - 0.15, dist);
    d += sin(dist * 16.0 - age * 22.0) * 0.05 * env;
    d -= 0.09 * exp(-age * 7.0) * exp(-dist * dist * 18.0);
  }
  return d;
}

vec3 orth(vec3 n) {
  return normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
}

void main() {
  vec3 n = normalize(position);
  vec3 t = orth(n);
  vec3 b = cross(n, t);
  float e = 0.012;
  float d0 = field(n);
  vec3 n1 = normalize(n + t * e);
  vec3 n2 = normalize(n + b * e);
  vec3 p0 = n * uRadius * (1.0 + d0);
  vec3 p1 = n1 * uRadius * (1.0 + field(n1));
  vec3 p2 = n2 * uRadius * (1.0 + field(n2));
  vec3 nrm = normalize(cross(p1 - p0, p2 - p0));
  vDisp = d0;
  vObj = n;
  vN = normalize(normalMatrix * nrm);
  vec4 mv = modelViewMatrix * vec4(p0, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const BLOB_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uIntensity;
uniform float uTime;
uniform float uGlow;
varying vec3 vN;
varying vec3 vView;
varying float vDisp;
varying vec3 vObj;

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(-vView);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  vec3 R = reflect(-V, N);
  vec3 L = normalize(vec3(-0.5, 0.8, 0.6));

  float k = clamp(0.5 + vDisp * 3.0 + vObj.y * 0.3, 0.0, 1.0);
  vec3 body = mix(uB, uA, k);
  float lambert = max(dot(N, L), 0.0);
  vec3 col = body * (0.16 + 0.6 * lambert);

  // procedural studio reflections: top softbox, side strip, coloured horizon
  float top = smoothstep(0.35, 0.9, R.y);
  float strip = smoothstep(0.55, 0.9, R.x) * smoothstep(-0.4, 0.2, R.y);
  vec3 env = vec3(1.0) * top * 0.9 + uA * strip * 0.7 + mix(uB, uA, R.y * 0.5 + 0.5) * 0.22;
  col += env * (0.1 + 0.9 * fres);
  col += pow(max(dot(R, L), 0.0), 80.0) * 1.3;

  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + ndv * 1.4 + vDisp * 2.5 + uTime * 0.05));
  col += irid * fres * 0.35 * uIntensity;
  col += uA * fres * uGlow;
  gl_FragColor = vec4(col, 1.0);
}
`
