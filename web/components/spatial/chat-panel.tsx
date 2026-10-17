"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Input, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Phone, Send, Video } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B", avatar: "#B9B4F5" }

type Message = { id: string; from: "me" | "them"; text: string; time?: string }
type Props = {
  messages?: Message[]
  onSend?: (text: string) => void
  title?: string
  status?: string
  placeholder?: string
  /** one-tap replies, handy in a headset where typing is slow */
  quickReplies?: string[]
  accent?: string
}

const SAMPLE: Message[] = [
  { id: "m1", from: "them", text: "Hey! Did the Quest build go through?", time: "2:41 PM" },
  { id: "m2", from: "me", text: "Yes, the studio loads in about 3 seconds now" },
  { id: "m3", from: "them", text: "Amazing. Can you drop the mixer next to the drum pads?" },
  { id: "m4", from: "me", text: "Done. Pinch the grab bar to move it.", time: "2:44 PM" },
  { id: "m5", from: "them", text: "Works perfectly with hands" },
]

const now = () => {
  const d = new Date()
  const h = d.getHours()
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

/** Chat panel: header with call buttons, message bubbles, quick replies and a message field with send. */
export default function ChatPanel({
  messages,
  onSend,
  title = "Maya Chen",
  status = "Online",
  placeholder,
  quickReplies = ["Sounds good", "On it", "Call me?"],
  accent = C.accent,
}: Props) {
  const [sent, setSent] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const list = [...(messages ?? SAMPLE), ...sent].slice(-5) // shortcut: shows the latest 5, swap for a scroll view if you need history
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const send = (text: string) => {
    const t = text.trim()
    if (!t) return
    setSent((s) => [...s, { id: `local-${Date.now()}`, from: "me", text: t, time: now() }])
    setDraft("")
    onSend?.(t)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={330}
      flexDirection="column"
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
      overflow="hidden"
    >
      <Container height={60} flexDirection="row" alignItems="center" gap={10} paddingX={14} borderBottomWidth={1} borderColor={C.line}>
        <Container width={36} height={36} borderRadius={18} backgroundColor={C.avatar} alignItems="center" justifyContent="center">
          <Text fontSize={13} fontWeight="bold" color="#0B0C10">
            {title
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </Text>
          <Container positionType="absolute" positionRight={-1} positionBottom={-1} width={11} height={11} borderRadius={6} borderWidth={2} borderColor={C.panel} backgroundColor={accent} />
        </Container>
        <Container flexDirection="column" flexGrow={1}>
          <Text fontSize={14} fontWeight="semi-bold" color={C.text}>
            {title}
          </Text>
          <Text fontSize={11} color={C.muted}>
            {status}
          </Text>
        </Container>
        <Press width={36} height={36} borderRadius={10} alignItems="center" justifyContent="center" backgroundColor={C.row} hover={{ backgroundColor: C.hover }}>
          <Phone width={16} height={16} color={C.text} />
        </Press>
        <Press width={36} height={36} borderRadius={10} alignItems="center" justifyContent="center" backgroundColor={C.row} hover={{ backgroundColor: C.hover }}>
          <Video width={16} height={16} color={C.text} />
        </Press>
      </Container>

      <Container flexDirection="column" gap={6} padding={14} minHeight={240} justifyContent="flex-end">
        {list.map((m) => (
          <Bubble key={m.id} m={m} accent={accent} />
        ))}
      </Container>

      <Container flexDirection="row" gap={6} paddingX={14} paddingBottom={10}>
        {quickReplies.map((r) => (
          <Press key={r} height={30} paddingX={10} borderRadius={8} alignItems="center" borderWidth={1} borderColor={C.border} hover={{ backgroundColor: C.hover }} onClick={() => send(r)}>
            <Text fontSize={11} fontWeight="medium" color={C.text}>
              {r}
            </Text>
          </Press>
        ))}
      </Container>

      <Container flexDirection="row" alignItems="center" gap={8} padding={10} backgroundColor={C.deep} borderTopWidth={1} borderColor={C.line}>
        <Container flexGrow={1} height={44} paddingX={14} borderRadius={12} backgroundColor={C.row} alignItems="center">
          <Input
            width="100%"
            fontSize={13}
            color={C.text}
            value={draft}
            placeholder={placeholder ?? `Message ${title.split(" ")[0]}...`}
            placeholderStyle={{ color: C.faint }}
            onValueChange={setDraft}
          />
        </Container>
        <Press width={44} height={44} borderRadius={12} alignItems="center" justifyContent="center" backgroundColor={accent} opacity={draft.trim() ? 1 : 0.55} onClick={() => send(draft)}>
          <Send width={18} height={18} color={C.onAccent} />
        </Press>
      </Container>
    </Container>
  )
}

function Bubble({ m, accent }: { m: Message; accent: string }) {
  const me = m.from === "me"
  // new bubbles rise in from below
  const [ref, s] = useSpring({ transformTranslateY: 0, transformScaleX: 1, transformScaleY: 1 }, { transformTranslateY: 14, transformScaleX: 0.9, transformScaleY: 0.9 })
  return (
    <Container ref={ref} {...s} flexDirection="column" alignItems={me ? "flex-end" : "flex-start"} gap={3} transformOriginX={me ? "right" : "left"}>
      <Container
        maxWidth={230}
        paddingX={12}
        paddingY={9}
        borderRadius={16}
        borderBottomRightRadius={me ? 4 : 16}
        borderBottomLeftRadius={me ? 16 : 4}
        backgroundColor={me ? accent : withOpacity("#FFFFFF", 0.07)}
      >
        <Text fontSize={13} color={me ? C.onAccent : C.text}>
          {m.text}
        </Text>
      </Container>
      {m.time ? (
        <Text fontSize={10} color={C.faint} paddingX={4}>
          {m.time}
        </Text>
      ) : null}
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.94 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? 3 : 0, transformScaleX: k, transformScaleY: k })
  return (
    <Container ref={ref} cursor="pointer" {...props} {...s} onHoverChange={setHover} onActiveChange={setDown}>
      {children}
    </Container>
  )
}

/** uikit has no CSS transitions: spring numeric props toward `to` each frame. Spread the returned values on the Container too. */
function useSpring<T extends Record<string, number>>(to: T, from: Partial<T> = {}) {
  const ref = useRef<VanillaContainer>(null)
  const s = useRef<{ x: Record<string, number>; v: Record<string, number> }>(null)
  if (!s.current) s.current = { x: { ...to, ...from }, v: {} }
  useFrame((_, dt) => {
    const { x, v } = s.current!
    const h = Math.min(dt, 1 / 30)
    let moved = false
    for (const k in to) {
      if (x[k] === to[k] && !v[k]) continue
      v[k] = (v[k] ?? 0) + ((to[k] - x[k]) * 320 - (v[k] ?? 0) * 24) * h
      x[k] += v[k] * h
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) (x[k] = to[k]), (v[k] = 0)
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
