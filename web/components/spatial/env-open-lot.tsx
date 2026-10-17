"use client"

import { Suspense, useLayoutEffect, useRef } from "react"
import type { Group } from "three"
import { Environment } from "@react-three/drei"

type Props = { intensity?: number; /** Override the photo, e.g. a self-hosted copy. */ src?: string }

// CC0 photo by Poly Haven (polyhaven.com/a/driving_school), streamed from their CORS-enabled CDN so this file works when copied anywhere.
const SRC = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/driving_school_2k.hdr"
// The photo is projected onto a flat floor at y = 0; height ≈ the camera height it was shot from.
const GROUND = { height: 1.7, radius: 45, scale: 100 }

/** Empty, flat open lot under a big cloudy sky: lots of room to build. */
export default function EnvOpenLot({ intensity = 1, src = SRC }: Props) {
  return (
    <>
      <hemisphereLight args={["#dfe8f3", "#8d8a84", 1 * intensity]} />
      <directionalLight position={[3, 9, -2]} intensity={1.5 * intensity} />
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
