"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"

type GraphData = { nodes: { id: string; label?: string }[]; links: { source: string; target: string }[] }

type Props = {
  /** Your own graph. Without it, a random tree of `count` nodes is generated. */
  data?: GraphData
  /** Nodes in the generated graph, 3–40 */
  count?: number
  /** Selected node id ("" = none). Controlled, or uncontrolled. */
  value?: string
  onChange?: (id: string) => void
  color?: string
  /** Rest length of a link, metres */
  linkLength?: number
}

const R = 0.012 // node radius: 2.4 cm target, poke-able

// Deterministic so the same count always gives the same graph.
function generate(count: number): GraphData {
  let s = 7
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const nodes = Array.from({ length: count }, (_, i) => ({ id: String(i), label: `Node ${i}` }))
  const links = nodes.slice(1).map((n, i) => ({ source: n.id, target: String(Math.floor(rand() * (i + 1))) }))
  for (let k = 0; k < Math.floor(count / 5); k++) {
    const a = Math.floor(rand() * count)
    const b = Math.floor(rand() * count)
    if (a !== b) links.push({ source: String(a), target: String(b) })
  }
  return { nodes, links }
}

/** ~35 cm 3D node-link graph on a live spring simulation. Drag nodes (mouse, ray or fingertip) and the rest follow; tap one to select it. */
export default function ForceGraph({ data, count = 16, value, onChange, color = "#9FE7D2", linkLength = 0.08 }: Props) {
  const graph = useMemo(() => data ?? generate(Math.max(3, Math.min(40, Math.round(count)))), [data, count])
  const n = graph.nodes.length
  const edges = useMemo(() => {
    const index = new Map(graph.nodes.map((nd, i) => [nd.id, i]))
    return graph.links.flatMap((l) => {
      const a = index.get(l.source)
      const b = index.get(l.target)
      return a === undefined || b === undefined || a === b ? [] : [[a, b] as const]
    })
  }, [graph])
  const sim = useMemo(() => {
    const pos = Array.from({ length: n }, () => new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2))
    return { pos, vel: pos.map(() => new THREE.Vector3()), drag: -1 }
  }, [n])
  const lines = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3))
    return g
  }, [edges])
  useEffect(() => () => lines.dispose(), [lines])

  const [inner, setInner] = useState("")
  const selected = value ?? inner
  const [hover, setHover] = useState(-1)
  const group = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const d = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const { pos, vel } = sim
    const L = Math.max(0.02, linkLength)
    // Pairwise repulsion: n ≤ 40, so O(n²) is ~800 pairs, cheap.
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        d.subVectors(pos[i], pos[j])
        const d2 = Math.max(d.lengthSq(), 1e-4)
        d.multiplyScalar((0.25 * L * L * dt) / (d2 * Math.sqrt(d2)))
        vel[i].add(d)
        vel[j].sub(d)
      }
    for (const [a, b] of edges) {
      d.subVectors(pos[b], pos[a])
      const len = Math.max(d.length(), 1e-4)
      d.multiplyScalar(((len - L) / len) * 25 * dt)
      vel[a].add(d)
      vel[b].sub(d)
    }
    for (let i = 0; i < n; i++) {
      if (i === sim.drag) {
        vel[i].set(0, 0, 0)
        continue
      }
      vel[i].addScaledVector(pos[i], -1.5 * dt).multiplyScalar(Math.pow(0.02, dt)) // centering + damping
      pos[i].addScaledVector(vel[i], dt)
      meshes.current[i]?.position.copy(pos[i])
    }
    if (sim.drag >= 0) meshes.current[sim.drag]?.position.copy(pos[sim.drag])
    const p = lines.attributes.position as THREE.BufferAttribute
    edges.forEach(([a, b], k) => {
      p.setXYZ(k * 2, pos[a].x, pos[a].y, pos[a].z)
      p.setXYZ(k * 2 + 1, pos[b].x, pos[b].y, pos[b].z)
    })
    p.needsUpdate = true
  })

  const down = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    sim.drag = i
  }
  const move = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    if (sim.drag === i && group.current) sim.pos[i].copy(group.current.worldToLocal(e.point.clone()))
  }
  const up = () => {
    sim.drag = -1
  }
  const select = (id: string) => {
    const next = id === selected ? "" : id
    if (value === undefined) setInner(next)
    onChange?.(next)
  }

  const sel = graph.nodes.findIndex((nd) => nd.id === selected)
  const degree = sel < 0 ? 0 : edges.filter(([a, b]) => a === sel || b === sel).length

  return (
    <group>
      <group ref={group}>
        <lineSegments geometry={lines} frustumCulled={false} raycast={() => null}>
          <lineBasicMaterial color="#7FE3FF" transparent opacity={0.45} />
        </lineSegments>
        {graph.nodes.map((nd, i) => (
          <mesh
            key={nd.id}
            ref={(m) => void (meshes.current[i] = m)}
            position={sim.pos[i]}
            onPointerDown={down(i)}
            onPointerMove={move(i)}
            onPointerUp={up}
            onPointerCancel={up}
            onClick={() => select(nd.id)}
            onPointerOver={() => setHover(i)}
            onPointerOut={() => setHover((h) => (h === i ? -1 : h))}
          >
            <sphereGeometry args={[i === sel ? R * 1.3 : R, 16, 12]} />
            <meshStandardMaterial
              color={i === sel ? "#7FE3FF" : color}
              emissive={i === sel ? "#7FE3FF" : color}
              emissiveIntensity={i === sel ? 0.6 : hover === i ? 0.4 : 0.12}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>
      <group position={[0, -0.22, 0]}>
        <Container pixelSize={0.002} backgroundColor="#15171E" borderRadius={10} paddingX={12} paddingY={6} flexDirection="row" gap={8} pointerEvents="none">
          <Text fontSize={13} fontWeight="semi-bold" color="#EEF0F4">
            {sel < 0 ? `${n} nodes · ${edges.length} links` : graph.nodes[sel].label ?? graph.nodes[sel].id}
          </Text>
          {sel >= 0 && (
            <Text fontSize={11} color="#9AA0AD">
              {`${degree} links`}
            </Text>
          )}
        </Container>
      </group>
    </group>
  )
}
