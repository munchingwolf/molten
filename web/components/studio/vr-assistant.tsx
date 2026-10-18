"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { IfInSessionMode } from "@react-three/xr"
import { Container, Text, type VanillaContainer } from "@react-three/uikit"
import { Vector3, type Camera, type Group } from "three"
import { useAssistant, type Message } from "@/lib/assistant-store"
import type { Viewer } from "@/lib/assist-ops"
import { viewerCamera } from "@/lib/viewer"
import type { Vec3 } from "@/lib/layout"
import { xr } from "./xr-theme"

const PX = 0.002
// 220 × 280 px = 44 × 56 cm. Smaller can't hold 14 px text plus three 44 px control rows at this pixel size.
const W = 220
const H = 280
/** Mascot slot in panel space: just above the panel's top-left corner. Render it via `<VRAssistant mascot={…} />`. */
export const MASCOT_OFFSET: Vec3 = [(-W / 2) * PX + 0.05, (H / 2) * PX + 0.06, 0]

const SIDE = (35 * Math.PI) / 180 // right of gaze, mirroring the shelf on the left
const DIST = 0.7 // m from the head: within reach for a poke, readable at 14 px
const DROP = 0.15 // m below eye height
// Lazy follow: you can turn to look at the panel; it only slides back once it leaves this cone around your gaze.
const MAX_RIGHT = (70 * Math.PI) / 180
const MAX_LEFT = (-25 * Math.PI) / 180
const FAIL = "#F87171" // xr-theme has no error colour yet
const STATUS = { idle: "Hold to talk", listening: "Listening... let go to send", thinking: "Thinking..." } as const

const UP = new Vector3(0, 1, 0)
const head = new Vector3()
const gaze = new Vector3()
const rel = new Vector3()
const vHead = new Vector3()
const vDir = new Vector3()

/** uikit's bundled font is ASCII-only (plus °): swap the typographic characters our messages use. */
const ascii = (s: string) =>
  s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/×/g, "x").replace(/→/g, "->").replace(/…/g, "...").replace(/[—–]/g, "-").replace(/[^\x20-\x7e°]/g, "")

/** Head pose for applyOps. You're looking at this panel when you use it, so aim back to straight ahead: new items land in front of you, not on the panel. */
function viewerFrom(camera: Camera): Viewer {
  camera.getWorldPosition(vHead)
  camera.getWorldDirection(vDir).applyAxisAngle(UP, SIDE)
  return { position: vHead.toArray() as Vec3, direction: vDir.toArray() as Vec3 }
}

function Line({ m }: { m: Message }) {
  if (m.role === "user") return <Text fontSize={14} color={xr.text} flexShrink={0}>{`> ${ascii(m.text)}`}</Text>
  return (
    <Container flexDirection="column" gap={4} flexShrink={0}>
      {m.ops?.map((o, k) => (
        <Container key={k} flexDirection="row" alignItems="center" gap={6}>
          <Container width={8} height={8} borderRadius={4} flexShrink={0} backgroundColor={o.ok ? xr.accent : FAIL} />
          <Text fontSize={14} color={xr.muted} flexShrink={1}>{ascii(o.label)}</Text>
          <Text fontSize={14} color={o.ok ? xr.accent : FAIL} flexShrink={0}>{o.ok ? "ok" : "fail"}</Text>
        </Container>
      ))}
      <Text fontSize={14} color={xr.muted}>{ascii(m.text)}</Text>
    </Container>
  )
}

function Chip({ label, onClick, grow = true }: { label: string; onClick: () => void; grow?: boolean }) {
  return (
    <Container
      height={xr.hit}
      flexGrow={grow ? 1 : 0}
      flexBasis={grow ? 0 : undefined}
      paddingX={8}
      alignItems="center"
      justifyContent="center"
      borderRadius={xr.radius.md}
      backgroundColor={xr.row}
      hover={{ backgroundColor: xr.rowHover }}
      active={{ backgroundColor: xr.rowActive }}
      onClick={onClick}
    >
      <Text fontSize={14} color={xr.text}>{label}</Text>
    </Container>
  )
}

