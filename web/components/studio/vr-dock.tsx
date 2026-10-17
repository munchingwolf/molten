"use client"

import { useRef, useState, type ReactNode } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { IfInSessionMode } from "@react-three/xr"
import { Container, Text, type ContainerProperties } from "@react-three/uikit"
import {
  Box, Copy, Eye, EyeOff, Frame, Globe, Layers, LibraryBig, Pin, PinOff, Plus, Redo2, SlidersHorizontal, Trash2, Undo2,
} from "@react-three/uikit-lucide"
import { Vector3, type Camera, type Group } from "three"
import { findEntry, registry } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import type { Item } from "@/lib/layout"

import { xr } from "./xr-theme"

// 0.001 m per px so 360 × 460 px = a 36 × 46 cm panel; at 0.002 that panel would only fit ~3 rows of 44 px.
const PX = 0.001
const W = 360
const H = 460

const DEG = Math.PI / 180
const DIST = 0.55 // m from the head to the panel centre (horizontal)
const LEFT = 35 * DEG // panel bearing, left of where you face
const DROP = 0.15 // m below eye level
const TILT = -15 * DEG // lean the face up toward the eyes
const TURN = 40 * DEG // how far you look away from the panel before it follows
const WALK = 0.35 // m you walk before it follows

const SWATCHES = ["#9FE7D2", "#7DB4FF", "#C9A7FF", "#F58BB0", "#F2B48A", "#EEF0F4"]
const WARN = "#F2B48A"

const UP = new Vector3(0, 1, 0)
const head = new Vector3()
const dir = new Vector3()

/** Registry `props` metadata (filled in by the component agents; missing on older entries). */
type PropMeta = { name: string; type?: string; options?: (string | number)[]; min?: number; max?: number; step?: number; default?: unknown }
const propsOf = (component: string): PropMeta[] => {
  const p = (findEntry(component) as { props?: unknown } | undefined)?.props
  return Array.isArray(p) ? p.filter((m): m is PropMeta => !!m && typeof m.name === "string") : []
}

const ready = registry.filter((e) => e.status === "ready")
const library = ready.filter((e) => e.category !== "environments")
const categories = [...new Set(library.map((e) => e.category))]
const environments = ready.filter((e) => e.category === "environments")

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b))
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const nameOf = (i: Item) => i.name ?? findEntry(i.component)?.displayName ?? i.component

/** Same placement as the VR shelf: ~60 cm out, swung right of gaze so it doesn't land on the dock. */
function addInFront(camera: Camera, name: string) {
  camera.getWorldPosition(head)
  camera.getWorldDirection(dir)
  dir.y = 0
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1) // looking straight down
  dir.normalize().applyAxisAngle(UP, -0.7)
  const { add, update } = useStudio.getState()
  add(name, [head.x + dir.x * 0.6, head.y - 0.1, head.z + dir.z * 0.6])
  const id = useStudio.getState().selectedId // add() selects the new item
  if (id) update(id, { rotation: [0, Math.atan2(-dir.x, -dir.z), 0] }) // face the user
}

type Tab = "library" | "inspect" | "layers" | "world"
const TABS: { id: Tab; label: string; Icon: typeof Box }[] = [
  { id: "library", label: "Library", Icon: LibraryBig },
  { id: "inspect", label: "Inspect", Icon: SlidersHorizontal },
  { id: "layers", label: "Layers", Icon: Layers },
  { id: "world", label: "World", Icon: Globe },
]

/** Always-with-you editor in an XR session: library, inspector, layers, world. Poke or pinch any row. */
export function VRDock() {
  return (
    <IfInSessionMode allow={["immersive-ar", "immersive-vr"]}>
      <Dock />
    </IfInSessionMode>
  )
}

