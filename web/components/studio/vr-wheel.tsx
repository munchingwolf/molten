"use client"

import { memo, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { context, useFrame, useStore, useThree, type RootState, type ThreeEvent } from "@react-three/fiber"
import { Text } from "@react-three/drei"
import { IfInSessionMode, useXRInputSourceState } from "@react-three/xr"
import {
  AdditiveBlending, Box3, BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, LineBasicMaterial,
  MeshBasicMaterial, PlaneGeometry, RepeatWrapping, RingGeometry, Shape, ShapeGeometry, Vector3,
  type Group, type Material, type Object3D,
} from "three"
import { create } from "zustand"
import { components, registry, type Entry } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import { useFavorites } from "@/lib/favorites"
import { SafeBoundary } from "@/components/site/preview"
import { aimDrop, dropOnto } from "./drop-target"

/** Wheel open/closed + which page it shows; the toolbar's wheel button (or the CLOSE tab) toggles it. */
export const useWheel = create<{ open: boolean; page: string; toggle: () => void; setPage: (p: string) => void }>((set) => ({
  open: true,
  page: "Favorites",
  toggle: () => set((s) => ({ open: !s.open })),
  setPage: (page) => set({ page }),
}))

const PAGES: Record<string, string[] | null> = {
  Favorites: null,
  Music: ["music", "hardware"],
  Controls: ["controls", "buttons", "buttons with effects", "inputs", "settings", "ui kit", "navigation", "feedback", "containers", "containers and feedback", "data", "app", "web"],
  Room: ["room", "objects", "media", "spaces", "layout"],
  Visuals: ["visuals", "motion", "materials", "interactive"],
  Worlds: ["environments"],
}
// Worlds page: the music backgrounds first (the demo), then the rest.
const WORLD_FIRST = ["env-recording-studio", "env-park-stage", "env-music-hall", "env-tron", "env-concert-stage", "env-studio-loft"]
const ON_FLOOR = new Set(["objects", "room", "hardware", "spaces"])

// Shown as a holo tile, never mounted live in the ring (still addable):
const TILE = new Set([
  // touch the global Tone transport / tempo on mount: a mini would stop the music, reset the tempo or double the beat
  "transport", "step-sequencer", "drum-machine", "drums-lane", "keys-lane", "arpeggiator", "loop-player", "oscilloscope",
  "audio-visualizer", "mixing-console", "turntable", "speaker", "tempo-lane",
  // media that plays or streams
  "tv", "video-panel", "audio-player", "positional-audio", "model-viewer", "gltf-model", "curved-gallery",
  // extra render passes (transmission / portal / reflector) or whole rooms
  "glass-button", "pendant-light", "glass-orb", "portal-card", "mirror-floor", "room-shell", "frame",
  // screen-space or unbounded: pixel-sized points and endless grids don't shrink into a bay
  "infinite-grid", "particle-field", "sparkles-field", "starfield", "flow-field-particles", "cloud-puff",
  // broken in visual QA (registry/qa-broken.json)
  "kinetic-title", "spotlight-text", "tabs",
])

const RADIUS = 0.62 // m from your body: inside arm's reach
const STEP = (24 * Math.PI) / 180 // fixed spacing between bays; spin the ring to scroll
const ARC = (150 * Math.PI) / 180 // bays live within ±150°, leaving a gap behind you
const LEAD = (60 * Math.PI) / 180 // a long page starts with its first bay 60° to your left
const MINI = 0.13 // every mini fits a 13 cm box, whatever its real size
const HUD_Y = -0.15 // the HUD rings sit just under the bays
const BAY_W = 0.19
const BAY_H = 0.22
const CYAN = "#7FE3FF"
const CYAN2 = "#9FF0FF"
const AMBER = "#FFB347"

const head = new Vector3()
const dir = new Vector3()
const tmp = new Vector3()
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ease = (x: number) => 1 - (1 - x) ** 3
const nn = (i: number) => String(i).padStart(2, "0")
/** Angle of p around the ring centre: 0 = straight ahead (-Z), positive = to your right. */
const angleOf = (p: Vector3, c: Vector3) => Math.atan2(p.x - c.x, -(p.z - c.z))

type Grab = { name: string; id: number; start: Vector3; at: Vector3; a0: number; s0: number; mode: "spin" | "pull" | null; t: number }
/** Wheel state mutated every frame (never React state): scroll angle, velocity, boot progress, the active grab. */
type Ctl = { s: number; v: number; lo: number; hi: number; boot: number; grab: Grab | null; entries: Entry[] | null }

/* ---------- Holo materials + geometry: built once, shared by every bay ---------- */

function holo(color: string, opacity: number, map?: CanvasTexture) {
  const m = new MeshBasicMaterial({ color, transparent: true, opacity, side: DoubleSide, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
  if (map) m.map = map
  m.userData.base = opacity
  return m
}
function holoLine(color: string, opacity: number) {
  const m = new LineBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
  m.userData.base = opacity
  return m
}
const lines = (pts: number[]) => new BufferGeometry().setAttribute("position", new Float32BufferAttribute(pts, 3))
/** Segments along an arc in the ring's XZ plane. */
function arc(out: number[], r: number, a0: number, a1: number, steps: number) {
  for (let i = 0; i < steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps
    const b = a0 + ((a1 - a0) * (i + 1)) / steps
    out.push(Math.sin(a) * r, 0, -Math.cos(a) * r, Math.sin(b) * r, 0, -Math.cos(b) * r)
  }
  return out
}

function makeKit() {
  const c = document.createElement("canvas")
  c.width = 4
  c.height = 64
  const g = c.getContext("2d")!
  for (let y = 0; y < 64; y += 4) (g.fillStyle = `rgba(255,255,255,${y % 16 ? 0.35 : 0.9})`), g.fillRect(0, y, 4, 1)
  const scanTex = new CanvasTexture(c)
  scanTex.wrapS = scanTex.wrapT = RepeatWrapping
  scanTex.repeat.set(1, 3)

  const R = RADIUS
  const ticks: number[] = []
  for (let k = 0; k < 72; k++) {
    const a = (k * Math.PI) / 36
    const r2 = R + 0.066 + (k % 6 ? 0.012 : 0.028)
    ticks.push(Math.sin(a) * (R + 0.066), 0, -Math.cos(a) * (R + 0.066), Math.sin(a) * r2, 0, -Math.cos(a) * r2)
  }
  const segs: number[] = []
  for (let k = 0; k < 12; k++) arc(segs, R + 0.11, (k * Math.PI) / 6 + 0.04, ((k + 1) * Math.PI) / 6 - 0.04, 6)
  const dashes: number[] = []
  for (let k = 0; k < 40; k++) arc(dashes, R - 0.13, (k * Math.PI) / 20, (k * Math.PI) / 20 + 0.09, 2)
  const floor: number[] = []
  for (const r of [0.35, 0.7, 1.05]) arc(floor, r, 0, Math.PI * 2, 64)
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6
    floor.push(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2, Math.sin(a) * 1.05, 0, -Math.cos(a) * 1.05)
  }
  // Corner brackets around a bay, plus the leader line down to the outer ring.
  const w = BAY_W / 2, h = BAY_H / 2, l = 0.035
  const bracket = [
    -w, h, 0, -w + l, h, 0, -w, h, 0, -w, h - l, 0, w, h, 0, w - l, h, 0, w, h, 0, w, h - l, 0,
    -w, -h, 0, -w + l, -h, 0, -w, -h, 0, -w, -h + l, 0, w, -h, 0, w - l, -h, 0, w, -h, 0, w, -h + l, 0,
    0, -h - 0.03, 0, 0, HUD_Y, -0.06,
  ]
  // Targeting reticle: four arcs with outward notches.
  const ret: number[] = []
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + 0.25
    for (let i = 0; i < 6; i++) {
      const p = a + i / 6, q = a + (i + 1) / 6
      ret.push(Math.cos(p) * 0.125, Math.sin(p) * 0.125, 0, Math.cos(q) * 0.125, Math.sin(q) * 0.125, 0)
    }
    const m = (k * Math.PI) / 2 + Math.PI / 4
    ret.push(Math.cos(m) * 0.135, Math.sin(m) * 0.135, 0, Math.cos(m) * 0.15, Math.sin(m) * 0.15, 0)
  }
  // Chamfered tab: two opposite corners cut.
  const tab = new Shape()
  const tw = 0.12 / 2, th = 0.06 / 2, tc = 0.014
  tab.moveTo(-tw + tc, -th)
  tab.lineTo(tw, -th)
  tab.lineTo(tw, th - tc)
  tab.lineTo(tw - tc, th)
  tab.lineTo(-tw, th)
  tab.lineTo(-tw, -th + tc)
  tab.closePath()
  const flat = (geo: BufferGeometry) => geo.rotateX(-Math.PI / 2)

  return {
    scanTex,
    geo: {
      ring: flat(new RingGeometry(R + 0.06, R + 0.064, 128, 1, Math.PI / 2, Math.PI * 2)),
      sweep: flat(new RingGeometry(R - 0.13, R + 0.06, 24, 1, Math.PI / 2 - 0.35, 0.7)),
      ticks: lines(ticks),
      segs: lines(segs),
      dashes: lines(dashes),
      floor: lines(floor),
      bracket: lines(bracket),
      reticle: lines(ret),
      scan: new PlaneGeometry(BAY_W - 0.02, BAY_H - 0.02),
      tile: new PlaneGeometry(0.09, 0.09),
      tab: new ShapeGeometry(tab),
      tabEdge: new BufferGeometry().setFromPoints(tab.getPoints()),
      xMark: lines([-0.009, 0.004, 0, 0.009, 0.022, 0, 0.009, 0.004, 0, -0.009, 0.022, 0]),
      glyph: new RingGeometry(0.036, 0.04, 48),
    },
    mat: {
      ring: holo(CYAN, 0.6),
      sweep: holo(CYAN, 0.1),
      tick: holoLine(CYAN, 0.75),
      seg: holoLine(CYAN2, 0.35),
      dash: holoLine(CYAN2, 0.45),
      floor: holoLine(CYAN, 0.16),
      bracket: holoLine(CYAN, 0.8),
      bracketHot: holoLine(AMBER, 1),
      scan: holo(CYAN, 0.07, scanTex),
      scanHot: holo(AMBER, 0.1, scanTex),
      reticle: holoLine(AMBER, 0.95),
      tab: holo(CYAN, 0.06),
      tabHover: holo(CYAN, 0.18),
      tabOn: holo(AMBER, 0.45),
      edge: holoLine(CYAN, 0.9),
      edgeOn: holoLine(AMBER, 1),
      globe: Object.assign(holo(CYAN, 0.5), { wireframe: true }),
      globeOn: Object.assign(holo(AMBER, 0.9), { wireframe: true }),
    },
  }
}
let kit: ReturnType<typeof makeKit> | null = null
const getKit = () => (kit ??= makeKit())

/* ---------- Wheel ---------- */

/**
 * Component wheel, styled as a holographic HUD: live miniatures in bays on a ring around you at chest height. It
 * follows where you stand (not where you look). Poke a bay to drop it just outside the ring; drag sideways along the
 * ring (poke, pinch or trigger) to spin it and scroll; pull a bay away from the ring to place it where you let go.
 */
export function VRWheel() {
  const open = useWheel((s) => s.open)
  const playMode = useStudio((s) => s.playMode)
  const [shown, setShown] = useState(open)
  if (open && !shown) setShown(true) // stays mounted while it plays the closing sequence
  if (playMode) return null
  return (
    <IfInSessionMode allow={["immersive-ar", "immersive-vr"]}>
      {/* A wheel bug or a slow font must never blank or crash the rest of the XR scene. */}
      <SafeBoundary fallback={null}>
        <Suspense fallback={null}>{shown ? <Ring open={open} onClosed={() => setShown(false)} /> : <Reopen />}</Suspense>
      </SafeBoundary>
    </IfInSessionMode>
  )
}

function Ring({ open, onClosed }: { open: boolean; onClosed: () => void }) {
  const ring = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const page = useWheel((s) => s.page)
  const favorites = useFavorites()
  const entries = useMemo(() => {
    const ready = registry.filter((e) => e.status === "ready" && components[e.name])
    const cats = PAGES[page]
    const list = cats
      ? ready.filter((e) => cats.includes(e.category))
      : favorites.map((n) => ready.find((e) => e.name === n)).filter((e): e is Entry => !!e)
    if (page !== "Worlds") return list
    const rank = (e: Entry) => (WORLD_FIRST.includes(e.name) ? WORLD_FIRST.indexOf(e.name) : 99)
    return [...list].sort((a, b) => rank(a) - rank(b))
  }, [page, favorites])
  const n = entries.length

  const ctl = useRef<Ctl>({ s: 0, v: 0, lo: 0, hi: 0, boot: 0, grab: null, entries: null }).current
  if (ctl.entries !== entries) {
    // New page: a short page sits centred in front of you; a long one starts at its first bay and scrolls.
    const span = Math.max(0, n - 1) * STEP
    const fits = span <= 2 * (ARC - STEP)
    Object.assign(ctl, { entries, lo: fits ? span / 2 : LEAD, hi: fits ? span / 2 : span - LEAD, v: 0, grab: null })
    ctl.s = ctl.lo
  }
  const [win, setWin] = useState<[number, number]>([0, -1])
  const [focus, setFocus] = useState(-1)
  const right = useXRInputSourceState("controller", "right")
  const left = useXRInputSourceState("controller", "left")
  const done = useRef(false)

  useFrame((_, delta) => {
    const g = ring.current
    if (!g) return
    const dt = Math.min(delta, 0.1)
    // Follow the body: glide to stay centred under the head, at chest height. Snap on a jump (session start, recenter).
    camera.getWorldPosition(head)
    tmp.set(head.x, head.y - 0.45, head.z)
    if (g.position.distanceTo(tmp) > 1.5) g.position.copy(tmp)
    else g.position.lerp(tmp, 1 - Math.exp(-dt * 4))

    // Boot up in ~0.8 s, power down in ~0.4 s, then unmount. No input while it animates.
    ctl.boot = open ? Math.min(1, ctl.boot + dt / 0.8) : Math.max(0, ctl.boot - dt / 0.4)
    if (!open && ctl.boot === 0 && !done.current) (done.current = true), onClosed()
    if (open) done.current = false
    g.pointerEvents = ctl.boot > 0.95 ? undefined : "none"

    // Scroll: thumbstick, else coast with inertia and spring back inside the ends.
    const stick = (right?.gamepad["xr-standard-thumbstick"]?.xAxis ?? 0) + (left?.gamepad["xr-standard-thumbstick"]?.xAxis ?? 0)
    if (!ctl.grab && Math.abs(stick) > 0.2) ctl.v = stick * 2
    if (ctl.grab?.mode !== "spin") {
      ctl.s += ctl.v * dt
      ctl.v *= Math.exp(-dt * 3)
      const c = Math.min(ctl.hi, Math.max(ctl.lo, ctl.s))
      if (c !== ctl.s) (ctl.s += (c - ctl.s) * (1 - Math.exp(-dt * 12))), (ctl.v *= Math.exp(-dt * 10))
    }
    if (!Number.isFinite(ctl.s)) (ctl.s = ctl.lo), (ctl.v = 0)

    // Mount only the bays inside the arc (≤ 13), so a 40-item page costs the same as a short one.
    const i0 = Math.max(0, Math.ceil((ctl.s - ARC) / STEP))
    const i1 = Math.min(n - 1, Math.floor((ctl.s + ARC) / STEP))
    if (i0 !== win[0] || i1 !== win[1]) setWin([i0, i1])

    // Lock-on: the bay you're facing.
    camera.getWorldDirection(dir)
    const gaze = Math.atan2(dir.x, -dir.z)
    let f = Math.round((gaze + ctl.s) / STEP)
    if (f < i0 || f > i1 || Math.abs(wrap(f * STEP - ctl.s - gaze)) > STEP * 0.6 || dir.y < -0.95) f = -1
    if (f !== focus) setFocus(f)
  })

  const focused = focus >= 0 ? entries[focus] : undefined
  return (
    <group ref={ring}>
      <Hud ctl={ctl} ring={ring} />
      {entries.slice(win[0], win[1] + 1).map((e, k) => (
        <Bay key={e.name} entry={e} index={win[0] + k} order={k} ctl={ctl} ring={ring} focused={win[0] + k === focus} />
      ))}
      {focused && <Lock entry={focused} index={focus} n={n} ctl={ctl} />}
      <Tabs ctl={ctl} n={n} at={focus >= 0 ? focus : Math.round(ctl.s / STEP)} />
    </group>
  )
}

/* ---------- Static HUD: rings, ticks, sweep, floor reticle ---------- */

function Hud({ ctl, ring }: { ctl: Ctl; ring: React.RefObject<Group | null> }) {
  const { geo, mat, scanTex } = getKit()
  const dial = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const sweep = useRef<Group>(null)
  const floor = useRef<Group>(null)
  const readouts = useRef<Group>(null)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const b = ease(ctl.boot)
    for (const m of Object.values(mat) as Material[]) m.opacity = m.userData.base * b
    // Rings draw on from straight ahead; ticks and segments appear one after another.
    geo.ring.setDrawRange(0, Math.floor(128 * b) * 6)
    geo.ticks.setDrawRange(0, Math.floor(72 * clamp01(b * 1.3 - 0.2)) * 2)
    geo.segs.setDrawRange(0, Math.floor(72 * clamp01(b * 1.2 - 0.1)) * 2)
    scanTex.offset.y -= dt * 0.15
    if (dial.current) dial.current.rotation.y = ctl.s // the tick dial turns with the bays
    if (inner.current) inner.current.rotation.y = -t * 0.12
    if (sweep.current) sweep.current.rotation.y = t * 0.7
    if (readouts.current) readouts.current.visible = b > 0.6
    if (floor.current && ring.current) floor.current.position.y = 0.01 - ring.current.position.y
  })
  return (
    <group>
      <group position={[0, HUD_Y, 0]}>
        <mesh geometry={geo.ring} material={mat.ring} />
        <group ref={dial}>
          <lineSegments geometry={geo.ticks} material={mat.tick} />
          <lineSegments geometry={geo.segs} material={mat.seg} />
          <group ref={readouts}>
            {Array.from({ length: 12 }, (_, k) => (
              <group key={k} rotation={[0, -(k * Math.PI) / 6, 0]}>
                <Text position={[0, 0, -(RADIUS + 0.135)]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.014} letterSpacing={0.2} color={CYAN2} fillOpacity={0.8}>
                  {String(k * 30).padStart(3, "0")}
                </Text>
              </group>
            ))}
          </group>
        </group>
        <group ref={inner}>
          <lineSegments geometry={geo.dashes} material={mat.dash} />
        </group>
        <group ref={sweep}>
          <mesh geometry={geo.sweep} material={mat.sweep} />
        </group>
      </group>
      <group ref={floor}>
        <lineSegments geometry={geo.floor} material={mat.floor} />
      </group>
    </group>
  )
}

