"use client"

import { Container, Text } from "@react-three/uikit"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Slider, Switch } from "@react-three/uikit-default"

export default function SettingsDefault() {
  return (
    <Card pixelSize={0.002} width={360} flexDirection="column">
      <CardHeader>
        <CardTitle>
          <Text>Settings</Text>
        </CardTitle>
        <CardDescription>
          <Text>Sound and feel</Text>
        </CardDescription>
      </CardHeader>
      <CardContent flexDirection="column" gap={20}>
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
          <Switch defaultChecked />
        </Row>
      </CardContent>
    </Card>
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