function Dock() {
  const [tab, setTab] = useState<Tab>("library")
  const [pinned, setPinned] = useState(false)
  const ref = useRef<Group>(null)
  const follow = useRef({ yaw: 0, pos: new Vector3(), chasing: false, init: false })

  useFrame(({ camera }, dt) => {
    const g = ref.current
    if (!g) return
    const f = follow.current
    camera.getWorldPosition(head)
    camera.getWorldDirection(dir)
    const yaw = dir.x * dir.x + dir.z * dir.z < 1e-6 ? f.yaw : Math.atan2(-dir.x, -dir.z)

    // First frame, or the head jumped (session start / reference space reset): snap, don't glide.
    if (!f.init || head.distanceTo(f.pos) > 1) {
      f.init = true
      f.chasing = false
      f.yaw = yaw
      f.pos.copy(head)
    } else if (!pinned) {
      // Measured from the panel's own bearing, so turning toward the dock to use it never makes it run away.
      if (Math.abs(angleDiff(yaw, f.yaw + LEFT)) > LEFT + TURN || head.distanceTo(f.pos) > WALK) f.chasing = true
      if (f.chasing) {
        const k = 1 - Math.exp(-dt * 4)
        f.yaw += angleDiff(yaw, f.yaw) * k
        f.pos.lerp(head, k)
        if (Math.abs(angleDiff(yaw, f.yaw)) < 2 * DEG && head.distanceTo(f.pos) < 0.02) f.chasing = false
      }
    }
    const a = f.yaw + LEFT
    g.position.set(f.pos.x - Math.sin(a) * DIST, f.pos.y - DROP, f.pos.z - Math.cos(a) * DIST)
    g.rotation.set(0, a, 0) // local +Z faces the head
  })

  return (
    <group ref={ref}>
      <group rotation={[TILT, 0, 0]}>
        <Container
          pixelSize={PX}
          width={W}
          height={H}
          padding={12}
          gap={8}
          flexDirection="column"
          backgroundColor={xr.panel}
          borderRadius={xr.radius.lg}
          borderWidth={1.5}
          borderColor={xr.border}
          color={xr.text}
        >
          <Header pinned={pinned} onPin={() => setPinned((p) => !p)} />
          <Container flexDirection="row" gap={4} flexShrink={0}>
            {TABS.map(({ id, label, Icon }) => (
              <Container
                key={id}
                flexGrow={1}
                flexBasis={0}
                height={48}
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                gap={2}
                borderRadius={xr.radius.md}
                backgroundColor={tab === id ? xr.rowHover : xr.panel}
                color={tab === id ? xr.accent : xr.muted}
                hover={{ backgroundColor: xr.row }}
                active={{ backgroundColor: xr.rowActive }}
                onClick={() => setTab(id)}
              >
                <Icon width={18} height={18} />
                <Text fontSize={14} fontWeight={tab === id ? "bold" : "normal"}>
                  {label}
                </Text>
              </Container>
            ))}
          </Container>
          <Container flexGrow={1} flexBasis={0} flexDirection="column" gap={8} overflow="hidden">
            {tab === "library" && <LibraryTab />}
            {tab === "inspect" && <InspectTab />}
            {tab === "layers" && <LayersTab />}
            {tab === "world" && <WorldTab />}
          </Container>
        </Container>
      </group>
    </group>
  )
}

function Header({ pinned, onPin }: { pinned: boolean; onPin: () => void }) {
  const canUndo = useStudio((s) => s.past.length > 0)
  const canRedo = useStudio((s) => s.future.length > 0)
  return (
    <Container flexDirection="row" alignItems="center" gap={4} height={44} flexShrink={0} paddingLeft={6}>
      <Container width={10} height={10} borderRadius={5} backgroundColor={xr.accent} />
      <Text flexGrow={1} fontSize={20} fontWeight="bold" paddingLeft={6}>
        Spatial
      </Text>
      <Btn width={44} paddingX={0} dim={!canUndo} onClick={() => useStudio.getState().undo()}>
        <Undo2 width={20} height={20} />
      </Btn>
      <Btn width={44} paddingX={0} dim={!canRedo} onClick={() => useStudio.getState().redo()}>
        <Redo2 width={20} height={20} />
      </Btn>
      <Btn width={44} paddingX={0} on={pinned} onClick={onPin}>
        {pinned ? <Pin width={20} height={20} /> : <PinOff width={20} height={20} />}
      </Btn>
    </Container>
  )
}

