import type { LiveOp } from "./live-ops"

// shortcut: one in-memory queue + one scene snapshot per dev-server process (one Studio open at a time);
// fine for a laptop demo, use Redis pub/sub or a websocket hub before several people drive several Studios.
type Live = { seq: number; ops: { seq: number; op: LiveOp }[]; scene: unknown; sceneAt: number }
const g = globalThis as typeof globalThis & { __live?: Live }
export const live = (g.__live ??= { seq: 0, ops: [], scene: null, sceneAt: 0 })

/** Edits may only be queued from this machine (the MCP server), not through the public tunnel. */
export function fromThisMachine(req: Request) {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "")
  // Cloudflare tunnels add cf-connecting-ip; Next's dev server itself adds x-forwarded-for, so that can't be the test.
  return ["localhost", "127.0.0.1", "[::1]"].includes(host) && !req.headers.get("cf-connecting-ip")
}
