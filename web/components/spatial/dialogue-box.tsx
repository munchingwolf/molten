"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text } from "@react-three/uikit"
import { BoxGeometry, type Group, type Mesh, type MeshBasicMaterial } from "three"
import * as Tone from "tone"

const PX = 0.002 // metres per uikit pixel
const W = 200 // px: 40 cm panel
const H = 140
const PAD = 16
const CW = 168 // choice button width
const CH = 44 // px: 8.8 cm choice buttons for fingertips
const CGAP = 6
const GAP = 10 // panel to choices
const VOICE = ["C5", "D5", "E5", "G5"] // blip pitches, picked per character
const DEFAULT_LINES = ["Halt, traveller! The old bridge is out.", "They say a slime guards the chest past the falls.", "Will you help me find the key?"]
const DEFAULT_CHOICES = ["I'll help", "Tell me more", "Not today"]

type Props = {
  speaker?: string
  lines?: string[]
  choices?: string[]
  /** Typing speed in characters per second. */
  speed?: number
  color?: string
  /** Picked choice index, -1 for none. Omit to let the box manage it. */
  value?: number
  onChange?: (index: number) => void
  onComplete?: () => void
}

type Sfx = { blip: Tone.Synth; ui: Tone.PolySynth }

/** 40 cm RPG dialogue box: types lines out with voice blips; tap to skip or advance, then pick a choice. */
export default function DialogueBox(props: Props) {
  const lines = props.lines ?? DEFAULT_LINES
  // A new speaker or script remounts the box, so typing, line and pick all start over.
  return <Dialogue key={`${props.speaker}\n${lines.join("\n")}`} {...props} lines={lines} />
}

function Dialogue({ speaker = "Mira", lines = DEFAULT_LINES, choices = DEFAULT_CHOICES, speed = 40, color = "#9FE7D2", value, onChange, onComplete }: Props) {
  const [line, setLine] = useState(0)
  const [shown, setShown] = useState(0)
  const [inner, setInner] = useState(-1)
  const picked = value ?? inner
  const text = lines[line] ?? ""
  const typing = shown < text.length
  const last = line >= lines.length - 1
  const showChoices = !typing && last && choices.length > 0

  const body = useRef<Group>(null)
  const mark = useRef<Mesh>(null)
  const st = useRef({ s: 1, v: 0, prog: 0, shown: 0, fired: false })
  const hitGeo = useMemo(() => new BoxGeometry(CW * PX, CH * PX, 0.012), [])
  const sfx = useRef<Sfx | null>(null)
  useEffect(
    () => () => {
      hitGeo.dispose()
      sfx.current?.blip.dispose()
      sfx.current?.ui.dispose()
    },
    [hitGeo],
  )
  useEffect(() => {
    if (typing || !last || st.current.fired) return
    st.current.fired = true
    onComplete?.()
  }, [typing, last, onComplete])

  const voices = () =>
    (sfx.current ??= {
      blip: new Tone.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }, volume: -26 }).toDestination(),
      ui: new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 }, volume: -14 }).toDestination(),
    })
  const ui = (notes: string[]) => {
    void Tone.start().then(() => {
      const t = Tone.now()
      notes.forEach((n, i) => voices().ui.triggerAttackRelease(n, 0.08, t + i * 0.06))
    })
  }

  // Total height: the panel sits on top, choices stack below it; the whole stack is centred.
  const stackH = H + (choices.length ? GAP + choices.length * CH + (choices.length - 1) * CGAP : 0)
  const panelY = (stackH / 2 - H / 2) * PX
  const markX = (W / 2 - PAD - 4) * PX
  const markY = panelY + (-H / 2 + PAD + 6) * PX

  useFrame((state, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.v += (380 * (1 - s.s) - 16 * s.v) * dt
    s.s += s.v * dt
    body.current?.scale.setScalar(s.s)
    if (s.shown < text.length) {
      s.prog = Math.min(text.length, s.prog + dt * Math.max(1, speed))
      const c = Math.floor(s.prog)
      if (c > s.shown) {
        // A blip every third character, voiced by the letter; silent until audio has been unlocked by a tap.
        if (Math.floor(c / 3) > Math.floor(s.shown / 3) && text[c - 1] !== " " && Tone.getContext().state === "running")
          voices().blip.triggerAttackRelease(VOICE[text.charCodeAt(c - 1) % VOICE.length], 0.03, Tone.now())
        s.shown = c
        setShown(c)
      }
    }
    if (mark.current) {
      const t = state.clock.elapsedTime
      mark.current.position.y = markY + Math.abs(Math.sin(t * 5)) * 0.003
      ;(mark.current.material as MeshBasicMaterial).opacity = Math.sin(t * 6) > -0.4 ? 1 : 0.15
    }
  })

  const tapBox = () => {
    const s = st.current
    s.v -= 2.5 // squash
    if (typing) {
      s.prog = s.shown = text.length
      setShown(text.length)
      ui(["G5"])
    } else if (!last) {
      s.prog = s.shown = 0
      setShown(0)
      setLine(line + 1)
      ui(["E5", "A5"])
    } else void Tone.start()
  }

  const pick = (i: number) => {
    if (value === undefined) setInner(i)
    onChange?.(i)
    ui(["E5", "B5", "E6"])
  }

  return (
    <group>
      <group position={[0, panelY, 0]}>
        <group ref={body}>
          <Container
            pixelSize={PX}
            width={W}
            height={H}
            padding={PAD}
            gap={8}
            flexDirection="column"
            borderRadius={16}
            backgroundColor="#15171E"
            borderWidth={1.5}
            borderColor="#323745"
            borderBend={0.3}
            pointerEvents="none"
          >
            <Container height={22} flexShrink={0} alignSelf="flex-start" paddingX={10} borderRadius={11} backgroundColor={color} alignItems="center">
              <Text fontSize={11} fontWeight="semi-bold" color="#06221B">
                {speaker}
              </Text>
            </Container>
            <Container height={58} flexShrink={0}>
              <Text fontSize={13} lineHeight={1.35} color="#EEF0F4">{`${text.slice(0, shown)}`}</Text>
            </Container>
            <Container height={12} flexShrink={0}>
              {lines.length > 1 && <Text fontSize={9} color="#6B7180">{`${line + 1}/${lines.length}`}</Text>}
            </Container>
          </Container>
        </group>
        {/* Static hit box over the panel: the panel squashes on tap, the hit surface must not. */}
        <mesh visible={false} position={[0, 0, 0.006]} onClick={tapBox}>
          <boxGeometry args={[W * PX, H * PX, 0.012]} />
        </mesh>
      </group>
      {/* Blinking ▼: this line is done, tap to continue. */}
      <mesh ref={mark} visible={!typing && !showChoices} position={[markX, markY, 0.004]} rotation={[0, 0, -Math.PI / 2]}>
        <circleGeometry args={[0.007, 3]} />
        <meshBasicMaterial color={color} transparent toneMapped={false} />
      </mesh>
      {showChoices &&
        choices.map((label, i) => (
          <Choice
            key={i}
            i={i}
            label={label}
            on={i === picked}
            color={color}
            hitGeo={hitGeo}
            x={(W / 2 - CW / 2) * PX}
            y={(stackH / 2 - H - GAP - CH / 2 - i * (CH + CGAP)) * PX}
            onPick={() => pick(i)}
          />
        ))}
    </group>
  )
}

