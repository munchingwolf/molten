"use client"

import type { ReactNode } from "react"
import { IfInSessionMode } from "@react-three/xr"
import { Container, Text } from "@react-three/uikit"
import {
  Copy, Eye, EyeOff, Frame, Grid3x3, Orbit, Layers, Lock, LockOpen, Magnet, Minus, Plus, Redo2, RotateCcw, RotateCw, ScanEye, Trash2, Undo2,
} from "@react-three/uikit-lucide"
import { useStudio } from "@/lib/studio-store"
import { findEntry } from "@/lib/registry"
import type { Item, Vec3 } from "@/lib/layout"
import { PropControls } from "./prop-controls"
import { xr } from "./xr-theme"
import { useWheel } from "./vr-wheel"

// Cockpit layout around where the session starts (user at the origin, eyes ≈ 1.6 m):
// library shelf on the left (vr-shelf.tsx), toolbar ahead above eye line, inspector + layers on the right.
const TOOLBAR_POS: Vec3 = [0, 1.62, -0.7]
const RIGHT_POS: Vec3 = [0.55, 1.15, -0.45]
const RIGHT_YAW = Math.atan2(-RIGHT_POS[0], -RIGHT_POS[2])
const STEP = 0.05 // metres per nudge
const TURN = Math.PI / 12 // 15° per rotate

/** Figma-style editing UI inside the headset. Mount inside <XR>; renders only in a session. */
export function VRWorkspace() {
  return (
    <IfInSessionMode allow={["immersive-ar", "immersive-vr"]}>
      <group position={TOOLBAR_POS} rotation={[0.12, 0, 0]}>
        <Toolbar />
      </group>
      <group position={RIGHT_POS} rotation={[0, RIGHT_YAW, 0]}>
        <Container pixelSize={0.002} width={300} flexDirection="column" gap={10}>
          <Inspector />
          <LayersPanel />
        </Container>
      </group>
    </IfInSessionMode>
  )
}

function Toolbar() {
  const s = useStudio()
  const has = s.selectedIds.length > 0
  const wheel = useWheel()
  return (
    <Panel flexDirection="row" alignItems="center" gap={6} padding={8}>
      <Tool label="Component wheel" onClick={wheel.toggle} active={wheel.open}><Orbit {...icon} /></Tool>
      <Divider />
      <Tool label="Undo" onClick={s.undo} disabled={!s.past.length}><Undo2 {...icon} /></Tool>
      <Tool label="Redo" onClick={s.redo} disabled={!s.future.length}><Redo2 {...icon} /></Tool>
      <Divider />
      <Tool label="Duplicate" onClick={() => s.duplicate()} disabled={!has}><Copy {...icon} /></Tool>
      <Tool label="Frame" onClick={() => s.groupIntoFrame()} disabled={!has}><Frame {...icon} /></Tool>
      <Tool label="Delete" onClick={s.removeSelected} disabled={!has}><Trash2 {...icon} /></Tool>
      <Divider />
      <Tool label="Grid" onClick={s.toggleGrid} active={s.showGrid}><Grid3x3 {...icon} /></Tool>
      <Tool label="Snap" onClick={s.toggleSnap} active={s.snap}><Magnet {...icon} /></Tool>
      <Tool label="X-ray" onClick={() => s.setViewMode(s.viewMode === "xray" ? "design" : "xray")} active={s.viewMode === "xray"}>
        <ScanEye {...icon} />
      </Tool>
      <Divider />
      <Container paddingX={10} flexDirection="column">
        <Text fontSize={11} color={xr.faint}>SCENE</Text>
        <Text fontSize={14} color={xr.text}>{s.scenes.find((sc) => sc.id === s.sceneId)?.name ?? "Scene 1"}</Text>
      </Container>
    </Panel>
  )
}

