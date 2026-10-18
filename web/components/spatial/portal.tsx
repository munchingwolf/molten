"use client"

import { useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, type Group } from "three"
import { Text } from "@react-three/drei"

type Props = {
  /** Scene to go to: its name, a number (1 = first), "next" or "back". */
  to?: string
  label?: string
  color?: string
  onPress?: (to: string) => void
}

const W = 1.0 // doorway width, metres
const H = 2.1 // doorway height

/**
 * A walk-through doorway to another scene: a stone-grey arch filled with a swirling energy surface. Tap or poke the
 * surface and it surges, then fires `window.dispatchEvent(new CustomEvent("spatial:go", { detail: { to } }))`, which the
 * Studio (Play mode) and launched apps use to switch scenes. Origin at the floor, centre of the doorway.
 */
export default function Portal({ to = "next", label = "Enter", color = "#7C9CFF", onPress }: Props) {
  const [hover, setHover] = useState(false)
  const surge = useRef(0)
  const root = useRef<Group>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: { t: { value: 0 }, tint: { value: new Color(color) }, boost: { value: 0 } },
        vertexShader: "varying vec2 v; void main(){ v = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        // A slow spiral of light that brightens toward the rim; `boost` floods it when tapped.
        fragmentShader: `uniform float t; uniform vec3 tint; uniform float boost; varying vec2 v;
          void main(){
            vec2 p = (v - 0.5) * vec2(1.0, 2.1);
            float r = length(p); float a = atan(p.y, p.x);
            float swirl = 0.5 + 0.5 * sin(a * 4.0 + r * 14.0 - t * 2.2);
            float rim = smoothstep(0.15, 0.75, r);
            float glow = (0.18 + 0.55 * swirl * rim) * (1.0 + boost * 2.5);
            gl_FragColor = vec4(tint * glow, glow);
          }`,
      }),
    [color],
  )

  useFrame((state, dt) => {
    mat.uniforms.t.value = state.clock.elapsedTime
    surge.current = Math.max(0, surge.current - Math.min(dt, 0.05) * 1.6)
    mat.uniforms.boost.value = surge.current + (hover ? 0.25 : 0)
    if (root.current) root.current.scale.setScalar(1 + surge.current * 0.04)
    state.invalidate()
  })

  const go = () => {
    surge.current = 1
    window.dispatchEvent(new CustomEvent("spatial:go", { detail: { to } }))
    onPress?.(to)
  }

  return (
    <group ref={root}>
      {/* Arch: two posts and a lintel with a slight bevel. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 + 0.06), H / 2, 0]}>
          <boxGeometry args={[0.12, H, 0.24]} />
          <meshStandardMaterial color="#5E626C" roughness={0.75} metalness={0.1} />
        </mesh>
      ))}
      <mesh position={[0, H + 0.07, 0]}>
        <boxGeometry args={[W + 0.36, 0.14, 0.26]} />
        <meshStandardMaterial color="#5E626C" roughness={0.75} metalness={0.1} />
      </mesh>
      {/* Accent strips on the inner faces. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 + 0.001), H / 2, 0]} rotation-y={s * (Math.PI / 2)}>
          <planeGeometry args={[0.2, H - 0.1]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      ))}
      <mesh
        position={[0, H / 2, 0]}
        material={mat}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onClick={go}
      >
        <planeGeometry args={[W, H]} />
      </mesh>
      <Text position={[0, H + 0.3, 0.14]} fontSize={0.12} color="#EEF0F4" anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  )
}