// ---------- Library ----------

function LibraryTab() {
  const camera = useThree((s) => s.camera)
  const [cat, setCat] = useState<string | null>(null)
  const shown = cat ? library.filter((e) => e.category === cat) : library
  return (
    <>
      <Container flexDirection="row" gap={6} flexShrink={0} overflow="scroll" scrollbarWidth={0} paddingBottom={2}>
        <Btn on={cat === null} onClick={() => setCat(null)}>
          <Text fontSize={14}>All</Text>
        </Btn>
        {categories.map((c) => (
          <Btn key={c} on={cat === c} onClick={() => setCat(c)}>
            <Text fontSize={14}>{title(c)}</Text>
          </Btn>
        ))}
      </Container>
      <Scroll>
        {shown.length === 0 && <Empty>No components ready yet</Empty>}
        {shown.map((e) => (
          <Btn key={e.name} justifyContent="space-between" paddingX={14} onClick={() => addInFront(camera, e.name)}>
            <Text fontSize={16}>{e.displayName}</Text>
            <Plus width={20} height={20} color={xr.accent} />
          </Btn>
        ))}
      </Scroll>
    </>
  )
}

// ---------- Inspect ----------

function InspectTab() {
  const camera = useThree((s) => s.camera)
  const item = useStudio((s) => s.items.find((i) => i.id === s.selectedId))
  const count = useStudio((s) => s.selectedIds.length)
  if (!item) return <Empty>Select something to inspect</Empty>

  const { update, duplicate, removeSelected } = useStudio.getState()
  const [rx, ry, rz] = item.rotation
  const turn = (d: number) => update(item.id, { rotation: [rx, ry + d * 15 * DEG, rz] })
  const tilt = (d: number) => update(item.id, { rotation: [rx + d * 15 * DEG, ry, rz] })
  const scale = (f: number) => update(item.id, { scale: Math.min(10, Math.max(0.05, item.scale * f)) })
  const lift = (d: number) => update(item.id, { position: [item.position[0], item.position[1] + d, item.position[2]] })
  const toward = (d: number) => {
    camera.getWorldPosition(head)
    const [x, y, z] = item.position
    dir.set(head.x - x, 0, head.z - z)
    if (dir.lengthSq() < 1e-6) return
    dir.normalize().multiplyScalar(d)
    update(item.id, { position: [x + dir.x, y, z + dir.z] })
  }
  const metas = propsOf(item.component)

  return (
    <Scroll>
      <Container flexDirection="column" flexShrink={0} paddingX={4} paddingBottom={4}>
        <Text fontSize={18} fontWeight="bold">
          {nameOf(item)}
        </Text>
        <Text fontSize={14} color={xr.muted}>
          {count > 1 ? `${item.component} · ${count} selected` : item.component}
        </Text>
      </Container>
      <Field label="Size">
        <Btn width={52} onClick={() => scale(0.9)}><Text fontSize={18}>−</Text></Btn>
        <Text flexGrow={1} textAlign="center" fontSize={16}>{`${item.scale.toFixed(2)}×`}</Text>
        <Btn width={52} onClick={() => scale(1.1)}><Text fontSize={18}>+</Text></Btn>
      </Field>
      <Field label="Turn">
        <Btn flexGrow={1} onClick={() => turn(1)}><Text fontSize={14}>◀ 15°</Text></Btn>
        <Btn flexGrow={1} onClick={() => turn(-1)}><Text fontSize={14}>15° ▶</Text></Btn>
      </Field>
      <Field label="Tilt">
        <Btn flexGrow={1} onClick={() => tilt(-1)}><Text fontSize={14}>−15°</Text></Btn>
        <Btn flexGrow={1} onClick={() => tilt(1)}><Text fontSize={14}>+15°</Text></Btn>
      </Field>
      <Field label="Move">
        <Btn flexGrow={1} onClick={() => toward(0.05)}><Text fontSize={14}>Closer</Text></Btn>
        <Btn flexGrow={1} onClick={() => toward(-0.05)}><Text fontSize={14}>Farther</Text></Btn>
      </Field>
      <Field label="">
        <Btn flexGrow={1} onClick={() => lift(0.05)}><Text fontSize={14}>Up</Text></Btn>
        <Btn flexGrow={1} onClick={() => lift(-0.05)}><Text fontSize={14}>Down</Text></Btn>
      </Field>
      <Container flexDirection="row" gap={6} flexShrink={0}>
        <Btn flexGrow={1} onClick={() => duplicate()}>
          <Copy width={18} height={18} />
          <Text fontSize={14}>Duplicate</Text>
        </Btn>
        <Btn flexGrow={1} color={WARN} onClick={() => removeSelected()}>
          <Trash2 width={18} height={18} />
          <Text fontSize={14}>Delete</Text>
        </Btn>
      </Container>
      {metas.length > 0 && <Section>Properties</Section>}
      {metas.map((m) => (
        <PropControl key={m.name} item={item} meta={m} />
      ))}
    </Scroll>
  )
}

