"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Billboard, RoundedBox, Text as Label3D } from "@react-three/drei"
import { Box3, Color, ShaderMaterial, Vector3 } from "three"
import { useStudio } from "@/lib/studio-store"
import type { Vec3 } from "@/lib/layout"
import { findEntry } from "@/lib/registry"
import { DEFAULT_SIZE, liveFilled, openSlots, posed, progress, type Slot, type Template } from "@/lib/guides"
import { aimLabel, useDropAim } from "./drop-target"
import { contents } from "./layout-renderer"

const MINT = "#9FE7D2"
const WARM = "#F2B48A" // the next slot to build

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

// Translucent volume: faint fill, brighter soft band along the edges, a little rim light at grazing angles.
const VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() {
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`
const FRAG = /* glsl */ `
uniform vec3 color; uniform vec3 halfSize; uniform float fill; uniform float edge;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() {
  vec3 d = max(halfSize - abs(vP), 0.0);                                   // metres to each face
  float second = d.x + d.y + d.z - max(d.x, max(d.y, d.z)) - min(d.x, min(d.y, d.z));
  float e = 1.0 - smoothstep(0.0, 0.035, second);                      // near two faces = near an edge
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
  gl_FragColor = vec4(color, clamp(fill + edge * e + 0.25 * rim * edge, 0.0, 1.0));
}`
const glow = (size: Vec3) =>
  new ShaderMaterial({
    uniforms: { color: { value: new Color(MINT) }, halfSize: { value: new Vector3(...size).multiplyScalar(0.5) }, fill: { value: 0.12 }, edge: { value: 0.5 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  })

/** Ghost volumes for a guided template's open slots (edit mode only), plus the glow on whatever a drag is aimed at. */
export function SlotGuides() {
  const guide = useStudio((s) => s.guide)
  const items = useStudio((s) => s.items)
  const playMode = useStudio((s) => s.playMode)
  const aim = useDropAim((s) => s.target)
  if (playMode) return null
  const open = guide ? openSlots(posed(guide.slots), liveFilled(guide.filled, items)) : []
  // Ghosts live in the template root's space, so moving/turning/scaling the template moves them too.
  const root = guide && items.find((i) => i.id === guide.rootId)
  return (
    <>
      {aim?.kind === "item" && <ItemGlow id={aim.itemId} />}
      {root && (
        <group position={root.position} rotation={root.rotation} scale={root.scale}>
          {open.map((slot, k) => (
            <Ghost key={slot.id} slot={slot} next={k === 0} aimed={aim?.kind === "slot" && aim.slotId === slot.id} />
          ))}
        </group>
      )}
    </>
  )
}

function Ghost({ slot, next, aimed }: { slot: Slot; next: boolean; aimed: boolean }) {
  const size = slot.size ?? DEFAULT_SIZE
  const scale = slot.scale ?? 1
  const [hover, setHover] = useState(false)
  const mat = useMemo(() => glow(size), [size[0], size[1], size[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }) => {
    const u = mat.uniforms
    const t = (Math.sin(clock.elapsedTime * 2.2) + 1) / 2 // next slot breathes
    u.color.value.set(next && !aimed ? WARM : MINT)
    u.fill.value = aimed ? 0.24 : hover ? 0.2 : next ? 0.1 + 0.05 * t : 0.11
    u.edge.value = aimed ? 0.95 : hover ? 0.8 : next ? 0.4 + 0.3 * t : 0.38
  })
  const place = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation() // a ghost isn't an item: don't let the click reach the scene's select handlers
    useStudio.getState().placeSlot(slot.id)
  }
  const c = (slot.center ?? [0, 0, 0]).map((v) => v * scale) as Vec3
  const color = aimed ? MINT : next ? WARM : MINT
  return (
    <group position={slot.position} rotation={slot.rotation}>
      <group scale={scale} position={c}>
        <RoundedBox
          args={size}
          radius={Math.min(0.03, Math.min(...size) / 4)}
          smoothness={3}
          material={mat}
          onClick={place}
          onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
          onPointerOut={() => setHover(false)}
        />
      </group>
      {/* Faint footprint on the floor (template root's y = 0) under the volume. */}
      <mesh position={[c[0], 0.003 - slot.position[1], c[2]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <planeGeometry args={[size[0] * scale, size[2] * scale]} />
        <meshBasicMaterial color={color} transparent opacity={aimed || hover ? 0.14 : 0.06} depthWrite={false} />
      </mesh>
      <Billboard position={[0, c[1] + (size[1] / 2) * scale + 0.035, 0]}>
        <Suspense fallback={null}>
          <Label3D fontSize={0.034} letterSpacing={0.04} color={color} anchorY="bottom" raycast={() => null} outlineWidth={0.002} outlineColor="#0B0C10">
            {aimed ? "Drop to place" : `${next ? "NEXT  " : ""}${slotLabel(slot)}`}
          </Label3D>
        </Suspense>
      </Billboard>
    </group>
  )
}

const bounds = new Box3()
/** Mint glow around the placed item a drag would replace, labelled "Drop to replace <name>". */
function ItemGlow({ id }: { id: string }) {
  const b = useMemo(() => {
    const o = contents.get(id)
    if (!o) return null
    try {
      bounds.setFromObject(o)
    } catch {
      return null
    }
    if (bounds.isEmpty()) return null
    return { center: bounds.getCenter(new Vector3()).toArray() as Vec3, size: bounds.getSize(new Vector3()).addScalar(0.04).toArray() as Vec3 }
  }, [id])
  const mat = useMemo(() => b && glow(b.size), [b])
  useEffect(() => () => mat?.dispose(), [mat])
  if (!b || !mat) return null
  mat.uniforms.fill.value = 0.16
  mat.uniforms.edge.value = 0.9
  return (
    <group position={b.center}>
      <RoundedBox args={b.size} radius={0.03} smoothness={3} material={mat} raycast={() => null} />
      <Billboard position={[0, b.size[1] / 2 + 0.035, 0]}>
        <Suspense fallback={null}>
          <Label3D fontSize={0.036} letterSpacing={0.04} color={MINT} anchorY="bottom" raycast={() => null} outlineWidth={0.002} outlineColor="#0B0C10">
            {aimLabel({ kind: "item", itemId: id })}
          </Label3D>
        </Suspense>
      </Billboard>
    </group>
  )
}