/* ---------- A bay: live mini (or holo tile) in corner brackets ---------- */

type BayProps = { entry: Entry; index: number; order: number; ctl: Ctl; ring: React.RefObject<Group | null>; focused: boolean }

const Bay = memo(function Bay({ entry, index, order, ctl, ring, focused }: BayProps) {
  const { geo, mat } = getKit()
  const world = entry.category === "environments"
  const active = useStudio((s) => s.environment === entry.name)
  const camera = useThree((s) => s.camera)
  const slot = useRef<Group>(null)
  const pad = useRef<Object3D>(null)
  const visual = useRef<Group>(null)
  const brackets = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    if (focused && brackets.current) brackets.current.scale.setScalar(1.3) // snap in from wide
  }, [focused])
  useEffect(() => () => void (ctl.grab?.name === entry.name && ((ctl.grab = null), aimDrop(null))), [ctl, entry.name])

  useFrame((_, dt) => {
    const g = slot.current
    if (!g) return
    const a = index * STEP - ctl.s
    // Fade out toward the gap behind you; unfold one after another while booting.
    const unfold = ease(clamp01((ctl.boot - 0.3 - order * 0.04) / 0.25))
    const k = Math.max(1e-3, clamp01((ARC - Math.abs(a)) / (STEP * 0.8)) * unfold)
    g.position.set(Math.sin(a) * RADIUS, 0, -Math.cos(a) * RADIUS)
    g.rotation.y = -a
    g.scale.set(k, k * (0.2 + 0.8 * unfold), k)
    g.visible = k > 0.01
    // pointer-events still hits invisible meshes, so switch the pad off while the bay is (nearly) hidden.
    if (pad.current) pad.current.pointerEvents = k > 0.6 ? undefined : "none"
    const b = brackets.current
    if (b) b.scale.setScalar(b.scale.x + ((focused ? 0.96 : 1) - b.scale.x) * (1 - Math.exp(-dt * 14)))
    // While pulled out, the mini follows your hand (the pad stays put, so a poke still releases normally).
    const v = visual.current
    const gr = ctl.grab
    if (v) {
      if (gr?.name === entry.name && gr.mode === "pull") v.position.copy(g.worldToLocal(tmp.copy(gr.at)))
      else v.position.set(0, 0, 0)
    }
  })

  const place = (p: Vector3) => {
    if (dropOnto(entry.name, p.toArray())) return // filled a guide slot or replaced the item there
    camera.getWorldPosition(head)
    const yaw = Math.atan2(head.x - p.x, head.z - p.z) // face you
    useStudio.getState().add(entry.name, [p.x, ON_FLOOR.has(entry.category) ? 0 : p.y, p.z], { rotation: [0, yaw, 0] })
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    if (ctl.grab || !ring.current) return
    ;(e.target as unknown as Object3D).setPointerCapture(e.pointerId)
    ctl.grab = { name: entry.name, id: e.pointerId, start: e.point.clone(), at: e.point.clone(), a0: angleOf(e.point, ring.current.position), s0: ctl.s, mode: null, t: performance.now() }
    ctl.v = 0
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const gr = ctl.grab
    if (!gr || gr.id !== e.pointerId || gr.name !== entry.name || !ring.current) return
    gr.at.copy(e.point)
    const da = wrap(angleOf(e.point, ring.current.position) - gr.a0)
    const along = Math.abs(da) * RADIUS
    const away = Math.sqrt(Math.max(0, gr.at.distanceToSquared(gr.start) - along * along))
    // Sideways along the ring = spin; away from it = pull the mini out. Small wiggles stay a poke.
    if (!gr.mode) gr.mode = along > 0.04 && along > away ? "spin" : !world && away > 0.12 ? "pull" : null
    if (gr.mode === "pull") return void aimDrop(e.point.toArray()) // guide slot / item under your hand glows
    if (gr.mode !== "spin") return
    let s = gr.s0 - da
    if (s < ctl.lo) s = ctl.lo + (s - ctl.lo) * 0.35 // rubber-band past the ends
    if (s > ctl.hi) s = ctl.hi + (s - ctl.hi) * 0.35
    const now = performance.now()
    const t = (now - gr.t) / 1000
    if (t > 0.005) (ctl.v = Math.max(-6, Math.min(6, ctl.v * 0.5 + (0.5 * (s - ctl.s)) / t))), (gr.t = now)
    ctl.s = s
  }
  const up = (e: ThreeEvent<PointerEvent>) => {
    const gr = ctl.grab
    if (!gr || gr.id !== e.pointerId || gr.name !== entry.name || !ring.current) return
    ctl.grab = null
    if (gr.mode === "spin") return void (performance.now() - gr.t > 80 && (ctl.v = 0)) // coast only if still moving
    ctl.v = 0
    if (gr.mode === "pull") return place(gr.at)
    if (gr.at.distanceTo(gr.start) > 0.06) return // dragged a bit, then gave up: not a poke
    if (world) return useStudio.getState().setEnvironment(active ? null : entry.name)
    // A poke: drop it just outside the ring, in the same direction, at working height.
    const a = index * STEP - ctl.s
    const out = ring.current.localToWorld(new Vector3(Math.sin(a) * (RADIUS + 0.45), 0.2, -Math.cos(a) * (RADIUS + 0.45)))
    camera.getWorldPosition(head)
    useStudio.getState().add(entry.name, [out.x, ON_FLOOR.has(entry.category) ? 0 : out.y, out.z], { rotation: [0, Math.atan2(head.x - out.x, head.z - out.z), 0] })
  }
  const cancel = (e: ThreeEvent<PointerEvent>) => void (ctl.grab?.id === e.pointerId && ((ctl.grab = null), aimDrop(null)))

  const hot = focused || hover
  const live = !world && !broken && !TILE.has(entry.name)
  return (
    <group ref={slot} scale={1e-3} visible={false}>
      {/* The pad in front takes the pointer, so the live component inside never fires (no drum hits). */}
      <mesh
        ref={pad}
        position={[0, 0, 0.05]}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
      >
        <boxGeometry args={[BAY_W, BAY_H, 0.12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <group ref={brackets}>
        <lineSegments geometry={geo.bracket} material={hot ? mat.bracketHot : mat.bracket} />
      </group>
      <mesh geometry={geo.scan} material={hot ? mat.scanHot : mat.scan} position={[0, 0, -0.03]} />
      <group ref={visual}>
        <group scale={hover ? 1.12 : 1}>
          {world ? (
            // A whole environment can't be shrunk into a bay: a holo globe stands in, amber when it's the active world.
            <mesh material={active ? mat.globeOn : mat.globe}>
              <sphereGeometry args={[0.05, 16, 10]} />
            </mesh>
          ) : live ? (
            <SafeBoundary fallback={<Tile entry={entry} />}>
              <Suspense fallback={<Tile entry={entry} />}>
                <GuardFrames onError={() => setBroken(true)}>
                  <Mini name={entry.name} />
                </GuardFrames>
              </Suspense>
            </SafeBoundary>
          ) : (
            <Tile entry={entry} />
          )}
        </group>
      </group>
      <Suspense fallback={null}>
        <Text position={[0, -BAY_H / 2 - 0.006, 0.01]} fontSize={0.0135} letterSpacing={0.14} color={hot ? AMBER : CYAN2} anchorY="top" maxWidth={BAY_W} textAlign="center">
          {entry.displayName.toUpperCase()}
        </Text>
      </Suspense>
    </group>
  )
})

