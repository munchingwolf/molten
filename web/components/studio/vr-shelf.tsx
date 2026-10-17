"use client"

import { Fragment } from "react"
import { useThree } from "@react-three/fiber"
import { IfInSessionMode } from "@react-three/xr"
import { Container, Text } from "@react-three/uikit"
import { Vector3, type Camera } from "three"
import { registry, type Entry } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import type { Vec3 } from "@/lib/layout"

import { xr } from "./xr-theme"

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
        <Container
          pixelSize={0.002}
          width={280}
          padding={16}
          gap={12}
          flexDirection="column"
          backgroundColor={xr.panel}
          borderRadius={xr.radius.lg}
          borderWidth={1.5}
          borderColor={xr.border}
        >
          <Container flexDirection="row" justifyContent="space-between" alignItems="center" paddingX={4}>
            <Container flexDirection="row" alignItems="center" gap={8}>
              <Container width={10} height={10} borderRadius={5} backgroundColor={xr.accent} />
              <Text fontSize={20} fontWeight="bold" color={xr.text}>
                Spatial
              </Text>
            </Container>
            <Text fontSize={13} color={xr.muted}>
              Tap to add
            </Text>
          </Container>
          <Container flexDirection="column" gap={6} maxHeight={380} overflow="scroll" scrollbarColor={xr.faint} scrollbarWidth={4}>
            {groups.size === 0 && (
              <Text fontSize={14} color={xr.muted} padding={4}>
                No components ready yet
              </Text>
            )}
            {[...groups].map(([category, entries]) => (
              <Fragment key={category}>
                <Text fontSize={12} color={xr.faint} letterSpacing={1} paddingX={4} paddingTop={10} flexShrink={0}>
                  {category.toUpperCase()}
                </Text>
                {entries.map((e) => (
                  <Container
                    key={e.name}
                    height={xr.hit}
                    flexShrink={0}
                    paddingX={14}
                    flexDirection="row"
                    alignItems="center"
                    justifyContent="space-between"
                    borderRadius={xr.radius.md}
                    backgroundColor={xr.row}
                    hover={{ backgroundColor: xr.rowHover }}
                    active={{ backgroundColor: xr.rowActive }}
                    onClick={() => addInFront(camera, e.name)}
                  >
                    <Text fontSize={16} color={xr.text}>
                      {e.displayName}
                    </Text>
                    <Text fontSize={18} color={xr.accent}>
                      +
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
