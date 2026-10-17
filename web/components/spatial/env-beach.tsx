"use client"

import { Suspense, useLayoutEffect, useRef } from "react"
import type { Group } from "three"
import { Environment } from "@react-three/drei"

type Props = { intensity?: number }

// CC0 photo by Poly Haven (polyhaven.com/a/spiaggia_di_mondello). Copying this file? Put the 2k .hdr in public/hdri/.
const SRC = "/hdri/spiaggia_di_mondello_2k.hdr"
// The photo is projected onto a flat floor at y = 0; height ≈ the camera height it was shot from.
const GROUND = { height: 1.7, radius: 45, scale: 100 }

/** Wide, flat sand beach on a clear morning, sea on the horizon. */
export default function EnvBeach({ intensity = 1 }: Props) {
  return (
    <>
      <hemisphereLight args={["#cfe4ff", "#d8c49c", 0.9 * intensity]} />
      <directionalLight position={[-5, 8, -4]} intensity={1.8 * intensity} />
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
