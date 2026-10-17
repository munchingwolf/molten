"use client"

import { Environment, Lightformer } from "@react-three/drei"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => {}

/**
 * Bright, seamless photo-studio backdrop: a soft grey floor that fades into an off-white wall in every direction.
 * Calm and neutral, so the components carry the colour. Built in code: no downloads.
 */
export default function EnvLightStudio({ intensity = 1, tint = "#F3F4F6" }: Props) {
  return (
    <>
      <color attach="background" args={[tint]} />
      {/* Fog in the backdrop colour hides the floor's edge, so floor and wall read as one sweep. */}
      <fog attach="fog" args={[tint, 10, 38]} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001} raycast={noRay}>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#E4E6EA" roughness={0.95} />
      </mesh>
      <hemisphereLight args={["#ffffff", "#d5d8de", 1.1 * intensity]} />
      <directionalLight position={[3, 7, 2]} intensity={1.3 * intensity} />
      {/* Softbox reflections for glossy and glass components, rendered locally. */}
      <Environment resolution={128} environmentIntensity={intensity}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -4]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-5, 2, 1]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[5, 2, 1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="circle" intensity={2} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={4} />
      </Environment>
    </>
  )
}
