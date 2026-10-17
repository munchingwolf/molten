"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, type Group } from "three"

type Props = { label?: string; color?: string; size?: number; onPress?: () => void }

const W = 0.16
const H = 0.056

// Iridescent face: hue follows the viewing angle, so the shimmer shifts as your head moves.
const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vView;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vView = normalize(cameraPosition - wp.xyz);
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uHover;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vView;
varying vec3 vNormal;
vec3 hue(float h) { return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
void main() {
  vec2 p = (vUv - .5) * vec2(${W}, ${H});
  float d = box(p, vec2(${W / 2}, ${H / 2}), .014);
  if (d > 0.) discard;
  float fres = 1. - abs(dot(vView, vNormal));
  vec3 iri = hue(fract(vView.x * 1.6 + vView.y * 1.1 + (vUv.x + vUv.y) * .35 + uTime * .03));
  float lines = .5 + .5 * sin((vUv.y * ${H} + uTime * .004) * 1400.);
  float sweep = (1. - smoothstep(0., .06, abs(fract(uTime * .4) * 1.8 - .4 - (vUv.x + vUv.y * .3)))) * (.25 + uHover);
  float rim = smoothstep(-.003, 0., d);
  vec3 col = mix(uColor, iri, .6) * (.3 + .15 * lines + .7 * fres + .35 * uHover) + sweep + rim * uColor;
  gl_FragColor = vec4(col, clamp(.45 + .3 * fres + .25 * uHover + rim, 0., 1.));
  #include <colorspace_fragment>
}`

/** 16 x 5.6 cm hologram button: an iridescent sheet whose shimmer shifts with your head angle; brightens and sweeps on hover. */
export default function HoloButton({ label = "Holo", color = "#9FE7D2", size = 1, onPress }: Props) {
  const sheet = useRef<Group>(null)
  const st = useRef({ hover: 0, target: 0, z: 0, zv: 0, down: false, flash: 0 })
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uHover: { value: 0 }, uColor: { value: new Color() } },
      }),
    [],
  )
  useEffect(() => void material.uniforms.uColor.value.set(color), [material, color])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.flash = Math.max(0, s.flash - dt * 3)
    s.hover += (Math.max(s.target, s.flash) - s.hover) * (1 - Math.exp(-dt * 10))
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uHover.value = s.hover
    const rest = s.down ? -0.006 : 0.003 * Math.sin(clock.elapsedTime * 1.6) // idle float of ±3 mm
    s.zv += (380 * (rest - s.z) - 20 * s.zv) * dt
    s.z += s.zv * dt
    if (sheet.current) sheet.current.position.z = 0.012 + s.z
  })

  const near = (e: ThreeEvent<PointerEvent>) => {
    st.current.target = e.pointerType === "touch" ? Math.min(1, Math.max(0.3, 1.1 - e.distance * 9)) : 1
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    st.current.down = true
  }
  const up = () => {
    st.current.down = false
  }

  return (
    <group scale={size}>
      {/* Emitter base the hologram floats above. */}
      <mesh position={[0, 0, -0.004]}>
        <boxGeometry args={[W * 0.92, H * 0.85, 0.006]} />
        <meshStandardMaterial color="#101218" emissive="#101218" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, -H * 0.36, 0.0001]}>
        <planeGeometry args={[W * 0.6, 0.0015]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <group ref={sheet} position={[0, 0, 0.012]}>
        <mesh material={material}>
          <planeGeometry args={[W, H]} />
        </mesh>
        <group position={[0, 0, 0.001]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={13} fontWeight="semi-bold" letterSpacing={1} color="#F4FFFB">
              {label}
            </Text>
          </Container>
        </group>
      </group>
      <mesh
        visible={false}
        position={[0, 0, 0.006]}
        onPointerOver={near}
        onPointerMove={near}
        onPointerOut={() => {
          st.current.target = 0
          up()
        }}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          st.current.flash = 1.4
          onPress?.()
        }}
      >
        <boxGeometry args={[W, H, 0.022]} />
      </mesh>
    </group>
  )
}
