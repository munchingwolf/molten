"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Color, Object3D, type Group, type InstancedMesh } from "three"
import { Container, Text } from "@react-three/uikit"

type Props = {
  kills?: number
  deaths?: number
  assists?: number
  /** Percent, 0-100. */
  winRate?: number
  /** Last matches, newest last: W or L per character. */
  results?: string
  accent?: string
  /** Fires on tap (the numbers replay their count-up). */
  onPress?: () => void
}

const PX = 0.002
const W = 460 // px -> 92 cm
const PAD = 22
const HEAD = 56
const RING_ROW = 176
const KDA = 84
const STRIP = 62
const H = PAD * 2 + HEAD + RING_ROW + KDA + STRIP
const SEG = 60
const R = 0.128 // ring radius, metres
const RING_Y = (H / 2 - PAD - HEAD - RING_ROW / 2) * PX
const RING_X = ((W - PAD * 2) / 4) * PX
const DUR = 1.5
const easeOut = (x: number) => 1 - (1 - x) ** 3
const dummy = new Object3D()
const TMP = new Color()

/**
 * Match-stats panel: K/D and win rate as segmented radial rings that sweep in, KDA numbers that count up, and a
 * last-10-matches W/L strip. Tap it to replay the entrance.
 */
export default function MatchStats({ kills = 18, deaths = 7, assists = 11, winRate = 64, results = "WWLWWLWLWW", accent = "#7C5CFF", onPress }: Props) {
  const kd = kills / Math.max(1, deaths)
  const rings = [
    { label: "K/D", frac: Math.min(1, kd / 3), color: accent, text: (p: number) => (kd * p).toFixed(2) },
    { label: "WIN RATE", frac: Math.min(1, Math.max(0, winRate / 100)), color: "#3DDC84", text: (p: number) => `${Math.round(winRate * p)}%` },
  ]
  const [p, setP] = useState(0)
  const t = useRef({ start: -1, shown: -1 })
  const fills = useRef<(InstancedMesh | null)[]>([])
  const root = useRef<Group>(null)

  useFrame((state) => {
    const s = t.current
    const now = state.clock.elapsedTime
    if (s.start < 0) s.start = now
    const raw = Math.min(1, (now - s.start) / DUR)
    const e = easeOut(raw)
    for (let i = 0; i < 2; i++) {
      const m = fills.current[i]
      if (m) m.count = Math.round(e * rings[i].frac * SEG)
    }
    if (root.current) root.current.scale.setScalar(0.96 + 0.04 * easeOut(Math.min(1, raw * 2)))
    // Text re-layout is the costly part, so step it at ~20 fps during the count-up.
    const q = Math.round(e * 40) / 40
    if (q !== s.shown) {
      s.shown = q
      setP(q)
    }
    if (raw < 1) state.invalidate()
  })

  const replay = () => {
    t.current.start = -1
    onPress?.()
  }

  const games = results.toUpperCase().replace(/[^WL]/g, "").slice(-10).split("")
  const wins = games.filter((g) => g === "W").length
  return (
    <group ref={root} onClick={replay}>
      <Container pixelSize={PX} width={W} height={H} flexDirection="column" padding={PAD} borderRadius={30} backgroundColor="#0E1016" borderWidth={1.5} borderColor="#252A36" cursor="pointer">
        <Container height={HEAD} flexDirection="row" alignItems="center" justifyContent="space-between">
          <Container flexDirection="column" gap={2}>
            <Text fontSize={24} fontWeight="bold" color="#F2F4F8">Match Stats</Text>
            <Text fontSize={13} color="#7D8494">Ranked - this season</Text>
          </Container>
          <Container paddingX={12} paddingY={6} borderRadius={999} backgroundColor="#1A1E29">
            <Text fontSize={13} fontWeight="semi-bold" color="#B8BECB">{`${wins}W - ${games.length - wins}L`}</Text>
          </Container>
        </Container>
        <Container height={RING_ROW} flexDirection="row">
          {rings.map((r) => (
            <Container key={r.label} flexGrow={1} flexBasis={0} alignItems="center" justifyContent="center" flexDirection="column" gap={2}>
              <Text fontSize={34} fontWeight="bold" color="#F2F4F8">{r.text(p)}</Text>
              <Text fontSize={12} fontWeight="semi-bold" color="#7D8494" letterSpacing={1}>{r.label}</Text>
            </Container>
          ))}
        </Container>
        <Container height={KDA} flexDirection="row" gap={10} alignItems="center">
          {([["KILLS", kills, "#F2F4F8"], ["DEATHS", deaths, "#FF6B6B"], ["ASSISTS", assists, "#4CC3FF"]] as const).map(([label, v, c]) => (
            <Container key={label} flexGrow={1} flexBasis={0} height={66} borderRadius={14} backgroundColor="#151924" flexDirection="column" alignItems="center" justifyContent="center" gap={2}>
              <Text fontSize={26} fontWeight="bold" color={c}>{`${Math.round(v * p)}`}</Text>
              <Text fontSize={11} fontWeight="semi-bold" color="#6B7282" letterSpacing={1}>{label}</Text>
            </Container>
          ))}
        </Container>
        <Container height={STRIP} flexDirection="column" justifyContent="flex-end" gap={8}>
          <Text fontSize={12} fontWeight="semi-bold" color="#6B7282" letterSpacing={1}>LAST 10 MATCHES</Text>
          <Container flexDirection="row" gap={6}>
            {games.map((g, i) => (
              <Container key={i} flexGrow={1} height={26} borderRadius={7} alignItems="center" justifyContent="center"
                backgroundColor={g === "W" ? (p * 10 > i ? "#1F6B45" : "#151924") : p * 10 > i ? "#6B2430" : "#151924"}>
                <Text fontSize={12} fontWeight="bold" color={g === "W" ? "#7CF0B0" : "#FF9AA5"}>{g}</Text>
              </Container>
            ))}
          </Container>
        </Container>
      </Container>
      {rings.map((r, i) => (
        <group key={r.label} position={[(i ? 1 : -1) * RING_X, RING_Y, 0.003]}>
          <Ring color="#1E2330" track />
          <Ring color={r.color} meshRef={(m) => void (fills.current[i] = m)} />
        </group>
      ))}
    </group>
  )
}

function Ring({ color, track, meshRef }: { color: string; track?: boolean; meshRef?: (m: InstancedMesh | null) => void }) {
  const ref = useRef<InstancedMesh | null>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const base = new Color(color)
    for (let i = 0; i < SEG; i++) {
      // Clockwise from 12 o'clock, each segment turned along the circle.
      const a = Math.PI / 2 - ((i + 0.5) / SEG) * Math.PI * 2
      dummy.position.set(Math.cos(a) * R, Math.sin(a) * R, track ? 0 : 0.001)
      dummy.rotation.set(0, 0, a)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, TMP.copy(base).lerp(track ? base : new Color("#FFFFFF"), track ? 0 : (i / SEG) * 0.35))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [color, track])
  return (
    <instancedMesh ref={(m) => ((ref.current = m), meshRef?.(m))} args={[undefined, undefined, SEG]} raycast={() => null} frustumCulled={false}>
      <boxGeometry args={[0.022, 0.009, 0.003]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
