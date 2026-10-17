import { getLayout, saveLayout } from "@/lib/layout-store"

export const dynamic = "force-dynamic"

const MAX_ITEMS = 200
const MAX_BYTES = 256_000

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const isVec3 = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n))
const isItem = (i: unknown) =>
  isObj(i) &&
  typeof i.component === "string" &&
  isVec3(i.position) &&
  isVec3(i.rotation) &&
  typeof i.scale === "number" &&
  Number.isFinite(i.scale) &&
  isObj(i.bind) &&
  Object.values(i.bind).every((n) => typeof n === "string") &&
  (i.props === undefined || isObj(i.props))

export async function POST(req: Request) {
  const text = await req.text()
  if (text.length > MAX_BYTES) return Response.json({ error: "layout too large" }, { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 })
  }
  if (!isObj(body) || typeof body.name !== "string" || !Array.isArray(body.items) || body.items.length > MAX_ITEMS || !body.items.every(isItem))
    return Response.json({ error: `expected { name: string, items: Item[] (max ${MAX_ITEMS}) }` }, { status: 400 })
  const id = await saveLayout({ name: body.name, items: body.items })
  return Response.json({ id })
}

export async function GET() {
  const layout = await getLayout("latest")
  return layout ? Response.json(layout) : Response.json({ error: "no layout saved yet" }, { status: 404 })
}
