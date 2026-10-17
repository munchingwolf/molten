"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, Shape, ShapeGeometry, SRGBColorSpace, TextureLoader, type Group, type Texture } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { Container, Text } from "@react-three/uikit"

type Props = { images?: string[] }

const SAMPLE = [1015, 1016, 1018, 1036, 1043].map((id) => `https://picsum.photos/id/${id}/600/400`)
const CW = 0.16 // card width, metres (3:2)
const CH = CW / 1.5
const R = 0.55 // arc radius: the arc curves toward the viewer
const STEP = (CW + 0.02) / R // angle between cards

let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated matcap shades the frames the same everywhere.
function getMatcap() {
  if (matcap) return matcap
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 30, 0, 64, 30, 90)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.5, "#d0d3da")
  grad.addColorStop(1, "#2f323a")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  matcap = new CanvasTexture(c)
  matcap.colorSpace = SRGBColorSpace
  return matcap
}

/** Rounded-rect plane whose UVs span 0–1, so a texture fills it. */
function roundedRect(w: number, h: number, r: number) {
  const x = -w / 2
  const y = -h / 2
  const s = new Shape()
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  const g = new ShapeGeometry(s, 6)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h)
  return g
}

/** Loads without suspending, so one bad URL shows a placeholder instead of taking down the scene. */
function useImage(url: string) {
  const [state, setState] = useState<{ tex: Texture | null; failed: boolean }>({ tex: null, failed: false })
  useEffect(() => {
    let alive = true
    let loaded: Texture | null = null
    new TextureLoader().load(
      url,
      (t) => {
        if (!alive) return t.dispose()
        t.colorSpace = SRGBColorSpace
        // Cover-fit: crop the image to the card's 3:2 instead of stretching it.
        const img = t.image as { width: number; height: number }
        const k = img.width / img.height / (CW / CH)
        if (k > 1) {
          t.repeat.set(1 / k, 1)
          t.offset.set((1 - 1 / k) / 2, 0)
        } else {
          t.repeat.set(1, k)
          t.offset.set(0, (1 - k) / 2)
        }
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

/** Images on an arc that wraps toward you. Hover a card to lift it; press to pull it forward, press again to send it back. */
export default function CurvedGallery({ images = SAMPLE }: Props) {
  const [focus, setFocus] = useState<number | null>(null)
  const plane = useMemo(() => roundedRect(CW, CH, 0.01), [])
  const frame = useMemo(() => new RoundedBoxGeometry(CW + 0.01, CH + 0.01, 0.008, 2, 0.008), [])
  useEffect(() => () => plane.dispose(), [plane])
  useEffect(() => () => frame.dispose(), [frame])
  const mc = useMemo(getMatcap, [])
  const n = images.length

  return (
    <group>
      {images.map((url, i) => {
        const a = (i - (n - 1) / 2) * STEP
        return (
          <group key={`${i}-${url}`} position={[R * Math.sin(a), 0, R * (1 - Math.cos(a))]} rotation={[0, -a, 0]}>
            <Card
              url={url}
              index={i}
              count={n}
              focused={focus === i}
              onPress={() => setFocus((f) => (f === i ? null : i))}
              plane={plane}
              frame={frame}
              matcap={mc}
            />
          </group>
        )
      })}
    </group>
  )
}

type CardProps = {
  url: string
  index: number
  count: number
  focused: boolean
  onPress: () => void
  plane: ShapeGeometry
  frame: RoundedBoxGeometry
  matcap: Texture
}

function Card({ url, index, count, focused, onPress, plane, frame, matcap }: CardProps) {
  const { tex, failed } = useImage(url)
  const [hover, setHover] = useState(false)
  const lift = useRef<Group>(null)

  useFrame((state, delta) => {
    const g = lift.current
    if (!g) return
    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 10)
    const z = focused ? 0.12 : hover ? 0.03 : 0
    const s = focused ? 1.6 : hover ? 1.08 : 1
    g.position.z += (z - g.position.z) * k
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * k)
    if (Math.abs(z - g.position.z) > 1e-4 || Math.abs(s - g.scale.x) > 1e-4) state.invalidate()
  })

  // R3F hands a click to every card under the ray; only the nearest one acts (no stopPropagation, the Studio needs the bubble).
  const press = (e: ThreeEvent<MouseEvent>) => {
    const nearest = e.intersections?.[0]
    if (!nearest || nearest.object === e.object) onPress()
  }
  const active = hover || focused
  return (
    <group ref={lift}>
      {/* Press target: the image itself (16 × 10.7 cm). */}
      <mesh geometry={plane} onClick={press} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        {tex ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshBasicMaterial color="#1B1E26" />}
      </mesh>
      <mesh geometry={frame} position={[0, 0, -0.0045]}>
        <meshMatcapMaterial matcap={matcap} color={active ? "#9FE7D2" : "#2A2E3A"} />
      </mesh>
      {(failed || active) && (
        <group position={[0, failed && !active ? 0 : -CH / 2 - 0.022, 0.004]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={10} color={failed ? "#9AA0AD" : "#EEF0F4"}>
              {failed ? "Image unavailable" : `${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`}
            </Text>
          </Container>
        </group>
      )}
    </group>
  )
}