function PropControl({ item, meta: m }: { item: Item; meta: PropMeta }) {
  const value = item.props?.[m.name] ?? m.default
  const set = (v: unknown) => useStudio.getState().update(item.id, { props: { ...item.props, [m.name]: v } })
  const label = title(m.name)

  if (m.type === "color")
    return (
      <Block label={label}>
        {SWATCHES.map((c) => (
          <Container
            key={c}
            width={44}
            height={44}
            borderRadius={22}
            alignItems="center"
            justifyContent="center"
            borderWidth={3}
            borderColor={String(value).toLowerCase() === c.toLowerCase() ? xr.text : xr.panel}
            hover={{ borderColor: xr.muted }}
            onClick={() => set(c)}
          >
            <Container width={32} height={32} borderRadius={16} backgroundColor={c} />
          </Container>
        ))}
      </Block>
    )
  if (m.type === "boolean")
    return (
      <Field label={label}>
        <Btn flexGrow={1} on={value === true} onClick={() => set(value !== true)}>
          <Text fontSize={14}>{value === true ? "On" : "Off"}</Text>
        </Btn>
      </Field>
    )
  if (Array.isArray(m.options) && m.options.length > 0)
    return (
      <Block label={label}>
        {m.options.map((o) => (
          <Btn key={String(o)} on={value === o} onClick={() => set(o)}>
            <Text fontSize={14}>{String(o)}</Text>
          </Btn>
        ))}
      </Block>
    )
  if (m.type === "number") {
    const v = typeof value === "number" ? value : 0
    const ints = [m.min, m.max, m.default].every((x) => x === undefined || Number.isInteger(x))
    const span = m.min !== undefined && m.max !== undefined ? m.max - m.min : undefined
    const raw = m.step ?? (span !== undefined ? span / 20 : ints ? 1 : Math.max(Math.abs(v) / 10, 0.01))
    const step = ints ? Math.max(1, Math.round(raw)) : raw
    const clamp = (n: number) => Math.round(Math.min(m.max ?? Infinity, Math.max(m.min ?? -Infinity, n)) * 1000) / 1000
    return (
      <Field label={label}>
        <Btn width={52} dim={m.min !== undefined && v <= m.min} onClick={() => set(clamp(v - step))}><Text fontSize={18}>−</Text></Btn>
        <Text flexGrow={1} textAlign="center" fontSize={16}>{fmt(v)}</Text>
        <Btn width={52} dim={m.max !== undefined && v >= m.max} onClick={() => set(clamp(v + step))}><Text fontSize={18}>+</Text></Btn>
      </Field>
    )
  }
  return (
    <Field label={label}>
      <Text flexGrow={1} flexShrink={1} fontSize={14} color={xr.muted}>
        {value === undefined || value === null ? "—" : String(value)}
      </Text>
    </Field>
  )
}

