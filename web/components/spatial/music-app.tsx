// Ported from pmndrs/uikit examples/market (MIT, © 2024 Bela Bohlender), a 3D port of the shadcn/ui music app, and refined for Spatial.
"use client"

import { memo, useEffect, useRef, useState, type ComponentType } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Image as Picture, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { CirclePlay, Disc3, Heart, LayoutGrid, Library, ListMusic, Mic, Music2, Pause, Play, Podcast, Radio, SkipBack, SkipForward, User } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", track: "#2A2E3A", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B", like: "#F0A6B8" }

type Kind = "listen" | "made" | "podcast"
type Album = { name: string; artist: string; cover: string; duration: number; kind: Kind }
type Props = {
  /** index of the selected (now playing) album */
  value?: number
  onChange?: (index: number) => void
  /** is the now-playing track running */
  playing?: boolean
  onPlayingChange?: (playing: boolean) => void
  albums?: Album[]
  title?: string
  accent?: string
}

const pic = (n: number) => `https://picsum.photos/id/${n}/300/300`
const ALBUMS: Album[] = [
  { name: "React Rendezvous", artist: "Ethan Byte", cover: pic(1062), duration: 214, kind: "listen" },
  { name: "Async Awakenings", artist: "Nina Netcode", cover: pic(1015), duration: 187, kind: "listen" },
  { name: "The Art of Reusability", artist: "Lena Logic", cover: pic(1035), duration: 242, kind: "listen" },
  { name: "Stateful Symphony", artist: "Beth Binary", cover: pic(1084), duration: 201, kind: "listen" },
  { name: "Low Orbit", artist: "Kites", cover: pic(1041), duration: 195, kind: "listen" },
  { name: "Thinking Components", artist: "Lena Logic", cover: pic(1025), duration: 228, kind: "made" },
  { name: "Functional Fury", artist: "Beth Binary", cover: pic(1043), duration: 176, kind: "made" },
  { name: "Midnight Drive", artist: "Neon Coast", cover: pic(1050), duration: 217, kind: "made" },
  { name: "Glass Rooms", artist: "Lumen", cover: pic(1067), duration: 233, kind: "made" },
  { name: "Hooked on Hooks", artist: "Ethan Byte", cover: pic(1074), duration: 190, kind: "made" },
  { name: "Pure Functions", artist: "Nina Netcode", cover: pic(1080), duration: 205, kind: "made" },
  { name: "Shipping Fridays", artist: "The Changelog", cover: pic(1060), duration: 2460, kind: "podcast" },
  { name: "Design in Depth", artist: "Spatial Talks", cover: pic(1039), duration: 1920, kind: "podcast" },
  { name: "Signal & Noise", artist: "Waveform", cover: pic(1011), duration: 3120, kind: "podcast" },
  { name: "Night Shift", artist: "Render Loop", cover: pic(1019), duration: 1500, kind: "podcast" },
]

