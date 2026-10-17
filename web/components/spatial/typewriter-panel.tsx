"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import { Container, Text, withOpacity, type VanillaContainer } from "@react-three/uikit"

type Props = {
  /** Text that types itself out */
  text?: string
  /** Header label */
  title?: string
  /** Caret, dot, border and progress colour */
  primaryColor?: string
  /** Second glow colour */
  secondaryColor?: string
  /** 1 ≈ 26 characters per second */
  speed?: number
  paused?: boolean
  /** Erase and retype after a pause */
  loop?: boolean
  /** Background glow strength */
  intensity?: number
  /** Tap: restarts the typing, then calls this */
  onPress?: () => void
}

const FS = 19
type Clock = { lastKey: number; now: number }

/** Glass panel that types its text with a blinking caret, pauses on punctuation, then erases and loops. The layout never jumps: untyped words hold their space. */
export default function TypewriterPanel({
  text = "Hey, I'm Nova. Drop a knob next to the drum pads and I'll wire it to the tempo for you.",
  title = "Assistant",
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  speed = 1,
  paused = false,
  loop = true,
  intensity = 1,
  onPress,
}: Props) {
  const still = useThree((s) => s.frameloop) !== "always" // static previews show the full text
  const chars = useMemo(() => Array.from(text), [text])
  const words = useMemo(() => splitWords(chars), [chars])
  const total = chars.length
  const [count, setCount] = useState(still || paused ? total : 0)
  const st = useRef({ count: still || paused ? total : 0, acc: 0, phase: "typing" as "typing" | "hold" | "erase", hold: 0 })
  const clock = useRef<Clock>({ lastKey: -1, now: 0 })

  useEffect(() => {
    // new text: start over
    st.current = { count: still || paused ? chars.length : 0, acc: 0, phase: "typing", hold: 0 }
    setCount(st.current.count)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chars])

  const glow = useMemo(
    () => ({ uTime: { value: 0 }, uAlpha: { value: 0.5 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() } }),
    [],
  )
  useEffect(() => {
    glow.uA.value.set(primaryColor).convertLinearToSRGB()
    glow.uB.value.set(secondaryColor).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, glow])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    clock.current.now += dt
    glow.uAlpha.value = 0.45 * intensity
    if (paused || still) return
    glow.uTime.value += dt * speed
    const s = st.current
    const step = dt * speed
    if (s.phase === "typing") {
      s.acc += step
      while (s.count < total) {
        const prev = chars[s.count - 1] ?? ""
        const need = /[,.;:!?]/.test(prev) ? 0.3 : 0.038
        if (s.acc < need) break
        s.acc -= need
        s.count++
        clock.current.lastKey = clock.current.now
      }
      if (s.count >= total) {
        s.phase = "hold"
        s.hold = 0
      }
    } else if (s.phase === "hold") {
      s.hold += step
      if (loop && s.hold > 3.2) {
        s.phase = "erase"
        s.acc = 0
      }
    } else {
      s.acc += step
      while (s.count > 0 && s.acc > 0.012) {
        s.acc -= 0.012
        s.count--
      }
      clock.current.lastKey = clock.current.now
      if (s.count === 0) {
        s.phase = "typing"
        s.acc = -0.6 // short breath before retyping
      }
    }
    if (s.count !== count) setCount(s.count)
  })

  // the caret sits in the last word that has started
  let caretWord = 0
  for (let j = 0; j < words.length; j++) if (words[j].start <= count) caretWord = j
  const pct = total ? Math.round((count / total) * 100) : 100

  return (
    <group>
      <mesh position={[0, 0, -0.03]} renderOrder={-1}>
        <planeGeometry args={[1.0, 0.7]} />
        <shaderMaterial uniforms={glow} vertexShader={GLOW_VERT} fragmentShader={GLOW_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Container
        pixelSize={0.0015}
        width={400}
        padding={22}
        gap={14}
        flexDirection="column"
        borderRadius={22}
        backgroundColor={withOpacity("#0B0C10", 0.84)}
        borderWidth={1.5}
        borderColor={withOpacity(primaryColor, 0.35)}
        onClick={() => {
          st.current = { count: 0, acc: -0.2, phase: "typing", hold: 0 }
          setCount(0)
          onPress?.()
        }}
      >
        <Container flexDirection="row" justifyContent="space-between" alignItems="center">
          <Container flexDirection="row" alignItems="center" gap={8}>
            <Container width={9} height={9} borderRadius={4.5} backgroundColor={primaryColor} />
            <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4">
              {title}
            </Text>
          </Container>
          <Text fontSize={12} color="#6B7180">
            {count < total ? "typing..." : "ready"}
          </Text>
        </Container>
        <Container flexDirection="row" flexWrap="wrap" gapColumn={FS * 0.3} gapRow={FS * 0.35}>
          {words.map((w, j) => (
            <Word
              key={j}
              word={w.text}
              typed={Math.max(0, Math.min(w.text.length, count - w.start))}
              caret={j === caretWord}
              color="#EEF0F4"
              caretColor={primaryColor}
              clock={clock}
            />
          ))}
        </Container>
        <Container height={3} borderRadius={1.5} backgroundColor={withOpacity("#ffffff", 0.08)}>
          <Container width={`${pct}%`} height={3} borderRadius={1.5} backgroundColor={primaryColor} />
        </Container>
      </Container>
    </group>
  )
}

