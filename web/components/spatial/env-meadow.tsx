"use client"

import { Suspense, useLayoutEffect, useRef } from "react"
import type { Group } from "three"
import { Environment } from "@react-three/drei"

type Props = { intensity?: number }

// CC0 photo by Poly Haven (polyhaven.com/a/noon_grass). Copying this file? Put the 2k .hdr in public/hdri/.
const SRC = "/hdri/noon_grass_2k.hdr"
// The photo is projected onto a flat floor at y = 0; height ≈ the camera height it was shot from.
const GROUND = { height: 1.7, radius: 45, scale: 100 }

/** Sunny, flat meadow under a clear midday sky. */
export default function EnvMeadow({ intensity = 1 }: Props) {
  return (
    <>
      <hemisphereLight args={["#dcebff", "#6f8f45", 0.9 * intensity]} />
      <directionalLight position={[4, 9, 3]} intensity={1.8 * intensity} />
      <Suspense fallback={null}>
        <Photo intensity={intensity} />
      </Suspense>
    </>
  )
}

function Photo({ intensity }: { intensity: number }) {
  const ref = useRef<Group>(null)
  // Environment meshes never take pointer rays, so hands and rays reach the components.
  useLayoutEffect(() => ref.current?.traverse((o) => void (o.raycast = () => {})), [])
  return (
    <group ref={ref}>
      <Environment files={SRC} ground={GROUND} environmentIntensity={intensity} />
    </group>
  )
}
