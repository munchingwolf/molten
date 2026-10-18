import { Vector3, type Camera } from "three"
import type { Viewer } from "./assist-ops"
import type { Vec3 } from "./layout"

// The live camera: the laptop orbit camera, or the headset pose in XR (three copies the XR head into it each frame).
// Set from inside the Canvas (useViewerProbe in vr-assistant.tsx) so the assistant can place things "in front of me".
export const viewerCamera: { current: Camera | null } = { current: null }

const p = new Vector3()
const d = new Vector3()

/** Where the user is and which way they look, in world space; undefined before the Canvas mounts. */
export function currentViewer(): Viewer | undefined {
  const c = viewerCamera.current
  if (!c) return undefined
  c.getWorldPosition(p)
  c.getWorldDirection(d)
  return { position: p.toArray() as Vec3, direction: d.toArray() as Vec3 }
}
