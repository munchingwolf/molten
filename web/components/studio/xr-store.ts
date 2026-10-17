import { createXRStore } from "@react-three/xr"

// One XR session store for the Studio and launched apps. See XR-INTERACTION.md for what each gesture does.
// emulate is left at its default: on localhost without WebXR it injects an emulated Quest 3 (Option+Cmd+E forces it elsewhere).
export const xrStore = createXRStore({
  // Our own Enter AR / Enter VR buttons start sessions; don't also let the Quest browser offer one on page load.
  offerSession: false,
  hand: { model: true, touchPointer: true, rayPointer: true, grabPointer: true, teleportPointer: false },
  controller: { model: true, rayPointer: true, grabPointer: true, teleportPointer: false },
})
