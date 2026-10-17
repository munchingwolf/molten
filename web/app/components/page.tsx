import { Suspense } from "react"
import { Browser } from "./browser"

export const metadata = { title: "Components · Spatial" }

export default function ComponentsPage() {
  return (
    <Suspense>
      <Browser />
    </Suspense>
  )
}
