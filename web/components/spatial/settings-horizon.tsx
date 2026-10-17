"use client"

import { Container, Text } from "@react-three/uikit"
import { Panel, Slider, Toggle } from "@react-three/uikit-horizon"

export default function SettingsHorizon() {
  return (
    <Panel pixelSize={0.002} width={360} flexDirection="column" gap={20} padding={24}>
      <Text fontSize={22} fontWeight="bold">
        Settings
      </Text>
      <Row label="Master volume">
        <Slider defaultValue={70} max={100} width={150} />
      </Row>
      <Row label="Reverb">
        <Slider defaultValue={30} max={100} width={150} />
      </Row>
      <Row label="Tempo">
        <Slider defaultValue={120} min={60} max={180} width={150} />
      </Row>
      <Row label="Haptics">
        <Toggle defaultChecked />
      </Row>
    </Panel>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Container flexDirection="row" justifyContent="space-between" alignItems="center">
      <Text fontSize={14}>{label}</Text>
      {children}
    </Container>
  )
}
