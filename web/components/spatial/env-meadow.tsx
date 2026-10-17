"use client"

import { Suspense, useLayoutEffect, useRef } from "react"
import type { Group } from "three"
import { Environment } from "@react-three/drei"

type Props = { intensity?: number; /** Override the photo, e.g. a self-hosted copy. */ src?: string }

// CC0 photo by Poly Haven (polyhaven.com/a/noon_grass), streamed from their CORS-enabled CDN so this file works when copied anywhere.
const SRC = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/noon_grass_2k.hdr"
// The photo is projected onto a flat floor at y = 0; height ≈ the camera height it was shot from.
const GROUND = { height: 1.7, radius: 45, scale: 100 }

/** Sunny, flat meadow under a clear midday sky. */
export default function EnvMeadow({ intensity = 1, src = SRC }: Props) {
  return (
    <>
      <hemisphereLight args={["#dcebff", "#6f8f45", 0.9 * intensity]} />
      <directionalLight position={[4, 9, 3]} intensity={1.8 * intensity} />
      <Suspense fallback={null}>
        <Photo intensity={intensity} src={src} />
      </Suspense>
    </>
  )
}

function Photo({ intensity, src }: { intensity: number; src: string }) {
  const ref = useRef<Group>(null)
  // Environment meshes never take pointer rays, so hands and rays reach the components.
  useLayoutEffect(() => ref.current?.traverse((o) => void (o.raycast = () => {})), [])
  return (
    <group ref={ref}>
      <Environment files={src} ground={GROUND} environmentIntensity={intensity} />
    </group>
  )
}
