"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, Color, ExtrudeGeometry, Object3D, SRGBColorSpace, Shape, type Group, type InstancedMesh } from "three"
import { Container, Text, withOpacity, type VanillaContainer } from "@react-three/uikit"
import { Check, FlaskConical, GitBranch, Hammer, LoaderCircle, Package, Rocket } from "@react-three/uikit-lucide"

type Props = {
  /** Current stage index: -1 idle, 0-3 running that stage, 4 deployed. */
  value?: number
  onChange?: (stage: number) => void
  /** Fires when the deploy finishes. */
  onPress?: () => void
  project?: string
  branch?: string
  accent?: string
  /** Seconds per stage. */
  speed?: number
}

const PX = 0.002
const W = 620 // px -> 1.24 m
const H = 260
const COL = 130
const STAGES = [
  { name: "Install", Icon: Package, log: "npm ci - added 412 packages in 2.1s" },
  { name: "Build", Icon: Hammer, log: "next build - compiled 38 routes, 182 kB first load" },
  { name: "Test", Icon: FlaskConical, log: "vitest - 64 passed, 0 failed" },
  { name: "Deploy", Icon: Rocket, log: "uploading to edge - 18 regions" },
]
const MINT = "#9FE7D2"

// ---------- shared slab + motion ----------
let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated brushed-metal matcap shades the bezel the same everywhere.
function getMatcap() {
  if (matcap) return matcap
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 34, 0, 64, 34, 92)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.45, "#c9ccd4")
  grad.addColorStop(1, "#26282f")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  matcap = new CanvasTexture(c)
  matcap.colorSpace = SRGBColorSpace
  return matcap
}
function slabGeometry(w: number, h: number, r: number, d: number) {
  const s = new Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  const bevel = 0.004
  const g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 })
  g.translate(0, 0, -(d + bevel) - 0.0015)
  return g
}
function Slab({ w, h, r = 18, depth = 0.022, color = "#2A2E38" }: { w: number; h: number; r?: number; depth?: number; color?: string }) {
  const mc = useMemo(getMatcap, [])
  const geo = useMemo(() => slabGeometry(w * PX, h * PX, r * PX, depth), [w, h, r, depth])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshMatcapMaterial matcap={mc} color={color} />
    </mesh>
  )
}
const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2
function usePanelMotion(w: number, h: number, amp = 0.5, delay = 0) {
  const ref = useRef<Group>(null)
  const m = useRef({ born: -1, z: 0, rx: 0, ry: 0, tx: 0, ty: 0, hover: false })
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const s = m.current
    const now = state.clock.elapsedTime
    if (s.born < 0) s.born = now
    const p = Math.min(1, Math.max(0, (now - s.born - delay) / 0.8))
    const e = p === 1 ? 1 : easeOutBack(p)
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 10)
    s.z += ((s.hover ? 0.025 : 0) - s.z) * k
    s.rx += (s.tx - s.rx) * k
    s.ry += (s.ty - s.ry) * k
    g.position.set(0, (1 - e) * -0.06, s.z - (1 - e) * 0.1)
    g.rotation.set(s.rx, s.ry, 0)
    g.scale.setScalar(0.92 + 0.08 * e)
  })
  const handlers = {
    onPointerOver: () => void (m.current.hover = true),
    onPointerOut: () => void ((m.current.hover = false), (m.current.tx = 0), (m.current.ty = 0)),
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const g = ref.current
      if (!g) return
      const p = g.worldToLocal(e.point.clone())
      m.current.tx = -(p.y / ((h * PX) / 2)) * 0.06 * amp
      m.current.ty = (p.x / ((w * PX) / 2)) * 0.08 * amp
    },
  }
  return { ref, handlers }
}

/** Install, Build, Test, Deploy stages joined by a progress line. Press Deploy: each stage spins then ticks green,
 * a log line streams underneath, and a burst of sparks marks the release. value = current stage, onPress on finish. */
