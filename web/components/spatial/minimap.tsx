"use client"

import { useEffect, useMemo, useRef } from "react"
import * as Tone from "tone"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { AdditiveBlending, Color, Object3D, ShaderMaterial, Vector3, type InstancedMesh, type Mesh } from "three"

type Props = { blips?: number; color?: string; blipColor?: string; sweepSpeed?: number; onPress?: () => void }

const R = 0.125 // radius, metres
const TAU = Math.PI * 2
const PINGS = 3
const PING_LIFE = 1.2 // seconds
const MAX_BLIPS = 24
const ROAM = 0.105 // blips stay inside this radius

// Radar face: range rings, crosshair, rim, a clockwise sweep with a fading trail and tap pings, all in one draw call.
const vertexShader = /* glsl */ `
varying vec2 vPos;
void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uBg;
uniform float uAngle;
uniform vec3 uPings[${PINGS}];
varying vec2 vPos;
void main() {
  float r = length(vPos);
  float edge = smoothstep(${R.toFixed(4)}, ${(R - 0.0012).toFixed(4)}, r);
  if (edge <= 0.) discard;
  float lines = 0.;
  for (int i = 1; i < 4; i++) lines += smoothstep(.0013, 0., abs(r - ${R.toFixed(4)} * float(i) / 4.)) * .3;
  lines += (smoothstep(.0008, 0., abs(vPos.x)) + smoothstep(.0008, 0., abs(vPos.y))) * .12;
  lines += smoothstep(.0035, 0., ${R.toFixed(4)} - r) * .9;
  float d = mod(atan(vPos.y, vPos.x) - uAngle, ${TAU.toFixed(5)}); // radians since the sweep passed
  float sweep = exp(-d * 2.4) * .5 + smoothstep(.0025, 0., d * r) * .8;
  float ping = 0.;
  for (int i = 0; i < ${PINGS}; i++) {
    vec3 p = uPings[i];
    if (p.z < 0. || p.z > ${PING_LIFE.toFixed(2)}) continue;
    float k = p.z / ${PING_LIFE.toFixed(2)};
    float dist = length(vPos - p.xy);
    float rad = .004 + k * .1;
    ping += (smoothstep(.0025, 0., abs(dist - rad)) + smoothstep(.0015, 0., abs(dist - rad * .6)) * .5) * (1. - k) * (1. - k);
    ping += smoothstep(.008, 0., dist) * pow(1. - k, 6.);
  }
  vec3 col = uBg * (1. + (1. - r / ${R.toFixed(4)}) * .5) + uColor * (lines + sweep + ping * 1.2);
  gl_FragColor = vec4(col, edge);
  #include <colorspace_fragment>
}`

type Blip = { x: number; y: number; vx: number; vy: number; flash: number; last: number }

function spawn(): Blip {
  const r = 0.015 + Math.sqrt(Math.random()) * (ROAM - 0.02)
  const a = Math.random() * TAU
  const h = Math.random() * TAU
  const v = 0.004 + Math.random() * 0.005
  // Start lit as if the sweep (angle 0, clockwise) had already been running, so a still preview isn't empty.
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: Math.cos(h) * v, vy: Math.sin(h) * v, flash: Math.exp(-0.55 * a), last: a }
}

