import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Redis } from "@upstash/redis"
import { isValidId, newId, type Layout } from "./layout"

// Redis.fromEnv() reads UPSTASH_REDIS_REST_URL/TOKEN or Vercel's KV_REST_API_URL/TOKEN.
const redis = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL ? Redis.fromEnv() : null

// shortcut: without Redis, layouts live on this machine's disk (repo-root .data/layouts, outside the dev server's
// watched tree, like .data/assets) so launched /apps/<id> links survive a restart; serverless hosts need Redis.
const DIR = join(process.cwd(), "..", ".data", "layouts")
const file = (id: string) => join(DIR, `${id}.json`)

export async function saveLayout(layout: Layout): Promise<string> {
  const id = newId()
  const saved = { ...layout, id }
  if (redis) await Promise.all([redis.set(`layout:${id}`, saved), redis.set("layout:latest", saved)])
  else {
    await mkdir(DIR, { recursive: true })
    const json = JSON.stringify(saved)
    await Promise.all([writeFile(file(id), json), writeFile(file("latest"), json)])
  }
  return id
}

export async function getLayout(id: string): Promise<Layout | null> {
  if (!isValidId(id)) return null // ids become file names
  if (redis) return redis.get<Layout>(`layout:${id}`)
  try {
    return JSON.parse(await readFile(file(id), "utf8")) as Layout
  } catch {
    return null
  }
}
