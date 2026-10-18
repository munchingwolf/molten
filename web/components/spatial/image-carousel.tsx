// Ported from pmndrs/examples "cards" (MIT, © 2024 Poimandres) and refined for Spatial.
"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Image as PhotoCard, Text } from "@react-three/drei"

type Props = {
  images?: string[]
  captions?: string[]
  /** Active slide index */
  value?: number
  onChange?: (index: number) => void
  autoplay?: boolean
  /** Seconds per slide while autoplaying */
  interval?: number
  accent?: string
}

const IDS = [1015, 1016, 1018, 1036, 1039, 1043, 1044, 1050]
const SAMPLE = IDS.map((id) => `https://picsum.photos/id/${id}/800/600`)
const CAPTIONS = ["River Valley", "Canyon Light", "Alpine Morning", "Winter Pines", "Falls", "Coastline", "Harbour Dusk", "Open Water"]
const C = { surface: "#1B1E26", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", dark: "#101218" }
const TILT = 0.14 // ring leans back so the far cards show above the front one
const RING_Y = 0.06
const BTN_X = 0.585
const DOT = 0.045 // dot pitch = 4.5 cm tap target
const damp = THREE.MathUtils.damp
const wrap = (i: number, n: number) => ((i % n) + n) % n
/** Signed shortest distance around the ring, in slides. */
const around = (d: number, n: number) => wrap(d + n / 2, n) - n / 2

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
        t.anisotropy = 4
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

/** A plane bent onto the ring's own cylinder (the example's BentPlaneGeometry, solved for an exact fit). Stays a PlaneGeometry so drei <Image> reads its width/height. */
function bentPlane(w: number, h: number, r: number) {
  const g = new THREE.PlaneGeometry(w, h, 24, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / r
    p.setXYZ(i, Math.sin(a) * r, p.getY(i), (Math.cos(a) - 1) * r)
  }
  g.computeVertexNormals()
  return g
}

/** Ring of curved photo cards. Drag to spin (it snaps to the nearest slide), tap a card or the arrows/dots to bring one to the front. Autoplay pauses while hovered. */
export default function ImageCarousel({
  images = SAMPLE,
  captions = CAPTIONS,
  value,
  onChange,
  autoplay = true,
  interval = 4,
  accent = "#9FE7D2",
}: Props) {
  const n = Math.max(images.length, 1)
  const step = (Math.PI * 2) / n
  const R = Math.min(0.46, Math.max(0.3, (n * 0.33) / (Math.PI * 2)))
  const cw = Math.min(0.3, R * step - 0.03)
  const ch = cw / 1.5
  const geo = useMemo(() => bentPlane(cw, ch, R), [cw, ch, R])
  useEffect(() => () => geo.dispose(), [geo])

  const start = wrap(Math.round(value ?? 0), n)
  const [index, setIndex] = useState(start)
  const indexRef = useRef(start)
  const target = useRef(start) // where the ring is heading, in slides (unbounded)
  const pos = useRef(start) // where it is now
  const clock = useRef(0)
  const hovered = useRef(false)
  const [hoverCard, setHoverCard] = useState(-1)
  const drag = useRef<{ id: number; i0: number; x0: number; t0: number; moved: number; v: number; last: number; lastT: number } | null>(null)
  const dragged = useRef(false)
  const dragRoot = useRef<THREE.Group>(null)
  const pill = useRef<THREE.Group>(null)

  const show = (i: number, emit: boolean) => {
    if (i !== indexRef.current) {
      indexRef.current = i
      setIndex(i)
      if (emit) onChange?.(i)
    }
  }
  const goTo = (t: number) => {
    target.current = t
    clock.current = 0
    show(wrap(t, n), true)
  }
  const go = (d: number) => goTo(Math.round(target.current) + d)
  const bring = (i: number) => go(around(i - indexRef.current, n))

  // Controlled: follow `value` the short way round.
  useEffect(() => {
    if (value === undefined) return
    const v = wrap(Math.round(value), n)
    if (v === indexRef.current) return
    target.current = Math.round(target.current) + around(v - indexRef.current, n)
    show(v, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, n])

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    if (autoplay && n > 1 && !hovered.current && !drag.current) {
      clock.current += d
      if (clock.current >= Math.max(1, interval)) go(1)
    } else clock.current = 0
    pos.current = damp(pos.current, target.current, drag.current ? 18 : 5, d)
    if (pill.current) pill.current.position.x = (wrap(pos.current + 0.5, n) - 0.5 - (n - 1) / 2) * DOT
  })

  // Pointer position on the ring's front plane, in the carousel's own space (works when the Studio moves or scales it).
  const plane = useMemo(() => new THREE.Plane(), [])
  const v3 = useMemo(() => new THREE.Vector3(), [])
  const nrm = useMemo(() => new THREE.Vector3(), [])
  const localX = (e: ThreeEvent<PointerEvent>) => {
    const g = dragRoot.current
    if (!g || !e.ray) return null
    g.updateWorldMatrix(true, false)
    nrm.set(0, 0, 1).transformDirection(g.matrixWorld)
    plane.setFromNormalAndCoplanarPoint(nrm, v3.setFromMatrixPosition(g.matrixWorld))
    return e.ray.intersectPlane(plane, v3) ? g.worldToLocal(v3).x : null
  }
  const slot = R * step
  // Handlers sit on the group, so R3F may call them once per hit card; each is written to be idempotent.
  const down = (e: ThreeEvent<PointerEvent>) => {
    if (drag.current?.id === e.pointerId) return
    const x = localX(e)
    if (x === null) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragged.current = false
    drag.current = { id: e.pointerId, i0: indexRef.current, x0: x, t0: target.current, moved: 0, v: 0, last: target.current, lastT: performance.now() }
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const near = e.intersections.find((h) => h.object.userData.card !== undefined)
    setHoverCard(near && !drag.current ? (near.object.userData.card as number) : -1)
    const g = drag.current
    if (!g || g.id !== e.pointerId) return
    const x = localX(e)
    if (x === null) return
    const dx = x - g.x0
    g.moved = Math.max(g.moved, Math.abs(dx))
    target.current = g.t0 - dx / slot
    const now = performance.now()
    if (now - g.lastT > 8) {
      g.v = g.v * 0.5 + (0.5 * (target.current - g.last) * 1000) / (now - g.lastT)
      g.last = target.current
      g.lastT = now
    }
    show(wrap(Math.round(target.current), n), false)
  }
  const up = (e: ThreeEvent<PointerEvent>) => {
    const g = drag.current
    if (!g || g.id !== e.pointerId) return
    drag.current = null
    dragged.current = g.moved > 0.012
    if (!dragged.current) {
      target.current = g.t0
      return
    }
    // Snap to the nearest slide, nudged by the flick speed.
    const fling = Math.max(-1.5, Math.min(1.5, g.v * 0.18))
    target.current = Math.round(target.current + fling)
    clock.current = 0
    show(wrap(target.current, n), false)
    if (indexRef.current !== g.i0) onChange?.(indexRef.current)
  }

  const caption = captions[index] ?? `Image ${index + 1}`
  const frontY = RING_Y - R * Math.sin(TILT)
  const dotsW = (n - 1) * DOT

  return (
    <group position={[0, 0.02, 0]}>
      <group
        ref={dragRoot}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerOver={() => (hovered.current = true)}
        onPointerOut={() => {
          hovered.current = false
          setHoverCard(-1)
        }}
      >
        {/* Grab area: lets a drag start between cards too. */}
        <mesh visible={false} position={[0, RING_Y, 0]}>
          <planeGeometry args={[2 * R + 0.1, 0.42]} />
        </mesh>
        <group position={[0, RING_Y, 0]} rotation={[TILT, 0, 0]}>
          {images.map((url, i) => (
            <Card
              key={`${i}-${url}`}
              url={url}
              index={i}
              n={n}
              step={step}
              radius={R}
              pos={pos}
              geo={geo}
              w={cw}
              h={ch}
              hovered={hoverCard === i}
              accent={accent}
              onTap={(e) => {
                if (dragged.current) return
                const near = e.intersections.find((h) => h.object.userData.card !== undefined)
                if (!near || near.object === e.object) bring(i)
              }}
            />
          ))}
        </group>
      </group>

      <RoundButton x={-BTN_X} y={frontY} dir={-1} accent={accent} onPress={() => go(-1)} />
      <RoundButton x={BTN_X} y={frontY} dir={1} accent={accent} onPress={() => go(1)} />

      <Text position={[0, -0.175, 0.3]} fontSize={0.034} maxWidth={0.8} anchorX="center" anchorY="middle" color={C.text}>
        {caption}
      </Text>
      <Text position={[0, -0.215, 0.3]} fontSize={0.019} letterSpacing={0.12} anchorX="center" anchorY="middle" color={C.muted}>
        {`${String(index + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`}
      </Text>
      <group position={[0, -0.255, 0.3]}>
        {images.map((_, i) => (
          <Dot key={i} x={i * DOT - dotsW / 2} onPress={() => bring(i)} />
        ))}
        <group ref={pill} position={[0, 0, 0.001]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.0055, 0.016, 4, 12]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

type CardProps = {
  url: string
  index: number
  n: number
  step: number
  radius: number
  pos: RefObject<number>
  geo: THREE.PlaneGeometry
  w: number
  h: number
  hovered: boolean
  accent: string
  onTap: (e: ThreeEvent<MouseEvent>) => void
}

type ImageMat = THREE.ShaderMaterial & { zoom: number; grayscale: number; color: THREE.Color }

function Card({ url, index, n, step, radius, pos, geo, w, h, hovered, accent, onTap }: CardProps) {
  const { tex, failed } = useImage(url)
  const group = useRef<THREE.Group>(null)
  const img = useRef<THREE.Mesh>(null)
  const edge = useRef<THREE.MeshBasicMaterial>(null)
  const hover = useRef(0)

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const rel = around(index - pos.current, n) // slides from the front
    const phi = rel * step
    const front = Math.max(0, 1 - Math.abs(rel))
    const f = front * front * (3 - 2 * front) // smoothstep
    hover.current = damp(hover.current, hovered ? 1 : 0, 10, dt)
    g.position.set(Math.sin(phi) * radius, hover.current * 0.012, Math.cos(phi) * radius + f * 0.05)
    g.rotation.y = phi
    g.scale.setScalar(1 + 0.24 * f + 0.06 * hover.current)
    // Cards dim and desaturate as they turn away.
    const lit = 0.28 + 0.72 * Math.min(1, Math.max(0, (Math.cos(phi) + 0.35) / 1.35))
    const m = img.current?.material as ImageMat | undefined
    if (m) {
      m.color.setScalar(lit)
      m.grayscale = (1 - lit) * 0.9
      m.zoom = 1 + 0.12 * hover.current
    }
    if (edge.current) edge.current.opacity = 0.9 * Math.max(hover.current, f * 0.35)
  })

  return (
    <group ref={group}>
      {tex ? (
        <PhotoCard
          ref={img}
          texture={tex}
          radius={0.016}
          transparent
          toneMapped={false}
          side={THREE.DoubleSide}
          userData={{ card: index }}
          onClick={onTap}
        >
          <primitive object={geo} attach="geometry" />
        </PhotoCard>
      ) : (
        <mesh geometry={geo} userData={{ card: index }} onClick={onTap}>
          <meshBasicMaterial color={C.surface} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Accent outline behind the card: shows on hover and, faintly, on the front card. */}
      <mesh geometry={geo} position={[0, 0, -0.004]} scale={[1 + 0.016 / w, 1 + 0.016 / h, 1]} raycast={() => null}>
        <meshBasicMaterial ref={edge} color={accent} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {failed && (
        <Text position={[0, 0, 0.004]} fontSize={0.018} color={C.muted} anchorX="center" anchorY="middle">
          Image unavailable
        </Text>
      )}
    </group>
  )
}

function RoundButton({ x, y, dir, accent, onPress }: { x: number; y: number; dir: 1 | -1; accent: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (g.current) g.current.scale.setScalar(damp(g.current.scale.x, hover ? 1.08 : 1, 12, dt))
  })
  return (
    <group ref={g} position={[x, y, 0.25]}>
      {/* 6.4 cm round button */}
      <mesh onClick={onPress} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <circleGeometry args={[0.032, 48]} />
        <meshBasicMaterial color={hover ? accent : C.surface} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.0005]} raycast={() => null}>
        <ringGeometry args={[0.0305, 0.032, 48]} />
        <meshBasicMaterial color={hover ? accent : C.border} toneMapped={false} />
      </mesh>
      <mesh position={[dir * 0.003, 0, 0.001]} rotation={[0, 0, dir === 1 ? 0 : Math.PI]} raycast={() => null}>
        <circleGeometry args={[0.011, 3]} />
        <meshBasicMaterial color={hover ? C.dark : C.text} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Dot({ x, onPress }: { x: number; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <group position={[x, 0, 0]}>
      <mesh visible={false} onClick={onPress} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <planeGeometry args={[DOT, DOT]} />
      </mesh>
      <mesh raycast={() => null}>
        <circleGeometry args={[hover ? 0.0065 : 0.0048, 24]} />
        <meshBasicMaterial color={hover ? C.text : C.faint} toneMapped={false} />
      </mesh>
    </group>
  )
}
