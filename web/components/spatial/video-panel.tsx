"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { CanvasTexture, SRGBColorSpace, VideoTexture, type Group, type Mesh } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { Container, Text } from "@react-three/uikit"
import { Pause, Play } from "@react-three/uikit-lucide"

type Props = { src?: string; label?: string }

// Sintel (Blender Foundation, CC BY 3.0), served with CORS so it can be a WebGL texture.
const SAMPLE = "https://threejs.org/examples/textures/sintel.mp4"
const W = 0.64 // screen width, metres
const STRIP = 0.1 // seek bar + control row under the screen
const PAD = 0.012

let matcap: CanvasTexture | undefined
// Previews have no lights, so a generated matcap shades the bezel the same everywhere.
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

type Media = { video: HTMLVideoElement; texture: VideoTexture }
const noHit = () => {}

/** 64 cm video screen. Press the screen (or the play button) to play/pause; sound unmutes on the first press. Tap the bar under the screen to seek. */
export default function VideoPanel({ src = SAMPLE, label = "Sintel (trailer)" }: Props) {
  const invalidate = useThree((s) => s.invalidate)
  const [media, setMedia] = useState<Media | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [aspect, setAspect] = useState(16 / 9)
  const [playing, setPlaying] = useState(false)
  const [hover, setHover] = useState(false)
  const [sec, setSec] = useState(0)
  const grp = useRef<Group>(null)
  const fill = useRef<Mesh>(null)
  const mc = useMemo(getMatcap, [])

  // Created in an effect (not useMemo) so StrictMode's mount/unmount/mount gets a fresh element each time.
  useEffect(() => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.preload = "auto"
    video.src = src
    const texture = new VideoTexture(video)
    texture.colorSpace = SRGBColorSpace
    const onMeta = () => {
      setAspect(video.videoWidth / video.videoHeight || 16 / 9)
      setStatus("ready")
      video.currentTime = Math.min(2, (video.duration || 0) / 10) // show a frame from the film, not black
    }
    const onSeeked = () => {
      texture.needsUpdate = true
      invalidate()
    }
    const onError = () => setStatus("error")
    video.addEventListener("loadedmetadata", onMeta)
    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onError)
    setMedia({ video, texture })
    setStatus("loading")
    setPlaying(false)
    return () => {
      video.removeEventListener("loadedmetadata", onMeta)
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
      video.pause()
      video.removeAttribute("src")
      video.load() // releases the network stream
      texture.dispose()
      setMedia(null)
    }
  }, [src, invalidate])

  const toggle = () => {
    const v = media?.video
    if (!v || status !== "ready") return
    if (!v.paused) {
      v.pause()
      setPlaying(false)
      return
    }
    v.muted = false
    v.play()
      .catch(() => {
        v.muted = true // autoplay policy refused sound: play muted rather than not at all
        return v.play()
      })
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }

  const seek = (e: ThreeEvent<MouseEvent>) => {
    const v = media?.video
    if (!v || !grp.current || !Number.isFinite(v.duration)) return
    const x = grp.current.worldToLocal(e.point.clone()).x
    v.currentTime = Math.min(1, Math.max(0, (x + W / 2) / W)) * v.duration
    setSec(Math.floor(v.currentTime))
  }

  useFrame((state) => {
    const v = media?.video
    if (!v) return
    const p = v.duration ? v.currentTime / v.duration : 0
    if (fill.current) {
      fill.current.scale.x = Math.max(p * W, 0.0001)
      fill.current.position.x = -W / 2 + (p * W) / 2
    }
    const s = Math.floor(v.currentTime)
    if (s !== sec) setSec(s)
    if (playing) state.invalidate() // demand-mode canvases still need frames while the film runs
  })

  const h = W / aspect
  const screenY = STRIP / 2
  const sb = screenY - h / 2 // screen bottom
  const bezel = useMemo(() => new RoundedBoxGeometry(W + PAD * 2, h + STRIP + PAD * 2, 0.02, 3, 0.014), [h])
  useEffect(() => () => bezel.dispose(), [bezel])
  const duration = media?.video.duration ?? 0

  return (
    <group ref={grp}>
      <mesh geometry={bezel} position={[0, 0, -0.011]}>
        <meshMatcapMaterial matcap={mc} color="#1B1E26" />
      </mesh>
      <mesh
        position={[0, screenY, 0]}
        onClick={toggle}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <planeGeometry args={[W, h]} />
        {media && status === "ready" ? (
          <meshBasicMaterial map={media.texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#0B0C10" />
        )}
      </mesh>
      {status !== "ready" && (
        <group position={[0, screenY, 0.004]}>
          <Container pixelSize={0.002} pointerEvents="none">
            <Text fontSize={14} color="#9AA0AD">
              {status === "error" ? "Video unavailable" : "Loading video"}
            </Text>
          </Container>
        </group>
      )}
      {status === "ready" && (!playing || hover) && (
        <group position={[0, screenY, 0.006]} scale={hover ? 1.12 : 1}>
          {/* Overlay meshes don't raycast, so a press always reaches the screen behind them. */}
          <mesh raycast={noHit}>
            <circleGeometry args={[0.042, 48]} />
            <meshBasicMaterial color="#0B0C10" transparent opacity={0.62} depthWrite={false} />
          </mesh>
          {playing ? (
            <>
              <mesh position={[-0.009, 0, 0.001]} raycast={noHit}>
                <planeGeometry args={[0.009, 0.032]} />
                <meshBasicMaterial color="#EEF0F4" toneMapped={false} />
              </mesh>
              <mesh position={[0.009, 0, 0.001]} raycast={noHit}>
                <planeGeometry args={[0.009, 0.032]} />
                <meshBasicMaterial color="#EEF0F4" toneMapped={false} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 0, 0.001]} raycast={noHit}>
              <circleGeometry args={[0.02, 3]} />
              <meshBasicMaterial color="#9FE7D2" toneMapped={false} />
            </mesh>
          )}
        </group>
      )}
      <group position={[0, sb - 0.012, 0.002]}>
        <mesh>
          <boxGeometry args={[W, 0.004, 0.002]} />
          <meshBasicMaterial color="#323745" />
        </mesh>
        <mesh ref={fill} position={[-W / 2, 0, 0.001]} scale={[0.0001, 1, 1]}>
          <boxGeometry args={[1, 0.005, 0.002]} />
          <meshBasicMaterial color="#9FE7D2" toneMapped={false} />
        </mesh>
        {/* Seek hit strip: 2 cm tall, kept below the screen so a seek tap never also toggles play. */}
        <mesh visible={false} onClick={seek}>
          <boxGeometry args={[W, 0.02, 0.02]} />
        </mesh>
      </group>
      <group position={[0, sb - 0.062, 0.002]}>
        <Container pixelSize={0.002} width={W / 0.002} height={36} flexDirection="row" alignItems="center" gap={10}>
          <Container
            onClick={toggle}
            width={44}
            height={32}
            borderRadius={9}
            alignItems="center"
            justifyContent="center"
            backgroundColor={playing ? "#242833" : "#9FE7D2"}
            hover={{ backgroundColor: playing ? "#323745" : "#B8F0E0" }}
          >
            {playing ? <Pause width={18} height={18} color="#EEF0F4" /> : <Play width={18} height={18} color="#06221B" />}
          </Container>
          <Text fontSize={14} fontWeight="semi-bold" color="#EEF0F4" flexGrow={1}>
            {label}
          </Text>
          <Text fontSize={12} color="#9AA0AD">
            {`${clock(sec)} / ${clock(duration)}`}
          </Text>
        </Container>
      </group>
    </group>
  )
}
