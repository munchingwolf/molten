"use client"
// Built for Spatial.

import { useEffect, useRef, useState } from "react"
import { Quaternion, Vector3 } from "three"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import {
  BatteryMedium,
  BookOpen,
  Calculator,
  Calendar,
  Camera,
  Dumbbell,
  FolderOpen,
  Globe,
  Image,
  Joystick,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  NotebookPen,
  Puzzle,
  Rocket,
  Search,
  Settings,
  Swords,
  Tv,
  Wifi,
} from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", card: "#1B1E27", border: "#323745", line: "#242833", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B" }

type Cat = "apps" | "games" | "tools" | "media"
type App = { id: string; name: string; icon: typeof Music; color: string; cat: Cat }
type Props = {
  title?: string
  /** id of the last opened app */
  value?: string
  onChange?: (id: string) => void
  onOpen?: (id: string) => void
  accent?: string
}

const APPS: App[] = [
  { id: "browser", name: "Browser", icon: Globe, color: "#3BA8F5", cat: "apps" },
  { id: "music", name: "Music", icon: Music, color: "#F2557A", cat: "media" },
  { id: "messages", name: "Messages", icon: MessageCircle, color: "#34C77B", cat: "apps" },
  { id: "photos", name: "Photos", icon: Image, color: "#F0A43A", cat: "media" },
  { id: "tv", name: "TV", icon: Tv, color: "#4F6BF0", cat: "media" },
  { id: "beat-arena", name: "Beat Arena", icon: Swords, color: "#9B6BF2", cat: "games" },
  { id: "mail", name: "Mail", icon: Mail, color: "#4C8DF6", cat: "apps" },
  { id: "calendar", name: "Calendar", icon: Calendar, color: "#EF6A5A", cat: "apps" },
  { id: "maps", name: "Maps", icon: MapPin, color: "#2FB59A", cat: "apps" },
  { id: "puzzle-room", name: "Puzzle Room", icon: Puzzle, color: "#F08A3E", cat: "games" },
  { id: "orbit-run", name: "Orbit Run", icon: Rocket, color: "#6672F0", cat: "games" },
  { id: "files", name: "Files", icon: FolderOpen, color: "#3E9BEF", cat: "tools" },
  { id: "camera", name: "Camera", icon: Camera, color: "#6E7687", cat: "media" },
  { id: "arcade", name: "Arcade", icon: Joystick, color: "#E2559E", cat: "games" },
  { id: "fitness", name: "Fitness", icon: Dumbbell, color: "#1FB5CC", cat: "games" },
  { id: "notes", name: "Notes", icon: NotebookPen, color: "#E0B12C", cat: "tools" },
  { id: "calculator", name: "Calculator", icon: Calculator, color: "#E3862B", cat: "tools" },
  { id: "books", name: "Books", icon: BookOpen, color: "#E96F3C", cat: "media" },
  { id: "settings", name: "Settings", icon: Settings, color: "#7B8394", cat: "tools" },
]
const DOCK = ["browser", "music", "messages", "photos", "settings"]
const CHIPS: { id: "all" | Cat; label: string }[] = [
  { id: "all", label: "All" },
  { id: "apps", label: "Apps" },
  { id: "games", label: "Games" },
  { id: "tools", label: "Tools" },
  { id: "media", label: "Media" },
]
// Tapping the search field cycles these demo queries (no keyboard in a headset demo).
const QUERIES = ["", "ca", "mu", "ar"]
const COLS = 6
const PER_PAGE = 12
const TILE_W = 92
const GAP = 8
const byId = (id: string) => APPS.find((a) => a.id === id)
const clock = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
const today = () => new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })

