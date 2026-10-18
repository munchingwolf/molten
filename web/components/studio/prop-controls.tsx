"use client"

// Live property editing for the selected item, generated from its registry `props` metadata
// (color swatches, enum chips, number steppers, on/off). Extracted from vr-dock.tsx so any in-headset inspector can use it.
import type { ReactNode } from "react"
import { Container, Text, type ContainerProperties } from "@react-three/uikit"
import { Minus, Plus } from "@react-three/uikit-lucide"
import { findEntry } from "@/lib/registry"
import { useStudio } from "@/lib/studio-store"
import type { Item } from "@/lib/layout"
import { xr } from "./xr-theme"

const SWATCHES = ["#9FE7D2", "#7DB4FF", "#C9A7FF", "#F58BB0", "#F2B48A", "#EEF0F4"]
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type PropMeta = { name: string; type?: string; options?: (string | number)[]; min?: number; max?: number; step?: number; default?: unknown }
export const propsOf = (component: string): PropMeta[] => {
  const p = (findEntry(component) as { props?: unknown } | undefined)?.props
  return Array.isArray(p) ? p.filter((m): m is PropMeta => !!m && typeof m.name === "string") : []
}

/** Every editable property of `item`, or nothing if its component declares none. */
export function PropControls({ item }: { item: Item }) {
  const metas = propsOf(item.component)
  if (!metas.length) return null
  return (
    <>
      <Section>Properties</Section>
      {metas.map((m) => (
        <PropControl key={m.name} item={item} meta={m} />
      ))}
    </>
  )
}

export function PropControl({ item, meta: m }: { item: Item; meta: PropMeta }) {
  const value = item.props?.[m.name] ?? m.default
  const set = (v: unknown) => useStudio.getState().update(item.id, { props: { ...item.props, [m.name]: v } })
  const label = title(m.name)

  if (m.type === "color")
    return (
      <Block label={label}>
        {SWATCHES.map((c) => (
          <Container
            key={c}
            width={44}
            height={44}
            borderRadius={22}
            alignItems="center"
            justifyContent="center"
            borderWidth={3}
            borderColor={String(value).toLowerCase() === c.toLowerCase() ? xr.text : xr.panel}
            hover={{ borderColor: xr.muted }}
            onClick={() => set(c)}
          >
            <Container width={32} height={32} borderRadius={16} backgroundColor={c} />
          </Container>
        ))}
      </Block>
    )
  if (m.type === "boolean")
    return (
      <Field label={label}>
        <Btn flexGrow={1} on={value === true} onClick={() => set(value !== true)}>
          <Text fontSize={14}>{value === true ? "On" : "Off"}</Text>
        </Btn>
      </Field>
    )
  if (Array.isArray(m.options) && m.options.length > 0)
    return (
      <Block label={label}>
        {m.options.map((o) => (
          <Btn key={String(o)} on={value === o} onClick={() => set(o)}>
            <Text fontSize={14}>{String(o)}</Text>
          </Btn>
        ))}
      </Block>
    )
  if (m.type === "number") {
    const v = typeof value === "number" ? value : 0
    const ints = [m.min, m.max, m.default].every((x) => x === undefined || Number.isInteger(x))
    const span = m.min !== undefined && m.max !== undefined ? m.max - m.min : undefined
    const raw = m.step ?? (span !== undefined ? span / 20 : ints ? 1 : Math.max(Math.abs(v) / 10, 0.01))
    const step = ints ? Math.max(1, Math.round(raw)) : raw
    const clamp = (n: number) => Math.round(Math.min(m.max ?? Infinity, Math.max(m.min ?? -Infinity, n)) * 1000) / 1000
    return (
      <Field label={label}>
        <Btn width={52} dim={m.min !== undefined && v <= m.min} onClick={() => set(clamp(v - step))}><Minus width={20} height={20} /></Btn>
        <Text flexGrow={1} textAlign="center" fontSize={16}>{fmt(v)}</Text>
        <Btn width={52} dim={m.max !== undefined && v >= m.max} onClick={() => set(clamp(v + step))}><Plus width={20} height={20} /></Btn>
      </Field>
    )
  }
  return (
    <Field label={label}>
      <Text flexGrow={1} flexShrink={1} fontSize={14} color={xr.muted}>
        {value === undefined || value === null ? "not set" : String(value)}
      </Text>
    </Field>
  )
}

type BtnProps = Pick<ContainerProperties, "width" | "flexGrow" | "flexShrink" | "justifyContent" | "paddingX" | "paddingLeft" | "color"> & {
  children: ReactNode
  onClick?: () => void
  /** Selected / toggled on: mint fill. */
  on?: boolean
  /** Nothing to do right now: faint and inert. */
  dim?: boolean
}

/** 44 px tall hit target (≥ 4.4 cm) with hover/press feedback. */
function Btn({ children, onClick, on, dim, color, ...layout }: BtnProps) {
  return (
    <Container
      height={44}
      minWidth={44}
      flexShrink={0}
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      gap={8}
      paddingX={12}
      borderRadius={xr.radius.md}
      backgroundColor={on ? xr.accent : xr.row}
      color={on ? xr.onAccent : dim ? xr.faint : (color ?? xr.text)}
      hover={dim || on ? {} : { backgroundColor: xr.rowHover }}
      active={dim ? {} : { backgroundColor: on ? xr.accent : xr.rowActive, transformTranslateZ: -2 }}
      onClick={dim ? undefined : onClick}
      {...layout}
    >
      {children}
    </Container>
  )
}

/** Label on the left, controls in a row on the right. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Container flexDirection="row" alignItems="center" gap={6} flexShrink={0}>
      <Text width={72} fontSize={14} color={xr.muted} paddingLeft={4}>
        {label}
      </Text>
      <Container flexGrow={1} flexShrink={1} flexDirection="row" alignItems="center" gap={6}>
        {children}
      </Container>
    </Container>
  )
}

/** Label above, controls wrapping below (swatches, chips). */
function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Container flexDirection="column" gap={6} flexShrink={0}>
      <Text fontSize={14} color={xr.muted} paddingLeft={4} paddingTop={4}>
        {label}
      </Text>
      <Container flexDirection="row" flexWrap="wrap" gap={6}>
        {children}
      </Container>
    </Container>
  )
}

function Section({ children }: { children: string }) {
  return (
    <Text fontSize={14} color={xr.faint} letterSpacing={1} paddingX={4} paddingTop={10} flexShrink={0}>
      {children.toUpperCase()}
    </Text>
  )
}

