// Ported from pmndrs/examples "image-gallery" (MIT, © 2024 Poimandres) and refined for Spatial.
"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Image as Artwork, MeshReflectorMaterial, Text } from "@react-three/drei"

type Props = {
  images?: string[]
  titles?: string[]
  artists?: string[]
  /** Focused artwork index, -1 = none */
  value?: number
  onChange?: (index: number) => void
  /** Mirror-like floor (one extra render pass); off = plain floor */
  reflective?: boolean
  accent?: string
}

const GOLDENRATIO = 1.61803398875
const SAMPLE = [1011, 1025, 1035, 1040, 1062].map((id) => `https://picsum.photos/id/${id}/600/960`)
const TITLES = ["Morning Study", "Field Notes", "The Long Light", "Quiet Hours", "After Rain"]
const ARTISTS = ["Mara Okafor, 2021", "Lena Varga, 2019", "Sami Moreau, 2023", "Aiko Lindqvist, 2020", "Theo Tanaka, 2022"]
const C = { frame: "#1A1C22", surface: "#1B1E26", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", dark: "#101218", floor: "#0D0E12" }
const W = 0.22 // frame width, metres
const H = W * GOLDENRATIO
const D = 0.012
const FLOOR = -0.3
const ARC = 0.95 // the frames stand on an arc that wraps toward the viewer
const FOCUS: [number, number, number] = [0, 0.05, 0.3]
const FOCUS_SCALE = 1.5
const damp = THREE.MathUtils.damp

/** Loads without suspending, so one bad URL shows a placeholder instead of taking down the scene. */
function useImage(url: string) {
  const [state, setState] = useState<{ tex: THREE.Texture | null; failed: boolean }>({ tex: null, failed: false })
  useEffect(() => {
    let alive = true
    let loaded: THREE.Texture | null = null
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (!alive) return t.dispose()
        t.colorSpace = THREE.SRGBColorSpace
        loaded = t
        setState({ tex: t, failed: false })
      },
      undefined,
      () => alive && setState({ tex: null, failed: true }),
    )
    return () => {
      alive = false
      loaded?.dispose()
      setState({ tex: null, failed: false })
    }
  }, [url])
  return state
}

/** Damped spring step (k 170, c 15): overshoots a little, which reads as springy. */
function spring(x: number, v: number, to: number, dt: number): [number, number] {
  v += ((to - x) * 170 - v * 15) * dt
  return [x + v * dt, v]
}

