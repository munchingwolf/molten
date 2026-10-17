"use client"

import { useState } from "react"
import { Container, Text } from "@react-three/uikit"
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@react-three/uikit-default"
import { Trash2 } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", row: "#1B1E27", hover: "#262A35", border: "#323745", text: "#EEF0F4", muted: "#9AA0AD", danger: "#F2555A" }

type Props = {
  open?: boolean
  onChange?: (open: boolean) => void
  onConfirm?: () => void
  title?: string
  description?: string
  confirmLabel?: string
}

/**
 * Confirm-before-delete dialog (uikit default kit pieces). Shows a track row with a Delete button; pressing it swaps in the
 * confirmation. `open` + `onChange` control it, `onConfirm` fires on the destructive action. The kit's AlertDialog root
 * (a full-screen overlay that stops event propagation) is skipped so Studio selection still works.
 */
export default function AlertDialog({
  open,
  onChange,
  onConfirm,
  title = "Delete \"Bassline 2\"?",
  description = "This removes the track and its 14 clips from the session. You can't undo this.",
  confirmLabel = "Delete track",
}: Props) {
  const [inner, setInner] = useState(false)
  const isOpen = open ?? inner
  const set = (o: boolean) => {
    if (open === undefined) setInner(o)
    onChange?.(o)
  }

  return (
    <Container pixelSize={0.002} width={420} color={C.text}>
      {isOpen ? (
        // Our own onClick replaces the kit's default handlers, which stopPropagation and need the AlertDialog root.
        <AlertDialogContent onClick={() => {}} borderRadius={16} backgroundColor={C.panel} borderColor={C.border}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Text>{title}</Text>
            </AlertDialogTitle>
            <AlertDialogDescription color={C.muted}>
              <Text>{description}</Text>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter flexDirection="row" justifyContent="flex-end">
            <AlertDialogCancel
              onClick={() => set(false)}
              height={44}
              backgroundColor={C.row}
              borderColor={C.border}
              hover={{ backgroundColor: C.hover }}
            >
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onConfirm?.()
                set(false)
              }}
              height={44}
              backgroundColor={C.danger}
              hover={{ backgroundColor: "#FF6B70" }}
              color="#FFFFFF"
            >
              <Text>{confirmLabel}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : (
        <Container
          flexGrow={1}
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          padding={16}
          borderRadius={16}
          borderWidth={1}
          borderColor={C.border}
          backgroundColor={C.panel}
        >
          <Container flexDirection="column" gap={2}>
            <Text fontSize={15} fontWeight="medium">
              Bassline 2
            </Text>
            <Text fontSize={13} color={C.muted}>
              14 clips · 3:42
            </Text>
          </Container>
          <Button
            variant="destructive"
            onClick={() => set(true)}
            height={44}
            gap={8}
            backgroundColor={C.danger}
            hover={{ backgroundColor: "#FF6B70" }}
            color="#FFFFFF"
          >
            <Trash2 width={16} height={16} />
            <Text>Delete</Text>
          </Button>
        </Container>
      )}
    </Container>
  )
}
