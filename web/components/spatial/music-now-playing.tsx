"use client"

import { memo, useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Image, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Heart, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", row: "#1B1E27", hover: "#262A35", track: "#2A2E3A", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B", warm: "#F2B48A", lilac: "#B9B4F5", like: "#F0A6B8" }

type Track = { title: string; artist: string; duration: number; cover?: string }
type Props = {
  /** is the track playing */
  value?: boolean
  onChange?: (playing: boolean) => void
  tracks?: Track[]
  onNext?: (track: Track) => void
  onPrev?: (track: Track) => void
  accent?: string
}

const SAMPLE: Track[] = [
  { title: "Midnight Drive", artist: "Neon Coast", duration: 217 },
  { title: "Glass Rooms", artist: "Lumen", duration: 242 },
  { title: "Low Orbit", artist: "Kites", duration: 195 },
]

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** Now-playing card: cover art with a live equalizer, title, like, progress and transport controls. */
export default function MusicNowPlaying({ value, onChange, tracks = SAMPLE, onNext, onPrev, accent = C.accent }: Props) {
  const list = tracks.length ? tracks : SAMPLE
  const [inner, setInner] = useState(false)
  const playing = value ?? inner
  const [index, setIndex] = useState(0)
  const [t, setT] = useState(64)
  const [liked, setLiked] = useState<string[]>([])
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const track = list[index % list.length]
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const play = (p: boolean) => {
    if (value === undefined) setInner(p)
    onChange?.(p)
  }
  const skip = (d: number) => {
    const n = shuffle && list.length > 1 ? (index + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length : (index + d + list.length) % list.length
    setIndex(n)
    setT(0)
    ;(d > 0 ? onNext : onPrev)?.(list[n])
  }

  // shortcut: a 1 s timer stands in for real audio; wire `value` to your player for true position
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [playing])
  useEffect(() => {
    if (t < track.duration) return
    if (repeat) setT(0)
    else skip(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const pct = Math.min(100, (t / track.duration) * 100)
  const isLiked = liked.includes(track.title)

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={330}
      flexDirection="column"
      padding={18}
      gap={16}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={22}
    >
      <Container flexDirection="row" gap={14} alignItems="center">
        <Cover key={track.title} src={track.cover} playing={playing} accent={accent} />
        <Container flexDirection="column" flexGrow={1} flexShrink={1} gap={3}>
          <Text fontSize={11} fontWeight="semi-bold" letterSpacing={0.5} color={playing ? accent : C.faint}>
            {playing ? "NOW PLAYING" : "PAUSED"}
          </Text>
          <Text fontSize={17} fontWeight="semi-bold" color={C.text}>
            {track.title}
          </Text>
          <Text fontSize={13} color={C.muted}>
            {track.artist}
          </Text>
        </Container>
        <Press
          width={40}
          height={40}
          borderRadius={12}
          alignItems="center"
          justifyContent="center"
          hover={{ backgroundColor: C.hover }}
          onClick={() => setLiked(isLiked ? liked.filter((x) => x !== track.title) : [...liked, track.title])}
        >
          <Heart width={19} height={19} color={isLiked ? C.like : C.muted} />
        </Press>
      </Container>

      <Container flexDirection="column" gap={6}>
        <Container height={14} justifyContent="center">
          <Container height={4} borderRadius={2} backgroundColor={C.track}>
            <Container width={`${pct}%`} height={4} borderRadius={2} backgroundColor={accent} />
          </Container>
          <Container positionType="absolute" positionLeft={`${pct}%`} marginLeft={-6} width={12} height={12} borderRadius={6} backgroundColor={C.text} />
        </Container>
        <Container flexDirection="row" justifyContent="space-between">
          <Text fontSize={11} color={C.faint}>
            {clock(t)}
          </Text>
          <Text fontSize={11} color={C.faint}>
            {`-${clock(Math.max(0, track.duration - t))}`}
          </Text>
        </Container>
      </Container>

      <Container flexDirection="row" alignItems="center" justifyContent="space-between">
        <Small on={shuffle} accent={accent} onPress={() => setShuffle(!shuffle)}>
          <Shuffle width={18} height={18} color={shuffle ? accent : C.muted} />
        </Small>
        <Small onPress={() => skip(-1)}>
          <SkipBack width={22} height={22} color={C.text} />
        </Small>
        <Press width={60} height={60} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={accent} hover={{ backgroundColor: withOpacity(accent, 0.88) }} onClick={() => play(!playing)}>
          {playing ? <Pause width={24} height={24} color={C.onAccent} /> : <Play width={24} height={24} color={C.onAccent} marginLeft={3} />}
        </Press>
        <Small onPress={() => skip(1)}>
          <SkipForward width={22} height={22} color={C.text} />
        </Small>
        <Small on={repeat} accent={accent} onPress={() => setRepeat(!repeat)}>
          <Repeat width={18} height={18} color={repeat ? accent : C.muted} />
        </Small>
      </Container>
    </Container>
  )
}

/** Cover art (or a generated one) with an equalizer that dances while playing. Memoised so the 1 s tick doesn't re-render it. */
const Cover = memo(function Cover({ src, playing, accent }: { src?: string; playing: boolean; accent: string }) {
  const [ref, s] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.8, transformScaleY: 0.8 })
  const bars = [useRef<VanillaContainer>(null), useRef<VanillaContainer>(null), useRef<VanillaContainer>(null), useRef<VanillaContainer>(null)]
  const level = useRef(0)
  useFrame(({ clock: c }, dt) => {
    level.current += ((playing ? 1 : 0) - level.current) * Math.min(1, dt * 6)
    if (level.current < 0.001 && !playing) return
    bars.forEach((b, i) => b.current?.setProperties({ height: 4 + level.current * (6 + Math.abs(Math.sin(c.elapsedTime * (5 + i * 1.7) + i)) * 14) }))
  })
  return (
    <Container ref={ref} {...s} width={96} height={96} borderRadius={16} overflow="hidden" backgroundColor="#2A1F3D">
      {src ? (
        <Image src={src} width={96} height={96} objectFit="cover" />
      ) : (
        <>
          <Container positionType="absolute" positionRight={-26} positionBottom={-30} width={96} height={96} borderRadius={48} backgroundColor={C.warm} />
          <Container positionType="absolute" positionLeft={-18} positionTop={-14} width={64} height={64} borderRadius={32} backgroundColor={withOpacity(C.lilac, 0.55)} />
          <Container positionType="absolute" positionLeft={30} positionTop={34} width={22} height={22} borderRadius={11} borderWidth={3} borderColor={withOpacity("#FFFFFF", 0.8)} />
        </>
      )}
      <Container positionType="absolute" positionLeft={8} positionBottom={8} flexDirection="row" alignItems="flex-end" gap={3} height={26} paddingX={6} paddingY={4} borderRadius={8} backgroundColor={withOpacity("#0B0C10", 0.55)}>
        {bars.map((b, i) => (
          <Container key={i} ref={b} width={3} height={4} borderRadius={2} backgroundColor={accent} />
        ))}
      </Container>
    </Container>
  )
})

function Small({ on, accent, onPress, children }: { on?: boolean; accent?: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Press
      width={44}
      height={44}
      borderRadius={12}
      alignItems="center"
      justifyContent="center"
      backgroundColor={on && accent ? withOpacity(accent, 0.12) : withOpacity("#FFFFFF", 0)}
      hover={{ backgroundColor: C.hover }}
      onClick={onPress}
    >
      {children}
    </Press>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.9 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? 4 : 0, transformScaleX: k, transformScaleY: k })
  return (
    <Container ref={ref} cursor="pointer" {...props} {...s} onHoverChange={setHover} onActiveChange={setDown}>
      {children}
    </Container>
  )
}

/** uikit has no CSS transitions: spring numeric props toward `to` each frame. Spread the returned values on the Container too. */
function useSpring<T extends Record<string, number>>(to: T, from: Partial<T> = {}) {
  const ref = useRef<VanillaContainer>(null)
  const s = useRef<{ x: Record<string, number>; v: Record<string, number> }>(null)
  if (!s.current) s.current = { x: { ...to, ...from }, v: {} }
  useFrame((_, dt) => {
    const { x, v } = s.current!
    const h = Math.min(dt, 1 / 30)
    let moved = false
    for (const k in to) {
      if (x[k] === to[k] && !v[k]) continue
      v[k] = (v[k] ?? 0) + ((to[k] - x[k]) * 320 - (v[k] ?? 0) * 24) * h
      x[k] += v[k] * h
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) (x[k] = to[k]), (v[k] = 0)
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
