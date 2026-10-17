"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"

type Props = {
  label?: string
  /** Left end of the liquid gradient */
  primaryColor?: string
  /** Right end of the liquid gradient */
  secondaryColor?: string
  /** Label colour (dark reads best on the bright liquid) */
  labelColor?: string
  speed?: number
  paused?: boolean
  /** Wobble and glow strength */
  intensity?: number
  disabled?: boolean
  onPress?: () => void
}

const R = 0.045 // capsule radius (button half-height)
const DEPTH = 0.55 // the pill is flattened front-to-back
const SLOTS = 3

/** Glossy liquid pill button. Press it and the surface squashes and ripples out from your fingertip, then jiggles back. */
export default function LiquidButton({
  label = "Get started",
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  labelColor = "#06221B",
  speed = 1,
  paused = false,
  intensity = 1,
  disabled = false,
  onPress,
}: Props) {
  const len = THREE.MathUtils.clamp(Array.from(label).length * 0.0115, 0.08, 0.4)
  const half = len / 2 + R
  const mesh = useRef<THREE.Mesh>(null)
  const body = useRef<THREE.Group>(null)
  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uHover: { value: 0 },
      uPress: { value: 0 },
      uAmp: { value: 1 },
      uHalf: { value: 0.1 },
      uIntensity: { value: 1 },
      uRipples: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4(0, 0, 0, -100)) },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
    }),
    [],
  )
  const halo = useMemo(
    () => ({ ...u, uLen: { value: 0.1 }, uSize: { value: new THREE.Vector2(1, 1) }, uR: { value: R } }),
    [u],
  )
  useEffect(() => {
    u.uA.value.set(primaryColor).convertLinearToSRGB()
    u.uB.value.set(secondaryColor).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, u])

  const s = useRef({ time: 0, hover: 0, hoverOn: 0, down: 0, sq: 0, sqV: 0, slot: 0 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = s.current
    if (!paused) st.time += dt * speed
    st.hover += (st.hoverOn - st.hover) * (1 - Math.exp(-dt * 8))
    st.sqV += (240 * (st.down - st.sq) - 11 * st.sqV) * dt
    st.sq += st.sqV * dt
    if (body.current) {
      const q = st.sq
      body.current.scale.set(1 + 0.06 * q, 1 + 0.05 * q, 1 - 0.32 * q)
      body.current.position.z = -0.008 * q
    }
    u.uTime.value = st.time
    u.uHover.value = st.hover
    u.uPress.value = THREE.MathUtils.clamp(st.sq, 0, 1)
    u.uAmp.value = intensity * (disabled ? 0.3 : 1)
    u.uHalf.value = half
    u.uIntensity.value = intensity * (disabled ? 0.5 : 1)
    halo.uLen.value = len / 2
    halo.uSize.value.set(len + 2 * R + 0.16, 2 * R + 0.16)
  })

  const press = (e: ThreeEvent<PointerEvent>) => {
    if (disabled || !mesh.current) return
    const st = s.current
    const p = mesh.current.worldToLocal(e.point.clone())
    u.uRipples.value[st.slot].set(p.x, p.y, p.z, st.time)
    st.slot = (st.slot + 1) % SLOTS
    st.down = 1
  }
  const release = () => (s.current.down = 0)

  return (
    <group
      onPointerOver={() => (s.current.hoverOn = 1)}
      onPointerOut={() => {
        s.current.hoverOn = 0
        release()
      }}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onClick={() => {
        if (!disabled) onPress?.()
      }}
    >
      <mesh position={[0, 0, -0.03]} renderOrder={-1} raycast={() => null}>
        <planeGeometry args={[len + 2 * R + 0.16, 2 * R + 0.16]} />
        <shaderMaterial uniforms={halo} vertexShader={HALO_VERT} fragmentShader={HALO_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <group ref={body}>
        <mesh ref={mesh} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, DEPTH]}>
          <capsuleGeometry args={[R, len, 12, 48, 12]} />
          <shaderMaterial uniforms={u} vertexShader={LIQUID_VERT} fragmentShader={LIQUID_FRAG} />
        </mesh>
        <group position={[0, 0, R * DEPTH + 0.009]}>
          <Container pixelSize={0.001} alignItems="center" justifyContent="center">
            <Text fontSize={20} fontWeight="semi-bold" color={labelColor}>
              {label}
            </Text>
          </Container>
        </group>
      </group>
    </group>
  )
}