/** Stand-in for a component that can't run as a live mini (see TILE): its initial on a holo plate. */
function Tile({ entry }: { entry: Entry }) {
  const { geo, mat } = getKit()
  return (
    <group>
      <mesh geometry={geo.tile} material={mat.scanHot} />
      <Suspense fallback={null}>
        <Text position={[0, 0, 0.002]} fontSize={0.05} color={AMBER} fillOpacity={0.9}>
          {entry.displayName.slice(0, 1).toUpperCase()}
        </Text>
      </Suspense>
    </group>
  )
}

/* ---------- Lock-on: reticle + readout on the bay you face ---------- */

function Lock({ entry, index, n, ctl }: { entry: Entry; index: number; n: number; ctl: Ctl }) {
  const { geo, mat } = getKit()
  const g = useRef<Group>(null)
  const ret = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (g.current) (g.current.rotation.y = -(index * STEP - ctl.s)), (g.current.visible = ctl.boot > 0.9)
    if (ret.current) ret.current.rotation.z = clock.elapsedTime * 0.8
  })
  return (
    <group ref={g} visible={false}>
      <group position={[0, 0, -RADIUS + 0.07]}>
        <group ref={ret}>
          <lineSegments geometry={geo.reticle} material={mat.reticle} />
        </group>
        <Suspense fallback={null}>
          <Text position={[0, BAY_H / 2 + 0.062, 0]} fontSize={0.011} letterSpacing={0.3} color={AMBER}>
            {`LOCKED  //  ${nn(index + 1)}/${nn(n)}`}
          </Text>
          <Text position={[0, BAY_H / 2 + 0.04, 0]} anchorY="middle" fontSize={0.02} letterSpacing={0.06} color="#FFE2B8" maxWidth={BAY_W + 0.04} textAlign="center">
            {entry.displayName.toUpperCase()}
          </Text>
          <Text position={[0, BAY_H / 2 + 0.018, 0]} fontSize={0.0095} letterSpacing={0.25} color={CYAN2}>
            {entry.category === "environments" ? "WORLD  //  POKE TO LOAD" : entry.category.toUpperCase()}
          </Text>
        </Suspense>
      </group>
    </group>
  )
}