/** Home launcher: status bar, search, category chips, a paged app grid (swipe or tap dots), pinned dock; tapping an app opens it with a toast. */
export default function AppLauncher({ title = "Home", value, onChange, onOpen, accent = C.accent }: Props) {
  const [inner, setInner] = useState("")
  const last = value ?? inner
  const [q, setQ] = useState(0)
  const [cat, setCat] = useState<"all" | Cat>("all")
  const [page, setPage] = useState(0)
  const [time, setTime] = useState(clock)
  const [toast, setToast] = useState<{ app: App; n: number } | null>(null)
  const [popping, setPopping] = useState<string | null>(null)
  const swipe = useRef<Vector3 | null>(null)
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  useEffect(() => {
    const t = setInterval(() => setTime(clock()), 10000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1600)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (!popping) return
    const t = setTimeout(() => setPopping(null), 180)
    return () => clearTimeout(t)
  }, [popping])

  const query = QUERIES[q]
  const shown = APPS.filter((a) => (cat === "all" || a.cat === cat) && (!query || a.name.toLowerCase().includes(query)))
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
  const pg = Math.min(page, pages - 1)
  const visible = shown.slice(pg * PER_PAGE, pg * PER_PAGE + PER_PAGE)
  const rows = [visible.slice(0, COLS), visible.slice(COLS)]

  const open = (app: App) => {
    if (value === undefined) setInner(app.id)
    onChange?.(app.id)
    onOpen?.(app.id)
    setPopping(app.id)
    setToast((t) => ({ app, n: (t?.n ?? 0) + 1 }))
  }
  const filter = (fn: () => void) => {
    fn()
    setPage(0)
  }
  const endSwipe = (point: Vector3) => {
    const from = swipe.current
    swipe.current = null
    if (!from || pages < 2 || !panel.current) return
    // Distance along the panel's own x axis, in metres, so it works however the panel is placed.
    const axis = new Vector3(1, 0, 0).applyQuaternion(panel.current.getWorldQuaternion(new Quaternion()))
    const dx = point.clone().sub(from).dot(axis)
    if (Math.abs(dx) > 0.05) setPage(Math.min(pages - 1, Math.max(0, pg + (dx < 0 ? 1 : -1))))
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={640}
      height={400}
      flexDirection="column"
      padding={14}
      gap={10}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={22}
      overflow="hidden"
    >
      {/* Status bar */}
      <Container flexDirection="row" alignItems="center" height={20} paddingX={4} gap={8}>
        <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
          {time}
        </Text>
        <Text fontSize={12} color={C.faint} flexGrow={1}>
          {today()}
        </Text>
        <Text fontSize={12} fontWeight="semi-bold" color={C.muted}>
          {title}
        </Text>
        <Container flexGrow={1} flexDirection="row" justifyContent="flex-end" alignItems="center" gap={8}>
          <Wifi width={15} height={15} color={C.text} />
          <BatteryMedium width={18} height={18} color={C.text} />
          <Text fontSize={12} fontWeight="medium" color={C.text}>
            82%
          </Text>
        </Container>
      </Container>

      {/* Search + category chips */}
      <Container flexDirection="row" alignItems="center" gap={10} height={34}>
        <Press
          flexGrow={1}
          height={34}
          borderRadius={17}
          paddingX={12}
          flexDirection="row"
          alignItems="center"
          gap={8}
          backgroundColor={C.deep}
          borderWidth={1}
          borderColor={query ? withOpacity(accent, 0.6) : C.line}
          hover={{ backgroundColor: C.card }}
          lift={1}
          onClick={() => filter(() => setQ((i) => (i + 1) % QUERIES.length))}
        >
          <Search width={15} height={15} color={query ? accent : C.faint} />
          <Text fontSize={13} color={query ? C.text : C.faint}>
            {query || "Search apps"}
          </Text>
          {query ? <Container width={2} height={16} borderRadius={1} backgroundColor={accent} /> : null}
          <Text flexGrow={1} textAlign="right" fontSize={11} color={C.faint}>
            {query ? `${shown.length} found` : ""}
          </Text>
        </Press>
        {CHIPS.map((c) => {
          const on = c.id === cat
          return (
            <Press
              key={c.id}
              height={30}
              paddingX={12}
              borderRadius={15}
              alignItems="center"
              justifyContent="center"
              backgroundColor={on ? accent : C.card}
              hover={{ backgroundColor: on ? accent : C.hover }}
              lift={2}
              onClick={() => filter(() => setCat(c.id))}
            >
              <Text fontSize={12} fontWeight="semi-bold" color={on ? C.onAccent : C.muted}>
                {c.label}
              </Text>
            </Press>
          )
        })}
      </Container>

      {/* App grid: swipe sideways to change page */}
      <Container
        flexDirection="column"
        alignItems="center"
        gap={GAP}
        height={2 * 92 + GAP}
        onPointerDown={(e) => (swipe.current = e.point.clone())}
        onPointerUp={(e) => endSwipe(e.point)}
        onPointerLeave={() => (swipe.current = null)}
      >
        {visible.length === 0 ? (
          <Container flexGrow={1} alignItems="center" justifyContent="center">
            <Text fontSize={13} color={C.faint}>
              {`No apps match "${query}"`}
            </Text>
          </Container>
        ) : (
          rows.map((row, r) => (
            <Container key={r} flexDirection="row" gap={GAP} width={COLS * TILE_W + (COLS - 1) * GAP} height={92}>
              {row.map((a) => (
                <Tile key={a.id} app={a} pop={popping === a.id} active={last === a.id} accent={accent} onOpen={() => open(a)} />
              ))}
            </Container>
          ))
        )}
      </Container>

      {/* Pagination dots */}
      <Container flexDirection="row" justifyContent="center" alignItems="center" height={20}>
        {pages > 1
          ? Array.from({ length: pages }, (_, i) => (
              <Press key={i} width={26} height={20} alignItems="center" justifyContent="center" lift={1} onClick={() => setPage(i)}>
                <Dot on={i === pg} accent={accent} />
              </Press>
            ))
          : null}
      </Container>

      {/* Dock */}
      <Container flexDirection="row" justifyContent="center" flexGrow={1} alignItems="flex-end">
        <Container flexDirection="row" gap={10} padding={8} borderRadius={22} backgroundColor={withOpacity("#FFFFFF", 0.04)} borderWidth={1} borderColor={C.border}>
          {DOCK.map((id) => {
            const a = byId(id)
            return a ? <Icon key={id} app={a} size={44} pop={popping === id} onOpen={() => open(a)} /> : null
          })}
        </Container>
      </Container>

      {toast ? <Toast key={toast.n} app={toast.app} accent={accent} /> : null}
    </Container>
  )
}

