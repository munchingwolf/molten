"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { Box3, Mesh, PMREMGenerator, Vector3, type Group, type Material, type Object3D, type Texture } from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { Container, Text } from "@react-three/uikit"

type Props = { url?: string; label?: string; autoRotate?: boolean; color?: string }

const SAMPLE = "https://modelviewer.dev/shared-assets/models/Astronaut.glb"
const FIT = 0.28 // the model is scaled to fit a 28 cm cube
const PED = 0.15 // pedestal radius
const BASE_Y = -FIT / 2 - 0.02 // pedestal top
const SPIN = 12 // radians per metre of horizontal drag
const IDLE = 0.35 // auto-rotate speed, rad/s

function disposeTree(root: Object3D) {
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    o.geometry.dispose()
    for (const m of ([] as Material[]).concat(o.material)) {
      for (const [k, v] of Object.entries(m)) if (k !== "envMap" && v && (v as Texture).isTexture) (v as Texture).dispose() // envMap is ours, shared
      m.dispose()
    }
  })
}

/** Turntable for any GLB (`url`). Grab and drag sideways to spin it, let go and it coasts. Lit by its own environment map, so it looks right in any scene. */
export default function ModelViewer({ url = SAMPLE, label = "Astronaut", autoRotate = true, color = "#9FE7D2" }: Props) {
  const gl = useThree((s) => s.gl)
  const [env, setEnv] = useState<Texture | null>(null)
  const [model, setModel] = useState<Object3D | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [hover, setHover] = useState(false)
  const [grabbing, setGrabbing] = useState(false)
  const turn = useRef<Group>(null)
  const base = useRef<Group>(null)
  const spin = useRef({ vel: autoRotate ? IDLE : 0, lastX: 0, lastT: 0 })

  // Image-based light for this model only (scene.environment would relight everyone else's components).
  useEffect(() => {
    const pm = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const rt = pm.fromScene(room, 0.04)
    room.dispose()
    pm.dispose()
    setEnv(rt.texture)
    return () => {
      setEnv(null)
      rt.dispose()
    }
  }, [gl])

  useEffect(() => {
    let alive = true
    let loaded: Object3D | null = null
    setModel(null)
    setStatus("loading")
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (!alive) return disposeTree(gltf.scene)
        const obj = gltf.scene
        const box = new Box3().setFromObject(obj)
        const size = box.getSize(new Vector3())
        const center = box.getCenter(new Vector3())
        const s = FIT / (Math.max(size.x, size.y, size.z) || 1)
        obj.scale.setScalar(s)
        obj.position.set(-center.x * s, BASE_Y - box.min.y * s, -center.z * s) // centred, standing on the pedestal
        loaded = obj
        setModel(obj)
        setStatus("ready")
      },
      undefined,
      () => alive && setStatus("error"),
    )
    return () => {
      alive = false
      if (loaded) disposeTree(loaded)
    }
  }, [url])

  useEffect(() => {
    if (!model || !env) return
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return
      for (const m of ([] as Material[]).concat(o.material)) {
        if ("envMap" in m) {
          ;(m as Material & { envMap: Texture | null }).envMap = env
          m.needsUpdate = true
        }
      }
    })
  }, [model, env])

  const localX = (e: ThreeEvent<PointerEvent>) => (base.current ? base.current.worldToLocal(e.point.clone()).x : 0)
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    spin.current = { vel: 0, lastX: localX(e), lastT: performance.now() }
    setGrabbing(true)
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!grabbing || !turn.current) return
    const x = localX(e)
    const now = performance.now()
    const s = spin.current
    const d = (x - s.lastX) * SPIN
    turn.current.rotation.y += d
    const dt = Math.max(0.001, (now - s.lastT) / 1000)
    s.vel = s.vel * 0.5 + (d / dt) * 0.5 // smoothed, so release speed isn't one noisy sample
    s.lastX = x
    s.lastT = now
  }
  const up = () => setGrabbing(false)

  useFrame((state, delta) => {
    const g = turn.current
    if (!g || grabbing) return
    const dt = Math.min(delta, 0.05)
    const s = spin.current
    s.vel += ((autoRotate ? IDLE : 0) - s.vel) * (1 - Math.exp(-dt * 1.5)) // coast back to idle speed
    g.rotation.y += s.vel * dt
    if (Math.abs(s.vel - (autoRotate ? IDLE : 0)) > 0.01) state.invalidate() // finish a fling in demand mode; idle spin needs a live canvas
  })

  const active = hover || grabbing
  return (
    <group>
      <group ref={base}>
        <mesh position={[0, BASE_Y - 0.012, 0]}>
          <cylinderGeometry args={[PED, PED * 1.04, 0.024, 64]} />
          <meshStandardMaterial color="#1B1E26" metalness={0.6} roughness={0.35} envMap={env} />
        </mesh>
        <mesh position={[0, BASE_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[PED - 0.004, 0.0025, 8, 96]} />
          <meshBasicMaterial color={active ? color : "#3A3F4E"} toneMapped={false} />
        </mesh>
        <group ref={turn}>
          {/* Platter marks turn with the model, so the spin reads even on a symmetric model. */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} position={[Math.sin((i * Math.PI) / 3) * (PED - 0.022), BASE_Y + 0.001, Math.cos((i * Math.PI) / 3) * (PED - 0.022)]}>
              <boxGeometry args={[0.006, 0.002, 0.006]} />
              <meshBasicMaterial color="#6B7180" />
            </mesh>
          ))}
          {model ? (
            <primitive object={model} />
          ) : (
            <mesh position={[0, BASE_Y + 0.12, 0]}>
              <torusKnotGeometry args={[0.06, 0.02, 160, 24]} />
              <meshStandardMaterial color={color} metalness={0.3} roughness={0.25} envMap={env} />
            </mesh>
          )}
        </group>
        {/* Grab volume around the model (34 × 34 × 34 cm). */}
        <mesh
          visible={false}
          position={[0, BASE_Y + FIT / 2, 0]}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerOver={() => setHover(true)}
          onPointerOut={() => setHover(false)}
        >
          <boxGeometry args={[FIT + 0.06, FIT + 0.06, FIT + 0.06]} />
        </mesh>
      </group>
      <group position={[0, BASE_Y - 0.06, PED]}>
        <Container pixelSize={0.002} pointerEvents="none" flexDirection="column" alignItems="center" gap={2}>
          <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4">
            {label}
          </Text>
          <Text fontSize={10} color={status === "error" ? "#F2B48A" : active ? color : "#9AA0AD"}>
            {status === "loading" ? "Loading model" : status === "error" ? "Model unavailable" : "Drag to spin"}
          </Text>
        </Container>
      </group>
    </group>
  )
}