/* ---------- Category tabs: a curved arc of chamfered holo buttons, plus CLOSE ---------- */

const TAB_R = 0.46
const TAB_STEP = 0.29 // rad: ≈ 13 cm between tab centres at TAB_R; each tab is 12 × 6 cm

function Tabs({ ctl, n, at }: { ctl: Ctl; n: number; at: number }) {
  const page = useWheel((s) => s.page)
  const names = [...Object.keys(PAGES), "Close"]
  const g = useRef<Group>(null)
  useFrame(() => {
    if (g.current) g.current.scale.setScalar(Math.max(1e-3, ease(clamp01((ctl.boot - 0.2) / 0.5))))
  })
  return (
    <group ref={g} position={[0, -0.25, 0]}>
      {names.map((p, k) => {
        const a = (k - (names.length - 1) / 2) * TAB_STEP
        const close = p === "Close"
        return (
          <group key={p} position={[Math.sin(a) * TAB_R, 0, -Math.cos(a) * TAB_R]} rotation={[0, -a, 0]}>
            <group rotation={[-0.65, 0, 0]}>
              <Tab label={p} on={p === page} close={close} onClick={() => (close ? useWheel.getState().toggle() : useWheel.getState().setPage(p))} />
            </group>
          </group>
        )
      })}
      <group position={[0, 0.06, -TAB_R - 0.02]} rotation={[-0.65, 0, 0]}>
        <Suspense fallback={null}>
          <Text fontSize={0.0105} letterSpacing={0.2} color={CYAN2} fillOpacity={0.85}>
            {n === 0
              ? "NO SIGNAL  //  STAR COMPONENTS IN THE LAPTOP LIBRARY"
              : `${nn(Math.min(n, Math.max(1, at + 1)))} / ${nn(n)}   //   POKE TO ADD   //   PULL OUT TO PLACE${ctl.hi > ctl.lo ? "   //   <  SPIN TO SCROLL  >" : ""}`}
          </Text>
        </Suspense>
      </group>
    </group>
  )
}

