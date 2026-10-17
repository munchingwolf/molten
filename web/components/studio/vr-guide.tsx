"use client"

import type { ReactNode } from "react"
import { IfInSessionMode } from "@react-three/xr"
import { Container, Text } from "@react-three/uikit"
import { useStudio } from "@/lib/studio-store"
import type { Vec3 } from "@/lib/layout"
import { slotLabel, useGuideProgress, useTemplates } from "./slot-guides"
import { xr } from "./xr-theme"

// Far right of the cockpit, past the inspector (vr-workspace RIGHT_POS ends near x 0.74, z -0.22) and clear of the
// assistant (follows 35 deg right of gaze at 0.7 m). Angled to face the user at the origin.
const POS: Vec3 = [0.66, 1.3, 0.12]
const YAW = Math.atan2(-POS[0], -POS[2])
const WARM = "#F2B48A"
const PX = 0.0015 // 48 px buttons = 7.2 cm

/** Template Library + guide progress in the headset. Mount inside <XR>; renders only in a session. */
export function VRGuide() {
  return (
    <IfInSessionMode allow={["immersive-ar", "immersive-vr"]}>
      <group position={POS} rotation={[0, YAW, 0]}>
        <Container
          pixelSize={PX}
          width={320}
          flexDirection="column"
          gap={10}
          padding={16}
          backgroundColor={xr.panel}
          borderRadius={xr.radius.lg}
          borderWidth={1.5}
          borderColor={xr.border}
        >
          <GuideBody />
        </Container>
      </group>
    </IfInSessionMode>
  )
}

function GuideBody() {
  const p = useGuideProgress()
  const templates = useTemplates()
  const playMode = useStudio((s) => s.playMode)
  if (!p) {
    return (
      <>
        <Text fontSize={18} fontWeight="bold" color={xr.text}>Templates</Text>
        <Text fontSize={13} color={xr.muted}>Guide shows where each part goes. Insert drops them all.</Text>
        {templates.map((t) => (
          <Container key={t.id ?? t.name} flexDirection="row" alignItems="center" gap={8} padding={8} borderRadius={xr.radius.md} backgroundColor={xr.row}>
            <Container flexDirection="column" flexGrow={1} flexShrink={1}>
              <Text fontSize={15} color={xr.text}>{t.name}</Text>
              <Text fontSize={12} color={xr.faint}>{`${t.items.length} parts`}</Text>
            </Container>
            <Btn onClick={() => useStudio.getState().startGuide(t)} primary>Guide</Btn>
            <Btn onClick={() => useStudio.getState().insertAll(t)}>Insert</Btn>
          </Container>
        ))}
      </>
    )
  }
  const done = !p.next
  return (
    <>
      <Text fontSize={13} color={xr.faint}>{p.name.toUpperCase()}</Text>
      <Text fontSize={22} fontWeight="bold" color={xr.text}>{`${p.placed}/${p.total} placed`}</Text>
      <Container height={8} borderRadius={4} backgroundColor={xr.row}>
        <Container height={8} borderRadius={4} width={`${Math.round((p.placed / Math.max(1, p.total)) * 100)}%`} backgroundColor={xr.accent} />
      </Container>
      <Text fontSize={15} color={done ? xr.accent : WARM}>{done ? "All placed. Press Play and jam." : `Next: ${slotLabel(p.next!)}`}</Text>
      {done ? (
        <Btn onClick={() => useStudio.getState().togglePlay()} primary big>{playMode ? "Back to edit" : "Play"}</Btn>
      ) : (
        <Btn onClick={() => useStudio.getState().placeSlot(p.next!.id)} primary big>Place next</Btn>
      )}
      <Btn onClick={() => useStudio.getState().endGuide()}>Exit guide</Btn>
    </>
  )
}

function Btn({ children, onClick, primary, big }: { children: ReactNode; onClick: () => void; primary?: boolean; big?: boolean }) {
  return (
    <Container
      height={big ? 64 : 48}
      paddingX={16}
      alignItems="center"
      justifyContent="center"
      borderRadius={xr.radius.md}
      backgroundColor={primary ? xr.accent : xr.row}
      hover={{ backgroundColor: primary ? "#B8F0E0" : xr.rowHover }}
      active={{ backgroundColor: xr.rowActive }}
      cursor="pointer"
      onClick={onClick}
    >
      <Text fontSize={big ? 20 : 15} fontWeight="bold" color={primary ? xr.onAccent : xr.text}>{children}</Text>
    </Container>
  )
}