function Inspector() {
  const { items, selectedId, selectedIds, update } = useStudio()
  const item = items.find((i) => i.id === selectedId)
  if (!item) {
    return (
      <Panel flexDirection="column" gap={6} padding={16}>
        <Text fontSize={16} fontWeight="bold" color={xr.text}>Inspector</Text>
        <Text fontSize={13} color={xr.muted}>Tap a component or a layer to edit it.</Text>
      </Panel>
    )
  }
  const nudge = (axis: 0 | 1 | 2, d: number) => {
    const p = [...item.position] as Vec3
    p[axis] = Math.round((p[axis] + d) * 1000) / 1000
    update(item.id, { position: p })
  }
  const turn = (d: number) => update(item.id, { rotation: [item.rotation[0], item.rotation[1] + d, item.rotation[2]] })
  const tilt = (d: number) => update(item.id, { rotation: [item.rotation[0] + d, item.rotation[1], item.rotation[2]] })
  const scale = (d: number) => update(item.id, { scale: Math.max(0.2, Math.round((item.scale + d) * 10) / 10) })
  const anchor = item.anchor ?? "world"

  return (
    <Panel flexDirection="column" gap={12} padding={16}>
      <Container flexDirection="row" justifyContent="space-between" alignItems="center">
        <Container flexDirection="column">
          <Text fontSize={17} fontWeight="bold" color={xr.text}>{label(item)}</Text>
          <Text fontSize={12} color={xr.faint}>{selectedIds.length > 1 ? `${selectedIds.length} selected` : item.component}</Text>
        </Container>
        <Container flexDirection="row" gap={6}>
          <Tool label={item.hidden ? "Show" : "Hide"} onClick={() => update(item.id, { hidden: !item.hidden })} small>
            {item.hidden ? <EyeOff {...iconSm} /> : <Eye {...iconSm} />}
          </Tool>
          <Tool label={item.locked ? "Unlock" : "Lock"} onClick={() => update(item.id, { locked: !item.locked })} active={item.locked} small>
            {item.locked ? <Lock {...iconSm} /> : <LockOpen {...iconSm} />}
          </Tool>
        </Container>
      </Container>

      {(["X", "Y", "Z"] as const).map((a, k) => (
        <Stepper key={a} label={a} value={`${item.position[k].toFixed(2)} m`} onMinus={() => nudge(k as 0 | 1 | 2, -STEP)} onPlus={() => nudge(k as 0 | 1 | 2, STEP)} />
      ))}
      <Stepper label="Scale" value={`${item.scale.toFixed(1)}×`} onMinus={() => scale(-0.1)} onPlus={() => scale(0.1)} />
      <Container flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text fontSize={13} color={xr.muted}>Turn</Text>
        <Container flexDirection="row" gap={6}>
          <Tool label="Left" onClick={() => turn(TURN)} small><RotateCcw {...iconSm} /></Tool>
          <Tool label="Right" onClick={() => turn(-TURN)} small><RotateCw {...iconSm} /></Tool>
        </Container>
      </Container>
      <Container flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text fontSize={13} color={xr.muted}>Tilt</Text>
        <Container flexDirection="row" gap={6}>
          <Tool label="Back" onClick={() => tilt(-TURN)} small><RotateCcw {...iconSm} /></Tool>
          <Tool label="Forward" onClick={() => tilt(TURN)} small><RotateCw {...iconSm} /></Tool>
        </Container>
      </Container>

      <Container flexDirection="column" gap={6}>
        <Text fontSize={13} color={xr.muted}>Anchor</Text>
        <Container flexDirection="row" gap={4} padding={4} borderRadius={xr.radius.md} backgroundColor={xr.bg}>
          {(["world", "head", "wrist"] as const).map((a) => (
            <Chip key={a} active={anchor === a} onClick={() => update(item.id, { anchor: a })}>{a}</Chip>
          ))}
        </Container>
      </Container>
      {/* Live property editing (colour, label, size…) from the component's registry `props`. */}
      <PropControls item={item} />
    </Panel>
  )
}