function Panel({ mascot }: { mascot?: ReactNode }) {
  const camera = useThree((s) => s.camera)
  const messages = useAssistant((s) => s.messages)
  const status = useAssistant((s) => s.status)
  const group = useRef<Group>(null)
  const list = useRef<VanillaContainer>(null)
  const placed = useRef(false)
  const following = useRef(true)
  const holder = useRef<number | null>(null) // pointer holding push-to-talk
  const stick = useRef(0) // frames left to pin the log to its newest line (layout settles a few frames later)

  useEffect(() => {
    stick.current = 20
  }, [messages, status])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    camera.getWorldPosition(head)
    camera.getWorldDirection(gaze)
    gaze.y = 0
    if (gaze.lengthSq() < 1e-6) return // looking straight up or down: hold still
    gaze.normalize()

    // Panel position around the head, in polar form, and its angle from gaze (right = +).
    rel.subVectors(g.position, head)
    const yawNow = Math.atan2(rel.x, rel.z)
    const rNow = Math.hypot(rel.x, rel.z)
    const angle = Math.atan2(-gaze.z * rel.x + gaze.x * rel.z, gaze.x * rel.x + gaze.z * rel.z)
    const yawGoal = Math.atan2(gaze.x, gaze.z) - SIDE
    const yGoal = head.y - DROP

    if (!placed.current) {
      g.position.set(head.x + Math.sin(yawGoal) * DIST, yGoal, head.z + Math.cos(yawGoal) * DIST)
      placed.current = true
      following.current = false
    } else {
      if (angle > MAX_RIGHT || angle < MAX_LEFT || Math.abs(rNow - DIST) > 0.35 || Math.abs(g.position.y - yGoal) > 0.3) following.current = true
      if (following.current) {
        // Slide around the head (not through it) toward 35° right of gaze.
        const dYaw = Math.atan2(Math.sin(yawGoal - yawNow), Math.cos(yawGoal - yawNow))
        const k = 1 - Math.exp(-dt * 5)
        const yaw = yawNow + dYaw * k
        const r = rNow + (DIST - rNow) * k
        g.position.set(head.x + Math.sin(yaw) * r, g.position.y + (yGoal - g.position.y) * k, head.z + Math.cos(yaw) * r)
        if (Math.abs(dYaw) < 0.02 && Math.abs(DIST - r) < 0.02) following.current = false
      }
    }
    g.rotation.set(0, Math.atan2(head.x - g.position.x, head.z - g.position.z), 0) // face the user

    const l = list.current
    if (l && stick.current > 0) {
      stick.current--
      l.scrollPosition.value = [0, l.maxScrollPosition.value[1] ?? 0]
    }
  })

  const { send, startTalking, stopTalking } = useAssistant.getState()
  const talk = (text: string) => void send(text, viewerFrom(camera))
  // Only the pointer that pressed can end the hold: another hand's ray passing over the button mustn't cut it off.
  const release = (pointerId: number) => {
    if (holder.current !== pointerId) return
    holder.current = null
    stopTalking(viewerFrom(camera))
  }
  const live = status === "listening"
  const start = messages.length - 6

  return (
    <group ref={group}>
      <group name="mascotAnchor" position={MASCOT_OFFSET}>
        {mascot}
      </group>
      <Container
        pixelSize={PX}
        anchorX="center"
        anchorY="center"
        width={W}
        height={H}
        padding={8}
        gap={8}
        flexDirection="column"
        backgroundColor={xr.panel}
        borderRadius={xr.radius.lg}
        borderWidth={1.5}
        borderColor={xr.border}
      >
        <Container flexDirection="row" alignItems="center" justifyContent="space-between" gap={8} flexShrink={0}>
          <Container flexDirection="row" alignItems="center" gap={6} paddingLeft={4}>
            <Container width={10} height={10} borderRadius={5} backgroundColor={status === "idle" ? xr.faint : xr.accent} />
            <Text fontSize={14} color={xr.muted}>{status === "idle" ? "Stark" : status}</Text>
          </Container>
          <Chip label="What can I do?" grow={false} onClick={() => talk("What can I do?")} />
        </Container>

        <Container
          ref={list}
          flexGrow={1}
          flexShrink={1}
          flexBasis={0}
          overflow="scroll"
          flexDirection="column"
          gap={8}
          padding={8}
          backgroundColor={xr.bg}
          borderRadius={xr.radius.md}
          scrollbarWidth={4}
          scrollbarColor={xr.faint}
        >
          {messages.slice(-6).map((m, i) => (
            <Line key={start + i} m={m} />
          ))}
          {status === "thinking" && <Text fontSize={14} color={xr.faint} flexShrink={0}>thinking...</Text>}
        </Container>

        <Container flexDirection="row" gap={6} flexShrink={0}>
          <Chip label="Undo" onClick={() => talk("undo")} />
          <Chip label="Bigger" onClick={() => talk("make it bigger")} />
          <Chip label="Smaller" onClick={() => talk("make it smaller")} />
        </Container>

        {/* Push-to-talk: poke and hold, or point and hold a pinch/trigger. Capture keeps the release even if the ray drifts. */}
        <Container
          height={56}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
          borderRadius={xr.radius.md}
          backgroundColor={live ? xr.accent : xr.row}
          hover={{ backgroundColor: live ? xr.accent : xr.rowHover }}
          onPointerDown={(e) => {
            if (holder.current !== null) return
            holder.current = e.pointerId
            e.target.setPointerCapture(e.pointerId)
            void startTalking()
          }}
          onPointerUp={(e) => release(e.pointerId)}
          onPointerLeave={(e) => release(e.pointerId)}
        >
          <Text fontSize={16} fontWeight="bold" color={live ? xr.onAccent : xr.text}>{STATUS[status]}</Text>
        </Container>
      </Container>
    </group>
  )
}

/** In-headset Assistant: conversation + op log, push-to-talk and quick chips. Mount inside <XR>; shows only in a session. */
export function VRAssistant({ mascot }: { mascot?: ReactNode }) {
  // Also publishes the camera (laptop or headset) so typed/voice commands place things in front of the user.
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    viewerCamera.current = camera
    return () => void (viewerCamera.current === camera && (viewerCamera.current = null))
  }, [camera])
  return (
    <IfInSessionMode allow={["immersive-ar", "immersive-vr"]}>
      <Panel mascot={mascot} />
    </IfInSessionMode>
  )
}
