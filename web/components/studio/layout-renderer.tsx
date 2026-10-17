"use client"

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react"
import { useFrame } from "@react-three/fiber"
import { Handle, HandleStore, PivotHandlesContext, PivotHandlesHandles, defaultApply, type HandleState } from "@react-three/handle"
import { Container, Text } from "@react-three/uikit"
import { Box3, Vector3, type Group, type Object3D } from "three"
import { components, findEntry } from "@/lib/registry"
import { bindingProps, type Bindable, type Item, type Vec3 } from "@/lib/layout"
import { SNAP, clampScale, isSurface, mountOnCeiling, mountOnWall, restOn, snapRotation, snapTo } from "@/lib/snap"
import { useXR } from "@react-three/xr"

/** Registry `bindable` metadata (Person 2 adds it per entry); empty until then. */
export const bindablesOf = (name: string): Bindable[] =>
  (findEntry(name) as { bindable?: Bindable[] } | undefined)?.bindable ?? []

// Registry components take arbitrary props; frames also take children.
const componentOf = (name: string) => components[name] as ComponentType<Record<string, unknown> & { children?: ReactNode }> | undefined

export type TransformPatch = { position?: Vec3; rotation?: Vec3; scale?: number }

type Props = {
  items: Item[]
  values: Record<string, unknown>
  setValue: (name: string, v: unknown) => void
  /** Studio mode: grab bar per item + click to select. Launched apps pass false. */
  editable?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onMove?: (id: string, position: Vec3) => void
  /** Final transform on release (move, two-hand scale/rotate, gizmo). Replaces onMove when given. */
  onTransform?: (id: string, patch: TransformPatch) => void
  /** Snap moves to 2.5 cm, turns to 15°, scale to 0.05 (hold Shift to bypass). Default true. */
  snap?: boolean
}

export function LayoutRenderer(p: Props) {
  const visible = p.items.filter((i) => !i.hidden)
  const ids = new Set(visible.map((i) => i.id))
  return (
    <>
      {visible.map((item) =>
        // Frame children render inside their frame (auto-layout places them); orphans render at the top level.
        item.parentId && ids.has(item.parentId) ? null : <Placed key={item.id} item={item} {...p} items={visible} />,
      )}
    </>
  )
}

/** Each item's content group (surface snapping, X-ray overlay measure these). */
export const contents = new Map<string, Object3D>()

/** A frame's child: laid out by the frame, so no own transform/gizmo; click selects it. */
function FrameChild({ item, items, values, setValue, editable, onSelect }: Props & { item: Item }) {
  const content = useRef<Group>(null)
  const Component = componentOf(item.component)
  const props = bindingProps(item, bindablesOf(item.component), values, setValue)
  useEffect(() => {
    if (content.current) contents.set(item.id, content.current)
    return () => void contents.delete(item.id)
  }, [item.id])
  const kids = items.filter((c) => c.parentId === item.id)
  return (
    <group ref={content} scale={item.scale} onClick={editable ? (e) => (e.stopPropagation(), onSelect?.(item.id)) : undefined}>
      {Component ? (
        <Component {...props}>
          {kids.length ? kids.map((c) => <FrameChild key={c.id} item={c} items={items} values={values} setValue={setValue} editable={editable} onSelect={onSelect} />) : undefined}
        </Component>
      ) : (
        <Missing name={item.component} />
      )}
    </group>
  )
}

function Placed({ item, items, values, setValue, editable, selectedId, onSelect, onMove, onTransform, snap = true }: Props & { item: Item }) {
  const ref = useRef<Group>(null)
  const content = useRef<Group>(null)
  const Component = componentOf(item.component)
  const props = bindingProps(item, bindablesOf(item.component), values, setValue)
  const inXR = useXR((x) => x.session != null)
  const kids = items.filter((c) => c.parentId === item.id)
  const body = Component ? (
    <Component {...props}>
      {kids.length ? kids.map((c) => <FrameChild key={c.id} item={c} items={items} values={values} setValue={setValue} editable={editable} onSelect={onSelect} />) : undefined}
    </Component>
  ) : (
    <Missing name={item.component} />
  )
  useEffect(() => {
    if (content.current) contents.set(item.id, content.current)
    return () => void contents.delete(item.id)
  }, [item.id])

  // Shared by the grab bar / hand grab and the gizmo: snap while dragging, seat on a surface and report on release.
  const apply = (state: HandleState<unknown>, t: Object3D) => {
    if (state.first) onSelect?.(item.id)
    applySnapped(state, t, snap)
    if (!state.last) return
    seatOnSurface(t, item.id, items)
    mount(t, item, items)
    const position = t.position.toArray() as Vec3
    if (onTransform) onTransform(item.id, { position, rotation: [t.rotation.x, t.rotation.y, t.rotation.z], scale: t.scale.x })
    else onMove?.(item.id, position)
  }

  return (
    // PivotHandlesContext is a plain group that the gizmo below transforms. Its types omit `scale`, so it goes in via spread.
    <PivotHandlesContext
      ref={ref}
      position={item.position}
      rotation={item.rotation}
      {...{ scale: item.scale }}
      apply={apply}
      onClick={editable ? () => onSelect?.(item.id) : undefined}
    >
      {/* In the headset the gizmo's big handles catch pokes meant for the component; hands use grab + two-hand scale/turn. */}
      {editable && !item.locked && !inXR && selectedId === item.id && <PivotHandlesHandles fixed={false} size={0.35} />}
      {editable && !item.locked ? (
        <GrabHandle target={ref} content={content} selected={selectedId === item.id} apply={apply}>
          <group ref={content}>{body}</group>
        </GrabHandle>
      ) : (
        <group ref={content}>{body}</group>
      )}
    </PivotHandlesContext>
  )
}