type ChoiceProps = { i: number; label: string; on: boolean; color: string; hitGeo: BoxGeometry; x: number; y: number; onPick: () => void }

function Choice({ i, label, on, color, hitGeo, x, y, onPick }: ChoiceProps) {
  const g = useRef<Group>(null)
  const st = useRef({ a: 0, av: 0, t: 0, s: 1, v: 0, hover: false, down: false })

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    s.t += dt
    s.av += (320 * ((s.t > i * 0.09 ? 1 : 0) - s.a) - 17 * s.av) * dt // staggered spring-in
    s.a += s.av * dt
    s.v += (420 * ((s.down ? 0.94 : s.hover ? 1.04 : 1) - s.s) - 18 * s.v) * dt
    s.s += s.v * dt
    if (g.current) {
      g.current.scale.setScalar(Math.max(0.001, s.a * s.s))
      g.current.position.y = (1 - s.a) * 0.03
    }
  })

  const release = () => {
    st.current.down = false
  }

  return (
    <group position={[x, y, 0]}>
      <group ref={g} scale={0.001}>
        <Container
          pixelSize={PX}
          width={CW}
          height={CH}
          paddingX={14}
          gap={10}
          flexDirection="row"
          alignItems="center"
          borderRadius={12}
          backgroundColor={on ? color : "#15171E"}
          borderWidth={1.5}
          borderColor={on ? color : "#323745"}
          pointerEvents="none"
        >
          <Text fontSize={11} fontWeight="semi-bold" color={on ? "#06221B" : color}>{`${i + 1}`}</Text>
          <Text fontSize={13} fontWeight="semi-bold" color={on ? "#06221B" : "#EEF0F4"}>
            {label}
          </Text>
        </Container>
      </group>
      <mesh
        geometry={hitGeo}
        visible={false}
        position={[0, 0, 0.006]}
        onPointerOver={() => (st.current.hover = true)}
        onPointerOut={() => {
          st.current.hover = false
          release()
        }}
        onPointerDown={() => (st.current.down = true)}
        onPointerUp={release}
        onPointerCancel={release}
        onClick={() => {
          st.current.v += 6 // pop
          onPick()
        }}
      />
    </group>
  )
}
