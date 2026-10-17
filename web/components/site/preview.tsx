"use client"

import { Canvas } from "@react-three/fiber"
import { components } from "@/lib/registry"

/** Live 3D render of a registry component. One WebGL context per preview. */
// shortcut: one Canvas per card, browsers cap ~16 live contexts; switch to drei <View> if a page shows more.
export function Preview({ name, interactive = false }: { name: string; interactive?: boolean }) {
  const Component = components[name]
  if (!Component) return <Placeholder />
  return (
    <Canvas
      camera={{ position: [0, 0, 2.1], fov: 35 }}
      gl={{ antialias: true, localClippingEnabled: true }}
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      frameloop={interactive ? "always" : "demand"}
    >
      <color attach="background" args={["#111214"]} />
      <Component />
    </Canvas>
  )
}

export function Placeholder({ label = "Coming soon" }: { label?: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-stage font-mono text-xs text-stage-text/50">{label}</div>
  )
}