type Nav = { label: string; Icon: ComponentType<{ width?: number; height?: number; color?: string }> }
const SECTIONS: { title: string; items: Nav[] }[] = [
  { title: "Discover", items: [{ label: "Listen Now", Icon: CirclePlay }, { label: "Browse", Icon: LayoutGrid }, { label: "Radio", Icon: Radio }] },
  { title: "Library", items: [{ label: "Songs", Icon: Music2 }, { label: "Made for You", Icon: User }, { label: "Albums", Icon: Library }] },
  { title: "Playlists", items: [{ label: "Recently Added", Icon: ListMusic }, { label: "Top Songs", Icon: ListMusic }, { label: "Bedtime Beats", Icon: ListMusic }] },
]
const TABS = ["Music", "Podcasts", "Live"] as const

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** Music app: sidebar navigation, Listen Now / Made for You album rows, a Podcasts tab and a now-playing bar. Tap a cover to play it. */
export default function MusicApp({ value, onChange, playing, onPlayingChange, albums = ALBUMS, title = "Listen Now", accent = C.accent }: Props) {
  const list = albums.length ? albums : ALBUMS
  const [inner, setInner] = useState(0)
  const sel = Math.min(list.length - 1, Math.max(0, Math.round(value ?? inner)))
  const [innerPlay, setInnerPlay] = useState(false)
  const on = playing ?? innerPlay
  const [nav, setNav] = useState(0)
  const [tab, setTab] = useState<(typeof TABS)[number]>("Music")
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const setPlay = (p: boolean) => {
    if (playing === undefined) setInnerPlay(p)
    onPlayingChange?.(p)
  }
  const pick = (i: number, autoplay = true) => {
    const n = (i + list.length) % list.length
    if (value === undefined) setInner(n)
    onChange?.(n)
    if (autoplay) setPlay(true)
  }

  const idx = list.map((a, i) => ({ a, i }))
  const navs = SECTIONS.flatMap((s) => s.items)
  // Each sidebar page reorders the shelf so the view visibly changes, like browsing a different list.
  const shift = (arr: typeof idx) => arr.map((_, k) => arr[(k + nav) % arr.length])
  const listen = shift(idx.filter((x) => x.a.kind === "listen")).slice(0, 5)
  const made = shift(idx.filter((x) => x.a.kind === "made")).slice(0, 6)
  const pods = idx.filter((x) => x.a.kind === "podcast").slice(0, 4)
  const heading = nav === 0 ? title : navs[nav].label

  return (
    <Container ref={panel} {...enter} pixelSize={0.002} width={640} height={400} flexDirection="column" backgroundColor={C.panel} borderWidth={1} borderColor={C.border} borderRadius={20} overflow="hidden">
      <Container flexDirection="row" flexGrow={1} flexShrink={1} minHeight={0}>
        {/* Sidebar */}
        <Container width={148} flexShrink={0} flexDirection="column" paddingX={8} paddingTop={14} gap={10} backgroundColor={C.deep} borderRightWidth={1} borderColor={C.line}>
          <Container flexDirection="row" alignItems="center" gap={6} paddingX={8} paddingBottom={2}>
            <Disc3 width={16} height={16} color={accent} />
            <Text fontSize={13} fontWeight="bold" color={C.text}>
              Music
            </Text>
          </Container>
          {SECTIONS.map((s, si) => (
            <Container key={s.title} flexDirection="column" gap={1}>
              <Text fontSize={9} fontWeight="semi-bold" letterSpacing={0.8} color={C.faint} paddingX={8} paddingBottom={3}>
                {s.title.toUpperCase()}
              </Text>
              {s.items.map((it, ii) => {
                const k = SECTIONS.slice(0, si).reduce((n, x) => n + x.items.length, 0) + ii
                const act = k === nav
                return (
                  <Press
                    key={it.label}
                    lift={1}
                    height={24}
                    paddingX={8}
                    borderRadius={7}
                    flexDirection="row"
                    alignItems="center"
                    gap={7}
                    backgroundColor={act ? withOpacity(accent, 0.14) : withOpacity("#FFFFFF", 0)}
                    hover={{ backgroundColor: act ? withOpacity(accent, 0.18) : withOpacity("#FFFFFF", 0.05) }}
                    onClick={() => {
                      setNav(k)
                      setTab("Music")
                    }}
                  >
                    <it.Icon width={13} height={13} color={act ? accent : C.muted} />
                    <Text fontSize={11} fontWeight={act ? "semi-bold" : "medium"} color={act ? C.text : C.muted}>
                      {it.label}
                    </Text>
                  </Press>
                )
              })}
            </Container>
          ))}
        </Container>

        {/* Main */}
        <Container flexGrow={1} flexShrink={1} flexDirection="column" paddingX={16} paddingTop={10} gap={8} overflow="hidden">
          <Container flexDirection="row" alignItems="center" justifyContent="space-between" flexShrink={0}>
            <Container flexDirection="row" padding={3} gap={2} borderRadius={9} backgroundColor={C.row}>
              {TABS.map((t) => {
                const act = t === tab
                const off = t === "Live"
                return (
                  <Press
                    key={t}
                    lift={off ? 0 : 1}
                    height={22}
                    paddingX={12}
                    borderRadius={7}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor={act ? C.hover : withOpacity("#FFFFFF", 0)}
                    hover={{ backgroundColor: act || off ? (act ? C.hover : withOpacity("#FFFFFF", 0)) : withOpacity("#FFFFFF", 0.05) }}
                    cursor={off ? "default" : "pointer"}
                    onClick={() => !off && setTab(t)}
                  >
                    <Text fontSize={11} fontWeight="semi-bold" color={act ? C.text : off ? C.faint : C.muted}>
                      {t}
                    </Text>
                  </Press>
                )
              })}
            </Container>
            <Text fontSize={10} color={C.faint}>
              {tab === "Music" ? `${listen.length + made.length} albums` : `${pods.length} new episodes`}
            </Text>
          </Container>

          {tab === "Music" ? (
            <>
              <Heading title={heading} sub="Top picks for you. Updated daily." />
              <Container flexDirection="row" gap={10} flexShrink={0}>
                {listen.map(({ a, i }) => (
                  <Cover key={i} album={a} size={80} active={i === sel} playing={on && i === sel} accent={accent} onPick={() => pick(i)} />
                ))}
              </Container>
              <Heading title="Made for You" sub="Your personal playlists." />
              <Container flexDirection="row" gap={10} flexShrink={0}>
                {made.map(({ a, i }) => (
                  <Cover key={i} album={a} size={67} active={i === sel} playing={on && i === sel} accent={accent} onPick={() => pick(i)} />
                ))}
              </Container>
            </>
          ) : (
            <>
              <Heading title="New Episodes" sub="Your favorite podcasts. Updated daily." />
              <Container flexDirection="column" gap={2} flexShrink={0}>
                {pods.map(({ a, i }) => {
                  const act = i === sel
                  return (
                    <Press
                      key={i}
                      lift={1}
                      height={50}
                      paddingX={8}
                      borderRadius={10}
                      flexDirection="row"
                      alignItems="center"
                      gap={10}
                      backgroundColor={act ? withOpacity(accent, 0.1) : withOpacity("#FFFFFF", 0)}
                      hover={{ backgroundColor: act ? withOpacity(accent, 0.14) : withOpacity("#FFFFFF", 0.04) }}
                      onClick={() => pick(i)}
                    >
                      <Picture src={a.cover} width={38} height={38} borderRadius={7} objectFit="cover" />
                      <Container flexDirection="column" flexGrow={1} gap={2}>
                        <Text fontSize={12} fontWeight="semi-bold" color={act ? accent : C.text}>
                          {a.name}
                        </Text>
                        <Text fontSize={10} color={C.muted}>
                          {a.artist}
                        </Text>
                      </Container>
                      <Text fontSize={10} color={C.faint}>
                        {`${Math.round(a.duration / 60)} min`}
                      </Text>
                      <Container width={26} height={26} borderRadius={13} alignItems="center" justifyContent="center" backgroundColor={act ? accent : C.hover}>
                        {act && on ? <Pause width={12} height={12} color={act ? C.onAccent : C.text} /> : <Play width={12} height={12} marginLeft={1} color={act ? C.onAccent : C.text} />}
                      </Container>
                    </Press>
                  )
                })}
              </Container>
              <Container flexDirection="row" alignItems="center" gap={8} paddingX={8} paddingTop={4}>
                <Podcast width={13} height={13} color={C.faint} />
                <Text fontSize={10} color={C.faint}>
                  Subscribed to 4 shows · new episodes every Tuesday
                </Text>
              </Container>
            </>
          )}
        </Container>
      </Container>

      <NowPlaying album={list[sel]} playing={on} accent={accent} onPlay={setPlay} onSkip={(d) => pick(sel + d, on)} />
    </Container>
  )
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <Container flexDirection="row" alignItems="flex-end" gap={8} flexShrink={0} marginTop={2}>
      <Text fontSize={14} fontWeight="semi-bold" letterSpacing={-0.2} color={C.text}>
        {title}
      </Text>
      <Text fontSize={10} color={C.faint} paddingBottom={1}>
        {sub}
      </Text>
    </Container>
  )
}