/** Framed artworks on a reflective floor. Tap a frame to bring it forward with its title and artist; tap it again, the close button or anywhere else to hang it back. */
export default function ImageGallery({
  images = SAMPLE,
  titles = TITLES,
  artists = ARTISTS,
  value,
  onChange,
  reflective = true,
  accent = "#9FE7D2",
}: Props) {
  const n = images.length
  const [inner, setInner] = useState(-1)
  const focus = Math.round(value ?? inner)
  const [hover, setHover] = useState(-1)
  const set = (i: number) => {
    if (value === undefined) setInner(i)
    onChange?.(i)
  }
  const da = (W + 0.06) / ARC

  // R3F hands an event to every frame under the ray; only the nearest frame acts (no stopPropagation, the Studio needs the bubble).
  const nearest = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const hit = e.intersections.find((h) => h.object.userData.frame !== undefined)
    return hit ? (hit.object.userData.frame as number) : -1
  }

  return (
    <group
      onPointerMove={(e) => setHover(nearest(e))}
      onPointerOut={() => setHover(-1)}
      onPointerMissed={() => focus >= 0 && set(-1)}
    >
      {images.map((url, i) => {
        const a = (i - (n - 1) / 2) * da
        return (
          <Frame
            key={`${i}-${url}`}
            url={url}
            index={i}
            title={titles[i] ?? `Untitled ${i + 1}`}
            artist={artists[i] ?? ""}
            base={[ARC * Math.sin(a), FLOOR + H / 2 + 0.012, ARC * (1 - Math.cos(a)) - 0.12]}
            angle={-a}
            focused={focus === i}
            dimmed={focus >= 0 && focus !== i}
            hovered={hover === i}
            accent={accent}
            onPress={(e) => {
              if (nearest(e) === i) set(focus === i ? -1 : i)
            }}
            onClose={() => set(-1)}
          />
        )
      })}
      {/* Elliptical stage floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, 0]} scale={[1.3, 0.62, 1]}>
        <circleGeometry args={[0.5, 64]} />
        {reflective ? (
          <MeshReflectorMaterial
            resolution={512}
            blur={[200, 80]}
            mixBlur={1}
            mixStrength={6}
            roughness={1}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color={C.floor}
            metalness={0.5}
          />
        ) : (
          <meshStandardMaterial color={C.floor} roughness={0.9} />
        )}
      </mesh>
    </group>
  )
}

type FrameProps = {
  url: string
  index: number
  title: string
  artist: string
  base: [number, number, number]
  angle: number
  focused: boolean
  dimmed: boolean
  hovered: boolean
  accent: string
  onPress: (e: ThreeEvent<MouseEvent>) => void
  onClose: () => void
}

type ImageMat = THREE.ShaderMaterial & { zoom: number; color: THREE.Color }

function Frame({ url, index, title, artist, base, angle, focused, dimmed, hovered, accent, onPress, onClose }: FrameProps) {
  const { tex, failed } = useImage(url)
  const group = useRef<THREE.Group>(null)
  const image = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const sim = useRef({ x: base[0], y: base[1], z: base[2], r: angle, s: 1, vx: 0, vy: 0, vz: 0, vr: 0, vs: 0, light: 1 })
  const [rnd] = useState(() => (index * 0.618) % 1)
  const color = new THREE.Color()

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 1 / 30)
    const q = sim.current
    const to = focused ? FOCUS : [base[0], base[1], base[2] + (dimmed ? -0.05 : hovered ? 0.012 : 0)]
    ;[q.x, q.vx] = spring(q.x, q.vx, to[0], dt)
    ;[q.y, q.vy] = spring(q.y, q.vy, to[1], dt)
    ;[q.z, q.vz] = spring(q.z, q.vz, to[2], dt)
    ;[q.r, q.vr] = spring(q.r, q.vr, focused ? 0 : angle, dt)
    ;[q.s, q.vs] = spring(q.s, q.vs, focused ? FOCUS_SCALE : dimmed ? 0.94 : 1, dt)
    q.light = damp(q.light, dimmed ? 0.35 : 1, 6, dt)
    g.position.set(q.x, q.y, q.z)
    g.rotation.y = q.r
    g.scale.setScalar(q.s)
    const img = image.current
    if (img) {
      // The example's slow drift, kept subtle; hover pulls the print back into its mat.
      const m = img.material as ImageMat
      m.zoom = 1.12 + Math.sin(rnd * 10000 + state.clock.elapsedTime / 3) * 0.06
      m.color.setScalar(q.light)
      const k = !focused && hovered ? 0.9 : 1
      img.scale.x = damp(img.scale.x, k, 10, dt)
      img.scale.y = damp(img.scale.y, k, 10, dt)
    }
    if (mat.current) mat.current.color.lerp(color.set(hovered || focused ? accent : "#F2F2EE").multiplyScalar(q.light), 1 - Math.exp(-10 * dt))
  })

  return (
    <group ref={group} position={base} rotation={[0, angle, 0]}>
      {/* Frame: also the tap target (22 x 36 cm). */}
      <mesh userData={{ frame: index }} onClick={onPress}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={C.frame} metalness={0.3} roughness={0.45} />
      </mesh>
      {/* Mat */}
      <mesh position={[0, 0, D * 0.2]} raycast={() => null}>
        <boxGeometry args={[W * 0.9, H * 0.93, D * 0.9]} />
        <meshBasicMaterial ref={mat} color="#F2F2EE" toneMapped={false} />
      </mesh>
      {tex ? (
        <Artwork ref={image} texture={tex} scale={[W * 0.85, H * 0.9]} position={[0, 0, D * 0.7]} toneMapped={false} raycast={() => null} />
      ) : (
        <mesh position={[0, 0, D * 0.7]} raycast={() => null}>
          <planeGeometry args={[W * 0.85, H * 0.9]} />
          <meshBasicMaterial color={C.surface} />
        </mesh>
      )}
      {failed && (
        <Text position={[0, 0, D * 0.7 + 0.001]} fontSize={0.014} maxWidth={W * 0.75} textAlign="center" color={C.muted} anchorX="center" anchorY="middle">
          Image unavailable
        </Text>
      )}
      {focused && (
        <>
          <Text position={[0, -H / 2 - 0.014, 0]} fontSize={0.017} maxWidth={0.4} color={C.text} anchorX="center" anchorY="top">
            {title}
          </Text>
          {artist && (
            <Text position={[0, -H / 2 - 0.038, 0]} fontSize={0.011} maxWidth={0.4} color={C.muted} anchorX="center" anchorY="top">
              {artist}
            </Text>
          )}
          <CloseButton accent={accent} onPress={onClose} />
        </>
      )}
    </group>
  )
}

/** Round × button beside the focused frame: 3.4 cm here, 5.1 cm once the frame is scaled up. */
function CloseButton({ accent, onPress }: { accent: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <group position={[W / 2 + 0.03, H / 2 - 0.017, 0]}>
      <mesh onClick={onPress} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <circleGeometry args={[0.017, 40]} />
        <meshBasicMaterial color={hover ? accent : C.surface} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.0005]} raycast={() => null}>
        <ringGeometry args={[0.016, 0.017, 40]} />
        <meshBasicMaterial color={hover ? accent : C.border} toneMapped={false} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 0, 0.001]} rotation={[0, 0, (s * Math.PI) / 4]} raycast={() => null}>
          <planeGeometry args={[0.014, 0.0022]} />
          <meshBasicMaterial color={hover ? C.dark : C.text} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
