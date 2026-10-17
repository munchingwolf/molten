import { join } from "node:path"

// shortcut: uploads live on this machine's disk (repo-root .data/assets, outside the dev server's watched tree);
// fine for the laptop dev server + tunnel, but Vercel's disk is read-only, so move to Vercel Blob/S3 for a deployed app.
const DIR = join(process.cwd(), "..", ".data", "assets")
export const MAX_ASSET_BYTES = 50 * 1024 * 1024

/** Absolute path for a stored asset id like "k3f9a2bc.glb"; null for anything else (blocks path traversal). */
export function assetPath(id: string) {
  return /^[a-z0-9]{6,12}\.(glb|gltf)$/.test(id) ? join(DIR, id) : null
}