/** Album artwork with name and artist (the example's AlbumArtwork). Lifts on hover, rings in the accent when it's the current track. */
const Cover = memo(function Cover({ album, size, active, playing, accent, onPick }: { album: Album; size: number; active: boolean; playing: boolean; accent: string; onPick: () => void }) {
  return (
    <Press lift={4} width={size} flexDirection="column" gap={5} onClick={onPick}>
      <Container width={size} height={size} borderRadius={8} borderWidth={2} borderColor={active ? accent : withOpacity("#FFFFFF", 0)} overflow="hidden" backgroundColor={C.row}>
        <Picture src={album.cover} width="100%" height="100%" objectFit="cover" />
        {active ? (
          <Container positionType="absolute" positionRight={4} positionBottom={4} width={20} height={20} borderRadius={10} alignItems="center" justifyContent="center" backgroundColor={accent}>
            {playing ? <Pause width={10} height={10} color={C.onAccent} /> : <Play width={10} height={10} marginLeft={1} color={C.onAccent} />}
          </Container>
        ) : null}
      </Container>
      <Container flexDirection="column" gap={1}>
        <Text fontSize={10} fontWeight="semi-bold" color={active ? accent : C.text}>
          {fit(album.name, size)}
        </Text>
        <Text fontSize={9} color={C.muted}>
          {fit(album.artist, size)}
        </Text>
      </Container>
    </Press>
  )
})

// shortcut: character-count truncation (≈6.2 px per glyph at 10 px, the font has no "…" glyph); swap for measured text if fonts change
const fit = (s: string, w: number) => (s.length * 6.2 <= w ? s : `${s.slice(0, Math.max(3, Math.floor(w / 6.2) - 2)).trimEnd()}...`)

