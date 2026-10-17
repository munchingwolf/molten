"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import {
  CanvasTexture,
  CatmullRomCurve3,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from "three"
import { Container, Text } from "@react-three/uikit"

type Props = { data?: number[]; label?: string; color?: string; unit?: string }

const SAMPLE = [12, 18, 15, 22, 19, 27, 24, 31, 29, 36, 33, 41]
const PW = 260 // card, px at pixelSize 0.002 → 52 × 28 cm
const PH = 140
const LW = 0.44 // line area, metres
const LH = 0.1
const LY = -0.115 // line area bottom
const LZ = 0.014 // the line floats 1.4 cm in front of the card
const RADIAL = 8
const PER_POINT = 12

let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated matcap gives the tube the same soft top-light everywhere.
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

const fmt = (v: number, unit: string) => `${Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(1)}${unit}`

/** Trend card with a 3D tube line that draws itself in. Hover along the line to read any point. `data` is a list of numbers. */
export default function Sparkline({ data = SAMPLE, label = "Revenue ($k)", color = "#9FE7D2", unit = "" }: Props) {
  const vals = data.filter(Number.isFinite)
  if (vals.length === 1) vals.push(vals[0])
  const n = vals.length
  const key = vals.join(",")

  const points = useMemo(() => {
    const lo = Math.min(...vals)
    const span = Math.max(...vals) - lo || 1
    return vals.map((v, i) => new Vector3(-LW / 2 + (i / (n - 1)) * LW, LY + ((v - lo) / span) * LH, LZ))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const geo = useMemo(() => {
    if (n < 2) return null
    const curve = new CatmullRomCurve3(points, false, "centripetal")
    const tube = new TubeGeometry(curve, (n - 1) * PER_POINT, 0.0028, RADIAL, false)
    const s = new Shape()
    s.moveTo(points[0].x, LY)
    curve.getPoints((n - 1) * PER_POINT).forEach((p) => s.lineTo(p.x, p.y))
    s.lineTo(points[n - 1].x, LY)
    return { tube, area: new ShapeGeometry(s), segs: (n - 1) * PER_POINT }
  }, [points, n])
  useEffect(
    () => () => {
      geo?.tube.dispose()
      geo?.area.dispose()
    },
    [geo],
  )

  const [hover, setHover] = useState<number | null>(null)
  const grp = useRef<Group>(null)
  const dot = useRef<Mesh>(null)
  const fill = useRef<MeshBasicMaterial>(null)
  const progress = useRef(0)
  const mc = useMemo(getMatcap, [])

  useEffect(() => {
    progress.current = 0 // redraw when the data changes
  }, [geo])

  useFrame((state, delta) => {
    if (!geo) return
    const p = Math.min(1, progress.current + Math.min(delta, 0.05) / 1.1)
    progress.current = p
    const eased = 1 - Math.pow(1 - p, 3)
    geo.tube.setDrawRange(0, Math.ceil(eased * geo.segs) * RADIAL * 6)
    if (fill.current) fill.current.opacity = 0.16 * eased
    if (dot.current) {
      dot.current.visible = p >= 1
      dot.current.scale.setScalar(1 + 0.25 * Math.sin(state.clock.elapsedTime * 3)) // live "latest value" pulse
    }
    if (p < 1) state.invalidate()
  })

  const pick = (e: ThreeEvent<PointerEvent>) => {
    if (!grp.current || n < 2) return
    const x = grp.current.worldToLocal(e.point.clone()).x
    setHover(Math.min(n - 1, Math.max(0, Math.round(((x + LW / 2) / LW) * (n - 1)))))
  }

  const last = vals[n - 1] ?? 0
  const first = vals[0] ?? 0
  const change = n >= 2 && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null
  const hp = hover !== null ? points[hover] : null

  return (
    <group ref={grp}>
      <Container
        pixelSize={0.002}
        width={PW}
        height={PH}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="flex-start"
        padding={18}
        borderRadius={16}
        backgroundColor="#15171E"
        borderWidth={1.5}
        borderColor={hover !== null ? "#9FE7D2" : "#323745"}
      >
        <Text fontSize={13} fontWeight="medium" color="#9AA0AD">
          {label}
        </Text>
        <Container flexDirection="column" alignItems="flex-end">
          <Text fontSize={24} fontWeight="bold" color="#EEF0F4">
            {n ? fmt(last, unit) : "No data"}
          </Text>
          {change !== null && (
            <Text fontSize={11} fontWeight="semi-bold" color={change >= 0 ? "#9FE7D2" : "#F2B48A"}>
              {`${change >= 0 ? "+" : "-"}${Math.abs(change).toFixed(1)}%`}
            </Text>
          )}
        </Container>
      </Container>
      {geo && (
        <>
          <mesh geometry={geo.area} position={[0, 0, LZ - 0.006]}>
            <meshBasicMaterial ref={fill} color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh geometry={geo.tube}>
            <meshMatcapMaterial matcap={mc} color={color} />
          </mesh>
          <mesh ref={dot} position={points[n - 1]} visible={false}>
            <sphereGeometry args={[0.006, 16, 16]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </>
      )}
      {hp && hover !== null && (
        <>
          <mesh position={[hp.x, (LY + hp.y) / 2, LZ - 0.002]}>
            <boxGeometry args={[0.0015, Math.max(0.001, hp.y - LY), 0.0015]} />
            <meshBasicMaterial color="#6B7180" />
          </mesh>
          <mesh position={hp}>
            <sphereGeometry args={[0.007, 16, 16]} />
            <meshBasicMaterial color="#F2B48A" toneMapped={false} />
          </mesh>
          <group position={[hp.x, hp.y + 0.032, LZ + 0.004]}>
            <Container
              pixelSize={0.002}
              pointerEvents="none"
              paddingX={8}
              paddingY={4}
              borderRadius={7}
              backgroundColor="#0B0C10"
              borderWidth={1}
              borderColor="#F2B48A"
            >
              <Text fontSize={12} fontWeight="semi-bold" color="#EEF0F4">
                {fmt(vals[hover], unit)}
              </Text>
            </Container>
          </group>
        </>
      )}
      {/* Hover strip over the line area (48 × 14 cm). */}
      <mesh
        visible={false}
        position={[0, LY + LH / 2, LZ]}
        onPointerOver={pick}
        onPointerMove={pick}
        onPointerOut={() => setHover(null)}
      >
        <boxGeometry args={[LW + 0.04, LH + 0.04, 0.03]} />
      </mesh>
    </group>
  )
}
