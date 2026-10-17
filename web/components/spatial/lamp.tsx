"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Color, DoubleSide, MathUtils, type MeshBasicMaterial, type MeshStandardMaterial, type PointLight } from "three"

type Props = { value?: boolean; onChange?: (on: boolean) => void; color?: string; intensity?: number }

const LED_OFF = new Color("#323745")
const LED_ON = new Color("#9FE7D2")

/** 40 cm table lamp with a real point light. Press it (poke, pinch or click) to switch it on or off. Controlled via `value`, or uncontrolled. */
export default function Lamp({ value, onChange, color = "#FFD2A1", intensity = 1 }: Props) {
  const [inner, setInner] = useState(true)
  const [hover, setHover] = useState(false)
  const on = value ?? inner
  const level = useRef(on ? 1 : 0)
  const light = useRef<PointLight>(null)
  const bulb = useRef<MeshStandardMaterial>(null)
  const shade = useRef<MeshStandardMaterial>(null)
  const led = useRef<MeshBasicMaterial>(null)

  const toggle = () => {
    if (value === undefined) setInner(!on)
    onChange?.(!on)
  }

  // Fade instead of snapping; the light stays mounted so toggling never recompiles shaders.
  useFrame((_, dt) => {
    level.current = MathUtils.damp(level.current, on ? 1 : 0, 12, Math.min(dt, 0.1))
    const l = level.current
    const k = Math.max(0, intensity)
    if (light.current) light.current.intensity = l * 2.5 * k
    if (bulb.current) bulb.current.emissiveIntensity = l * 3 * Math.max(0.3, k)
    if (shade.current) shade.current.emissiveIntensity = l * 0.55 * Math.max(0.3, k) + (hover ? 0.06 : 0)
    led.current?.color.copy(LED_OFF).lerp(LED_ON, l)
  })

  return (
    <group
      onClick={toggle}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Weighted base */}
      <mesh position={[0, -0.19, 0]}>
        <cylinderGeometry args={[0.078, 0.085, 0.02, 48]} />
        <meshStandardMaterial color="#1B1E26" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* State LED on the base, readable without hover (Quest hands have none). */}
      <mesh position={[0, -0.1795, 0.052]}>
        <cylinderGeometry args={[0.006, 0.006, 0.002, 16]} />
        <meshBasicMaterial ref={led} color={LED_OFF} toneMapped={false} />
      </mesh>
      {/* Stem with brass collars */}
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.0055, 0.0055, 0.28, 12]} />
        <meshStandardMaterial color="#2A2F3A" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.174, 0]}>
        <cylinderGeometry args={[0.012, 0.014, 0.012, 24]} />
        <meshStandardMaterial color="#F2B48A" metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.088, 0]}>
        <cylinderGeometry args={[0.013, 0.011, 0.026, 24]} />
        <meshStandardMaterial color="#F2B48A" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* Bulb */}
      <mesh position={[0, 0.118, 0]}>
        <sphereGeometry args={[0.026, 24, 16]} />
        <meshStandardMaterial ref={bulb} color="#FFF8EE" emissive={color} emissiveIntensity={0} roughness={0.2} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0.118, 0]} color={color} intensity={0} distance={4} decay={2} />
      {/* Fabric drum shade, lit from inside */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.078, 0.11, 0.14, 48, 1, true]} />
        <meshStandardMaterial ref={shade} color="#EDE6DA" emissive={color} emissiveIntensity={0} roughness={0.9} side={DoubleSide} />
      </mesh>
      {/* Thin rims keep the shade edge crisp */}
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.078, 0.0018, 6, 48]} />
        <meshStandardMaterial color="#F2B48A" metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.11, 0.0018, 6, 48]} />
        <meshStandardMaterial color="#F2B48A" metalness={0.4} roughness={0.3} />
      </mesh>
    </group>
  )
}
