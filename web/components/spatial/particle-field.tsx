"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"

type Props = {
  /** Number of particles (max 3000) */
  count?: number
  /** Galaxy radius in metres */
  radius?: number
  /** Spiral arms */
  arms?: number
  /** Outer arm colour */
  primaryColor?: string
  /** Hot core colour */
  secondaryColor?: string
  speed?: number
  paused?: boolean
  /** Brightness and pull strength */
  intensity?: number
  /** Tap: the galaxy bursts outward, then calls this */
  onPress?: () => void
}

const noRaycast = () => null

/** Spiral galaxy of glowing particles. Inner stars orbit faster; the cloud swirls toward your pointer or fingertip; tap to burst it. */
export default function ParticleField({
  count = 2400,
  radius = 0.6,
  arms = 3,
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  speed = 1,
  paused = false,
  intensity = 1,
  onPress,
}: Props) {
  const n = Math.max(1, Math.min(3000, Math.round(count)))
  const armCount = Math.max(1, Math.round(arms))
  const geometry = useMemo(() => buildGalaxy(n, radius, armCount), [n, radius, armCount])
  useEffect(() => () => geometry.dispose(), [geometry])

  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 0.011 },
      uViewH: { value: 600 },
      uRadius: { value: 0.6 },
      uPointer: { value: new THREE.Vector3() },
      uAttract: { value: 0 },
      uBurst: { value: 0 },
      uIntensity: { value: 1 },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
    }),
    [],
  )
  const core = useMemo(() => ({ uA: { value: new THREE.Color() }, uAlpha: { value: 0.5 } }), [])
  useEffect(() => {
    u.uA.value.set(primaryColor).convertLinearToSRGB()
    u.uB.value.set(secondaryColor).convertLinearToSRGB()
    core.uA.value.set(secondaryColor).lerp(new THREE.Color("#ffffff"), 0.25).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, u, core])

  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const disk = useRef<THREE.Group>(null)
  const time = useRef(0)
  const pointer = useRef({ target: new THREE.Vector3(), on: 0, amt: 0, burst: 0 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const p = pointer.current
    if (!paused) time.current += dt * speed
    p.amt += (p.on - p.amt) * (1 - Math.exp(-dt * 4))
    p.burst *= Math.exp(-dt * 2.2)
    u.uPointer.value.lerp(p.target, 1 - Math.exp(-dt * 10))
    u.uTime.value = time.current
    u.uAttract.value = p.amt * intensity
    u.uBurst.value = p.burst
    u.uRadius.value = radius
    u.uIntensity.value = intensity
    u.uViewH.value = size.height * dpr * 0.5
    core.uAlpha.value = (0.45 + 0.25 * p.amt) * intensity
  })

  const track = (e: ThreeEvent<PointerEvent>) => {
    if (!disk.current) return
    pointer.current.target.copy(disk.current.worldToLocal(e.point.clone()))
    pointer.current.on = 1
  }

  return (
    <group rotation={[0.62, 0, 0.1]}>
      <group ref={disk}>
        <points geometry={geometry} frustumCulled={false} raycast={noRaycast}>
          <shaderMaterial
            uniforms={u}
            vertexShader={STAR_VERT}
            fragmentShader={STAR_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
        {/* invisible disc in the galaxy plane catches hover, poke and taps */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerOver={track}
          onPointerMove={track}
          onPointerOut={() => (pointer.current.on = 0)}
          onClick={() => {
            pointer.current.burst = 1
            onPress?.()
          }}
        >
          <circleGeometry args={[radius * 1.1, 48]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh renderOrder={-1} raycast={noRaycast}>
        <planeGeometry args={[radius * 1.1, radius * 1.1]} />
        <shaderMaterial
          uniforms={core}
          vertexShader={CORE_VERT}
          fragmentShader={CORE_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function buildGalaxy(n: number, radius: number, arms: number) {
  const pos = new Float32Array(n * 3)
  const rnd = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const r = Math.pow(Math.random(), 1.5) * radius
    const branch = ((i % arms) / arms) * Math.PI * 2
    const spin = (r / radius) * 3.2
    const jitter = () => Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * (0.05 + 0.32 * r)
    pos[i * 3] = Math.cos(branch + spin) * r + jitter()
    pos[i * 3 + 1] = jitter() * 0.35
    pos[i * 3 + 2] = Math.sin(branch + spin) * r + jitter()
    rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 4))
  return g
}

const STAR_VERT = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uViewH;
uniform float uRadius;
uniform vec3 uPointer;
uniform float uAttract;
uniform float uBurst;
uniform float uIntensity;
uniform vec3 uA;
uniform vec3 uB;
attribute vec4 aRand;
varying vec3 vColor;
varying float vAlpha;

vec2 rot(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

void main() {
  vec3 p = position;
  float r = length(p.xz);
  float rn = r / uRadius;
  // differential rotation: the core spins faster than the arms
  p.xz = rot(p.xz, -uTime * 0.32 / (0.3 + rn) * (0.85 + aRand.z * 0.3));
  p.y += sin(uTime * (0.5 + aRand.y) + aRand.w * 6.2831) * 0.012;

  // swirl toward the pointer: pull in and twist around it
  vec2 q = p.xz - uPointer.xz;
  float d = length(q);
  float f = uAttract * exp(-d * d / (0.11 * uRadius * uRadius));
  q = rot(q, f * 2.4) * (1.0 - 0.55 * f);
  p.xz = uPointer.xz + q;
  p.y += f * 0.06 * (aRand.x - 0.3);

  // tap burst
  p.xz *= 1.0 + uBurst * (0.35 + 0.6 * aRand.x);
  p.y += uBurst * (aRand.y - 0.5) * 0.35;

  vec3 col = mix(uB, uA, smoothstep(0.05, 0.75, rn));
  col = mix(col, vec3(1.0), step(0.965, aRand.x) * 0.7);
  col += f * 0.5;
  vColor = col;
  vAlpha = (0.55 + 0.45 * aRand.w) * uIntensity * (1.0 - 0.35 * uBurst);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float sz = uSize * (0.5 + aRand.x * aRand.x * 1.6) * (1.0 + f * 1.4) * (1.0 + 0.6 * (1.0 - rn));
  gl_PointSize = max(1.0, sz * projectionMatrix[1][1] * uViewH / max(-mv.z, 0.05));
  gl_Position = projectionMatrix * mv;
}
`

const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor, a * vAlpha);
}
`

const CORE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // camera-facing glow at the galaxy centre
  float scale = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * scale;
  gl_Position = projectionMatrix * mv;
}
`

const CORE_FRAG = /* glsl */ `
uniform vec3 uA;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = exp(-d * d * 9.0) + 0.35 * exp(-d * d * 2.5);
  gl_FragColor = vec4(uA, a * uAlpha);
}
`