function LayersPanel() {
  const { items, selectedIds, select } = useStudio()
  // Depth-first: top-level items, each followed by its frame children (indented).
  const rows: { item: Item; depth: number }[] = []
  const walk = (parentId: string | undefined, depth: number) => {
    for (const i of items) if (i.parentId === parentId) (rows.push({ item: i, depth }), walk(i.id, depth + 1))
  }
  walk(undefined, 0)

  return (
    <Panel flexDirection="column" gap={8} padding={12}>
      <Container flexDirection="row" alignItems="center" gap={8} paddingX={4}>
        <Layers {...iconSm} color={xr.muted} />
        <Text fontSize={15} fontWeight="bold" color={xr.text}>Layers</Text>
        <Text fontSize={12} color={xr.faint} marginLeft="auto">{`${items.length}`}</Text>
      </Container>
      <Container flexDirection="column" gap={4} maxHeight={260} overflow="scroll" scrollbarColor={xr.faint} scrollbarWidth={4}>
        {rows.length === 0 && <Text fontSize={13} color={xr.muted} padding={4}>Add something from the shelf on your left.</Text>}
        {rows.map(({ item, depth }) => {
          const on = selectedIds.includes(item.id)
          return (
            <Container
              key={item.id}
              height={xr.hit}
              flexShrink={0}
              paddingLeft={12 + depth * 18}
              paddingRight={12}
              flexDirection="row"
              alignItems="center"
              gap={8}
              borderRadius={xr.radius.sm}
              backgroundColor={on ? xr.rowHover : xr.row}
              borderWidth={on ? 1.5 : 0}
              borderColor={xr.accent}
              hover={{ backgroundColor: xr.rowHover }}
              active={{ backgroundColor: xr.rowActive }}
              // Hands have no shift key: tapping a second row adds to the selection, tapping a selected row toggles it off.
              onClick={() => select(item.id, selectedIds.length > 0)}
            >
              {item.component === "frame" ? <Frame {...iconSm} color={xr.muted} /> : null}
              <Text fontSize={14} color={item.hidden ? xr.faint : xr.text}>{label(item)}</Text>
              {item.locked && <Lock {...iconSm} color={xr.faint} marginLeft="auto" />}
            </Container>
          )
        })}
      </Container>
      {selectedIds.length > 0 && (
        <Container height={36} alignItems="center" justifyContent="center" borderRadius={xr.radius.sm} hover={{ backgroundColor: xr.rowHover }} onClick={() => select(null)}>
          <Text fontSize={13} color={xr.muted}>Clear selection</Text>
        </Container>
      )}
    </Panel>
  )
}

/* ---------- building blocks (night-studio look, finger-sized) ---------- */

const icon = { width: 22, height: 22, color: xr.text }
const iconSm = { width: 18, height: 18, color: xr.text }
const label = (i: Item) => i.name ?? findEntry(i.component)?.displayName ?? i.component

function Panel({ children, ...rest }: { children: ReactNode } & Parameters<typeof Container>[0]) {
  return (
    <Container backgroundColor={xr.panel} borderRadius={xr.radius.lg} borderWidth={1.5} borderColor={xr.border} {...rest}>
      {children}
    </Container>
  )
}

/** `label` names the action at the call site (uikit has no title/aria attribute to put it on). */
function Tool({ children, onClick, active, disabled, small }: {
  children: ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean; small?: boolean
}) {
  const size = small ? 36 : xr.hit + 4
  return (
    <Container
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      borderRadius={xr.radius.md}
      backgroundColor={active ? xr.accent : xr.row}
      opacity={disabled ? 0.35 : 1}
      hover={disabled ? {} : { backgroundColor: active ? xr.accent : xr.rowHover }}
      active={disabled ? {} : { backgroundColor: xr.rowActive }}
      onClick={disabled ? undefined : onClick}
      cursor={disabled ? undefined : "pointer"}
    >
      {children}
    </Container>
  )
}

function Divider() {
  return <Container width={1.5} height={28} marginX={4} backgroundColor={xr.border} />
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <Container flexDirection="row" justifyContent="space-between" alignItems="center">
      <Text fontSize={13} color={xr.muted} width={52}>{label}</Text>
      <Container flexDirection="row" alignItems="center" gap={8}>
        <Tool label={`${label} down`} onClick={onMinus} small><Minus {...iconSm} /></Tool>
        <Text fontSize={14} color={xr.text} width={70} textAlign="center">{value}</Text>
        <Tool label={`${label} up`} onClick={onPlus} small><Plus {...iconSm} /></Tool>
      </Container>
    </Container>
  )
}

function Chip({ children, active, onClick }: { children: string; active: boolean; onClick: () => void }) {
  return (
    <Container
      flexGrow={1}
      height={36}
      alignItems="center"
      justifyContent="center"
      borderRadius={xr.radius.sm}
      backgroundColor={active ? xr.accent : xr.bg}
      hover={{ backgroundColor: active ? xr.accent : xr.rowHover }}
      onClick={onClick}
    >
      <Text fontSize={13} color={active ? xr.onAccent : xr.muted}>{children}</Text>
    </Container>
  )
}