export default function DeployPipeline({ value, onChange, onPress, project = "spatial-web", branch = "main", accent = "#7C9CFF", speed = 1.2 }: Props) {
  const [local, setLocal] = useState(-1)
  const [running, setRunning] = useState(false)
  const stage = running ? local : value ?? local
  const { ref, handlers } = usePanelMotion(W, H, 0.5)
  const fillRef = useRef<VanillaContainer>(null)
  const spinRef = useRef<VanillaContainer>(null)
  const fill = useRef(0)
  const burst = useRef(-1)
  const stageRef = useRef(stage)
  stageRef.current = stage

  useEffect(() => {
    if (!running) return
    if (local >= STAGES.length) {
      setRunning(false)
      burst.current = 0
      onPress?.()
      return
    }
    const id = setTimeout(() => {
      const n = local + 1
      setLocal(n)
      onChange?.(n)
    }, speed * 1000 * (local < 0 ? 0.2 : 1))
    return () => clearTimeout(id)
  }, [running, local, speed]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    if (running) return
    setLocal(-1)
    onChange?.(-1)
    setRunning(true)
  }

  useFrame(({ clock }, dt) => {
    const s = stageRef.current
    // the line fills to the running stage and creeps toward the next one
    const target = s < 0 ? 0 : Math.min(1, (s + (s < STAGES.length ? 0.5 : 0)) / (STAGES.length - 1))
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 5)
    const next = fill.current + (target - fill.current) * k
    if (Math.abs(next - fill.current) > 1e-4) {
      fill.current = next
      fillRef.current?.setProperties({ width: `${next * 100}%` })
    }
    spinRef.current?.setProperties({ transformRotateZ: -clock.elapsedTime * 360 })
  })

  const done = stage >= STAGES.length
  const log = stage < 0 ? `Ready to deploy ${project}@${branch}` : done ? `Deployed to https://${project}.spatial.app in 4.8s` : STAGES[stage].log

  return (
    <group ref={ref} {...handlers}>
      <Slab w={W} h={H} />
      <Burst trigger={burst} accent={accent} />
      <Container pixelSize={PX} width={W} height={H} flexDirection="column" borderRadius={18} padding={22} gap={14} backgroundColor="#0D0F14" borderWidth={1.5} borderColor={done ? withOpacity(MINT, 0.6) : "#2A2F3B"}>
        <Container flexDirection="row" alignItems="center" gap={10}>
          <Text fontSize={16} fontWeight="semi-bold" color="#EEF0F5">Production deploy</Text>
          <Container flexDirection="row" alignItems="center" gap={5} paddingX={8} paddingY={3} borderRadius={999} backgroundColor="#1A1D26">
            <GitBranch width={11} height={11} color="#8A90A0" />
            <Text fontSize={11} color="#C9CDD8">{branch}</Text>
          </Container>
          <Container flexGrow={1} />
          <Container
            height={34}
            paddingX={16}
            borderRadius={10}
            flexDirection="row"
            alignItems="center"
            gap={7}
            backgroundColor={running ? "#1A1D26" : accent}
            hover={{ backgroundColor: running ? "#1A1D26" : "#93ADFF", transformTranslateY: running ? 0 : -1 }}
            active={{ transformScale: 0.96 }}
            cursor="pointer"
            onClick={start}
          >
            <Rocket width={14} height={14} color={running ? "#8A90A0" : "#0B0C10"} />
            <Text fontSize={13} fontWeight="semi-bold" color={running ? "#8A90A0" : "#0B0C10"}>{running ? "Deploying" : done ? "Redeploy" : "Deploy"}</Text>
          </Container>
        </Container>

        <Container flexGrow={1} alignItems="center" justifyContent="center">
          <Container width={COL * STAGES.length} flexDirection="row">
            <Container positionType="absolute" positionTop={21} positionLeft={COL / 2} width={COL * (STAGES.length - 1)} height={2} borderRadius={1} backgroundColor="#232733">
              <Container ref={fillRef} height={2} width="0%" borderRadius={1} backgroundColor={done ? MINT : accent} />
            </Container>
            {STAGES.map(({ name, Icon }, i) => {
              const state = stage > i ? "done" : stage === i ? "run" : "idle"
              return (
                <Container key={name} width={COL} flexDirection="column" alignItems="center" gap={8}>
                  <Container
                    width={44}
                    height={44}
                    borderRadius={22}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor={state === "done" ? withOpacity(MINT, 0.16) : state === "run" ? withOpacity(accent, 0.18) : "#14171F"}
                    borderWidth={1.5}
                    borderColor={state === "done" ? MINT : state === "run" ? accent : "#2A2F3B"}
                  >
                    {state === "done" ? (
                      <Check width={18} height={18} color={MINT} />
                    ) : state === "run" ? (
                      <Container ref={spinRef} width={18} height={18}>
                        <LoaderCircle width={18} height={18} color={accent} />
                      </Container>
                    ) : (
                      <Icon width={17} height={17} color="#6B7182" />
                    )}
                  </Container>
                  <Text fontSize={13} fontWeight="medium" color={state === "idle" ? "#7A8091" : "#E8EAF0"}>{name}</Text>
                  <Text fontSize={11} color={state === "done" ? MINT : state === "run" ? accent : "#454B5A"}>
                    {state === "done" ? `${(1.1 + i * 0.4).toFixed(1)}s` : state === "run" ? "running" : "queued"}
                  </Text>
                </Container>
              )
            })}
          </Container>
        </Container>

        <Container height={32} flexDirection="row" alignItems="center" gap={8} paddingX={12} borderRadius={9} backgroundColor="#08090D" borderWidth={1} borderColor="#1C2029">
          <Text fontSize={12} color={done ? MINT : accent}>{">"}</Text>
          <Text fontSize={12} color="#B8BDC9">{log}</Text>
        </Container>
      </Container>
    </group>
  )
}

const N = 40
/** Instanced sparks that fly off the panel when the deploy lands. */
function Burst({ trigger, accent }: { trigger: { current: number }; accent: string }) {
  const mesh = useRef<InstancedMesh>(null)
  const dirs = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2 + Math.random() * 0.3
        const sp = 0.35 + Math.random() * 0.45
        return [Math.cos(a) * sp, Math.sin(a) * sp * 0.6 + 0.15, 0.1 + Math.random() * 0.35, Math.random() * 6]
      }),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const a = new Color(accent)
    const b = new Color(MINT)
    for (let i = 0; i < N; i++) m.setColorAt(i, i % 2 ? a : b)
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [accent])
  useFrame((_, dt) => {
    const m = mesh.current
    if (!m || trigger.current < 0) return
    trigger.current += Math.min(dt, 0.05)
    const t = trigger.current
    const live = t < 1.4
    m.visible = live
    if (!live) return void (trigger.current = -1)
    const s = Math.max(0, 1 - t / 1.4) * 0.014
    for (let i = 0; i < N; i++) {
      const [dx, dy, dz, spin] = dirs[i]
      dummy.position.set(dx * t, dy * t - 0.35 * t * t, 0.02 + dz * t)
      dummy.rotation.set(spin + t * 6, spin + t * 4, 0)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} visible={false} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
