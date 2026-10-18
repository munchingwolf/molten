"use client"

import { useAssistant } from "@/lib/assistant-store"

import { useEffect, useRef, useState } from "react"
import { useThree } from "@react-three/fiber"
import { IfInSessionMode } from "@react-three/xr"
import { Container, Text } from "@react-three/uikit"
import { Vector3 } from "three"
import type { Viewer } from "@/lib/assist-ops"
import type { Vec3 } from "@/lib/layout"

// Push-to-talk: hold → record → /api/stt (ElevenLabs) → /api/assist (Ollama + word gating) → applyOps.
// Without an ElevenLabs key, falls back to the browser's Web Speech API (Chrome/Edge desktop; not Quest).

type Phase = "idle" | "listening" | "thinking" | "done" | "error"
type Status = { phase: Phase; text: string }
type Recording = { stop: () => void; cancel: () => void }


type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void; abort: () => void
}
const speechCtor = () =>
  typeof window === "undefined" ? undefined
    : ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => SpeechRec) | undefined

async function record(onDone: (audio: Blob, ms: number) => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mr = new MediaRecorder(stream)
  const chunks: Blob[] = []
  const t0 = Date.now()
  let keep = true
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  mr.onstop = () => {
    stream.getTracks().forEach((t) => t.stop()) // release the mic indicator
    if (keep) onDone(new Blob(chunks, { type: mr.mimeType }), Date.now() - t0)
  }
  mr.start()
  return { stop: () => mr.state !== "inactive" && mr.stop(), cancel: () => { keep = false; if (mr.state !== "inactive") mr.stop() } }
}

function listen(onText: (text: string) => void, onInterim: (text: string) => void, onError: (msg: string) => void): Recording {
  const Ctor = speechCtor()!
  const r = new Ctor()
  r.lang = "en-US"
  r.interimResults = true
  r.continuous = true
  let text = ""
  let failed = false
  r.onresult = (e) => {
    text = Array.from(e.results, (res) => res[0].transcript).join(" ").trim()
    onInterim(text)
  }
  r.onerror = (e) => {
    if (e.error === "aborted") return
    failed = true
    onError(e.error === "not-allowed" ? "Microphone blocked: allow it in the address bar" : `Speech recognition: ${e.error}`)
  }
  r.onend = () => !failed && onText(text)
  r.start()
  return { stop: () => r.stop(), cancel: () => { failed = true; r.abort() } }
}

/** The shared pipeline behind both buttons. `viewer` gives the XR head pose so new items land in front of you. */
function useVoice(viewer?: () => Viewer) {
  const [status, setStatus] = useState<Status>({ phase: "idle", text: "" })
  const stt = useRef<"eleven" | "browser" | null>(null)
  const rec = useRef<Recording | null>(null)
  const holding = useRef(false)

  useEffect(() => {
    fetch("/api/stt").then((r) => r.json()).then((d: { ready?: boolean }) => (stt.current = d.ready ? "eleven" : "browser")).catch(() => (stt.current = "browser"))
    fetch("/api/assist").catch(() => {}) // warm the local model so the first command is fast
  }, [])

  const run = async (text: string) => {
    if (!text.trim()) return setStatus({ phase: "error", text: "Didn't catch that. Hold and speak." })
    setStatus({ phase: "thinking", text: `“${text}”` })
    // Route through the assistant so laptop voice shows up in the assistant panel's transcript + op log.
    try {
      await useAssistant.getState().send(text)
      setStatus({ phase: "done", text: `“${text}”` })
    } catch (e) {
      setStatus({ phase: "error", text: `Couldn't apply: ${(e as Error).message}` })
    }
  }

  const transcribe = async (audio: Blob, ms: number) => {
    if (ms < 350) return setStatus({ phase: "error", text: "Hold the button while you speak" })
    setStatus({ phase: "thinking", text: "Transcribing…" })
    try {
      const res = await fetch("/api/stt", { method: "POST", headers: { "content-type": audio.type || "audio/webm" }, body: audio })
      const data = (await res.json()) as { text?: string; error?: string }
      if (res.status === 503) {
        stt.current = "browser"
        return setStatus({ phase: "error", text: speechCtor() ? "No ElevenLabs key: switched to browser speech. Hold again." : "Voice needs ELEVENLABS_API_KEY on the server (this browser has no built-in speech)." })
      }
      if (!res.ok) throw new Error(data.error ?? `stt ${res.status}`)
      await run(data.text ?? "")
    } catch (e) {
      setStatus({ phase: "error", text: `Speech-to-text failed: ${(e as Error).message}` })
    }
  }

  const start = async () => {
    if (holding.current) return
    holding.current = true
    setStatus({ phase: "listening", text: "Listening…" })
    try {
      let r: Recording
      // Browser speech unless the server key is confirmed (also covers a press before GET /api/stt answers).
      if (stt.current !== "eleven" && speechCtor()) {
        r = listen(run, (t) => setStatus({ phase: "listening", text: t || "Listening…" }), (msg) => setStatus({ phase: "error", text: msg }))
      } else r = await record(transcribe)
      if (!holding.current) return r.cancel() // released before the mic opened
      rec.current = r
    } catch (e) {
      holding.current = false
      const err = e as Error
      setStatus({ phase: "error", text: err.name === "NotAllowedError" ? "Microphone blocked: allow it in the address bar" : err.message })
    }
  }

  const stop = () => {
    holding.current = false
    rec.current?.stop()
    rec.current = null
  }

  return { status, start, stop }
}

