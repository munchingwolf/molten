"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { AdditiveBlending, type Group, type MeshBasicMaterial } from "three"
import { Container, Text } from "@react-three/uikit"

type Player = { name: string; score: number }
type Props = {
  title?: string
  players?: Player[]
  accent?: string
  /** Fires when Simulate is pressed (after the re-rank). */
  onPress?: () => void
}

const PX = 0.002
const W = 460 // px -> 92 cm
const ROW = 50
const HEAD = 78
const FOOT = 70
const PAD = 22
const H = PAD * 2 + HEAD + ROW * 8 + FOOT
const DEFAULTS: Player[] = [
  { name: "NovaStrike", score: 9840 }, { name: "Kairo", score: 9420 }, { name: "PixelWitch", score: 9105 },
  { name: "Torque", score: 8770 }, { name: "Lumen", score: 8390 }, { name: "Glitchfox", score: 8010 },
  { name: "Mara Vey", score: 7655 }, { name: "Zero Dawn", score: 7200 },
]
const MEDAL = ["#F5C451", "#C9D1DC", "#E0915A"]
const HUES = ["#7C5CFF", "#2EC4B6", "#FF6B6B", "#4C8DFF", "#F7B32B", "#E056FD", "#3DDC84", "#FF8A3D"]
const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2
const rowY = (rank: number) => (H / 2 - PAD - HEAD - ROW * rank - ROW / 2) * PX
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()

type Anim = { group: Group | null; flash: MeshBasicMaterial | null; y: number; v: number; f: number; born: number }

/**
 * Top-8 leaderboard: rank, avatar initials, name and a score bar. Rows slide in one after another. Simulate plays a round:
 * scores jump, rows glide past each other into their new places, and every row whose rank changed flashes with an arrow.
 */
