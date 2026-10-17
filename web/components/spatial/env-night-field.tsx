"use client"

import { Suspense, useLayoutEffect, useRef } from "react"
import type { Group } from "three"
import { Environment } from "@react-three/drei"

type Props = { intensity?: number }

// CC0 photo by Poly Haven (polyhaven.com/a/moonless_golf). Copying this file? Put the 2k .hdr in public/hdri/.
const SRC = "/hdri/moonless_golf_2k.hdr"
// The photo is projected onto a flat floor at y = 0; height ≈ the camera height it was shot from.
const GROUND = { height: 1.7, radius: 45, scale: 100 }

/** Flat field at night: starry sky, town glow on the horizon. */
export default function EnvNightField({ intensity = 1 }: Props) {
  return (
    <>
      <hemisphereLight args={["#6d7fa8", "#141a16", 0.7 * intensity]} />
      <directionalLight position={[-3, 6, 4]} intensity={0.6 * intensity} />
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