function splitWords(chars: string[]) {
  const words: { text: string[]; start: number }[] = []
  let cur: string[] = []
  let start = 0
  chars.forEach((c, i) => {
    if (c === " " || c === "\n") {
      if (cur.length) words.push({ text: cur, start })
      cur = []
      start = i + 1
    } else cur.push(c)
  })
  if (cur.length) words.push({ text: cur, start })
  return words
}

const Word = memo(function Word({
  word,
  typed,
  caret,
  color,
  caretColor,
  clock,
}: {
  word: string[]
  typed: number
  caret: boolean
  color: string
  caretColor: string
  clock: React.RefObject<Clock>
}) {
  return (
    <Container flexDirection="row" alignItems="center">
      {typed > 0 && (
        <Text fontSize={FS} color={color}>
          {word.slice(0, typed).join("")}
        </Text>
      )}
      {caret && <Caret color={caretColor} clock={clock} />}
      {typed < word.length && (
        <Text fontSize={FS} color={color} opacity={0}>
          {word.slice(typed).join("")}
        </Text>
      )}
    </Container>
  )
})

/** Zero-width slot so the caret never pushes text around. Solid while typing, blinks when idle. */
function Caret({ color, clock }: { color: string; clock: React.RefObject<Clock> }) {
  const bar = useRef<VanillaContainer>(null)
  useFrame(() => {
    const c = clock.current
    const typing = c.now - c.lastKey < 0.45
    bar.current?.setProperties({ opacity: typing || Math.sin(c.now * 7) > 0 ? 1 : 0 })
  })
  return (
    <Container width={0} height={FS * 1.2}>
      <Container ref={bar} positionType="absolute" positionLeft={1} positionTop={0} width={3} height={FS * 1.2} borderRadius={1.5} backgroundColor={color} />
    </Container>
  )
}

const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const GLOW_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  vec2 c1 = vec2(sin(uTime * 0.5) * 0.18, cos(uTime * 0.4) * 0.1);
  vec2 c2 = vec2(cos(uTime * 0.37) * 0.2, sin(uTime * 0.6) * 0.12);
  float a1 = exp(-dot(p - c1, p - c1) * 16.0);
  float a2 = exp(-dot(p - c2, p - c2) * 16.0);
  vec3 col = (uA * a1 + uB * a2) / max(a1 + a2, 0.001);
  float a = (a1 + a2) * uAlpha * smoothstep(0.5, 0.3, max(abs(p.x), abs(p.y)));
  gl_FragColor = vec4(col, a);
}
`