export default function GameLeaderboard({ title = "Leaderboard", players = DEFAULTS, accent = "#7C5CFF", onPress }: Props) {
  const [board, setBoard] = useState(() =>
    [...players].slice(0, 8).sort((a, b) => b.score - a.score).map((p, i) => ({ ...p, color: HUES[i % HUES.length], moved: 0 })),
  )
  const [round, setRound] = useState(1)
  const anim = useRef(new Map<string, Anim>())
  const t0 = useRef(-1)

  const slot = (name: string, rank: number) => {
    let a = anim.current.get(name)
    if (!a) anim.current.set(name, (a = { group: null, flash: null, y: rowY(rank), v: 0, f: 0, born: rank * 0.07 }))
    return a
  }

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime
    if (t0.current < 0) t0.current = now
    const h = Math.min(dt, 1 / 30)
    let moving = false
    board.forEach((p, rank) => {
      const a = anim.current.get(p.name)
      if (!a?.group) return
      const target = rowY(rank)
      a.v += ((target - a.y) * 120 - a.v * 17) * h
      a.y += a.v * h
      a.f *= Math.exp(-h * 2.2)
      const e = Math.min(1, Math.max(0, (now - t0.current - a.born) / 0.6))
      const k = e === 1 ? 1 : easeOutBack(e)
      // Moving rows rise toward the viewer so they pass in front of the others.
      a.group.position.set((1 - k) * -0.14, a.y, 0.004 + Math.min(0.03, Math.abs(a.v) * 0.05) + (1 - k) * -0.05)
      a.group.scale.setScalar(e > 0 ? 0.94 + 0.06 * k : 0.001)
      if (a.flash) a.flash.opacity = a.f * 0.55
      if (e < 1 || Math.abs(target - a.y) + Math.abs(a.v) > 1e-4 || a.f > 0.003) moving = true
    })
    if (moving) state.invalidate()
  })

  const simulate = () => {
    const next = board
      .map((p) => ({ ...p, score: p.score + Math.round(Math.random() * 700 + (Math.random() < 0.3 ? 900 : 0)) }))
      .sort((a, b) => b.score - a.score)
    const ranked = next.map((p, i) => {
      const was = board.findIndex((q) => q.name === p.name)
      const a = anim.current.get(p.name)
      if (a && was !== i) a.f = 1
      return { ...p, moved: was - i }
    })
    setBoard(ranked)
    setRound((r) => r + 1)
    onPress?.()
  }

  const max = Math.max(1, ...board.map((p) => p.score))
  const rowW = W - PAD * 2
  return (
    <group>
      <Container pixelSize={PX} width={W} height={H} flexDirection="column" padding={PAD} borderRadius={30} backgroundColor="#0E1016" borderWidth={1.5} borderColor="#252A36">
        <Container height={HEAD} flexDirection="row" alignItems="center" gap={14}>
          <Container width={48} height={48} borderRadius={14} backgroundColor={accent} alignItems="center" justifyContent="center">
            <Text fontSize={24} fontWeight="bold" color="#FFFFFF">#1</Text>
          </Container>
          <Container flexDirection="column" flexGrow={1} gap={2}>
            <Text fontSize={26} fontWeight="bold" color="#F2F4F8">{title}</Text>
            <Text fontSize={14} color="#7D8494">{`Ranked - Round ${round}`}</Text>
          </Container>
          <Container paddingX={12} paddingY={6} borderRadius={999} backgroundColor="#1A1E29" flexDirection="row" alignItems="center" gap={6}>
            <Container width={8} height={8} borderRadius={4} backgroundColor="#3DDC84" />
            <Text fontSize={13} fontWeight="semi-bold" color="#B8BECB">LIVE</Text>
          </Container>
        </Container>
        <Container height={ROW * 8} />
        <Container height={FOOT} flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text fontSize={14} color="#6B7282">Top 8 this season</Text>
          <Container
            height={46}
            paddingX={24}
            borderRadius={14}
            backgroundColor={accent}
            hover={{ backgroundColor: "#FFFFFF" }}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            onClick={simulate}
          >
            <Text fontSize={17} fontWeight="bold" color="#0B0C10">Simulate</Text>
          </Container>
        </Container>
      </Container>

      {board.map((p, rank) => {
        const a = slot(p.name, rank)
        const top = rank < 3
        return (
          <group key={p.name} ref={(g) => void (a.group = g)} scale={0.001}>
            <mesh position={[0, 0, 0.002]} raycast={() => null}>
              <planeGeometry args={[rowW * PX, (ROW - 6) * PX]} />
              <meshBasicMaterial ref={(m) => void (a.flash = m)} color={accent} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
            </mesh>
            <Container
              pixelSize={PX}
              width={rowW}
              height={ROW - 6}
              flexDirection="row"
              alignItems="center"
              gap={12}
              paddingX={12}
              borderRadius={12}
              backgroundColor={top ? "#171B26" : "#12151D"}
              hover={{ backgroundColor: "#1E2333" }}
            >
              <Text fontSize={18} fontWeight="bold" color={top ? MEDAL[rank] : "#6B7282"} width={26}>{`${rank + 1}`}</Text>
              <Container width={32} height={32} borderRadius={16} backgroundColor={p.color} alignItems="center" justifyContent="center">
                <Text fontSize={13} fontWeight="bold" color="#FFFFFF">{initials(p.name)}</Text>
              </Container>
              <Container flexDirection="column" flexGrow={1} gap={5}>
                <Text fontSize={16} fontWeight="semi-bold" color="#EEF0F5">{p.name}</Text>
                <Container width={170} height={6} borderRadius={3} backgroundColor="#232836">
                  <Container width={Math.max(6, (p.score / max) * 170)} height={6} borderRadius={3} backgroundColor={top ? MEDAL[rank] : accent} />
                </Container>
              </Container>
              <Container width={30} flexDirection="row" alignItems="center" justifyContent="flex-end">
                {p.moved !== 0 && <Text fontSize={12} fontWeight="bold" color={p.moved > 0 ? "#3DDC84" : "#FF6B6B"}>{`${p.moved > 0 ? "+" : "-"}${Math.abs(p.moved)}`}</Text>}
              </Container>
              <Text fontSize={17} fontWeight="bold" color="#F2F4F8" width={66} textAlign="right">{p.score.toLocaleString("en-US")}</Text>
            </Container>
          </group>
        )
      })}
    </group>
  )
}
