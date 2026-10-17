"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Shape, ShapeGeometry, type MeshBasicMaterial } from "three"
import { Container, Text, withOpacity, type VanillaContainer } from "@react-three/uikit"
import { Info, MessageSquare, TriangleAlert } from "@react-three/uikit-lucide"

const PX = 0.002 // metres per uikit pixel

type Props = {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** "danger" paints the confirm button warm for destructive actions. */
  tone?: "danger" | "default"
  accent?: string
  /** Width in metres. */
  width?: number
  /** Controlled visibility. Omit and either button hides the dialog, leaving a "Show dialog" chip. */
  open?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}

/** Confirm / cancel dialog that springs in with a halo behind it. */
export default function Dialog({
  title = "Delete track?",
  message = "“Drums 2” and its 12 clips will be removed. You can't undo this.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  accent = "#9FE7D2",
  width = 0.44,
  open,
  onConfirm,
  onCancel,
}: Props) {
  const [inner, setInner] = useState(true)
  const [hover, setHover] = useState(false)
  const panel = useRef<VanillaContainer>(null)
  const size = useMeasured(panel)
  const shown = open ?? inner
  const p = useSpring(shown ? 1 : 0, 0)
  const main = tone === "danger" ? "#F2B48A" : accent
  const tint = useMemo(() => withOpacity(main, 0.16), [main])
  const ghost = useMemo(() => withOpacity("#EEF0F4", 0.06), [])

  const finish = (fn?: () => void) => () => {
    if (open === undefined) setInner(false)
    setHover(false) // no pointerout arrives once it unmounts
    fn?.()
  }

  return (
    <group>
      {p > 0.01 && (
        <group scale={0.88 + 0.12 * p} position={[0, 0, (1 - p) * -0.04]}>
          {size && <Halo width={size[0] * PX + 0.02} height={size[1] * PX + 0.02} color={main} strength={(hover ? 0.2 : 0.08) * Math.min(1, p)} />}
          <Container
            ref={panel}
            pixelSize={PX}
            width={width / PX}
            opacity={Math.min(1, Math.max(0, p))}
            flexDirection="column"
            gap={14}
            padding={22}
            borderRadius={20}
            backgroundColor="#15171E"
            borderWidth={1.5}
            borderColor="#323745"
            borderBend={0.4}
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
          >
            <Container flexDirection="row" alignItems="center" gap={12}>
              <Container width={36} height={36} flexShrink={0} borderRadius={12} backgroundColor={tint} alignItems="center" justifyContent="center" color={main}>
                {tone === "danger" ? <TriangleAlert width={18} height={18} /> : <Info width={18} height={18} />}
              </Container>
              <Text fontSize={17} fontWeight="semi-bold" color="#EEF0F4">
                {title}
              </Text>
            </Container>
            <Text fontSize={13} color="#9AA0AD" lineHeight="150%">
              {message}
            </Text>
            <Container flexDirection="row" justifyContent="flex-end" gap={10} marginTop={4}>
              <Button label={cancelLabel} bg="#1B1E26" fg="#EEF0F4" border="#323745" hoverBg={ghost} onClick={finish(onCancel)} />
              <Button label={confirmLabel} bg={main} fg={tone === "danger" ? "#2A1406" : "#06221B"} border={main} onClick={finish(onConfirm)} />
            </Container>
          </Container>
        </group>
      )}
      {!shown && open === undefined && p < 0.3 && (
        <Container
          pixelSize={PX}
          flexDirection="row"
          alignItems="center"
          gap={8}
          height={36}
          paddingX={14}
          borderRadius={12}
          backgroundColor="#15171E"
          borderWidth={1.5}
          borderColor="#323745"
          color="#9AA0AD"
          hover={{ borderColor: main, color: "#EEF0F4" }}
          onClick={() => setInner(true)}
        >
          <MessageSquare width={16} height={16} />
          <Text fontSize={13}>Show dialog</Text>
        </Container>
      )}
    </group>
  )
}

function Button({ label, bg, fg, border, hoverBg, onClick }: { label: string; bg: string; fg: string; border: string; hoverBg?: ReturnType<typeof withOpacity>; onClick: () => void }) {
  return (
    <Container
      height={38}
      paddingX={18}
      borderRadius={11}
      alignItems="center"
      justifyContent="center"
      backgroundColor={bg}
      borderWidth={1.5}
      borderColor={border}
      hover={{ transformTranslateZ: 3, ...(hoverBg ? { backgroundColor: hoverBg } : {}) }}
      active={{ transformTranslateZ: 0, transformScaleX: 0.96, transformScaleY: 0.96 }}
      onClick={onClick}
    >
      <Text fontSize={13} fontWeight="semi-bold" color={fg}>
        {label}
      </Text>
    </Container>
  )
}

/** Layout size (uikit px) of an auto-sized panel; uikit lays out async, so poll until it settles. */
function useMeasured(ref: React.RefObject<VanillaContainer | null>) {
  const [size, setSize] = useState<[number, number] | null>(null)
  useFrame(() => {
    const s = ref.current?.size.value
    if (s && (!size || Math.abs(s[0] - size[0]) > 0.5 || Math.abs(s[1] - size[1]) > 0.5)) setSize([s[0], s[1]])
  })
  return size
}

/** Rounded plate 1 cm behind the panel: depth in the headset, glow on hover. Ignores rays. */
function Halo({ width, height, color, strength }: { width: number; height: number; color: string; strength: number }) {
  const geometry = useMemo(() => roundedRect(width, height, 0.045), [width, height])
  const mat = useRef<MeshBasicMaterial>(null)
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((state, dt) => {
    const m = mat.current
    if (!m || Math.abs(m.opacity - strength) < 0.002) return
    m.opacity += (strength - m.opacity) * Math.min(1, dt * 10)
    state.invalidate()
  })
  return (
    <mesh geometry={geometry} position={[0, 0, -0.01]} raycast={() => null}>
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function roundedRect(w: number, h: number, r: number) {
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
  return new ShapeGeometry(s, 8)
}

/** Damped spring toward `target` (slight overshoot); re-renders only while it moves. */
function useSpring(target: number, from = target) {
  const s = useRef({ x: from, v: 0 })
  const [, tick] = useState(0)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => invalidate(), [target, invalidate])
  useFrame((state, dt) => {
    const k = s.current
    if (k.x === target && k.v === 0) return
    const d = Math.min(dt, 1 / 30)
    k.v += ((target - k.x) * 170 - k.v * 18) * d
    k.x += k.v * d
    if (Math.abs(target - k.x) < 1e-3 && Math.abs(k.v) < 1e-2) {
      k.x = target
      k.v = 0
    }
    tick((t) => t + 1)
    state.invalidate()
  })
  return s.current.x
}
