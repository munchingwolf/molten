"use client"

import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import {
  Color,
  Euler,
  InstancedBufferAttribute,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type BoxGeometry,
  type Group,
  type InstancedMesh,
} from "three"

export type MascotMood = "idle" | "listening" | "thinking" | "talking" | "happy"

type Props = {
  /** What Pix is doing. The assistant store's `status` ("idle" | "listening" | "thinking") passes straight in. */
  mood?: MascotMood
  /** Body colour. Accents stay warm. */
  color?: string
  /** Scale multiplier. 1 ≈ 13.5 cm tall. */
  size?: number
  /** Fired when someone pokes, pinches or clicks Pix. */
  onPress?: () => void
}

// ---------- the character, in voxel units (1 voxel = 1 cm at size 1) ----------

const WARM = "#F2B48A"
const BULB = "#FFD3B0"
const WHITE = "#EEF0F4"
const INK = "#0B0C10"
const MOUTH_INK = "#06221B"

const BODY = 0, EYE_L = 1, EYE_R = 2, PUP_L = 3, PUP_R = 4, HL_L = 5, HL_R = 6, MOUTH = 7
const EAR_L = 8, EAR_R = 9, ANT = 10, ARM_L = 11, ARM_R = 12, FOOT_L = 13, FOOT_R = 14
const RING = 15, ORBIT = 16, CONFETTI = 17
const PARTS = 15 // parts below RING get one shared matrix each; ring, orbit and confetti are placed one by one

/** Glow kinds: 0 fixed, 1 body (breathes with mood), 2 antenna bulb. */
type Vox = { part: number; p: [number, number, number]; s: [number, number, number]; c: string | null; shade: number; glow: number; kind: 0 | 1 | 2 }

const VOX: Vox[] = []
const add = (part: number, p: Vox["p"], s: Vox["s"], c: string | null, glow = 0, shade = 1, kind: Vox["kind"] = 0) =>
  VOX.push({ part, p, s, c, shade, glow, kind })

// Body: a 10x9x6 gumdrop (round dome, flat face, chamfered base). Only surface voxels are kept.
const inBody = (x: number, y: number, z: number) => {
  if (y < 0 || y > 8) return false
  const rh = (Math.abs(x / 5.2) ** 4 + Math.abs(z / 3.4) ** 4) ** 0.25
  const top = y > 4
  const ny = top ? (y - 4) / 4.6 : (4 - y) / 4.3
  const p = top ? 2.6 : 5
  return rh ** p + Math.abs(ny) ** p <= 1
}
const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
let seed = 0
const jitter = () => 0.95 + 0.1 * (((Math.sin(++seed * 12.9898) * 43758.5453) % 1 + 1) % 1)
for (let y = 0; y <= 8; y++)
  for (let x = -4.5; x <= 4.5; x++)
    for (let z = -2.5; z <= 2.5; z++) {
      if (!inBody(x, y, z) || NEIGHBOURS.every(([a, b, c]) => inBody(x + a, y + b, z + c))) continue
      add(BODY, [x, y, z], [1, 1, 1], null, 0.07, (y >= 7 ? 1.18 : y <= 1 ? 0.72 : 1) * jitter(), 1)
    }

