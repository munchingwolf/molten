"use client"

import { useEffect, useRef } from "react"
import { Container, Text } from "@react-three/uikit"
import {
  Accordion as KitAccordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AccordionTriggerIcon,
  type VanillaAccordion,
} from "@react-three/uikit-default"

const C = { panel: "#15171E", hover: "#262A35", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD" }

const ITEMS = [
  { id: "move", q: "How do I move a panel?", a: "Pinch its grab bar and drag. Let go to drop it where it is." },
  { id: "voice", q: "Can I edit by voice?", a: "Hold the mic button and say what to change, like \"make the mixer wider\"." },
  { id: "share", q: "How do I share a layout?", a: "Press Publish. Anyone with the link can open it in a browser or a headset." },
]

type Props = { value?: string; onChange?: (v: string) => void; title?: string }

/** FAQ-style accordion (uikit default kit). `value` is the open item id ("move" | "voice" | "share", "" = all closed). Controlled or uncontrolled. */
export default function Accordion({ value, onChange, title = "Studio help" }: Props) {
  const ref = useRef<VanillaAccordion>(null)
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }

  // The kit keeps the open item in its own signal; push our value into it (uncontrolled: open the first item once).
  useEffect(() => {
    if (ref.current) ref.current.openItemValue.value = (value ?? ITEMS[0].id) || undefined
  }, [value])

  useEffect(() => {
    const a = ref.current
    if (!a) return
    let first = true
    return a.openItemValue.subscribe((v) => {
      if (first) return void (first = false)
      if ((v ?? "") !== (latest.current.value ?? "")) latest.current.onChange?.(v ?? "")
    })
  }, [])

  return (
    <Container
      pixelSize={0.002}
      width={380}
      flexDirection="column"
      padding={20}
      gap={8}
      borderRadius={16}
      borderWidth={1}
      borderColor={C.border}
      backgroundColor={C.panel}
      color={C.text}
    >
      <Text fontSize={16} fontWeight="semi-bold">
        {title}
      </Text>
      <KitAccordion ref={ref}>
        {ITEMS.map((it) => (
          <AccordionItem key={it.id} value={it.id} borderColor={C.border}>
            <AccordionTrigger paddingX={8} borderRadius={8} hover={{ backgroundColor: C.hover }}>
              <Text>{it.q}</Text>
              <AccordionTriggerIcon color={C.muted} />
            </AccordionTrigger>
            <AccordionContent paddingX={8}>
              <Text color={C.muted}>{it.a}</Text>
            </AccordionContent>
          </AccordionItem>
        ))}
      </KitAccordion>
    </Container>
  )
}
