"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Handle, defaultApply } from "@react-three/handle"
import { Container, Text } from "@react-three/uikit"
import { Box3, Vector3, type Group } from "three"
import { components, findEntry } from "@/lib/registry"
import { bindingProps, type Bindable, type Item, type Vec3 } from "@/lib/layout"

/** Registry `bindable` metadata (Person 2 adds it per entry); empty until then. */
export const bindablesOf = (name: string): Bindable[] =>
  (findEntry(name) as { bindable?: Bindable[] } | undefined)?.bindable ?? []

type Props = {
  items: Item[]
  values: Record<string, unknown>
  setValue: (name: string, v: unknown) => void
  /** Studio mode: grab bar per item + click to select. Launched apps pass false. */
  editable?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onMove?: (id: string, position: Vec3) => void
}

export function LayoutRenderer(p: Props) {
  return (
    <>
      {p.items.map((item) => (
        <Placed key={item.id} item={item} {...p} />
      ))}
    </>
  )
}

function Placed({ item, values, setValue, editable, selectedId, onSelect, onMove }: Props & { item: Item }) {
  const ref = useRef<Group>(null)
  const content = useRef<Group>(null)
  const Component = components[item.component]
  const props = bindingProps(item, bindablesOf(item.component), values, setValue)
  return (
    <group
      ref={ref}
      position={item.position}
      rotation={item.rotation}
      scale={item.scale}
      onClick={editable ? () => onSelect?.(item.id) : undefined}
    >
      <group ref={content}>{Component ? <Component {...props} /> : <Missing name={item.component} />}</group>
      {editable && (
        <GrabBar
          target={ref}
          content={content}
          selected={selectedId === item.id}
          onGrab={() => onSelect?.(item.id)}
          onDrop={(pos) => onMove?.(item.id, pos)}
        />
      )}
    </group>
  )
}

const box = new Box3()
const size = new Vector3()

/** Bar under the component: grab it (mouse drag, hand grab, controller grip) to move the whole item. */
function GrabBar({ target, content, selected, onGrab, onDrop }: {
  target: React.RefObject<Group | null>
  content: React.RefObject<Group | null>
  selected: boolean
  onGrab: () => void
  onDrop: (p: Vec3) => void
}) {
  const bar = useRef<Group>(null)
  const [width, setWidth] = useState(0.3)
  const frame = useRef(0)
  // Size/place the bar from the component's bounds; uikit lays out async, so re-measure every ~0.5s.
  useFrame(() => {
    if (!target.current || !content.current || !bar.current || frame.current++ % 30) return
    box.setFromObject(content.current)
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
      targetRef={target}
      translate
      rotate={false}
      scale={false}
      apply={(state, t) => {
        if (state.first) onGrab()
        defaultApply(state, t)
        if (state.last) onDrop(t.position.toArray() as Vec3)
      }}
    >
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
