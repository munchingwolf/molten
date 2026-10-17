import { Redis } from "@upstash/redis"
import { newId, type Layout } from "./layout"

// Redis.fromEnv() reads UPSTASH_REDIS_REST_URL/TOKEN or Vercel's KV_REST_API_URL/TOKEN.
const redis = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL ? Redis.fromEnv() : null

// shortcut: in-memory fallback resets on server restart; set Upstash env vars for persistence.
const g = globalThis as typeof globalThis & { __layouts?: Map<string, Layout> }
const mem = (g.__layouts ??= new Map())

export async function saveLayout(layout: Layout): Promise<string> {
  const id = newId()
  const saved = { ...layout, id }
  if (redis) await Promise.all([redis.set(`layout:${id}`, saved), redis.set("layout:latest", saved)])
  else {
    mem.set(`layout:${id}`, saved)
    mem.set("layout:latest", saved)
  }
  return id
}

export async function getLayout(id: string): Promise<Layout | null> {
  const key = `layout:${id}`
  return redis ? redis.get<Layout>(key) : (mem.get(key) ?? null)
}