/** Bottom transport bar. Owns the playhead so the 4 Hz tick only re-renders this bar. */
function NowPlaying({ album, playing, accent, onPlay, onSkip }: { album: Album; playing: boolean; accent: string; onPlay: (p: boolean) => void; onSkip: (d: number) => void }) {
  const [t, setT] = useState(0)
  const [liked, setLiked] = useState<string[]>([])
  const fill = useRef<VanillaContainer>(null)
  const live = useRef({ t: 0, d: album.duration })
  useEffect(() => {
    live.current = { t: 0, d: album.duration }
    fill.current?.setProperties({ width: "0%" })
    setT(0)
  }, [album])
  // shortcut: a frame clock stands in for real audio; wire `playing`/`value` to a player for true position
  useFrame((_, dt) => {
    if (!playing) return
    const s = live.current
    s.t = Math.min(s.d, s.t + dt)
    fill.current?.setProperties({ width: `${(s.t / s.d) * 100}%` })
    if (Math.floor(s.t) !== t) setT(Math.floor(s.t))
    if (s.t >= s.d) {
      s.t = 0
      onSkip(1)
    }
  })
  const like = liked.includes(album.name)

  return (
    <Container height={64} flexShrink={0} flexDirection="row" alignItems="center" paddingX={14} gap={14} backgroundColor={C.deep} borderTopWidth={1} borderColor={C.line}>
      <Container width={190} flexDirection="row" alignItems="center" gap={10}>
        <Picture key={album.cover} src={album.cover} width={42} height={42} borderRadius={7} objectFit="cover" />
        <Container flexDirection="column" flexGrow={1} flexShrink={1} gap={2}>
          <Text fontSize={12} fontWeight="semi-bold" color={C.text}>
            {fit(album.name, 100)}
          </Text>
          <Text fontSize={10} color={C.muted}>
            {album.artist}
          </Text>
        </Container>
        <Press width={26} height={26} borderRadius={8} alignItems="center" justifyContent="center" hover={{ backgroundColor: C.hover }} onClick={() => setLiked(like ? liked.filter((x) => x !== album.name) : [...liked, album.name])}>
          <Heart width={14} height={14} color={like ? C.like : C.muted} />
        </Press>
      </Container>

      <Container flexGrow={1} flexDirection="column" alignItems="center" gap={4}>
        <Container flexDirection="row" alignItems="center" gap={12}>
          <Press width={28} height={28} borderRadius={8} alignItems="center" justifyContent="center" hover={{ backgroundColor: C.hover }} onClick={() => onSkip(-1)}>
            <SkipBack width={15} height={15} color={C.text} />
          </Press>
          <Press width={32} height={32} borderRadius={16} alignItems="center" justifyContent="center" backgroundColor={accent} hover={{ backgroundColor: withOpacity(accent, 0.88) }} onClick={() => onPlay(!playing)}>
            {playing ? <Pause width={15} height={15} color={C.onAccent} /> : <Play width={15} height={15} marginLeft={2} color={C.onAccent} />}
          </Press>
          <Press width={28} height={28} borderRadius={8} alignItems="center" justifyContent="center" hover={{ backgroundColor: C.hover }} onClick={() => onSkip(1)}>
            <SkipForward width={15} height={15} color={C.text} />
          </Press>
        </Container>
        <Container flexDirection="row" alignItems="center" gap={8} width="100%">
          <Text fontSize={9} color={C.faint} width={30} textAlign="right">
            {clock(t)}
          </Text>
          <Container flexGrow={1} height={4} borderRadius={2} backgroundColor={C.track}>
            <Container ref={fill} width={`${(t / album.duration) * 100}%`} height={4} borderRadius={2} backgroundColor={accent} />
          </Container>
          <Text fontSize={9} color={C.faint} width={30}>
            {clock(album.duration)}
          </Text>
        </Container>
      </Container>

      <Container width={110} flexDirection="row" alignItems="center" justifyContent="flex-end" gap={6}>
        {album.kind === "podcast" ? <Mic width={13} height={13} color={C.faint} /> : <Music2 width={13} height={13} color={C.faint} />}
        <Text fontSize={10} color={playing ? accent : C.faint} fontWeight="semi-bold" letterSpacing={0.4}>
          {playing ? "PLAYING" : "PAUSED"}
        </Text>
      </Container>
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, lift = 3, ...props }: ContainerProperties & { lift?: number }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.98 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? lift : 0, transformScaleX: k, transformScaleY: k })
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
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) {
        x[k] = to[k]
        v[k] = 0
      }
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
