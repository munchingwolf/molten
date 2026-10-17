"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import * as THREE from "three"

type Props = { intensity?: number; tint?: string }

// Environment meshes never take pointer rays, so hands and rays reach the components.
const noRay = () => null

// Room: x -9..9, z -10..8, ceiling 5 m. Big steel-framed windows fill the back wall.
const W = 9
const BACK = -10
const FRONT = 8
const H = 5

type Item = { m: THREE.Matrix4 }

/** Static instanced mesh: matrices are written once. */
function Inst({ items, children }: { items: Item[]; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    items.forEach((it, i) => mesh.setMatrixAt(i, it.m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} raycast={noRay}>
      {children}
    </instancedMesh>
  )
}

const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number): Item => ({
  m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)),
})

const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

function canvasTexture(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  draw(c.getContext("2d")!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repeat)
  }
  return t
}

function makeTextures() {
  const r = rand(5)
  // Oak planks, 8 per tile; tile repeated so planks are ~25 cm wide.
  const planks = canvasTexture(512, 512, (x) => {
    for (let col = 0; col < 8; col++) {
      for (let y = -r() * 200; y < 512; ) {
        const len = 140 + r() * 240
        x.fillStyle = `hsl(${26 + r() * 6}, ${34 + r() * 10}%, ${36 + r() * 12}%)`
        x.fillRect(col * 64, y, 64, len)
        x.fillStyle = "rgba(0,0,0,0.28)"
        x.fillRect(col * 64, y, 64, 2)
        y += len
      }
      x.fillStyle = "rgba(0,0,0,0.3)"
      x.fillRect(col * 64, 0, 2, 512)
    }
  }, [12, 12])
  // Exposed brick for the left wall.
  const brick = canvasTexture(256, 256, (x) => {
    x.fillStyle = "#8f8478"
    x.fillRect(0, 0, 256, 256)
    for (let row = 0; row < 16; row++) {
      for (let col = -1; col < 4; col++) {
        x.fillStyle = `hsl(${10 + r() * 10}, ${38 + r() * 14}%, ${30 + r() * 12}%)`
        x.fillRect(col * 64 + (row % 2) * 32 + 2, row * 16 + 2, 60, 12)
      }
    }
  }, [13, 3.7])
  // Daytime view through the windows: soft sky with a hazy skyline.
  const view = canvasTexture(512, 256, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, "#a8c6e6")
    g.addColorStop(0.7, "#efe4d2")
    g.addColorStop(1, "#f6e2c4")
    x.fillStyle = g
    x.fillRect(0, 0, 512, 256)
    x.fillStyle = "rgba(120,135,155,0.45)"
    for (let px = 0; px < 512; ) {
      const w = 18 + r() * 40
      const h = 30 + r() * 90
      x.fillRect(px, 256 - h, w, h)
      px += w + r() * 6
    }
  })
  return { planks, brick, view }
}

