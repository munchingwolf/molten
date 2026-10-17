import { readFile } from "node:fs/promises"
import path from "node:path"
import { notFound } from "next/navigation"
import { findEntry, registry, siblings } from "@/lib/registry"
import { Detail } from "./detail"

export const generateStaticParams = () => registry.map((e) => ({ name: e.name }))

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const entry = findEntry((await params).name)
  return { title: entry ? `${entry.displayName} · Spatial` : "Spatial" }
}

export default async function ComponentPage({ params }: { params: Promise<{ name: string }> }) {
  const entry = findEntry((await params).name)
  if (!entry) notFound()
  // The app root is web/, which is where registry "file" paths are relative to.
  const code = entry.status === "ready" ? await readFile(path.join(process.cwd(), entry.file), "utf8") : null
  return <Detail entry={entry} code={code} styles={siblings(entry)} />
}
