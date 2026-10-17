import type { Metadata } from "next"
import { StudioLoader } from "./studio-loader"

export const metadata: Metadata = { title: "Studio · Spatial" }

export default function StudioPage() {
  return <StudioLoader />
}
