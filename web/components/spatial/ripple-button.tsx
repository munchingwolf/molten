"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Color, ShaderMaterial, Vector2, Vector3, type Group } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { label?: string; color?: string; size?: number; onPress?: () => void }

const W = 0.16
const H = 0.056
const D = 0.016
const R = 0.014
const LIFE = 1.1 // seconds a ripple lives

// Face shader: up to 4 rings expand from where the button was touched, clipped to the rounded face.
const fragmentShader = /* glsl */ `
uniform vec3 uRipples[4];
uniform vec3 uColor;
uniform vec2 uSize;
uniform float uHover;
varying vec2 vPos;
float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
void main() {
  float d = box(vPos, uSize * .5, ${R.toFixed(3)});
  if (d > 0.) discard;
  float a = 0.;
  for (int i = 0; i < 4; i++) {
    vec3 r = uRipples[i];
    if (r.z < 0. || r.z > ${LIFE.toFixed(2)}) continue;
    float k = r.z / ${LIFE.toFixed(2)};
    float rad = .02 + k * .17;
    float dist = length(vPos - r.xy);
    float ring = 1. - smoothstep(0., .007, abs(dist - rad)) + (1. - smoothstep(0., .004, abs(dist - rad * .62))) * .5;
    a += (ring + (1. - smoothstep(0., rad, dist)) * .18) * (1. - k) * (1. - k);
  }
  float rim = smoothstep(-.004, 0., d) * (.25 + uHover * .6);
  gl_FragColor = vec4(uColor, clamp(a + rim, 0., 1.));
  #include <colorspace_fragment>
}`
const vertexShader = /* glsl */ `
varying vec2 vPos;
void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`

/** 16 × 5.6 cm button: every press sends rings rippling out from the exact touch point. */
export default function RippleButton({ label = "Ripple", color = "#9FE7D2", size = 1, onPress }: Props) {
  const body = useRef<Group>(null)
  const st = useRef({ hover: 0, target: 0, z: 0, zv: 0, down: false, next: 0 })
  const plate = useMemo(() => new RoundedBoxGeometry(W, H, D, 4, R - 0.002), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uRipples: { value: [0, 1, 2, 3].map(() => new Vector3(0, 0, -1)) },
          uColor: { value: new Color() },
          uSize: { value: new Vector2(W, H) },
          uHover: { value: 0 },
        },
      }),
    [],
  )
  useEffect(() => void material.uniforms.uColor.value.set(color), [material, color])
  useEffect(() => () => (plate.dispose(), material.dispose()), [plate, material])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    for (const r of material.uniforms.uRipples.value as Vector3[]) if (r.z >= 0 && r.z <= LIFE) r.z += dt
    s.hover += (s.target - s.hover) * (1 - Math.exp(-dt * 10))
    material.uniforms.uHover.value = s.hover
    const a = 400 * ((s.down ? -0.006 : 0) - s.z) - 22 * s.zv
    s.zv += a * dt
    s.z += s.zv * dt
    if (body.current) body.current.position.z = s.z
  })

  const near = (e: ThreeEvent<PointerEvent>) => {
    st.current.target = e.pointerType === "touch" ? Math.min(1, Math.max(0.3, 1.1 - e.distance * 9)) : 1
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const s = st.current
    s.down = true
    if (!body.current) return
    const p = body.current.worldToLocal(e.point.clone())
    const r = (material.uniforms.uRipples.value as Vector3[])[s.next++ % 4]
    r.set(Math.max(-W / 2, Math.min(W / 2, p.x)), Math.max(-H / 2, Math.min(H / 2, p.y)), 0)
  }
  const up = () => {
    st.current.down = false
  }

  return (
    <group scale={size}>
      <group ref={body}>
        <mesh geometry={plate}>
          <meshStandardMaterial color="#1A1D25" emissive="#15171E" roughness={0.5} metalness={0.1} />
        </mesh>
        <mesh material={material} position={[0, 0, D / 2 + 0.0005]}>
          <planeGeometry args={[W, H]} />
        </mesh>
        <group position={[0, 0, D / 2 + 0.0015]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={13} fontWeight="semi-bold" color="#EEF0F4">
              {label}
            </Text>
          </Container>
        </group>
      </group>
      <mesh
        visible={false}
        position={[0, 0, 0.002]}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => {
          st.current.target = 0
          up()
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => onPress?.()}
      >
        <boxGeometry args={[W, H, D + 0.008]} />
      </mesh>
    </group>
  )
}