function Tab({ label, on, close, onClick }: { label: string; on: boolean; close: boolean; onClick: () => void }) {
  const { geo, mat } = getKit()
  const [hover, setHover] = useState(false)
  return (
    <group>
      <mesh geometry={geo.tab} material={on ? mat.tabOn : hover ? mat.tabHover : mat.tab} onClick={onClick} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} />
      <lineLoop geometry={geo.tabEdge} material={on || close ? mat.edgeOn : mat.edge} />
      {close && <lineSegments geometry={geo.xMark} material={mat.edgeOn} />}
      <Suspense fallback={null}>
        <Text position={[0, close ? -0.012 : 0, 0.002]} fontSize={close ? 0.011 : 0.0125} letterSpacing={0.16} color={on ? "#FFF4E0" : close ? AMBER : CYAN2}>
          {label.toUpperCase()}
        </Text>
      </Suspense>
    </group>
  )
}

/* ---------- Closed: a small holo glyph low in front of you reopens it ---------- */

function Reopen() {
  const { geo, mat } = getKit()
  const g = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  useFrame(({ clock }, delta) => {
    const o = g.current
    if (!o) return
    camera.getWorldPosition(head)
    camera.getWorldDirection(dir)
    dir.y = 0
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1)
    dir.normalize()
    tmp.set(head.x + dir.x * 0.35, head.y - 0.55, head.z + dir.z * 0.35)
    if (o.position.distanceTo(tmp) > 1.5) o.position.copy(tmp)
    else o.position.lerp(tmp, 1 - Math.exp(-Math.min(delta, 0.1) * 3))
    o.rotation.y = Math.atan2(-dir.x, -dir.z)
    if (spin.current) spin.current.rotation.z = clock.elapsedTime * 0.6
    // The closing sequence faded the shared materials out; the glyph needs these lit.
    mat.edge.opacity = mat.edge.userData.base
    mat.tabHover.opacity = mat.tabHover.userData.base
  })
  return (
    <group ref={g}>
      <group rotation={[-0.8, 0, 0]}>
        <mesh onClick={() => useWheel.getState().toggle()}>
          <circleGeometry args={[0.045, 32]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.08} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <group ref={spin}>
          <mesh geometry={geo.glyph} material={mat.tabHover} />
          <lineSegments geometry={geo.reticle} material={mat.edge} scale={0.42} />
        </group>
        <Suspense fallback={null}>
          <Text position={[0, -0.06, 0]} fontSize={0.011} letterSpacing={0.3} color={CYAN2}>
            WHEEL
          </Text>
        </Suspense>
      </group>
    </group>
  )
}