// Face (front surface is z = 3). Eyes: 3x3 whites, 2x2 pupils with a 1-voxel shine, looking slightly inward.
add(EYE_L, [0, 0, 0], [3, 3, 0.3], WHITE, 0.12)
add(EYE_R, [0, 0, 0], [3, 3, 0.3], WHITE, 0.12)
add(PUP_L, [0, 0, 0], [2, 2, 0.3], INK)
add(PUP_R, [0, 0, 0], [2, 2, 0.3], INK)
add(HL_L, [0, 0, 0], [1, 1, 0.3], "#FFFFFF", 0.6)
add(HL_R, [0, 0, 0], [1, 1, 0.3], "#FFFFFF", 0.6)
add(MOUTH, [0, -0.5, 0], [2, 1, 0.3], MOUTH_INK)
add(BODY, [-1.5, 3, 3.1], [1, 1, 0.3], MOUTH_INK) // smile corners
add(BODY, [1.5, 3, 3.1], [1, 1, 0.3], MOUTH_INK)
add(BODY, [-3.5, 3, 3.1], [1, 0.75, 0.3], WARM, 0.25) // cheeks
add(BODY, [3.5, 3, 3.1], [1, 0.75, 0.3], WARM, 0.25)
// Ears (base + warm tip), antenna (stem + glowing bulb), stubby arms, hovering feet.
for (const e of [EAR_L, EAR_R]) {
  add(e, [0, 0.5, 0], [1, 1, 2], null, 0.07, 1.12, 1)
  add(e, [0, 1.5, 0], [1, 1, 1.4], WARM, 0.2)
}
add(ANT, [0, 0.5, 0], [0.4, 1, 0.4], null, 0, 0.75)
add(ANT, [0, 1.5, 0], [0.4, 1, 0.4], null, 0, 0.75)
add(ANT, [0, 2.6, 0], [1.1, 1.1, 1.1], BULB, 1, 1, 2)
for (const a of [ARM_L, ARM_R]) add(a, [0, -0.75, 0], [0.9, 1.5, 0.9], null, 0.07, 0.92, 1)
for (const f of [FOOT_L, FOOT_R]) add(f, [0, -0.75, 0], [2, 0.8, 2.4], WARM, 0.1)
// Effects: listening ring, thinking dots, happy confetti.
for (let i = 0; i < 16; i++) add(RING, [0, 0, 0], [1, 1, 1], null, 1.2)
for (const c of [WHITE, null, WARM]) add(ORBIT, [0, 0, 0], [1, 1, 1], c, 1)
for (const c of [null, WARM, WHITE, null, WARM, WHITE]) add(CONFETTI, [0, 0, 0], [1, 1, 1], c, 0.6)

const N = VOX.length // ≈ 300 instances, one draw call
const LOCAL = VOX.map((v) => new Matrix4().compose(new Vector3(...v.p), new Quaternion(), new Vector3(...v.s)))

const MOODS: Record<MascotMood, { ear: number; wide: number; ring: number; orbit: number; talk: number; squint: number; glow: number; bulb: number; tilt: number; roll: number }> = {
  idle: { ear: 0, wide: 0, ring: 0, orbit: 0, talk: 0, squint: 0, glow: 1, bulb: 0.9, tilt: -0.14, roll: 0 },
  listening: { ear: 1, wide: 1, ring: 1, orbit: 0, talk: 0, squint: 0, glow: 2.2, bulb: 2.4, tilt: 0, roll: 0 },
  thinking: { ear: 0.4, wide: 0, ring: 0, orbit: 1, talk: 0, squint: 0, glow: 1.4, bulb: 1.6, tilt: 0.12, roll: 0.14 },
  talking: { ear: 0.5, wide: 0, ring: 0, orbit: 0, talk: 1, squint: 0, glow: 1.5, bulb: 1.4, tilt: -0.14, roll: 0 },
  happy: { ear: 0.7, wide: 0, ring: 0, orbit: 0, talk: 0, squint: 1, glow: 1.8, bulb: 1.8, tilt: -0.1, roll: 0 },
}

// Per-instance glow: the voxel's own colour, emitted. Keeps it to one InstancedMesh + one standard material.
const addGlow = (shader: { vertexShader: string; fragmentShader: string }) => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float glow;\nvarying float vGlow;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = glow;")
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying float vGlow;")
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * vGlow;\n#endif")
}
const noop = () => {}

const v3 = new Vector3(), s3 = new Vector3(), q = new Quaternion(), e = new Euler(), lookE = new Euler(0, 0, 0, "YXZ")
const out = new Matrix4(), tmp = new Matrix4()
const at = (m: Matrix4, x: number, y: number, z: number) => m.multiply(tmp.makeTranslation(x, y, z))
const scaled = (m: Matrix4, x: number, y: number, z: number) => m.multiply(tmp.makeScale(x, y, z))
const turned = (m: Matrix4, x: number, y: number, z: number) => m.multiply(tmp.makeRotationFromEuler(e.set(x, y, z)))

