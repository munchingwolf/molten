import { ENVIRONMENTS, OP_NAMES, extractOps, parseModelOps, type Ctx, type Op, type RegEntry } from "@/lib/assist-ops"

// Voice command → gated scene ops. Local Ollama classifies intent; lib/assist-ops decides every value from the words.
const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434"
const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b"

const SYSTEM = `You classify ONE spoken command for a 3D scene editor into edit operations.
Reply with JSON only: {"ops":[...]}. Each op is an object with "op" set to one of: ${OP_NAMES.join(", ")}.
Optional fields: "target" (an item id from the layout, or "selected"), "component" (a registry name), "prop", "value", "amount", "direction" (left|right|up|down|closer|farther).
"show" brings an item in front of the user ("show me the drum pad", "display it"). "it"/"that" means the selected item.
Only list operations the user explicitly asked for. Never add extra ones. If the command asks for nothing you can do, reply {"ops":[]}.`

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const str = (v: unknown, max = 80) => (typeof v === "string" ? v.slice(0, max) : "")

async function classify(text: string, ctx: Ctx): Promise<Op[] | null> {
  // Static parts first: Ollama reuses its cache for an unchanged prefix, so only the layout + command get re-read (12 s → ~1 s).
  const user = JSON.stringify({
    registry: ctx.registry.map((e) => e.name),
    environments: Object.keys(ENVIRONMENTS),
    layout: ctx.items.map((i) => ({ id: i.id, component: i.component })),
    selected: ctx.selectedId,
    command: text,
  })
  try {
    // Wall-clock deadline: AbortSignal.timeout covers a socket that accepts and never answers.
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: "json",
        keep_alive: "30m",
        options: { temperature: 0, num_predict: 256 },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: { content?: string } }
    return parseModelOps(JSON.parse(data.message?.content ?? ""))
  } catch {
    return null // unreachable, timed out, or not JSON → keyword grammar
  }
}

/** Load the model into memory so the first spoken command isn't the slow one (~10 s cold). */
export async function GET() {
  try {
    const res = await fetch(`${OLLAMA}/api/generate`, { method: "POST", body: JSON.stringify({ model: MODEL, keep_alive: "30m" }), signal: AbortSignal.timeout(30_000) })
    return Response.json({ ready: res.ok, model: MODEL })
  } catch {
    return Response.json({ ready: false, model: MODEL, fallback: "keywords" })
  }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "expected JSON" }, { status: 400 })
  }
  if (!isObj(body) || typeof body.text !== "string" || !body.text.trim() || body.text.length > 500)
    return Response.json({ error: "expected { text: string (≤500 chars), layout: { items }, selectedId, registry }" }, { status: 400 })

  const items = isObj(body.layout) && Array.isArray(body.layout.items) ? body.layout.items.slice(0, 200) : []
  const registry = Array.isArray(body.registry) ? body.registry.slice(0, 500) : []
  const ctx: Ctx = {
    items: items.filter(isObj).map((i) => ({ id: str(i.id, 40), component: str(i.component) })).filter((i) => i.id && i.component),
    selectedId: typeof body.selectedId === "string" ? body.selectedId : null,
    registry: registry.filter(isObj).filter((e) => typeof e.name === "string").map((e) => ({
      name: str(e.name),
      displayName: str(e.displayName) || str(e.name),
      aliases: Array.isArray(e.aliases) ? e.aliases.filter((a): a is string => typeof a === "string").slice(0, 10) : [],
      category: str(e.category),
      style: str(e.style),
      status: str(e.status),
      props: Array.isArray(e.props) ? (e.props.filter(isObj) as unknown as RegEntry["props"]) : undefined,
    })),
  }
  const text = body.text.trim()

  const started = Date.now()
  const intents = await classify(text, ctx)
  const ms = Date.now() - started
  let ops = intents ? extractOps(text, ctx, intents) : []
  let source: "ollama" | "keywords" = "ollama"
  // Model down, or nothing it heard survived gating → plain keyword grammar (same gates, no model filter).
  if (!ops.length) {
    ops = extractOps(text, ctx)
    source = "keywords"
  }
  return Response.json({ ops, source, transcript: text, model: { name: MODEL, ok: intents !== null, ms, intents } })
}
