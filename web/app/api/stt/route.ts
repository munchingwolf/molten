// Push-to-talk audio → text via ElevenLabs Scribe. 503 without a key so the client can fall back to Web Speech.
const MAX_BYTES = 10 * 1024 * 1024
const MODEL = process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2"

/** Lets the voice button pick ElevenLabs vs browser speech before the user starts talking. */
export function GET() {
  return Response.json({ ready: Boolean(process.env.ELEVENLABS_API_KEY) })
}

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return Response.json({ error: "no ELEVENLABS_API_KEY" }, { status: 503 })
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return Response.json({ error: "audio over 10 MB" }, { status: 413 })

  // Accept multipart (field "file") or the raw MediaRecorder blob as the body.
  let audio: Blob
  try {
    const type = req.headers.get("content-type") ?? ""
    if (type.startsWith("multipart/form-data")) {
      const f = (await req.formData()).get("file")
      if (!(f instanceof Blob)) return Response.json({ error: "expected a 'file' field" }, { status: 400 })
      audio = f
    } else audio = new Blob([await req.arrayBuffer()], { type: type || "audio/webm" })
  } catch {
    return Response.json({ error: "couldn't read the audio" }, { status: 400 })
  }
  if (!audio.size) return Response.json({ error: "empty audio" }, { status: 400 })
  if (audio.size > MAX_BYTES) return Response.json({ error: "audio over 10 MB" }, { status: 413 })

  const form = new FormData()
  form.append("model_id", MODEL)
  form.append("tag_audio_events", "false") // no "(laughter)" in the command text
  form.append("file", audio, audio.type.includes("mp4") ? "speech.mp4" : audio.type.includes("ogg") ? "speech.ogg" : "speech.webm")
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return Response.json({ error: `ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}` }, { status: 502 })
    const data = (await res.json()) as { text?: string }
    return Response.json({ text: (data.text ?? "").trim() })
  } catch (e) {
    return Response.json({ error: `ElevenLabs unreachable (${(e as Error).name})` }, { status: 502 })
  }
}