/**
 * Pix, a pocket-sized voxel buddy for your assistant. Hovers, blinks, looks at you, perks its ears when listening,
 * orbits dots when thinking, chatters when talking, hops with confetti when happy, and giggles when poked.
 * ~300 voxels in one InstancedMesh, no shadows: cheap enough for Quest.
 */
export default function Mascot({ mood = "idle", color = "#9FE7D2", size = 1, onPress }: Props) {
  const root = useRef<Group>(null)
  const mesh = useRef<InstancedMesh>(null)
  const geo = useRef<BoxGeometry>(null)
  const glow = useMemo(() => new InstancedBufferAttribute(new Float32Array(N), 1), [])
  const calm = useMemo(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, [])
  const sim = useMemo(
    () => ({
      look: new Quaternion(), target: new Quaternion(), parts: Array.from({ length: PARTS }, () => new Matrix4()),
      ear: 0, wide: 0, ring: 0, orbit: 0, talk: 0, squint: 0, glow: 1, bulb: 1, tilt: -0.14, roll: 0, gx: 0, gy: 0,
      blinkAt: -1, nextBlink: 1.5, glanceX: 0, nextGlance: 3,
      happyPending: false, happyAt: -10, pokePending: false, pokeAt: -10, lastPoke: -Infinity,
      confetti: Array.from({ length: 6 }, () => new Vector3()),
    }),
    [],
  )

  useEffect(() => {
    if (mood === "happy") sim.happyPending = true
  }, [mood, sim])

  useLayoutEffect(() => {
    geo.current?.setAttribute("glow", glow)
    // XR touch pointers spherecast instanced meshes directly; route every pointer to the hit box instead.
    if (mesh.current) Object.assign(mesh.current, { spherecast: noop })
  }, [glow])

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const body = new Color(color), c = new Color()
    VOX.forEach((v, i) => m.setColorAt(i, (v.c ? c.set(v.c) : c.copy(body)).multiplyScalar(v.shade)))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [color])

  useFrame((state, delta) => {
    const m = mesh.current, g = root.current
    if (!m || !g) return
    const dt = Math.min(delta, 0.1)
    const t = state.clock.elapsedTime
    const mo = calm ? 0 : 1 // decorative motion off for prefers-reduced-motion
    const k = MOODS[mood] ?? MOODS.idle
    const s = sim
    const damp = (a: number, b: number, r = 9) => MathUtils.damp(a, b, r, dt)

    if (s.happyPending) {
      s.happyPending = false
      s.happyAt = t
      s.confetti.forEach((p, i) => p.set(Math.cos(i * 1.05 + t) * 8, 18 + (i % 3) * 4, Math.sin(i * 1.05 + t) * 8))
    }
    if (s.pokePending) {
      s.pokePending = false
      s.pokeAt = t
    }
    const ha = t - s.happyAt
    const pa = t - s.pokeAt
    const giggle = pa < 0.8 ? 1 : 0

    // Smooth every expression channel toward the mood, so state changes blend instead of snapping.
    s.ear = damp(s.ear, k.ear)
    s.wide = damp(s.wide, k.wide)
    s.ring = damp(s.ring, k.ring, 6)
    s.orbit = damp(s.orbit, k.orbit, 6)
    s.talk = damp(s.talk, k.talk)
    s.squint = damp(s.squint, Math.max(k.squint, giggle), 14)
    s.glow = damp(s.glow, k.glow, 4)
    s.bulb = damp(s.bulb, k.bulb * (mood === "thinking" ? 0.6 + 0.4 * Math.sin(t * 6) : 1), 6)
    s.tilt = damp(s.tilt, k.tilt, 5)
    s.roll = damp(s.roll, k.roll, 4)

    // Blink every few seconds; glance around when idle; look up when thinking.
    if (t > s.nextBlink) {
      s.blinkAt = t
      s.nextBlink = t + (mood === "listening" ? 4 : 2) + Math.random() * 3.5
    }
    const bt = (t - s.blinkAt) / 0.14
    const blink = bt >= 0 && bt < 1 ? 1 - 0.9 * Math.sin(Math.PI * bt) : 1
    if (t > s.nextGlance) {
      s.glanceX = mood === "idle" ? [-0.5, 0, 0, 0.5][Math.floor(Math.random() * 4)] : 0
      s.nextGlance = t + 1.5 + Math.random() * 3
    }
    const gxT = mood === "thinking" ? 0.5 * Math.sin(t * 0.9) : s.glanceX
    const gyT = mood === "thinking" ? 0.5 : mood === "listening" ? 0 : -0.5
    s.gx = damp(s.gx, gxT, 16)
    s.gy = damp(s.gy, gyT, 16)

    // Face the camera (yaw + a little pitch), with a curious roll when thinking and a wiggle when poked.
    const cam = g.worldToLocal(state.camera.getWorldPosition(v3))
    const yaw = Math.atan2(cam.x, cam.z)
    const pitch = MathUtils.clamp(-Math.atan2(cam.y, Math.hypot(cam.x, cam.z)), -0.35, 0.35)
    const wig = Math.sin(pa * 28) * Math.exp(-pa * 5) * 0.3 * mo
    s.target.setFromEuler(lookE.set(pitch, yaw, s.roll + wig))
    s.look.slerp(s.target, 1 - Math.exp(-5 * dt))

    const hop = ha < 0.5 ? 5 * Math.sin((Math.PI * ha) / 0.5) * mo : 0
    const bob = (mood === "listening" ? 0.3 * Math.sin(t * 3.2) : 0.45 * Math.sin(t * 2.2)) * mo
    let sy = 1 + 0.07 * Math.sin(t * 13) * s.talk * mo
    if (ha < 0.5) sy += 0.1 * Math.sin((Math.PI * ha) / 0.5) * mo
    else if (ha < 0.75) sy -= 0.14 * Math.sin((Math.PI * (ha - 0.5)) / 0.25) * mo
    sy -= 0.1 * Math.exp(-pa * 7) * mo
    const sx = 1 / Math.sqrt(sy)

    const P = s.parts
    const rootM = P[BODY].compose(s3.set(0, bob + hop, 0), s.look, v3.set(sx, sy, sx))
    at(rootM, 0, -5, 0) // pivot about the visual middle (feet to bulb)

    const ex = 1 + 0.15 * s.wide
    const ey = (1 + 0.2 * s.wide) * blink * (1 - 0.75 * s.squint)
    const lift = 0.4 * s.squint
    const look = 1 - s.squint
    for (const [eye, pup, hl, cx, gx] of [[EYE_L, PUP_L, HL_L, -2.5, 0.5], [EYE_R, PUP_R, HL_R, 2.5, -0.5]]) {
      scaled(at(P[eye].copy(rootM), cx, 5 + lift, 3.1), ex, ey, 1)
      // Pupils widen into a closed-eye line when squinting (happy, giggling).
      at(scaled(at(P[pup].copy(rootM), cx, 5 + lift, 3.3), ex * (1 + 0.5 * s.squint), ey, 1), MathUtils.clamp(gx + s.gx, -0.5, 0.5) * look, s.gy * look, 0)
      scaled(at(P[hl].copy(P[pup]), -0.5, 0.5, 0.02), look, look, 1)
    }

    const chatter = 0.5 + 0.5 * Math.sin(t * 13 + 0.6)
    const my = 0.55 + s.talk * chatter * 1.3 + 0.7 * s.squint + 0.4 * s.wide - (mood === "thinking" ? 0.15 : 0)
    scaled(at(P[MOUTH].copy(rootM), mood === "thinking" ? 0.5 : 0, 2.5, 3.1), mood === "thinking" ? 0.5 : 1, my, 1)

    const flick = Math.exp(-pa * 6) * 0.5
    const earA = MathUtils.lerp(0.42, -0.05, s.ear)
    scaled(turned(at(P[EAR_L].copy(rootM), -3.5, 7.5, 0), 0, 0, earA + flick), 1, 1 + 0.3 * s.ear, 1)
    scaled(turned(at(P[EAR_R].copy(rootM), 3.5, 7.5, 0), 0, 0, -earA - flick), 1, 1 + 0.3 * s.ear, 1)
    turned(at(P[ANT].copy(rootM), 0.5, 8.5, 0), 0.1 * Math.sin(t * 1.7) * mo, 0, s.tilt + (0.08 * Math.sin(t * 3.3) + wig * 1.5) * mo)

    const wave = ha < 1.6 ? 1 : 0
    const armA = 0.12 + s.talk * 0.35 * Math.abs(Math.sin(t * 6.5)) * mo + wave * (2.2 + 0.35 * Math.sin(t * 16) * mo)
    turned(at(P[ARM_L].copy(rootM), -5.05, 3.5, 0), 0, 0, -armA)
    turned(at(P[ARM_R].copy(rootM), 5.05, 3.5, 0), 0, 0, armA)
    const tuck = ha < 0.5 ? 0.35 : 0
    turned(at(P[FOOT_L].copy(rootM), -2, -0.5 + tuck, 0.3), 0.18 * Math.sin(t * 2.2) * mo, 0, 0)
    turned(at(P[FOOT_R].copy(rootM), 2, -0.5 + tuck, 0.3), -0.18 * Math.sin(t * 2.2) * mo, 0, 0)

    const ga = glow.array as Float32Array
    let ri = 0, oi = 0, ci = 0
    for (let i = 0; i < N; i++) {
      const v = VOX[i]
      if (v.part < PARTS) out.multiplyMatrices(P[v.part], LOCAL[i])
      else if (v.part === RING) {
        // Pulsing ring of voxels under Pix while it listens.
        const a = (ri / 16) * Math.PI * 2 + t * 0.6 * mo
        const r = 6.2 + 0.4 * Math.sin(t * 3) * mo
        const sc = s.ring * (0.45 + 0.3 * (0.5 + 0.5 * Math.sin(t * 6 * mo - ri * 0.8)))
        out.compose(v3.set(Math.cos(a) * r, -7.6, Math.sin(a) * r), q.setFromEuler(e.set(0, -a, 0)), s3.setScalar(sc))
        ri++
      } else if (v.part === ORBIT) {
        // Three dots circling the head while it thinks.
        const a = t * 2.4 * (mo || 0.3) + (oi * Math.PI * 2) / 3
        const sc = s.orbit * 0.7 * (0.8 + 0.2 * Math.sin(t * 5 + oi))
        out.compose(v3.set(Math.cos(a) * 5.6, 5.3 + bob + hop + 0.5 * Math.sin(t * 3 + oi) * mo, Math.sin(a) * 5.6), q.setFromEuler(e.set(t, a, 0)), s3.setScalar(sc))
        oi++
      } else {
        // Six confetti cubes, thrown up when Pix turns happy.
        const p = sim.confetti[ci]
        const life = ha < 1.4 && mo ? 1 - MathUtils.smoothstep(ha, 0.9, 1.4) : 0
        out.compose(
          v3.set(p.x * ha, 4 + p.y * ha - 25 * ha * ha, p.z * ha),
          q.setFromEuler(e.set(ha * 7 + ci, ha * 5, 0)),
          s3.setScalar(0.8 * life),
        )
        ci++
      }
      m.setMatrixAt(i, out)
      ga[i] = v.glow * (v.kind === 1 ? s.glow : v.kind === 2 ? s.bulb : 1)
    }
    m.instanceMatrix.needsUpdate = true
    glow.needsUpdate = true
  })

  const poke = () => {
    // Ray + hit box + touch can all land on the same press; count it once.
    if (performance.now() - sim.lastPoke < 150) return
    sim.lastPoke = performance.now()
    sim.pokePending = true
    onPress?.()
  }

  return (
    <group ref={root} scale={0.01 * size} onPointerDown={poke}>
      <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false} raycast={noop}>
        <boxGeometry ref={geo} />
        <meshStandardMaterial roughness={0.6} metalness={0} onBeforeCompile={addGlow} />
      </instancedMesh>
      {/* Invisible, generous poke target (Quest hands have no hover, so make it easy to hit). */}
      <mesh>
        <boxGeometry args={[12, 14, 8]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

