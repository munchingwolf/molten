"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, MathUtils, SRGBColorSpace, Vector3, type Group } from "three"

type Props = { speed?: number }

const R = 0.13 // 26 cm globe
const RING = R + 0.012
const TILT = 0.41 // Earth's 23.4° axial tilt
const C = 0.045 // globe centre height; keeps globe + stand centred on the origin

// Coarse coastlines as [lon, lat] rings. Rendered as a dot matrix, so a few dozen points per continent read as the real map.
const LAND: number[][][] = [
  // North America
  [[-166,68],[-156,71],[-140,70],[-128,70],[-115,68],[-95,68],[-85,70],[-80,63],[-94,59],[-90,56],[-82,52],[-78,58],[-70,60],[-64,58],[-56,52],[-60,47],[-66,44],[-70,42],[-74,40],[-76,35],[-81,31],[-80,26],[-82,26],[-84,30],[-89,30],[-94,29],[-97,26],[-97,21],[-91,19],[-87,21],[-88,16],[-84,15],[-83,10],[-78,8],[-81,7],[-86,11],[-92,14],[-97,16],[-105,20],[-112,26],[-115,30],[-117,32],[-121,35],[-124,40],[-124,46],[-127,50],[-133,56],[-140,60],[-148,61],[-154,58],[-163,55],[-158,59],[-165,61],[-166,64]],
  [[-90,72],[-80,74],[-66,70],[-62,66],[-72,62],[-80,64],[-88,68]],
  [[-120,74],[-95,76],[-80,80],[-65,82],[-90,82],[-115,78]],
  // Greenland, Iceland, Cuba
  [[-55,60],[-43,60],[-35,65],[-22,70],[-20,76],[-18,81],[-30,83],[-45,83],[-60,81],[-72,78],[-66,75],[-56,72],[-52,67],[-50,63]],
  [[-24,64],[-14,64],[-14,66],[-22,66.5]],
  [[-85,22],[-80,23],[-74,20],[-78,20]],
  // South America
  [[-78,8],[-72,12],[-62,11],[-55,6],[-50,1],[-44,-2],[-35,-6],[-37,-12],[-39,-18],[-41,-22],[-48,-26],[-53,-33],[-58,-38],[-62,-40],[-65,-45],[-68,-50],[-70,-54],[-74,-52],[-74,-45],[-73,-37],[-71,-30],[-70,-20],[-75,-15],[-79,-8],[-81,-4],[-80,0],[-77,4]],
  // Africa, Madagascar
  [[-17,15],[-17,21],[-13,27],[-10,30],[-8,34],[-6,36],[0,36],[10,37],[11,33],[15,32],[20,31],[25,32],[32,31],[34,28],[38,21],[43,12],[51,12],[48,5],[42,-2],[40,-10],[40,-16],[35,-21],[35,-25],[32,-29],[27,-34],[20,-35],[18,-32],[15,-26],[12,-17],[13,-11],[12,-5],[9,-1],[9,4],[5,5],[-2,5],[-8,4],[-12,7],[-15,11]],
  [[44,-25],[47,-25],[50,-16],[49,-12],[44,-17]],
  // Eurasia
  [[-9,37],[-9,43],[-2,43.5],[-1,46],[-5,48],[-2,49],[2,51],[5,53],[8,54],[8,57],[5,58],[5,62],[10,64],[14,68],[20,70],[28,71],[32,70],[40,67],[44,68],[54,69],[60,70],[68,72],[72,72],[80,73],[90,75],[100,77],[106,77],[115,74],[130,72],[140,72],[150,71],[160,70],[170,69],[180,68],[180,65],[178,63],[170,60],[163,56],[160,52],[157,51],[156,57],[150,59],[142,59],[136,55],[140,50],[140,47],[135,43],[130,42],[129,37],[127,35],[126,38],[125,40],[121,39],[122,37],[119,35],[121,32],[122,30],[120,26],[116,23],[111,21],[108,22],[106,19],[109,12],[106,9],[104,10],[100,13],[99,10],[100,6],[103,2],[104,1.5],[101,3],[98,8],[98,16],[94,17],[92,22],[89,22],[86,20],[80,15],[80,10],[77,8],[73,16],[72,21],[69,22],[67,25],[62,25],[58,24],[59.8,22.5],[57,19],[55,17],[52,16],[45,13],[43,13],[42,16],[39,21],[37,25],[35,28],[34,31],[35,33],[36,36],[30,36],[27,37],[26,40],[23,40],[24,38],[22,37],[21,39],[19,42],[15,45],[12,45],[12,44],[14,42],[16,41],[18,40],[16,38],[15,40],[11,42],[10,44],[8,44],[3,43],[3,42],[0,40],[-1,37],[-5,36]],
  // UK, Ireland, Japan
  [[-5,50],[1,51],[1,53],[-2,56],[-2,58],[-5,59],[-6,57],[-5,55],[-3,54],[-5,52]],
  [[-10,52],[-6,52],[-6,55],[-8,55],[-10,54]],
  [[130,31],[132,34],[136,34],[140,35],[141,38],[142,40],[141,42],[145,44],[142,45],[140,42],[140,40],[136,37],[132,35]],
  // Maritime Southeast Asia
  [[95,5],[98,4],[104,-2],[106,-6],[103,-5],[100,-1],[96,3]],
  [[106,-6],[114,-7],[114,-8.5],[106,-7]],
  [[109,1],[111,2],[117,7],[119,5],[118,1],[116,-4],[110,-3]],
  [[120,18],[122,18],[126,8],[124,6],[121,12]],
  [[131,-1],[138,-2],[146,-6],[150,-10],[141,-9],[138,-8],[132,-4]],
  // Australia, Tasmania, New Zealand
  [[114,-22],[117,-20],[122,-17],[126,-14],[130,-12],[136,-12],[137,-15],[141,-17],[142,-11],[144,-14],[146,-19],[150,-22],[153,-26],[153,-30],[150,-37],[146,-39],[141,-38],[138,-35],[135,-35],[131,-31],[124,-34],[118,-35],[115,-34],[114,-28]],
  [[145,-41],[148,-41],[147,-43.5]],
  [[173,-35],[176,-37],[178,-38],[175,-41],[173,-39]],
  [[172,-41],[174,-41],[171,-44],[167,-46],[169,-44]],
  // Antarctica
  [[-180,-72],[-120,-74],[-60,-64],[-40,-78],[0,-70],[60,-67],[120,-66],[180,-72],[180,-90],[-180,-90]],
]