/** Warm indoor loft: oak floor, brick wall, tall steel windows, timber beams and soft daylight. */
export default function EnvStudioLoft({ intensity = 1, tint = "#ffe2bf" }: Props) {
  const tex = useMemo(makeTextures, [])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])

  const { mullions, beams } = useMemo(() => {
    const mullions: Item[] = []
    for (let i = 0; i <= 10; i++) mullions.push(box(-7.5 + i * 1.5, 2.45, BACK + 0.04, 0.07, 4.1, 0.07))
    for (const y of [0.4, 1.6, 3.0, 4.5]) mullions.push(box(0, y, BACK + 0.04, 15.07, 0.07, 0.07))
    const beams: Item[] = []
    for (let z = BACK + 1; z < FRONT; z += 2) beams.push(box(0, H - 0.17, z, 2 * W, 0.32, 0.22))
    return { mullions, beams }
  }, [])

  return (
    <group>
      <color attach="background" args={["#e8dccd"]} />
      <fog attach="fog" args={["#e8dccd", 14, 42]} />
      <hemisphereLight args={["#fff3e0", "#6b5444", 1.1 * intensity]} />
      {/* daylight, angled in from the front-left so it lights the faces of placed components */}
      <directionalLight position={[-6, 9, 8]} color={tint} intensity={2 * intensity} />

      {/* floor + rug */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, (BACK + FRONT) / 2]} raycast={noRay}>
        <planeGeometry args={[2 * W, FRONT - BACK]} />
        <meshLambertMaterial map={tex.planks} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, -0.9]} raycast={noRay}>
        <planeGeometry args={[3.4, 2.6]} />
        <meshLambertMaterial color="#3e4a52" />
      </mesh>

      {/* walls + ceiling */}
      <mesh position={[0, H / 2, BACK]} raycast={noRay}>
        <planeGeometry args={[2 * W, H]} />
        <meshLambertMaterial color="#d8cfc4" />
      </mesh>
      <mesh position={[0, 2.45, BACK + 0.02]} raycast={noRay}>
        <planeGeometry args={[15, 4.1]} />
        <meshBasicMaterial map={tex.view} fog={false} toneMapped={false} />
      </mesh>
      <mesh position={[-W, H / 2, (BACK + FRONT) / 2]} rotation-y={Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[FRONT - BACK, H]} />
        <meshLambertMaterial map={tex.brick} />
      </mesh>
      <mesh position={[W, H / 2, (BACK + FRONT) / 2]} rotation-y={-Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[FRONT - BACK, H]} />
        <meshLambertMaterial color="#cdc2b6" />
      </mesh>
      <mesh position={[0, H / 2, FRONT]} rotation-y={Math.PI} raycast={noRay}>
        <planeGeometry args={[2 * W, H]} />
        <meshLambertMaterial color="#d3c8bc" />
      </mesh>
      <mesh position={[0, H, (BACK + FRONT) / 2]} rotation-x={Math.PI / 2} raycast={noRay}>
        <planeGeometry args={[2 * W, FRONT - BACK]} />
        <meshLambertMaterial color="#4a4038" />
      </mesh>

      <Inst items={mullions}>
        <boxGeometry />
        <meshLambertMaterial color="#26272a" />
      </Inst>
      <Inst items={beams}>
        <boxGeometry />
        <meshLambertMaterial color="#6e5038" />
      </Inst>

      {/* pendant lamps */}
      {[-3, 0, 3].map((x) => (
        <group key={x} position={[x, 0, -5]}>
          <mesh position={[0, (H + 3.35) / 2, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.006, 0.006, H - 3.35, 4]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0, 3.25, 0]} raycast={noRay}>
            <coneGeometry args={[0.24, 0.22, 16, 1, true]} />
            <meshLambertMaterial color="#1f2124" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 3.13, 0]} raycast={noRay}>
            <sphereGeometry args={[0.07, 12, 8]} />
            <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* sofa on the right, facing the room */}
      <group position={[6.6, 0, -2]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, 0.22, 0]} raycast={noRay}>
          <boxGeometry args={[2.4, 0.44, 0.95]} />
          <meshLambertMaterial color="#7a5a45" />
        </mesh>
        <mesh position={[0, 0.62, 0.4]} raycast={noRay}>
          <boxGeometry args={[2.4, 0.5, 0.2]} />
          <meshLambertMaterial color="#6f513e" />
        </mesh>
      </group>

      {/* potted plants */}
      {[[-7.2, -8.2], [7.4, -8.4], [-7.6, 4]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.25, 0]} raycast={noRay}>
            <cylinderGeometry args={[0.28, 0.22, 0.5, 10]} />
            <meshLambertMaterial color="#c9b9a6" />
          </mesh>
          <mesh position={[0, 1.05, 0]} scale={[0.55, 0.75, 0.55]} raycast={noRay}>
            <icosahedronGeometry args={[1, 0]} />
            <meshLambertMaterial color="#4f7a3e" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}