// ---------- Layers ----------

function LayersTab() {
  const items = useStudio((s) => s.items)
  const selectedIds = useStudio((s) => s.selectedIds)
  const [multi, setMulti] = useState(false)
  const { select, update, groupIntoFrame } = useStudio.getState()

  // Depth-first: roots (no parent, or parent not in this scene), then each frame's children indented under it.
  const ids = new Set(items.map((i) => i.id))
  const rows: { item: Item; depth: number }[] = []
  const walk = (parent: string | undefined, depth: number) => {
    for (const i of items) {
      const isChild = parent ? i.parentId === parent : !i.parentId || !ids.has(i.parentId)
      if (!isChild) continue
      rows.push({ item: i, depth })
      if (depth < 8) walk(i.id, depth + 1)
    }
  }
  walk(undefined, 0)

  return (
    <>
      <Container flexDirection="row" gap={6} flexShrink={0}>
        <Btn flexGrow={1} on={multi} onClick={() => setMulti((m) => !m)}>
          <Text fontSize={14}>Multi-select</Text>
        </Btn>
        <Btn flexGrow={1} dim={selectedIds.length === 0} onClick={() => groupIntoFrame()}>
          <Frame width={18} height={18} />
          <Text fontSize={14}>{selectedIds.length > 1 ? `Frame ${selectedIds.length}` : "Frame selection"}</Text>
        </Btn>
      </Container>
      <Scroll>
        {rows.length === 0 && <Empty>Nothing in this scene yet. Add from Library.</Empty>}
        {rows.map(({ item, depth }) => {
          const on = selectedIds.includes(item.id)
          return (
            <Container key={item.id} flexDirection="row" gap={4} flexShrink={0}>
              <Btn
                flexGrow={1}
                flexShrink={1}
                justifyContent="flex-start"
                paddingLeft={12 + depth * 20}
                on={on}
                onClick={() => select(item.id, multi)}
              >
                {item.component === "frame" ? <Frame width={16} height={16} /> : <Box width={16} height={16} />}
                <Text fontSize={15} color={item.hidden && !on ? xr.faint : undefined}>
                  {nameOf(item)}
                </Text>
              </Btn>
              <Btn width={44} paddingX={0} color={item.hidden ? xr.faint : xr.muted} onClick={() => update(item.id, { hidden: !item.hidden })}>
                {item.hidden ? <EyeOff width={18} height={18} /> : <Eye width={18} height={18} />}
              </Btn>
            </Container>
          )
        })}
      </Scroll>
    </>
  )
}

// ---------- World ----------

function WorldTab() {
  const environment = useStudio((s) => s.environment)
  const scenes = useStudio((s) => s.scenes)
  const sceneId = useStudio((s) => s.sceneId)
  const viewMode = useStudio((s) => s.viewMode)
  const showGrid = useStudio((s) => s.showGrid)
  const snap = useStudio((s) => s.snap)
  const canUndo = useStudio((s) => s.past.length > 0)
  const canRedo = useStudio((s) => s.future.length > 0)
  const st = useStudio.getState()

  return (
    <Scroll>
      <Block label="Environment">
        <Btn on={!environment} onClick={() => st.setEnvironment(null)}>
          <Text fontSize={14}>None (your room)</Text>
        </Btn>
        {environments.map((e) => (
          <Btn key={e.name} on={environment === e.name} onClick={() => st.setEnvironment(e.name)}>
            <Text fontSize={14}>{e.displayName}</Text>
          </Btn>
        ))}
      </Block>
      <Section>Scenes</Section>
      {scenes.map((sc) => (
        <Btn key={sc.id} justifyContent="flex-start" paddingX={14} on={sc.id === sceneId} onClick={() => st.switchScene(sc.id)}>
          <Text fontSize={15}>{sc.name}</Text>
        </Btn>
      ))}
      <Btn onClick={() => st.addScene()}>
        <Plus width={18} height={18} />
        <Text fontSize={14}>Add scene</Text>
      </Btn>
      <Section>View</Section>
      <Container flexDirection="row" gap={6} flexShrink={0}>
        <Btn flexGrow={1} on={viewMode === "xray"} onClick={() => st.setViewMode(viewMode === "xray" ? "design" : "xray")}>
          <Text fontSize={14}>X-ray</Text>
        </Btn>
        <Btn flexGrow={1} on={showGrid} onClick={() => st.toggleGrid()}>
          <Text fontSize={14}>Grid</Text>
        </Btn>
        <Btn flexGrow={1} on={snap} onClick={() => st.toggleSnap()}>
          <Text fontSize={14}>Snap</Text>
        </Btn>
      </Container>
      <Section>History</Section>
      <Container flexDirection="row" gap={6} flexShrink={0}>
        <Btn flexGrow={1} dim={!canUndo} onClick={() => st.undo()}>
          <Undo2 width={18} height={18} />
          <Text fontSize={14}>Undo</Text>
        </Btn>
        <Btn flexGrow={1} dim={!canRedo} onClick={() => st.redo()}>
          <Redo2 width={18} height={18} />
          <Text fontSize={14}>Redo</Text>
        </Btn>
      </Container>
    </Scroll>
  )
}

