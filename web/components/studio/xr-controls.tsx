"use client"

import { unlockAudio } from "@/lib/unlock-audio"

import { useEffect, useState } from "react"
import { useStore } from "zustand"
import { xrStore } from "./xr-store"

const NO_XR = "WebXR isn't available in this browser. Open the Studio in the Quest browser over HTTPS."
const primary = "bg-accent text-on-accent rounded-md px-3 py-1.5 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
const secondary = "border border-border bg-surface rounded-md px-3 py-1.5 font-medium disabled:opacity-40 disabled:cursor-not-allowed"

const supported = (mode: XRSessionMode) =>
  navigator.xr?.isSessionSupported(mode).catch(() => false) ?? Promise.resolve(false)

const micGranted = () =>
  navigator.permissions?.query({ name: "microphone" as PermissionName }).then((p) => p.state === "granted", () => false) ?? Promise.resolve(false)

// Enter synchronously inside the click: anything awaited first can use up the click's user activation and the Quest
// then refuses the session.
const enter = (mode: XRSessionMode) => {
  unlockAudio() // inside the click: lets instruments play in the headset
  xrStore.enterXR(mode).catch((e) => console.error(`Couldn't start ${mode}`, e))
}

// The Quest can't show a permission prompt inside an immersive session, so ask for the mic on the first tap anywhere on
// the page (before Enter VR/AR), once, without blocking anything.
function useMicPrimer() {
  useEffect(() => {
    const prime = () => {
      micGranted().then((ok) => {
        if (!ok) navigator.mediaDevices?.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()), () => {})
      })
    }
    window.addEventListener("pointerdown", prime, { once: true, capture: true })
    return () => window.removeEventListener("pointerdown", prime, { capture: true })
  }, [])
}

/** Enter AR / Enter VR / Exit for the HTML top bar. Lives outside the Canvas, so it reads the XR store directly. */
export function EnterXRButtons({ className }: { className?: string }) {
  const session = useStore(xrStore, (s) => s.session)
  // On localhost the emulator is injected asynchronously; re-check support once it lands.
  const emulator = useStore(xrStore, (s) => s.emulator)
  const [support, setSupport] = useState({ ar: false, vr: false })
  useMicPrimer()

  useEffect(() => {
    let live = true
    Promise.all([supported("immersive-ar"), supported("immersive-vr")]).then(([ar, vr]) => {
      if (live) setSupport({ ar, vr })
    })
    return () => {
      live = false
    }
  }, [emulator])

  if (session)
    return (
      <div className={`flex gap-2 ${className ?? ""}`}>
        <button type="button" className={secondary} onClick={() => session.end().catch(console.error)}>
          Exit
        </button>
      </div>
    )

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      {/* Tooltip sits on a wrapper: disabled buttons don't receive hover in every browser. */}
      <span title={support.ar ? "Passthrough: build in your real room" : NO_XR}>
        <button type="button" className={primary} disabled={!support.ar} onClick={() => enter("immersive-ar")}>
          Enter AR
        </button>
      </span>
      <span title={support.vr ? "Fully immersive" : NO_XR}>
        <button type="button" className={secondary} disabled={!support.vr} onClick={() => enter("immersive-vr")}>
          Enter VR
        </button>
      </span>
    </div>
  )
}