function applySnapped(state: HandleState<unknown>, t: Object3D, snap: boolean) {
  defaultApply(state, t)
  // Items have one uniform scale: the axis the gesture changed most drives all three (so the gizmo's axis-scale cubes scale uniformly too).
  const s0 = state.initial.scale.x
  let s = [t.scale.x, t.scale.y, t.scale.z].reduce((a, b) => (Math.abs(b - s0) > Math.abs(a - s0) ? b : a))
  if (snap && !state.event?.shiftKey) {
    t.position.set(snapTo(t.position.x, SNAP.move), snapTo(t.position.y, SNAP.move), snapTo(t.position.z, SNAP.move))
    snapRotation(t.quaternion, state.initial.quaternion, SNAP.angle)
    s = snapTo(s, SNAP.scale)
  }
  t.scale.setScalar(clampScale(s))
  t.rotation.reorder("XYZ") // Item.rotation is an XYZ euler
}

/** On release: if the item's bottom is just above a desk/stage/table top, drop it exactly onto it. */
function seatOnSurface(t: Object3D, id: string, items: Item[]) {
  const self = contents.get(id)
  const tops = items.flatMap((i) => {
    const o = i.id !== id && isSurface(i.component, findEntry(i.component)?.tags) ? contents.get(i.id) : undefined
    return o ? [new Box3().setFromObject(o)] : []
  })
  if (!self || tops.length === 0) return
  t.updateWorldMatrix(true, true)
  const dy = restOn(new Box3().setFromObject(self), tops)
  if (dy === 0) return
  const p = t.getWorldPosition(new Vector3())
  p.y += dy
  t.position.copy(t.parent ? t.parent.worldToLocal(p) : p)
}

/** On release: `mount:wall` items go flush onto the nearest wall face and turn to face out; `mount:ceiling` items hang at the ceiling. */
function mount(t: Object3D, item: Item, items: Item[]) {
  const tags = findEntry(item.component)?.tags ?? []
  const wallMount = tags.includes("mount:wall")
  if (!wallMount && !tags.includes("mount:ceiling")) return
  const walls = items.flatMap((i) => {
    const o = i.id !== item.id && findEntry(i.component)?.tags?.includes("wall") ? contents.get(i.id) : undefined
    return o ? [new Box3().setFromObject(o)] : []
  })
  t.updateWorldMatrix(true, false)
  const origin = t.getWorldPosition(new Vector3())
  const m = wallMount ? mountOnWall(origin, walls) : mountOnCeiling(origin, walls)
  if (!m) return
  const p = new Vector3(...m.position)
  t.position.copy(t.parent ? t.parent.worldToLocal(p) : p)
  if (m.yaw !== undefined) t.rotation.set(0, m.yaw, 0)
}

// One pointer only moves. A second pointer on the same item adds uniform scale (hand distance) and yaw (hand twist).
const ONE_POINTER = { rotate: false, scale: false } as const
const TWO_POINTERS = { rotate: { x: false, y: true, z: false }, scale: { uniform: true } }

const box = new Box3()
const size = new Vector3()

/**
 * Grab bar under the component (mouse drag, ray, poke, hand grab, controller grip) moves the whole item.
 * The grab pointer (pinch near / controller grip) also grabs anywhere on the component, so two hands can scale and turn it,
 * while poke and ray presses still reach the component's own controls.
 */
function GrabHandle({ target, content, selected, apply, children }: {
  target: React.RefObject<Group | null>
  content: React.RefObject<Group | null>
  selected: boolean
  apply: (state: HandleState<unknown>, t: Object3D) => void
  children: React.ReactNode
}) {
  const store = useRef<HandleStore<unknown>>(null)
  const bar = useRef<Group>(null)
  const [width, setWidth] = useState(0.3)
  const frame = useRef(0)
  // Size/place the bar from the component's bounds; uikit lays out async, so re-measure every ~0.5s.
  useFrame(() => {
    if (!target.current || !content.current || !bar.current || frame.current++ % 30) return
    try {
      box.setFromObject(content.current)
    } catch {
      return // a child mid-load (e.g. glTF/uikit) can throw while measuring; try again next tick
    }
    if (box.isEmpty()) return
    const s = target.current.scale.x || 1
    box.getSize(size)
    const center = target.current.worldToLocal(box.getCenter(new Vector3()))
    const bottom = target.current.worldToLocal(box.min.clone())
    bar.current.position.set(center.x, bottom.y - 0.05 / s, 0)
    const w = Math.max(0.15, Math.min(0.5, size.x * 0.5)) / s
    if (Math.abs(w - width) > 0.01) setWidth(w)
  })
  return (
    <Handle
      ref={store}
      targetRef={target}
      translate
      multitouch
      filter={(e) => e.pointerType === "grab" || e.object.parent === bar.current}
      // rotate/scale must come from here, not props: props override getHandleOptions.
      getHandleOptions={() => ((store.current?.inputState.size ?? 0) > 1 ? TWO_POINTERS : ONE_POINTER)}
      apply={apply}
    >
      {children}
      <group ref={bar} position={[0, -0.25, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.012, width, 4, 12]} />
          <meshBasicMaterial color={selected ? "#1FB54A" : "#ECE9DF"} />
        </mesh>
        {/* Bigger invisible hit area so a fingertip or ray finds it easily. */}
        <mesh>
          <boxGeometry args={[width + 0.06, 0.06, 0.06]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </Handle>
  )
}

function Missing({ name }: { name: string }) {
  return (
    <Container pixelSize={0.002} padding={24} backgroundColor="#1A1B18" borderRadius={12}>
      <Text fontSize={18} color="#ECE9DF">{`${name} (coming soon)`}</Text>
    </Container>
  )
}