/** 25 cm radar minimap: a sweep lights up drifting enemy blips; tap anywhere to send a sonar ping. */
export default function Minimap({ blips = 5, color = "#9FE7D2", blipColor = "#FF5A6A", sweepSpeed = 1.6, onPress }: Props) {
  const n = Math.max(0, Math.min(MAX_BLIPS, Math.round(blips)))
  const disc = useRef<Mesh>(null)
  const dots = useRef<InstancedMesh>(null)
  const st = useRef({ angle: 0, next: 0, t: 0 })
  const sfx = useRef<{ synth: Tone.Synth; echo: Tone.FeedbackDelay } | null>(null)
  const field = useMemo(() => Array.from({ length: n }, spawn), [n])
  const tmp = useMemo(() => ({ o: new Object3D(), c: new Color(), v: new Vector3() }), [])
  const tint = useMemo(() => new Color(blipColor), [blipColor])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new Color() },
          uBg: { value: new Color("#101218") },
          uAngle: { value: 0 },
          uPings: { value: Array.from({ length: PINGS }, () => new Vector3(0, 0, -1)) },
        },
      }),
    [],
  )
  useEffect(() => void material.uniforms.uColor.value.set(color), [material, color])
  useEffect(() => () => material.dispose(), [material])
  useEffect(
    () => () => {
      sfx.current?.synth.dispose()
      sfx.current?.echo.dispose()
      sfx.current = null
    },
    [],
  )

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.t += dt
    s.angle = (s.angle - sweepSpeed * dt) % TAU // clockwise
    material.uniforms.uAngle.value = s.angle
    for (const p of material.uniforms.uPings.value as Vector3[]) if (p.z >= 0 && p.z <= PING_LIFE) p.z += dt

    const m = dots.current
    if (!m) return
    for (let i = 0; i < n; i++) {
      const b = field[i]
      const turn = Math.sin(s.t * 0.6 + i * 1.7) * 0.6 * dt // slow wander
      const vx = b.vx * Math.cos(turn) - b.vy * Math.sin(turn)
      b.vy = b.vx * Math.sin(turn) + b.vy * Math.cos(turn)
      b.vx = vx
      b.x += b.vx * dt
      b.y += b.vy * dt
      const r = Math.hypot(b.x, b.y)
      const out = (b.x * b.vx + b.y * b.vy) / (r || 1)
      if (r > ROAM && out > 0) {
        b.vx -= (2 * out * b.x) / r
        b.vy -= (2 * out * b.y) / r
      }
      const d = (((Math.atan2(b.y, b.x) - s.angle) % TAU) + TAU) % TAU
      if (d < b.last - Math.PI) b.flash = 1 // wrapped: the sweep just crossed this blip
      b.last = d
      b.flash *= Math.exp(-dt * 0.9)
      tmp.o.position.set(b.x, b.y, 0)
      tmp.o.scale.setScalar(0.7 + b.flash * 0.5 + b.flash ** 8 * 0.8)
      tmp.o.updateMatrix()
      m.setMatrixAt(i, tmp.o.matrix)
      m.setColorAt(i, tmp.c.copy(tint).multiplyScalar(0.12 + b.flash * 1.1))
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  const tap = async (e: ThreeEvent<MouseEvent>) => {
    const d = disc.current
    if (!d) return
    const p = d.worldToLocal(tmp.v.copy(e.point))
    ;(material.uniforms.uPings.value as Vector3[])[st.current.next++ % PINGS].set(p.x, p.y, 0)
    onPress?.()
    await Tone.start()
    sfx.current ??= (() => {
      const echo = new Tone.FeedbackDelay({ delayTime: 0.17, feedback: 0.35, wet: 0.3 }).toDestination()
      const synth = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 0.3 }, volume: -12 }).connect(echo)
      return { synth, echo }
    })()
    const t = Tone.now()
    sfx.current.synth.triggerAttackRelease(1480, 0.6, t)
    sfx.current.synth.frequency.exponentialRampTo(1240, 0.5, t + 0.02)
  }

  return (
    <group>
      <mesh ref={disc} material={material} onClick={tap}>
        <planeGeometry args={[R * 2, R * 2]} />
      </mesh>
      <instancedMesh ref={dots} args={[undefined, undefined, MAX_BLIPS]} count={n} frustumCulled={false} position={[0, 0, 0.001]}>
        <circleGeometry args={[0.0042, 12]} />
        <meshBasicMaterial toneMapped={false} transparent blending={AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      {/* Player arrow: a 3-sided circle is a triangle; point it up and slim it. */}
      <mesh position={[0, 0, 0.002]} rotation={[0, 0, Math.PI / 2]} scale={[1, 0.7, 1]}>
        <circleGeometry args={[0.009, 3]} />
        <meshBasicMaterial color="#EEF0F4" toneMapped={false} />
      </mesh>
    </group>
  )
}
