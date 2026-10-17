"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { ChevronLeft, ChevronRight, File, FileArchive, FileImage, FileMusic, FileSpreadsheet, FileText, Film, Folder } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", warm: "#F2B48A" }

type Entry = { name: string; children?: Entry[]; size?: string; modified?: string }
type Props = {
  root?: Entry
  /** path of the selected file, e.g. "My Drive/Design/Moodboard.png" */
  value?: string
  onChange?: (path: string) => void
  onSelect?: (file: Entry, path: string) => void
  onOpenFolder?: (path: string) => void
  accent?: string
}

const SAMPLE: Entry = {
  name: "My Drive",
  children: [
    {
      name: "Design",
      children: [
        { name: "Spatial UI kit.fig", size: "48 MB", modified: "2h ago" },
        { name: "Moodboard.png", size: "6.2 MB", modified: "Yesterday" },
        { name: "Icons", children: [{ name: "lucide-set.svg", size: "320 KB", modified: "Oct 3" }] },
      ],
    },
    {
      name: "Documents",
      children: [
        { name: "Roadmap Q4.pdf", size: "1.4 MB", modified: "Mon" },
        { name: "Budget 2027.xlsx", size: "88 KB", modified: "Oct 11" },
        { name: "Meeting notes.txt", size: "6 KB", modified: "Oct 10" },
      ],
    },
    {
      name: "Music",
      children: [
        { name: "Midnight Drive.mp3", size: "8.1 MB", modified: "Oct 8" },
        { name: "Drum loop 120bpm.wav", size: "21 MB", modified: "Oct 8" },
      ],
    },
    { name: "Launch deck.key", size: "22 MB", modified: "Oct 12" },
    { name: "Studio demo.mp4", size: "184 MB", modified: "Oct 9" },
    { name: "Assets.zip", size: "64 MB", modified: "Oct 2" },
  ],
}

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? ""
function iconFor(e: Entry) {
  if (e.children) return Folder
  const x = ext(e.name)
  if (["png", "jpg", "jpeg", "fig", "svg", "gif"].includes(x)) return FileImage
  if (["mp3", "wav", "aac", "flac"].includes(x)) return FileMusic
  if (["xlsx", "csv", "numbers"].includes(x)) return FileSpreadsheet
  if (["mp4", "mov", "webm"].includes(x)) return Film
  if (["zip", "tar", "gz"].includes(x)) return FileArchive
  if (["pdf", "txt", "md", "doc", "docx", "key"].includes(x)) return FileText
  return File
}

/** Drill-down file browser: tap a folder to open it, back to go up, tap a file to select it. */
export default function FileBrowser({ root = SAMPLE, value, onChange, onSelect, onOpenFolder, accent = C.accent }: Props) {
  const [path, setPath] = useState<string[]>([])
  const [dir, setDir] = useState(1)
  const [inner, setInner] = useState("")
  const selected = value ?? inner
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  // Walk the path; stop early if the tree changed under us.
  let folder = root
  const names = [root.name]
  for (const n of path) {
    const next = folder.children?.find((c) => c.name === n && c.children)
    if (!next) break
    folder = next
    names.push(n)
  }
  const children = folder.children ?? []

  const go = (next: string[], d: number) => {
    setDir(d)
    setPath(next)
    onOpenFolder?.([root.name, ...next].join("/"))
  }
  const pick = (e: Entry) => {
    if (e.children) return go([...names.slice(1), e.name], 1)
    const full = [...names, e.name].join("/")
    if (value === undefined) setInner(full)
    onChange?.(full)
    onSelect?.(e, full)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={340}
      flexDirection="column"
      padding={12}
      gap={8}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
      overflow="hidden"
    >
      <Container flexDirection="row" alignItems="center" gap={10} paddingBottom={4}>
        <Press
          width={40}
          height={40}
          borderRadius={12}
          alignItems="center"
          justifyContent="center"
          backgroundColor={C.row}
          hover={{ backgroundColor: C.hover }}
          opacity={names.length > 1 ? 1 : 0.4}
          onClick={() => names.length > 1 && go(names.slice(1, -1), -1)}
        >
          <ChevronLeft width={18} height={18} color={C.text} />
        </Press>
        <Container flexDirection="column" flexGrow={1} flexShrink={1}>
          <Text fontSize={16} fontWeight="semi-bold" color={C.text}>
            {folder.name}
          </Text>
          <Text fontSize={11} color={C.faint}>
            {names.join(" / ")}
          </Text>
        </Container>
        <Text fontSize={12} color={C.muted}>
          {`${children.length} item${children.length === 1 ? "" : "s"}`}
        </Text>
      </Container>
      <Container height={1} backgroundColor={C.line} />
      <Listing key={names.join("/")} from={dir * 24}>
        {children.length === 0 ? (
          <Container height={88} alignItems="center" justifyContent="center">
            <Text fontSize={13} color={C.faint}>
              This folder is empty
            </Text>
          </Container>
        ) : (
          children.map((e) => {
            const Icon = iconFor(e)
            const isSel = !e.children && [...names, e.name].join("/") === selected
            return (
              <Press
                key={e.name}
                height={48}
                flexDirection="row"
                alignItems="center"
                gap={12}
                paddingX={10}
                borderRadius={12}
                backgroundColor={isSel ? withOpacity(accent, 0.14) : withOpacity("#FFFFFF", 0)}
                hover={{ backgroundColor: isSel ? withOpacity(accent, 0.18) : withOpacity("#FFFFFF", 0.05) }}
                onClick={() => pick(e)}
              >
                <Container width={32} height={32} borderRadius={9} alignItems="center" justifyContent="center" backgroundColor={e.children ? withOpacity(C.warm, 0.14) : C.row}>
                  <Icon width={17} height={17} color={e.children ? C.warm : isSel ? accent : C.muted} />
                </Container>
                <Container flexDirection="column" flexGrow={1} flexShrink={1}>
                  <Text fontSize={14} fontWeight="medium" color={C.text}>
                    {e.name}
                  </Text>
                  <Text fontSize={11} color={C.faint}>
                    {e.children ? `${e.children.length} item${e.children.length === 1 ? "" : "s"}` : [e.size, e.modified].filter(Boolean).join("  -  ")}
                  </Text>
                </Container>
                {e.children ? <ChevronRight width={16} height={16} color={C.faint} /> : null}
              </Press>
            )
          })
        )}
      </Listing>
    </Container>
  )
}

/** Slides a folder's contents in from the side it was opened from. */
function Listing({ from, children }: { from: number; children: React.ReactNode }) {
  const [ref, s] = useSpring({ transformTranslateX: 0 }, { transformTranslateX: from })
  return (
    <Container ref={ref} {...s} flexDirection="column" gap={2}>
      {children}
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.97 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? 3 : 0, transformScaleX: k, transformScaleY: k })
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
