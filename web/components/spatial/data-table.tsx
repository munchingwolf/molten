"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { ArrowDown, ArrowUp, ArrowUpDown } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2" }
const STATUS: Record<string, string> = { Paid: "#86E0A6", Pending: "#F2B48A", Overdue: "#F0A6B8", Draft: "#9AA0AD" }
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

type Cell = string | number
type Row = { id: string } & Record<string, Cell>
type Column = { key: string; label: string; width?: number; align?: "left" | "right"; type?: "text" | "status" | "currency" | "date" }
type Dir = "asc" | "desc"
type Props = {
  columns?: Column[]
  rows?: Row[]
  title?: string
  /** column the rows are sorted by */
  value?: string
  onChange?: (sortKey: string, dir: Dir) => void
  onSelect?: (row: Row) => void
  accent?: string
}

const COLUMNS: Column[] = [
  { key: "customer", label: "Customer", width: 112 },
  { key: "status", label: "Status", width: 76, type: "status" },
  { key: "amount", label: "Amount", width: 72, align: "right", type: "currency" },
  { key: "date", label: "Date", width: 56, align: "right", type: "date" },
]
const ROWS: Row[] = [
  { id: "INV-1042", customer: "Acme Robotics", status: "Paid", amount: 4200, date: "2026-10-14" },
  { id: "INV-1041", customer: "Lumen Labs", status: "Pending", amount: 1850, date: "2026-10-12" },
  { id: "INV-1040", customer: "Orbit Audio", status: "Overdue", amount: 960, date: "2026-09-28" },
  { id: "INV-1039", customer: "Kite Studio", status: "Paid", amount: 12400, date: "2026-09-21" },
  { id: "INV-1038", customer: "Northwind", status: "Draft", amount: 3075, date: "2026-10-16" },
  { id: "INV-1037", customer: "Glass Rooms", status: "Paid", amount: 640, date: "2026-09-15" },
]

const money = (n: Cell) => `$${Number(n).toLocaleString("en-US")}`
const day = (s: Cell) => {
  const m = String(s).match(/^\d{4}-(\d{2})-(\d{2})/)
  return m ? `${MONTHS[+m[1] - 1]} ${+m[2]}` : String(s)
}