/* ---------- Live mini: the real component, isolated ---------- */

/**
 * Runs the subtree's useFrame callbacks inside try/catch. R3F's loop isn't guarded: one callback that throws skips
 * the render on every frame after it, freezing the whole headset view.
 */
function GuardFrames({ onError, children }: { onError: () => void; children: ReactNode }) {
  const store = useStore()
  const report = useRef(onError)
  report.current = onError
  const guarded = useMemo(() => {
    const subscribe = store.getState().internal.subscribe
    const safe: RootState["internal"]["subscribe"] = (ref, priority) => {
      let dead = false
      const wrapped = {
        current: (state: RootState, delta: number, frame?: XRFrame) => {
          if (dead) return
          try {
            ref.current?.(state, delta, frame)
          } catch (err) {
            dead = true
            console.warn("[vr-wheel] mini disabled after a frame error:", err)
            report.current()
          }
        },
      }
      return subscribe(wrapped, priority, store)
    }
    const getState = () => {
      const st = store.getState()
      return { ...st, internal: { ...st.internal, subscribe: safe } }
    }
    return Object.assign((...args: Parameters<typeof store>) => store(...args), store, { getState }) as typeof store
  }, [store])
  return <context.Provider value={guarded}>{children}</context.Provider>
}

const box = new Box3()
const size = new Vector3()
const center = new Vector3()
const ws = new Vector3()

