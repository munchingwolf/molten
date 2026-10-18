import { sanitizeLiveOp, type LiveOp } from "@/lib/live-ops"
import { fromThisMachine, live } from "@/lib/live-store"

export const dynamic = "force-dynamic"

/** Claude Code (Spatial MCP) queues edits for the open Studio. */
export async function POST(req: Request) {
  if (!fromThisMachine(req)) return Response.json({ error: "edits can only be sent from this machine" }, { status: 403 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "expected JSON { ops: [...] }" }, { status: 400 })
  }
  const raw = (body as { ops?: unknown })?.ops
  if (!Array.isArray(raw) || !raw.length || raw.length > 50) return Response.json({ error: "expected { ops: [...] } with 1-50 ops" }, { status: 400 })
  const ops: LiveOp[] = []
  for (const [i, r] of raw.entries()) {
    const op = sanitizeLiveOp(r)
    if (typeof op === "string") return Response.json({ error: `op ${i}: ${op}` }, { status: 400 })
    ops.push(op)
  }
  const first = live.seq + 1
  for (const op of ops) live.ops.push({ seq: ++live.seq, op })
  live.ops = live.ops.slice(-500)
  return Response.json({ first, last: live.seq })
}

/** The Studio polls this: `?after=<seq>` returns newer ops; without it, just the current seq (start from now). */
export function GET(req: Request) {
  const after = Number(new URL(req.url).searchParams.get("after"))
  if (!Number.isFinite(after)) return Response.json({ seq: live.seq, ops: [] })
  return Response.json({ seq: live.seq, ops: live.ops.filter((o) => o.seq > after) })
}
