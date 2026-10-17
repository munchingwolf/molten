"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace, type Group, type Mesh } from "three"
import { Container, Text } from "@react-three/uikit"
import { Pause, Play } from "@react-three/uikit-lucide"

type Props = { src?: string; label?: string; artist?: string }

const SAMPLE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
const PW = 300 // card, px at pixelSize 0.002 -> 60 x 24 cm
const PH = 120
const px = (x: number) => (x - PW / 2) * 0.002 // card px -> metres from centre
const py = (y: number) => (PH / 2 - y) * 0.002
const DISC = 0.092 // vinyl radius
const DISC_X = px(64)
const TRACK_L = px(184)
const TRACK_W = px(284) - TRACK_L
const TRACK_Y = py(80)
const ARM_REST = 0.15 // tonearm angle off the record
const ARM_PLAY = -0.42 // needle in the grooves

let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated matcap gives the vinyl its sheen everywhere.
function getMatcap() {
  if (matcap) return matcap
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 30, 0, 64, 30, 90)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.5, "#d0d3da")
  grad.addColorStop(1, "#2f323a")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  matcap = new CanvasTexture(c)
  matcap.colorSpace = SRGBColorSpace
  return matcap
}

const clock = (s: number) => {
  const t = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}

/** 60 cm music card with a spinning 3D record and a tonearm that drops on play. Press play/pause; tap or drag the bar to seek. `src` is any audio URL. */
export default function AudioPlayer({ src = SAMPLE, label = "SoundHelix Song 1", artist = "SoundHelix" }: Props) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [playing, setPlaying] = useState(false)
  const [sec, setSec] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scrub, setScrub] = useState(false)
  const disc = useRef<Group>(null)
  const arm = useRef<Group>(null)
  const fill = useRef<Mesh>(null)
  const grp = useRef<Group>(null)
  const mc = useMemo(getMatcap, [])

  // Created in an effect (not useMemo) so StrictMode's mount/unmount/mount gets a fresh element each time.
  useEffect(() => {
    const a = new Audio()
    a.preload = "metadata"
    a.src = src
    const onMeta = () => {
      setDuration(a.duration)
      setStatus("ready")
    }
    const onTime = () => setSec(Math.floor(a.currentTime))
    const onEnd = () => setPlaying(false)
    const onError = () => setStatus("error")
    a.addEventListener("loadedmetadata", onMeta)
    a.addEventListener("timeupdate", onTime)
    a.addEventListener("ended", onEnd)
    a.addEventListener("error", onError)
    setAudio(a)
    setStatus("loading")
    setPlaying(false)
    setSec(0)
    return () => {
      a.removeEventListener("loadedmetadata", onMeta)
      a.removeEventListener("timeupdate", onTime)
      a.removeEventListener("ended", onEnd)
      a.removeEventListener("error", onError)
      a.pause()
      a.removeAttribute("src")
      a.load() // releases the network stream
      setAudio(null)
    }
  }, [src])

  const toggle = () => {
    if (!audio || status === "error") return
    if (!audio.paused) {
      audio.pause()
      setPlaying(false)
      return
    }
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }

  const seekTo = (e: ThreeEvent<PointerEvent>) => {
    if (!audio || !grp.current || !Number.isFinite(audio.duration)) return
    const x = grp.current.worldToLocal(e.point.clone()).x
    audio.currentTime = Math.min(1, Math.max(0, (x - TRACK_L) / TRACK_W)) * audio.duration
    setSec(Math.floor(audio.currentTime))
  }
  const down = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setScrub(true)
    seekTo(e)
  }
  const up = () => setScrub(false)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    if (disc.current && playing) disc.current.rotation.z -= dt * 3.49 // 33⅓ rpm
    let moving = playing
    if (arm.current) {
      const target = playing ? ARM_PLAY : ARM_REST
      const r = arm.current.rotation.z
      arm.current.rotation.z = r + (target - r) * (1 - Math.exp(-dt * 6))
      if (Math.abs(target - r) > 1e-3) moving = true
    }
    if (fill.current && audio) {
      const p = audio.duration ? audio.currentTime / audio.duration : 0
      fill.current.scale.x = Math.max(p * TRACK_W, 0.0001)
      fill.current.position.x = TRACK_L + (p * TRACK_W) / 2
    }
    if (moving) state.invalidate()
  })

  return (
    <group ref={grp}>
      <Container
        pixelSize={0.002}
        width={PW}
        height={PH}
        borderRadius={18}
        backgroundColor="#15171E"
        borderWidth={1.5}
        borderColor={playing ? "#9FE7D2" : "#323745"}
      >
        <Container positionType="absolute" positionLeft={128} positionTop={18} positionRight={16} flexDirection="column" gap={2}>
          <Text fontSize={15} fontWeight="semi-bold" color="#EEF0F4">
            {label}
          </Text>
          <Text fontSize={12} color="#9AA0AD">
            {status === "error" ? "Audio unavailable" : artist}
          </Text>
        </Container>
        <Container
          positionType="absolute"
          positionLeft={128}
          positionTop={62}
          onClick={toggle}
          width={44}
          height={44}
          borderRadius={22}
          alignItems="center"
          justifyContent="center"
          backgroundColor={playing ? "#242833" : "#9FE7D2"}
          hover={{ backgroundColor: playing ? "#323745" : "#B8F0E0" }}
        >
          {playing ? <Pause width={20} height={20} color="#EEF0F4" /> : <Play width={20} height={20} color="#06221B" />}
        </Container>
        <Container positionType="absolute" positionLeft={184} positionRight={16} positionTop={90} flexDirection="row" justifyContent="space-between">
          <Text fontSize={11} color={scrub ? "#EEF0F4" : "#9AA0AD"}>
            {clock(sec)}
          </Text>
          <Text fontSize={11} color="#6B7180">
            {clock(duration)}
          </Text>
        </Container>
      </Container>

      {/* Record, floating 1.6 cm off the card. */}
      <group position={[DISC_X, 0, 0.016]}>
        <group ref={disc}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[DISC, DISC, 0.006, 64]} />
            <meshMatcapMaterial matcap={mc} color="#22252E" />
          </mesh>
          {[0.075, 0.062, 0.05].map((r) => (
            <mesh key={r} position={[0, 0, 0.0031]}>
              <ringGeometry args={[r - 0.0008, r, 64]} />
              <meshBasicMaterial color="#3A3F4E" />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.0032]}>
            <circleGeometry args={[0.032, 48]} />
            <meshBasicMaterial color="#9FE7D2" toneMapped={false} />
          </mesh>
          {/* Off-centre mark on the label, so the spin reads. */}
          <mesh position={[0, 0.019, 0.0034]}>
            <circleGeometry args={[0.005, 16]} />
            <meshBasicMaterial color="#06221B" />
          </mesh>
          <mesh position={[0, 0, 0.0036]}>
            <circleGeometry args={[0.004, 16]} />
            <meshBasicMaterial color="#0B0C10" />
          </mesh>
        </group>
        {/* Tonearm: pivots at the top-right of the record and swings on when playing. */}
        <group ref={arm} position={[DISC * 0.95, DISC * 0.92, 0.012]} rotation={[0, 0, ARM_REST]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.008, 24]} />
            <meshMatcapMaterial matcap={mc} color="#EEF0F4" />
          </mesh>
          <mesh position={[0, -0.045, 0.002]}>
            <boxGeometry args={[0.004, 0.09, 0.003]} />
            <meshMatcapMaterial matcap={mc} color="#C9CDD6" />
          </mesh>
          <mesh position={[0, -0.092, 0.002]}>
            <boxGeometry args={[0.01, 0.014, 0.005]} />
            <meshMatcapMaterial matcap={mc} color="#F2B48A" />
          </mesh>
        </group>
      </group>

      {/* Seek bar */}
      <group position={[0, TRACK_Y, 0.004]}>
        <mesh position={[TRACK_L + TRACK_W / 2, 0, 0]}>
          <boxGeometry args={[TRACK_W, 0.005, 0.002]} />
          <meshBasicMaterial color="#323745" />
        </mesh>
        <mesh ref={fill} position={[TRACK_L, 0, 0.001]} scale={[0.0001, 1, 1]}>
          <boxGeometry args={[1, 0.006, 0.002]} />
          <meshBasicMaterial color="#9FE7D2" toneMapped={false} />
        </mesh>
        {/* 21 x 3 cm hit strip; capture keeps a drag alive past its ends. */}
        <mesh
          visible={false}
          position={[TRACK_L + TRACK_W / 2, 0, 0.006]}
          onPointerDown={down}
          onPointerMove={(e) => scrub && seekTo(e)}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <boxGeometry args={[TRACK_W + 0.01, 0.03, 0.02]} />
        </mesh>
      </group>
    </group>
  )
}
