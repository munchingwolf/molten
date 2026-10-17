"use client"

import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"

// Real-world 50 x 50 cm wedge-foam tiles (metres). Hangs on a wall: faces +Z, origin = bounding-box centre.
const TILE = 0.5
const GAP = 0.02
const BASE_T = 0.025
const RIDGES = 5
const RIDGE_H = 0.035

/** Wedge prism: a 3-sided cylinder (apex toward +Z), squashed to the ridge height. */
function wedgeGeometry() {
  const w = TILE / RIDGES
  const r = w / Math.sqrt(3) // circumradius for a triangle with base w
  const g = new THREE.CylinderGeometry(r, r, TILE, 3, 1)
  g.translate(0, 0, r / 2) // base edge (at z = -r/2) onto z = 0
  g.scale(1, 1, RIDGE_H / (1.5 * r))
  return g
}

/**
 * Set of wedge-foam acoustic panels for a studio wall, in a checkerboard of ridge directions and two colours.
 * `cols` x `rows` tiles. Decor.
 */
export default function AcousticPanels({
  cols = 3,
  rows = 2,
  color = "#2A2B2F",
  accent = "#3E6E8E",
}: {
  cols?: number
  rows?: number
  color?: string
  /** Every other tile */
  accent?: string
}) {
  const c = Math.max(1, Math.min(8, Math.round(cols) || 3))
  const r = Math.max(1, Math.min(6, Math.round(rows) || 2))
  const n = c * r
  const wedge = useMemo(wedgeGeometry, [])
  useEffect(() => () => wedge.dispose(), [wedge])
  const bases = useRef<THREE.InstancedMesh>(null)
  const ridges = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const one = new THREE.Vector3(1, 1, 1)
    const col = new THREE.Color()
    const w = c * TILE + (c - 1) * GAP
    const h = r * TILE + (r - 1) * GAP
    let k = 0
    for (let i = 0; i < c; i++)
      for (let j = 0; j < r; j++) {
        const t = i * r + j
        const x = -w / 2 + TILE / 2 + i * (TILE + GAP)
        const y = -h / 2 + TILE / 2 + j * (TILE + GAP)
        const z0 = -(BASE_T + RIDGE_H) / 2
        const tint = (i + j) % 2 ? accent : color
        bases.current?.setMatrixAt(t, m.compose(new THREE.Vector3(x, y, z0 + BASE_T / 2), q.identity(), one))
        bases.current?.setColorAt(t, col.set(tint))
        const vertical = (i + j) % 2 === 0
        q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), vertical ? 0 : Math.PI / 2)
        for (let s = 0; s < RIDGES; s++) {
          const off = -TILE / 2 + (s + 0.5) * (TILE / RIDGES)
          const p = vertical ? new THREE.Vector3(x + off, y, z0 + BASE_T) : new THREE.Vector3(x, y + off, z0 + BASE_T)
          ridges.current?.setMatrixAt(k, m.compose(p, q, one))
          ridges.current?.setColorAt(k, col.set(tint))
          k++
        }
      }
    for (const im of [bases.current, ridges.current]) {
      if (!im) continue
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
      im.computeBoundingSphere()
    }
  }, [c, r, color, accent])

  return (
    <group>
      <instancedMesh key={`b${n}`} ref={bases} args={[undefined, undefined, n]}>
        <boxGeometry args={[TILE, TILE, BASE_T]} />
        <meshPhysicalMaterial roughness={1} sheen={0.4} sheenRoughness={0.9} />
      </instancedMesh>
      <instancedMesh key={`r${n}`} ref={ridges} args={[wedge, undefined, n * RIDGES]}>
        <meshPhysicalMaterial roughness={1} flatShading sheen={0.4} sheenRoughness={0.9} />
      </instancedMesh>
    </group>
  )
}
