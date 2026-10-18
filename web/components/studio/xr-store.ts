import { createXRStore } from "@react-three/xr"
import { Material } from "three"

// Laptop emulator only: IWER's DevUI draws the emulated headset view with its own three r165, which calls
// material.onBuild (removed from three by r186) on our materials and throws every frame, so the view stayed black.
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  const proto = Material.prototype as Material & { onBuild?: () => void }
  proto.onBuild ??= () => {}
}

// One XR session store for the Studio and launched apps. See XR-INTERACTION.md for what each gesture does.
// emulate is left at its default: on localhost without WebXR it injects an emulated Quest 3 (Option+Cmd+E forces it elsewhere).
export const xrStore = createXRStore({
  // Our own Enter AR / Enter VR buttons start sessions; don't also let the Quest browser offer one on page load.
  offerSession: false,
  hand: { model: true, touchPointer: true, rayPointer: true, grabPointer: true, teleportPointer: false },
  controller: { model: true, rayPointer: true, grabPointer: true, teleportPointer: false },
})
