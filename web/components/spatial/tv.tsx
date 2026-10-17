"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { SRGBColorSpace, VideoTexture, type Group, type MeshBasicMaterial } from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

type Props = { value?: boolean; onChange?: (playing: boolean) => void; src?: string }

const SAMPLE = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
const W = 0.96 // 16:9 screen, about a 43" TV
const H = 0.54
const BODY_Y = 0.036 // screen centre; keeps the whole TV + stand centred on the origin

/** 43" TV on a stand. Press the screen (poke, pinch or click) to play or pause a muted video. Controlled via `value`, or uncontrolled. */
export default function Tv({ value, onChange, src = SAMPLE }: Props) {
  const [inner, setInner] = useState(false)
  const [hover, setHover] = useState(false)
  const playing = value ?? inner
  const [media, setMedia] = useState<{ video: HTMLVideoElement; tex: VideoTexture } | null>(null)
  const [ready, setReady] = useState(false)
  const icon = useRef<Group>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const body = useMemo(() => new RoundedBoxGeometry(W + 0.024, H + 0.024, 0.03, 3, 0.008), [])
  const foot = useMemo(() => new RoundedBoxGeometry(0.34, 0.012, 0.17, 2, 0.005), [])
  useEffect(() => () => (body.dispose(), foot.dispose()), [body, foot])

  const toggle = () => {
    if (value === undefined) setInner(!playing)
    onChange?.(!playing)
  }

  // A new source drops the old video.
  useEffect(() => {
    setMedia(null)
    setReady(false)
  }, [src])

  // Create the video on first play only, so idle TVs in the library never download it.
  useEffect(() => {
    if (!playing || media) return
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.src = src
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.addEventListener("playing", () => setReady(true), { once: true })
    const tex = new VideoTexture(video)
    tex.colorSpace = SRGBColorSpace
    setMedia({ video, tex })
  }, [playing, media, src])

  useEffect(() => {
    if (!media) return
    return () => {
      media.video.pause()
      media.video.removeAttribute("src")
      media.video.load()
      media.tex.dispose()
    }
  }, [media])

  useEffect(() => {
    if (!media) return
    if (playing) media.video.play().catch(() => {})
    else media.video.pause()
  }, [playing, media])

  // Loading: the ring breathes until the first frame arrives.
  useFrame(({ clock }) => {
    if (ring.current) ring.current.opacity = playing && !ready ? 0.45 + 0.4 * Math.sin(clock.elapsedTime * 6) : 0.9
    if (icon.current) {
      const s = hover && !playing ? 1.08 : 1
      icon.current.scale.setScalar(icon.current.scale.x + (s - icon.current.scale.x) * 0.2)
    }
  })

  const showIcon = !playing || !ready

  return (
    <group>
      <group
        position={[0, BODY_Y, 0]}
        onClick={toggle}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <mesh geometry={body}>
          <meshStandardMaterial color="#0B0C10" metalness={0.35} roughness={0.4} />
        </mesh>
        {/* Glossy black panel when off */}
        <mesh position={[0, 0, 0.0151]}>
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial color="#06070A" metalness={0.3} roughness={0.12} />
        </mesh>
        {media && ready && (
          <mesh position={[0, 0, 0.0153]}>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial map={media.tex} toneMapped={false} color={playing ? "#ffffff" : "#8A8F99"} />
          </mesh>
        )}
        {showIcon && (
          <group ref={icon} position={[0, 0, 0.0158]}>
            <mesh>
              <circleGeometry args={[0.058, 48]} />
              <meshBasicMaterial color="#0B0C10" transparent opacity={0.55} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0, 0.0004]}>
              <ringGeometry args={[0.055, 0.06, 64]} />
              <meshBasicMaterial ref={ring} color="#9FE7D2" transparent opacity={0.9} toneMapped={false} depthWrite={false} />
            </mesh>
            <mesh position={[0.006, 0, 0.0004]}>
              <circleGeometry args={[0.026, 3]} />
              <meshBasicMaterial color="#EEF0F4" toneMapped={false} />
            </mesh>
          </group>
        )}
        {/* Standby LED */}
        <mesh position={[0, -H / 2 - 0.006, 0.0152]}>
          <circleGeometry args={[0.003, 16]} />
          <meshBasicMaterial color={playing ? "#9FE7D2" : "#F2B48A"} toneMapped={false} />
        </mesh>
      </group>
      {/* Stand */}
      <mesh position={[0, -0.274, -0.02]}>
        <boxGeometry args={[0.07, 0.06, 0.025]} />
        <meshStandardMaterial color="#15171E" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh geometry={foot} position={[0, -0.31, -0.02]}>
        <meshStandardMaterial color="#15171E" metalness={0.5} roughness={0.35} />
      </mesh>
    </group>
  )
}
