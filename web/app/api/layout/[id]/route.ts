import { isValidId } from "@/lib/layout"
import { getLayout } from "@/lib/layout-store"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isValidId(id)) return Response.json({ error: "invalid id" }, { status: 400 })
  const layout = await getLayout(id)
  return layout ? Response.json(layout) : Response.json({ error: "not found" }, { status: 404 })
}
