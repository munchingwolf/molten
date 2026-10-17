"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { Color, DoubleSide, SRGBColorSpace, ShaderMaterial, type Group } from "three"

type Props = { value?: string; onChange?: (hex: string) => void; label?: string; size?: number }

const R = 0.06 // 12 cm hue/saturation wheel
const BAR_H = 0.12
const BAR_W = 0.022
const WX = -0.03 // wheel centre x
const BX = 0.07 // lightness bar x

// Both shaders output sRGB directly (no colorspace include), so they match the hex values.
const vertexShader = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`
const hsl = /* glsl */ `vec3 hsl(float h, float s, float l) { vec3 c = clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); return l + s * (c - .5) * (1. - abs(2. * l - 1.)); }`
const wheelShader = /* glsl */ `
varying vec2 vUv;
${hsl}
void main() {
  vec2 p = vUv * 2. - 1.;
  float r = length(p);
  if (r > 1.) discard;
  gl_FragColor = vec4(hsl(fract(atan(p.y, p.x) / 6.28318 + 1.), r, .5), 1.);
}`
const barShader = /* glsl */ `
uniform float uH;
uniform float uS;
varying vec2 vUv;
${hsl}
void main() { gl_FragColor = vec4(hsl(uH, uS, vUv.y), 1.); }`

const toHex = (h: number, s: number, l: number) => "#" + new Color().setHSL(h, s, l, SRGBColorSpace).getHexString(SRGBColorSpace).toUpperCase()

/** 3D colour picker: drag on the 12 cm wheel for hue and saturation, on the bar for lightness; a glowing orb previews the colour. `value` is a hex string. */
export default function ColorPicker({ value, onChange, label = "Color", size = 1 }: Props) {
  const [hsla, setHsl] = useState(() => {
    const t = { h: 0, s: 0, l: 0 }
    new Color(value ?? "#9FE7D2").getHSL(t, SRGBColorSpace)
    return t
  })
  const emitted = useRef<string | undefined>(undefined)
  // Follow an outside `value`, but keep our own hue when the colour we emitted comes back (greys have no hue).
  useEffect(() => {
    if (value === undefined || value.toUpperCase() === emitted.current) return
    const t = { h: 0, s: 0, l: 0 }
    new Color(value).getHSL(t, SRGBColorSpace)
    setHsl(t)
  }, [value])
  const hex = toHex(hsla.h, hsla.s, hsla.l)

  const wheel = useMemo(() => new ShaderMaterial({ vertexShader, fragmentShader: wheelShader }), [])
  const bar = useMemo(() => new ShaderMaterial({ vertexShader, fragmentShader: barShader, uniforms: { uH: { value: 0 }, uS: { value: 0 } } }), [])
  useEffect(() => () => (wheel.dispose(), bar.dispose()), [wheel, bar])
  bar.uniforms.uH.value = hsla.h
  bar.uniforms.uS.value = hsla.s

  const root = useRef<Group>(null)
  const orb = useRef<Group>(null)
  const drag = useRef<"wheel" | "bar" | null>(null)
  const pop = useRef({ s: 1, v: 0 })

  useFrame(({ clock }, delta) => {
    const p = pop.current
    const dt = Math.min(delta, 1 / 30)
    p.v += (300 * (1 - p.s) - 14 * p.v) * dt
    p.s += p.v * dt
    if (orb.current) {
      orb.current.scale.setScalar(p.s)
      orb.current.position.z = 0.02 + 0.003 * Math.sin(clock.elapsedTime * 1.8)
    }
  })

  const update = (next: { h: number; s: number; l: number }) => {
    setHsl(next)
    const out = toHex(next.h, next.s, next.l)
    if (out === hex) return
    emitted.current = out
    pop.current.v += 0.6
    onChange?.(out)
  }
  const pick = (e: ThreeEvent<PointerEvent>) => {
    if (!root.current || !drag.current) return
    const p = root.current.worldToLocal(e.point.clone())
    if (drag.current === "wheel") {
      const x = (p.x - WX) / R
      const y = p.y / R
      update({ h: (Math.atan2(y, x) / (2 * Math.PI) + 1) % 1, s: Math.min(1, Math.hypot(x, y)), l: hsla.l })
    } else update({ ...hsla, l: Math.min(1, Math.max(0, p.y / BAR_H + 0.5)) })
  }
  const start = (which: "wheel" | "bar") => (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = which
    pick(e)
  }
  const end = () => {
    drag.current = null
  }
  const handlers = (which: "wheel" | "bar") => ({ onPointerDown: start(which), onPointerMove: pick, onPointerUp: end, onPointerCancel: end })

  const a = hsla.h * 2 * Math.PI
  return (
    <group scale={size}>
      <group ref={root}>
        {/* Bezel behind the wheel gives it a physical edge. */}
        <mesh position={[WX, 0, -0.004]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R + 0.006, R + 0.006, 0.006, 64]} />
          <meshStandardMaterial color="#15171E" emissive="#101218" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh material={wheel} position={[WX, 0, 0]}>
          <circleGeometry args={[R, 96]} />
        </mesh>
        <mesh position={[WX + Math.cos(a) * hsla.s * R, Math.sin(a) * hsla.s * R, 0.002]}>
          <ringGeometry args={[0.005, 0.0075, 32]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
        <mesh visible={false} position={[WX, 0, 0.002]} {...handlers("wheel")}>
          <boxGeometry args={[2 * R, 2 * R, 0.01]} />
        </mesh>

        <mesh position={[BX, 0, -0.004]}>
          <boxGeometry args={[BAR_W + 0.008, BAR_H + 0.008, 0.006]} />
          <meshStandardMaterial color="#15171E" emissive="#101218" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh material={bar} position={[BX, 0, 0]}>
          <planeGeometry args={[BAR_W, BAR_H]} />
        </mesh>
        <mesh position={[BX, (hsla.l - 0.5) * BAR_H, 0.003]}>
          <boxGeometry args={[BAR_W + 0.01, 0.004, 0.004]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh visible={false} position={[BX, 0, 0.002]} {...handlers("bar")}>
          <boxGeometry args={[BAR_W + 0.012, BAR_H + 0.01, 0.01]} />
        </mesh>

        {/* Preview orb + hex readout under the wheel. */}
        <group position={[WX - 0.03, -R - 0.03, 0]}>
          <group ref={orb} position={[0, 0, 0.02]}>
            <mesh>
              <sphereGeometry args={[0.013, 32, 16]} />
              <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={0.45} roughness={0.25} metalness={0.1} />
            </mesh>
          </group>
          <group position={[0.024, 0, 0]}>
            <Container pixelSize={0.002} anchorX="left" pointerEvents="none" flexDirection="column">
              <Text fontSize={9} color="#9AA0AD">
                {label}
              </Text>
              <Text fontSize={12} fontWeight="semi-bold" color="#EEF0F4">
                {hex}
              </Text>
            </Container>
          </group>
        </group>
      </group>
    </group>
  )
}

