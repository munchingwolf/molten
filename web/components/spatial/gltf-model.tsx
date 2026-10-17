"use client"

import { useMemo } from "react"
import { useLoader } from "@react-three/fiber"
import { Box3, Vector3 } from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

type Props = {
  /** URL of a .glb / self-contained .gltf */
  url?: string
  /** Size of the model's longest side, in metres (0 = keep the file's own scale). */
  size?: number
}

// A small built-in sample so the component renders with no props.
const SAMPLE = "https://modelviewer.dev/shared-assets/models/Astronaut.glb"

/** Any glTF model as an editable object: centred on the origin and scaled to `size` so it drops cleanly into a scene. */
export default function GltfModel({ url = SAMPLE, size = 1 }: Props) {
  const gltf = useLoader(GLTFLoader, url)
  const { scene, scale, offset } = useMemo(() => {
    const scene = gltf.scene.clone(true)
    const box = new Box3().setFromObject(scene)
    const dims = box.getSize(new Vector3())
    const longest = Math.max(dims.x, dims.y, dims.z) || 1
    const scale = size > 0 ? size / longest : 1
    const centre = box.getCenter(new Vector3())
    return { scene, scale, offset: centre.multiplyScalar(-1) }
  }, [gltf, size])
  return (
    <group scale={scale}>
      <primitive object={scene} position={offset} />
    </group>
  )
}