// ---------- building blocks ----------

type BtnProps = Pick<ContainerProperties, "width" | "flexGrow" | "flexShrink" | "justifyContent" | "paddingX" | "paddingLeft" | "color"> & {
  children: ReactNode
  onClick?: () => void
  /** Selected / toggled on: mint fill. */
  on?: boolean
  /** Nothing to do right now: faint and inert. */
  dim?: boolean
}

/** 44 px tall hit target (≥ 4.4 cm) with hover/press feedback. */
function Btn({ children, onClick, on, dim, color, ...layout }: BtnProps) {
  return (
    <Container
      height={44}
      minWidth={44}
      flexShrink={0}
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      gap={8}
      paddingX={12}
      borderRadius={xr.radius.md}
      backgroundColor={on ? xr.accent : xr.row}
      color={on ? xr.onAccent : dim ? xr.faint : (color ?? xr.text)}
      hover={dim || on ? undefined : { backgroundColor: xr.rowHover }}
      active={dim ? undefined : { backgroundColor: on ? xr.accent : xr.rowActive, transformTranslateZ: -2 }}
      onClick={dim ? undefined : onClick}
      {...layout}
    >
      {children}
    </Container>
  )
}

function Scroll({ children }: { children: ReactNode }) {
  return (
    <Container flexGrow={1} flexBasis={0} flexDirection="column" gap={6} overflow="scroll" scrollbarColor={xr.faint} scrollbarWidth={4} paddingRight={6}>
      {children}
    </Container>
  )
}

/** Label on the left, controls in a row on the right. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Container flexDirection="row" alignItems="center" gap={6} flexShrink={0}>
      <Text width={72} fontSize={14} color={xr.muted} paddingLeft={4}>
        {label}
      </Text>
      <Container flexGrow={1} flexShrink={1} flexDirection="row" alignItems="center" gap={6}>
        {children}
      </Container>
    </Container>
  )
}

/** Label above, controls wrapping below (swatches, chips). */
function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Container flexDirection="column" gap={6} flexShrink={0}>
      <Text fontSize={14} color={xr.muted} paddingLeft={4} paddingTop={4}>
        {label}
      </Text>
      <Container flexDirection="row" flexWrap="wrap" gap={6}>
        {children}
      </Container>
    </Container>
  )
}

function Section({ children }: { children: string }) {
  return (
    <Text fontSize={14} color={xr.faint} letterSpacing={1} paddingX={4} paddingTop={10} flexShrink={0}>
      {children.toUpperCase()}
    </Text>
  )
}

function Empty({ children }: { children: string }) {
  return (
    <Container flexGrow={1} alignItems="center" justifyContent="center" padding={24}>
      <Text fontSize={16} color={xr.muted} textAlign="center">
        {children}
      </Text>
    </Container>
  )
}