/** The real component, shrunk to fit MINI, deaf to rays (the bay's pad handles input), its lights switched off. */
const Mini = memo(function Mini({ name }: { name: string }) {
  const Component = components[name]
  const outer = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const fit = useRef({ frames: 0, count: -1 })
  useFrame(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    // Every frame (cheap): hide lights before they ever render (a new light recompiles every material in the scene
    // and lights your room), and notice children that mount late (lazy parts, uikit, async fonts) to re-fit.
    let count = 0
    i.traverse((c) => {
      count++
      if ((c as { isLight?: boolean }).isLight) c.visible = false
    })
    const f = fit.current
    if (count !== f.count) (f.count = count), (f.frames = 0)
    if (f.frames > 90) return
    f.frames++
    if (f.frames % 10 !== 1) return
    const prev = o.scale.x
    o.scale.setScalar(1)
    o.updateWorldMatrix(true, true)
    o.getWorldScale(ws)
    // Bay folded away or mid-unfold (non-uniform scale): try again next frame.
    if (ws.x < 0.05 || Math.abs(ws.y / ws.x - 1) > 0.01) return void (o.scale.setScalar(prev), f.frames--)
    box.setFromObject(i)
    box.getSize(size).divideScalar(ws.x)
    const m = Math.max(size.x, size.y, size.z)
    if (box.isEmpty() || !Number.isFinite(m)) return void o.scale.setScalar(prev)
    o.worldToLocal(box.getCenter(center))
    if (Number.isFinite(center.x + center.y + center.z)) i.position.sub(center)
    o.scale.setScalar(Math.min(6, MINI / Math.max(m, 1e-3)))
    o.visible = true
  })
  if (!Component) return null
  return (
    // intersectChildren=false: no pointer ever reaches the component (uikit and late children included).
    <group ref={outer} visible={false} intersectChildren={false}>
      <group ref={inner}>
        <Component />
      </group>
    </group>
  )
})