const LIQUID_VERT = /* glsl */ `
uniform float uTime;
uniform float uHover;
uniform float uAmp;
uniform vec4 uRipples[3];
varying vec3 vN;
varying vec3 vView;
varying vec3 vLocal;

float wave(vec3 p) {
  float w = sin(p.y * 38.0 + uTime * 2.6) * sin(p.x * 31.0 - uTime * 2.1) * 0.0012 * (0.4 + uHover);
  for (int i = 0; i < 3; i++) {
    float age = uTime - uRipples[i].w;
    if (age < 0.0 || age > 2.5) continue;
    float d = distance(p, uRipples[i].xyz);
    float front = age * 0.32;
    float env = exp(-age * 2.4) * smoothstep(front + 0.03, front - 0.02, d);
    w += sin(d * 95.0 - age * 26.0) * 0.0055 * env;
    w -= 0.008 * exp(-age * 9.0) * exp(-d * d * 900.0);
  }
  return w * uAmp;
}

vec3 orth(vec3 n) {
  return normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
}

void main() {
  vec3 n = normalize(normal);
  vec3 t = orth(n);
  vec3 b = cross(n, t);
  float e = 0.004;
  vec3 p0 = position + n * wave(position);
  vec3 q1 = position + t * e;
  vec3 q2 = position + b * e;
  vec3 p1 = q1 + n * wave(q1);
  vec3 p2 = q2 + n * wave(q2);
  vec3 nrm = normalize(cross(p1 - p0, p2 - p0));
  vLocal = position;
  vN = normalize(normalMatrix * nrm);
  vec4 mv = modelViewMatrix * vec4(p0, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const LIQUID_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uHover;
uniform float uPress;
uniform float uHalf;
uniform float uIntensity;
varying vec3 vN;
varying vec3 vView;
varying vec3 vLocal;

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(-vView);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.5);
  vec3 R = reflect(-V, N);
  vec3 L = normalize(vec3(-0.4, 0.8, 0.6));
  // capsule axis is local y; after the mesh rotation +y points left
  float g = clamp(0.5 + 0.5 * vLocal.y / uHalf + 0.08 * sin(uTime * 1.3 + vLocal.x * 30.0), 0.0, 1.0);
  vec3 body = mix(uB, uA, g);
  vec3 col = body * (0.55 + 0.45 * max(dot(N, L), 0.0));
  col += vec3(1.0) * smoothstep(0.3, 0.85, R.y) * 0.45 * (0.3 + 0.7 * fres);
  col += pow(max(dot(R, L), 0.0), 90.0) * 1.1;
  col += mix(body, vec3(1.0), 0.5) * fres * (0.25 + 0.5 * uHover);
  col *= (1.0 + 0.25 * uPress) * (0.85 + 0.15 * uIntensity);
  gl_FragColor = vec4(col, 1.0);
}
`

const HALO_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const HALO_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uHover;
uniform float uPress;
uniform float uIntensity;
uniform float uLen;
uniform float uR;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = length(vec2(max(abs(p.x) - uLen, 0.0), p.y)) - uR;
  float glow = exp(-max(d, 0.0) * 38.0);
  vec3 col = mix(uB, uA, clamp(0.5 - p.x / (uLen * 2.0 + uR * 2.0), 0.0, 1.0));
  gl_FragColor = vec4(col, glow * (0.25 + 0.35 * uHover + 0.6 * uPress) * uIntensity);
}
`
