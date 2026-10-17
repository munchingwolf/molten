"use client"

import { Fragment } from "react"
import { useThree } from "@react-three/fiber"
import { IfInSessionMode } from "@react-three/xr"
import { Container, Text } from "@react-three/uikit"
import { Vector3, type Camera } from "three"
import { registry, type Entry } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import type { Vec3 } from "@/lib/layout"

const STAGE = "#111214"
const TEXT = "#F4F4F4"
const MUTED = "#8E8F94"
const HOVER = "#2E2E30" // white at ~12% over STAGE
const PRESSED = "#0A0A0A"

// Left of where the session starts, within arm's reach of a standing user (≈0.6 m from the left shoulder), turned to face them.
const SHELF_POS: Vec3 = [-0.55, 1.15, -0.45]
const SHELF_YAW = Math.atan2(-SHELF_POS[0], -SHELF_POS[2])

// You're looking at the shelf when you tap it, so "dead ahead" would drop the item on top of the shelf.
// Swing the spawn point this many radians to the right of gaze so it lands beside the shelf.
const AWAY_FROM_SHELF = 0.7
const UP = new Vector3(0, 1, 0)
const head = new Vector3()
const dir = new Vector3()

const groups = new Map<string, Entry[]>()
for (const e of registry) if (e.status === "ready") groups.set(e.category, [...(groups.get(e.category) ?? []), e])

function addInFront(camera: Camera, name: string) {
  camera.getWorldPosition(head)
  camera.getWorldDirection(dir)
  dir.y = 0
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1) // looking straight down
  dir.normalize().applyAxisAngle(UP, -AWAY_FROM_SHELF)
  const { add, update } = useStudio.getState()
  add(name, [head.x + dir.x * 0.6, head.y - 0.1, head.z + dir.z * 0.6])
  const id = useStudio.getState().selectedId // add() selects the new item
  if (id) update(id, { rotation: [0, Math.atan2(-dir.x, -dir.z), 0] }) // face the user
}

/** Floating component shelf, only in an XR session. Poke or pinch a row to drop that component in front of you. */
export function VRShelf() {
  const camera = useThree((s) => s.camera)
  return (
    <IfInSessionMode allow={["immersive-ar", "immersive-vr"]}>
      <group position={SHELF_POS} rotation={[0, SHELF_YAW, 0]}>
        <Container pixelSize={0.002} width={260} padding={12} gap={8} flexDirection="column" backgroundColor={STAGE} borderRadius={6}>
          <Container flexDirection="row" justifyContent="space-between" alignItems="center" paddingX={4}>
            <Text fontSize={20} fontWeight="bold" color={TEXT}>
              Spatial
            </Text>
            <Text fontSize={13} color={MUTED}>
              Tap to add
            </Text>
          </Container>
          <Container flexDirection="column" gap={4} maxHeight={360} overflow="scroll" scrollbarColor={MUTED} scrollbarWidth={4}>
            {groups.size === 0 && (
              <Text fontSize={14} color={MUTED} padding={4}>
                No components ready yet
              </Text>
            )}
            {[...groups].map(([category, entries]) => (
              <Fragment key={category}>
                <Text fontSize={12} color={MUTED} paddingX={4} paddingTop={8} flexShrink={0}>
                  {category.toUpperCase()}
                </Text>
                {entries.map((e) => (
                  // 44 px ≈ 9 cm: comfortably bigger than a fingertip.
                  <Container
                    key={e.name}
                    height={44}
                    flexShrink={0}
                    paddingX={12}
                    alignItems="center"
                    borderRadius={4}
                    backgroundColor={STAGE}
                    hover={{ backgroundColor: HOVER }}
                    active={{ backgroundColor: PRESSED }}
                    onClick={() => addInFront(camera, e.name)}
                  >
                    <Text fontSize={16} color={TEXT}>
                      {e.displayName}
                    </Text>
                  </Container>
                ))}
              </Fragment>
            ))}
          </Container>
        </Container>
      </group>
    </IfInSessionMode>
  )
}
