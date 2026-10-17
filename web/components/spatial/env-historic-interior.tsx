"use client"

import { Suspense, useLayoutEffect, useRef } from "react"
import type { Group } from "three"
import { Environment } from "@react-three/drei"

type Props = { intensity?: number; /** Override the photo, e.g. the CDN copy when this file is used outside Spatial. */ src?: string }

// CC0 photo by Poly Haven (polyhaven.com/a/st_fagans_interior), self-hosted in web/public/hdri.
// Outside Spatial pass src="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/st_fagans_interior_1k.hdr".
const SRC = "/hdri/st_fagans_interior_1k.hdr"
// The photo is projected onto a flat floor at y = 0; height ≈ the camera height it was shot from.
const GROUND = { height: 1.6, radius: 14, scale: 40 }

/** Old stone and timber interior with daylight through small windows. */
export default function EnvHistoricInterior({ intensity = 1, src = SRC }: Props) {
  return (
    <>
      <hemisphereLight args={["#ffe6c8", "#5a4632", 0.9 * intensity]} />
      <directionalLight position={[-5, 8, -4]} intensity={1.2 * intensity} />
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
