"use client"

import { Suspense, useLayoutEffect, useRef } from "react"
import type { Group } from "three"
import { Environment } from "@react-three/drei"

type Props = { intensity?: number; /** Override the photo, e.g. the CDN copy when this file is used outside Spatial. */ src?: string }

// CC0 photo by Poly Haven (polyhaven.com/a/sunset_forest), self-hosted in web/public/hdri.
// Outside Spatial pass src="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/sunset_forest_1k.hdr".
const SRC = "/hdri/sunset_forest_1k.hdr"
// The photo is projected onto a flat floor at y = 0; height ≈ the camera height it was shot from.
const GROUND = { height: 1.7, radius: 45, scale: 100 }

/** Forest clearing lit by a low orange sun. */
export default function EnvSunsetForest({ intensity = 1, src = SRC }: Props) {
  return (
    <>
      <hemisphereLight args={["#ffcf9a", "#4a5a30", 0.9 * intensity]} />
      <directionalLight position={[-5, 8, -4]} intensity={1.8 * intensity} />
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