/** Sortable data table: tap a header to sort (tap again to flip), tap a row to select it. */
export default function DataTable({ columns = COLUMNS, rows = ROWS, title = "Invoices", value, onChange, onSelect, accent = C.accent }: Props) {
  const [sort, setSort] = useState<{ key: string; dir: Dir }>({ key: value ?? "date", dir: "desc" })
  const key = value ?? sort.key
  const [picked, setPicked] = useState<string | null>(null)
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const sorted = [...rows].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""))
    return sort.dir === "asc" ? c : -c
  })
  const amountKey = columns.find((c) => c.type === "currency")?.key
  const total = amountKey ? rows.reduce((n, r) => n + (Number(r[amountKey]) || 0), 0) : null

  const sortBy = (k: string) => {
    const dir: Dir = k === key && sort.dir === "asc" ? "desc" : "asc"
    setSort({ key: k, dir })
    onChange?.(k, dir)
  }

  const cell = (col: Column, v: Cell | undefined) => {
    if (col.type === "status") {
      const color = STATUS[String(v)] ?? C.muted
      return (
        <Container height={22} paddingX={8} borderRadius={6} flexDirection="row" alignItems="center" gap={5} backgroundColor={withOpacity(color, 0.14)}>
          <Container width={5} height={5} borderRadius={3} backgroundColor={color} />
          <Text fontSize={11} fontWeight="semi-bold" color={color}>
            {String(v ?? "")}
          </Text>
        </Container>
      )
    }
    const text = v === undefined ? "" : col.type === "currency" ? money(v) : col.type === "date" ? day(v) : String(v)
    return (
      <Text fontSize={13} fontWeight={col.type === "currency" ? "semi-bold" : "medium"} color={col.type === "date" ? C.muted : C.text}>
        {text}
      </Text>
    )
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      flexDirection="column"
      padding={12}
      gap={8}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={20}
      overflow="hidden"
    >
      <Container flexDirection="row" alignItems="center" gap={8} paddingX={8} paddingTop={4}>
        <Text fontSize={16} fontWeight="semi-bold" color={C.text}>
          {title}
        </Text>
        <Text flexGrow={1} fontSize={12} color={C.faint}>
          {`${rows.length} rows`}
        </Text>
      </Container>

      <Container flexDirection="column" borderRadius={12} overflow="hidden" borderWidth={1} borderColor={C.line}>
        <Container flexDirection="row" height={40} paddingX={10} backgroundColor={C.deep} alignItems="center">
          {columns.map((col) => {
            const on = col.key === key
            const Icon = on ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
            return (
              <Press
                key={col.key}
                width={col.width ?? 90}
                height={40}
                flexDirection="row"
                alignItems="center"
                justifyContent={col.align === "right" ? "flex-end" : "flex-start"}
                gap={4}
                onClick={() => sortBy(col.key)}
              >
                <Text fontSize={11} fontWeight="semi-bold" color={on ? C.text : C.muted} letterSpacing={0.5}>
                  {col.label.toUpperCase()}
                </Text>
                <Icon width={12} height={12} color={on ? accent : C.faint} />
              </Press>
            )
          })}
        </Container>
        {sorted.map((row, i) => {
          const sel = row.id === picked
          return (
            <Press
              key={row.id}
              flexDirection="row"
              height={44}
              paddingX={10}
              alignItems="center"
              borderTopWidth={i ? 1 : 0}
              borderColor={C.line}
              backgroundColor={sel ? withOpacity(accent, 0.12) : withOpacity("#FFFFFF", 0)}
              hover={{ backgroundColor: sel ? withOpacity(accent, 0.16) : withOpacity("#FFFFFF", 0.04) }}
              lift={1}
              onClick={() => {
                setPicked(row.id)
                onSelect?.(row)
              }}
            >
              {columns.map((col) => (
                <Container key={col.key} width={col.width ?? 90} flexDirection="row" justifyContent={col.align === "right" ? "flex-end" : "flex-start"}>
                  {cell(col, row[col.key])}
                </Container>
              ))}
            </Press>
          )
        })}
      </Container>

      {total !== null ? (
        <Container flexDirection="row" justifyContent="space-between" paddingX={18} paddingY={4}>
          <Text fontSize={12} color={C.muted}>
            Total
          </Text>
          <Text fontSize={14} fontWeight="semi-bold" color={C.text}>
            {money(total)}
          </Text>
        </Container>
      ) : null}
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, lift = 3, ...props }: ContainerProperties & { lift?: number }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.98 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? lift : 0, transformScaleX: k, transformScaleY: k })
  return (
    <Container ref={ref} cursor="pointer" {...props} {...s} onHoverChange={setHover} onActiveChange={setDown}>
      {children}
    </Container>
  )
}

/** uikit has no CSS transitions: spring numeric props toward `to` each frame. Spread the returned values on the Container too. */
function useSpring<T extends Record<string, number>>(to: T, from: Partial<T> = {}) {
  const ref = useRef<VanillaContainer>(null)
  const s = useRef<{ x: Record<string, number>; v: Record<string, number> }>(null)
  if (!s.current) s.current = { x: { ...to, ...from }, v: {} }
  useFrame((_, dt) => {
    const { x, v } = s.current!
    const h = Math.min(dt, 1 / 30)
    let moved = false
    for (const k in to) {
      if (x[k] === to[k] && !v[k]) continue
      v[k] = (v[k] ?? 0) + ((to[k] - x[k]) * 320 - (v[k] ?? 0) * 24) * h
      x[k] += v[k] * h
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) (x[k] = to[k]), (v[k] = 0)
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