const MicIcon = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
  </svg>
)

/** Top-bar push-to-talk: hold with mouse/touch, or hold Space/Enter while it's focused. */
export function VoiceButton({ className }: { className?: string }) {
  const { status, start, stop } = useVoice()
  const live = status.phase === "listening"
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <button
        type="button"
        aria-pressed={live}
        title="Hold and say e.g. “make it bigger”, “add a drum pad”, “turn it 45 degrees”"
        className={`flex select-none items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium touch-none ${live ? "border-accent bg-accent text-on-accent" : "border-border bg-surface"}`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start() }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start() } }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); stop() } }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <MicIcon />
        {live ? "Listening" : "Hold to talk"}
      </button>
      <span
        aria-live="polite"
        title={status.text}
        className={`max-w-[32ch] truncate font-mono text-xs ${status.phase === "error" ? "text-warm" : "text-muted"}`}
      >
        {status.phase === "thinking" && status.text.startsWith("“") ? `Thinking… ${status.text}` : status.text}
      </span>
    </div>
  )
}

const STAGE = "#111214"
const TEXT = "#F4F4F4"
const MUTED = "#8E8F94"
const HOVER = "#2E2E30"
const ACCENT = "#9FE7D2"
const ON_ACCENT = "#06221B"
const WARM = "#F2B48A"
const head = new Vector3()
const gaze = new Vector3()

/**
 * In-headset push-to-talk: poke and hold with a fingertip, or point and hold a pinch/trigger. XR sessions only.
 * Default spot mirrors the VR shelf on your right. Grant the mic once via the top-bar button before entering XR.
 */
export function XRVoiceButton({ position = [0.55, 1.15, -0.45] }: { position?: Vec3 }) {
  const camera = useThree((s) => s.camera)
  const { status, start, stop } = useVoice(() => {
    camera.getWorldPosition(head)
    camera.getWorldDirection(gaze)
    return { position: head.toArray() as Vec3, direction: gaze.toArray() as Vec3 }
  })
  const live = status.phase === "listening"
  const yaw = Math.atan2(-position[0], -position[2]) // face the user's starting spot
  return (
    <IfInSessionMode allow={["immersive-ar", "immersive-vr"]}>
      <group position={position} rotation={[0, yaw, 0]}>
        <Container pixelSize={0.002} width={260} padding={12} gap={10} flexDirection="column" backgroundColor={STAGE} borderRadius={6}>
          {/* 64 px ≈ 13 cm: an easy fingertip target. */}
          <Container
            height={64}
            borderRadius={32}
            alignItems="center"
            justifyContent="center"
            backgroundColor={live ? ACCENT : "#1C1D20"}
            hover={{ backgroundColor: live ? ACCENT : HOVER }}
            onPointerDown={() => start()}
            onPointerUp={stop}
            onPointerLeave={stop}
          >
            <Text fontSize={18} fontWeight="bold" color={live ? ON_ACCENT : TEXT}>
              {live ? "Listening… let go to send" : "Hold to talk"}
            </Text>
          </Container>
          <Text fontSize={14} color={status.phase === "error" ? WARM : MUTED} paddingX={4}>
            {status.text || "Try “make it bigger” or “add a drum pad”"}
          </Text>
        </Container>
      </group>
    </IfInSessionMode>
  )
}