/** Grid tile: icon square + label; lifts and brightens on hover, springs when opened. */
function Tile({ app, pop, active, accent, onOpen }: { app: App; pop: boolean; active: boolean; accent: string; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = pop ? 1.14 : down ? 0.94 : hover ? 1.05 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover ? 10 : 0, transformScaleX: k, transformScaleY: k })
  return (
    <Container
      ref={ref}
      {...s}
      width={TILE_W}
      height={92}
      borderRadius={16}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={6}
      cursor="pointer"
      backgroundColor={withOpacity("#FFFFFF", hover ? 0.06 : 0)}
      onHoverChange={setHover}
      onActiveChange={setDown}
      onClick={onOpen}
    >
      <Glyph app={app} size={54} />
      <Container flexDirection="row" alignItems="center" gap={4}>
        {active ? <Container width={5} height={5} borderRadius={3} backgroundColor={accent} /> : null}
        <Text fontSize={12} fontWeight="medium" color={hover ? C.text : C.muted}>
          {app.name}
        </Text>
      </Container>
    </Container>
  )
}

/** Dock icon (no label). */
function Icon({ app, size, pop, onOpen }: { app: App; size: number; pop: boolean; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = pop ? 1.16 : down ? 0.92 : hover ? 1.1 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover ? 10 : 0, transformScaleX: k, transformScaleY: k })
  return (
    <Container ref={ref} {...s} cursor="pointer" onHoverChange={setHover} onActiveChange={setDown} onClick={onOpen}>
      <Glyph app={app} size={size} />
    </Container>
  )
}

/** Rounded app icon with a top sheen and darker foot, so the flat colour reads as a gradient. */
function Glyph({ app, size }: { app: App; size: number }) {
  const r = size * 0.28
  return (
    <Container width={size} height={size} borderRadius={r} backgroundColor={app.color} alignItems="center" justifyContent="center" overflow="hidden">
      <Container positionType="absolute" positionTop={0} positionLeft={0} positionRight={0} height="50%" backgroundColor={withOpacity("#FFFFFF", 0.16)} />
      <Container positionType="absolute" positionBottom={0} positionLeft={0} positionRight={0} height="22%" backgroundColor={withOpacity("#000000", 0.12)} />
      <app.icon width={size * 0.48} height={size * 0.48} color="#FFFFFF" />
    </Container>
  )
}

function Dot({ on, accent }: { on: boolean; accent: string }) {
  const [ref, s] = useSpring({ width: on ? 18 : 7 })
  return <Container ref={ref} {...s} height={7} borderRadius={4} backgroundColor={on ? accent : C.border} />
}

/** "Opening X…" sheet that springs up above the dock, then the parent removes it. */
function Toast({ app, accent }: { app: App; accent: string }) {
  const [ref, s] = useSpring({ transformScaleX: 1, transformScaleY: 1, transformTranslateY: 0 }, { transformScaleX: 0.6, transformScaleY: 0.6, transformTranslateY: -16 })
  return (
    <Container
      ref={ref}
      {...s}
      positionType="absolute"
      positionBottom={86}
      positionLeft={210}
      width={220}
      height={46}
      paddingX={8}
      gap={10}
      borderRadius={23}
      flexDirection="row"
      alignItems="center"
      backgroundColor={C.card}
      borderWidth={1}
      borderColor={withOpacity(accent, 0.5)}
      zIndexOffset={10}
      transformTranslateZ={16}
    >
      <Glyph app={app} size={30} />
      <Container flexDirection="column">
        <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
          {`Opening ${app.name}…`}
        </Text>
        <Text fontSize={11} color={C.faint}>
          Launching in your space
        </Text>
      </Container>
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, lift = 3, ...props }: ContainerProperties & { lift?: number }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.97 : 1
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
