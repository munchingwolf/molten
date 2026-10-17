import { Box3, type Object3D } from "three"

// uikit's Content (every lucide icon is an Svg, which extends it) keeps a reactive signal in a field named `boundingBox`.
// three's Box3.expandByObject treats any object.boundingBox as a Box3 and throws "reading 'x'", which broke every
// bounds measurement (drei <Bounds> previews, grab bars, surface snapping) once an icon was in the scene.
// For such objects, measure their children instead, which is what the box would have covered anyway.
const expand = Box3.prototype.expandByObject
if (!(expand as { patched?: boolean }).patched) {
  const patched = function (this: Box3, object: Object3D, precise?: boolean): Box3 {
    const bb = (object as { boundingBox?: { isBox3?: boolean } | null }).boundingBox
    if (bb && !bb.isBox3) {
      object.updateWorldMatrix(false, false)
      for (const child of object.children) patched.call(this, child, precise)
      return this
    }
    return expand.call(this, object, precise)
  }
  ;(patched as { patched?: boolean }).patched = true
  Box3.prototype.expandByObject = patched
}