function makeTexture() {
  // 1 px per degree land mask to sample from.
  const mask = document.createElement("canvas")
  mask.width = 360
  mask.height = 180
  const m = mask.getContext("2d", { willReadFrequently: true })!
  m.fillStyle = "#fff"
  for (const ring of LAND) {
    m.beginPath()
    ring.forEach(([lon, lat], i) => (i ? m.lineTo(lon + 180, 90 - lat) : m.moveTo(lon + 180, 90 - lat)))
    m.fill()
  }
  const land = m.getImageData(0, 0, 360, 180).data

  const W = 1024
  const H = 512
  const px = W / 360
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext("2d")!
  c.fillStyle = "#101521"
  c.fillRect(0, 0, W, H)
  c.strokeStyle = "#242833"
  c.lineWidth = 1.5
  for (let lon = -180; lon <= 180; lon += 30) {
    c.beginPath()
    c.moveTo((lon + 180) * px, 0)
    c.lineTo((lon + 180) * px, H)
    c.stroke()
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    c.beginPath()
    c.moveTo(0, (90 - lat) * px)
    c.lineTo(W, (90 - lat) * px)
    c.stroke()
  }
  c.fillStyle = "#9FE7D2"
  const STEP = 2.2 // degrees between dots
  for (let lat = 90 - STEP / 2; lat > -90; lat -= STEP) {
    const stretch = 1 / Math.max(0.12, Math.cos((lat * Math.PI) / 180)) // keep dots round on the sphere
    for (let lon = -180; lon < 180; lon += STEP * stretch) {
      const x = Math.min(359, Math.floor(lon + 180))
      const y = Math.min(179, Math.floor(90 - lat))
      if (land[(y * 360 + x) * 4] < 128) continue
      c.beginPath()
      c.ellipse((lon + 180) * px, (90 - lat) * px, 2.1 * Math.min(stretch, 8), 2.1, 0, 0, Math.PI * 2)
      c.fill()
    }
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const p = new Vector3()

/** 26 cm desk globe with a dot-matrix world map. It turns slowly on its tilted axis; drag or flick it to spin it faster. `speed` is the idle spin in rad/s. */
export default function Globe({ speed = 0.25 }: Props) {
  const tex = useMemo(makeTexture, [])
  useEffect(() => () => tex.dispose(), [tex])
  const axis = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const vel = useRef(speed)
  const drag = useRef<{ x: number; t: number } | null>(null)

  const localX = (e: ThreeEvent<PointerEvent>) => axis.current!.worldToLocal(p.copy(e.point)).x

  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { x: localX(e), t: performance.now() }
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current || !spin.current) return
    const x = localX(e)
    const now = performance.now()
    const turn = MathUtils.clamp((x - drag.current.x) / R, -1, 1) // the surface follows the hand
    spin.current.rotation.y += turn
    const dt = (now - drag.current.t) / 1000
    if (dt > 0.004) vel.current = MathUtils.clamp(MathUtils.lerp(vel.current, turn / dt, 0.6), -14, 14)
    drag.current = { x, t: now }
  }
  const up = () => {
    drag.current = null
  }

  useFrame((_, dt) => {
    if (!spin.current) return
    const d = Math.min(dt, 0.1)
    // A flick keeps its momentum, then eases back to the idle speed.
    if (drag.current) vel.current = MathUtils.damp(vel.current, 0, 8, d)
    else {
      vel.current = MathUtils.damp(vel.current, speed, 0.8, d)
      spin.current.rotation.y += vel.current * d
    }
  })

  return (
    <group>
      {/* Base + stem */}
      <mesh position={[0, -0.176, 0]}>
        <cylinderGeometry args={[0.07, 0.076, 0.018, 48]} />
        <meshStandardMaterial color="#15171E" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.132, 0]}>
        <cylinderGeometry args={[0.0065, 0.009, 0.07, 16]} />
        <meshStandardMaterial color="#F2B48A" metalness={0.4} roughness={0.3} />
      </mesh>
      <group ref={axis} position={[0, C, 0]} rotation={[0, 0, TILT]}>
        {/* Half meridian ring and pole pins */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[RING, 0.0035, 8, 64, Math.PI]} />
          <meshStandardMaterial color="#F2B48A" metalness={0.4} roughness={0.3} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, s * (R + 0.006), 0]}>
            <cylinderGeometry args={[0.003, 0.003, 0.018, 8]} />
            <meshStandardMaterial color="#F2B48A" metalness={0.4} roughness={0.3} />
          </mesh>
        ))}
        <group ref={spin} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <mesh>
            <sphereGeometry args={[R, 48, 32]} />
            <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.45} roughness={0.55} metalness={0.05} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
