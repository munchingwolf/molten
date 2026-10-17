"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Billboard } from "@react-three/drei"
import { Container, Text } from "@react-three/uikit"
import { BoxGeometry, EdgesGeometry, type LineBasicMaterial, type MeshBasicMaterial } from "three"
import { useStudio } from "@/lib/studio-store"
import type { Vec3 } from "@/lib/layout"
import { findEntry } from "@/lib/registry"
import { DEFAULT_SIZE, liveFilled, openSlots, posed, progress, type Slot, type Template } from "@/lib/guides"

const MINT = "#9FE7D2"
const WARM = "#F2B48A" // the next slot to build
const EDGES = new EdgesGeometry(new BoxGeometry(1, 1, 1))

/** Templates from /api/templates (laptop Template Library + VR guide panel). */
export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates).catch(() => {})
  }, [])
  return templates
}

/** Live guide progress: { placed, total, next } or null when no guide is running. */
export function useGuideProgress() {
  const guide = useStudio((s) => s.guide)
  const items = useStudio((s) => s.items)
  return guide ? { name: guide.name, ...progress(guide.slots, liveFilled(guide.filled, items)) } : null
}

export const slotLabel = (s: Slot) => s.hint ?? s.name ?? findEntry(s.component)?.displayName ?? s.component

/** Ghost outlines for a guided template's open slots (edit mode only). Tap/pinch/click one to place its component. */
export function SlotGuides() {
  const guide = useStudio((s) => s.guide)
  const items = useStudio((s) => s.items)
  const playMode = useStudio((s) => s.playMode)
  if (!guide || playMode) return null
  const open = openSlots(posed(guide.slots), liveFilled(guide.filled, items))
  // Ghosts live in the template root's space, so moving/turning/scaling the template moves them too.
  const root = items.find((i) => i.id === guide.rootId)
  return (
    <group position={root?.position} rotation={root?.rotation} scale={root?.scale}>
      {open.map((slot, k) => (
        <Ghost key={slot.id} slot={slot} next={k === 0} />
      ))}
    </group>
  )
}

function Ghost({ slot, next }: { slot: Slot; next: boolean }) {
  const size = slot.size ?? DEFAULT_SIZE
  const scale = slot.scale ?? 1
  const edges = useRef<LineBasicMaterial>(null)
  const fill = useRef<MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const t = (Math.sin(clock.elapsedTime * (next ? 4 : 2)) + 1) / 2
    if (edges.current) edges.current.opacity = next ? 0.55 + 0.45 * t : 0.3 + 0.25 * t
    if (fill.current) fill.current.opacity = next ? 0.07 + 0.08 * t : 0.04
  })
  const color = next ? WARM : MINT
  const place = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation() // a ghost isn't an item: don't let the click reach the scene's select handlers
    useStudio.getState().placeSlot(slot.id)
  }
  return (
    <group position={slot.position} rotation={slot.rotation}>
      <group scale={scale} position={(slot.center ?? [0, 0, 0]).map((v) => v * scale) as Vec3}>
        <lineSegments geometry={EDGES} scale={size} raycast={() => {}}>
          <lineBasicMaterial ref={edges} color={color} transparent depthWrite={false} />
        </lineSegments>
        <mesh scale={size} onClick={place}>
          <boxGeometry />
          <meshBasicMaterial ref={fill} color={color} transparent depthWrite={false} />
        </mesh>
      </group>
      <Billboard position={[0, ((slot.center?.[1] ?? 0) + size[1] / 2) * scale + 0.06, 0]}>
        <Container
          pixelSize={0.0015}
          flexDirection="row"
          alignItems="center"
          gap={8}
          paddingX={14}
          height={44}
          borderRadius={22}
          backgroundColor="#15171E"
          borderWidth={2}
          borderColor={color}
          cursor="pointer"
          onClick={place}
        >
          {next && <Text fontSize={15} fontWeight="bold" color={WARM}>NEXT</Text>}
          <Text fontSize={16} color="#EEF0F4">{`${slotLabel(slot)} - drop here or tap`}</Text>
        </Container>
      </Billboard>
    </group>
  )
}
