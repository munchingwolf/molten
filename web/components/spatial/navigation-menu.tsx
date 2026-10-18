// Ported from pmndrs/uikit examples/dashboard (MIT, © 2024 Bela Bohlender): MainNav, TeamSwitcher and UserNav, rebuilt and extended for Spatial.
"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Image, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import {
  ArrowRight,
  Bell,
  BookOpen,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronsUpDown,
  CreditCard,
  LifeBuoy,
  LogIn,
  LogOut,
  Newspaper,
  Plug,
  Plus,
  Search,
  Settings,
  Sparkles,
  User,
  Workflow,
} from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", card: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", danger: "#F0A6B8" }
const GAP = 3

type Props = {
  /** active nav link index */
  value?: number
  onChange?: (index: number) => void
  /** fired when an item in any dropdown is picked */
  onSelect?: (item: string) => void
  /** nav link labels; the third one opens the mega menu */
  links?: string[]
  accent?: string
}

const LINKS = ["Overview", "Customers", "Products", "Settings"]
const MEGA = 2
const TEAMS = [
  { group: "Personal Account", items: [{ name: "Alicia Koch", plan: "Personal", tint: "#B9B4F5" }] },
  {
    group: "Teams",
    items: [
      { name: "Acme Inc.", plan: "Pro plan", tint: "#9FE7D2" },
      { name: "Monsters Inc.", plan: "Free plan", tint: "#F2B48A" },
    ],
  },
]
const PRODUCTS = [
  {
    group: "Platform",
    items: [
      { icon: ChartColumn, label: "Analytics", desc: "Live metrics & dashboards" },
      { icon: Workflow, label: "Automations", desc: "Hands-off workflows" },
      { icon: Plug, label: "Integrations", desc: "Connect 80+ tools" },
    ],
  },
  {
    group: "Resources",
    items: [
      { icon: BookOpen, label: "Docs", desc: "Guides & API reference" },
      { icon: Newspaper, label: "Changelog", desc: "What shipped this week" },
      { icon: LifeBuoy, label: "Support", desc: "Talk to a human" },
    ],
  },
]
const NOTES = [
  { title: "Your call has been confirmed.", time: "1 hour ago" },
  { title: "You have a new message!", time: "1 hour ago" },
  { title: "Your subscription is expiring soon!", time: "2 hours ago" },
]
const USER_ITEMS = [
  { icon: User, label: "Profile" },
  { icon: CreditCard, label: "Billing" },
  { icon: Settings, label: "Settings" },
]

type Menu = "team" | "products" | "bell" | "user" | null
const initials = (n: string) =>
  n
    .replace(/ Inc\.$/, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
// shortcut: width estimated from label length (13 px semi-bold ≈ 7.2 px/char); measure text if labels get exotic
const linkWidth = (label: string, i: number) => Math.round(label.length * 7.2 + 18 + (i === MEGA ? 16 : 0))

/** Website top bar: team switcher, nav links with a springy active pill, a Products mega menu, search, notifications and a user menu. Tap to open a dropdown, tap again or pick an item to close it. */
export default function NavigationMenu({ value, onChange, onSelect, links = LINKS, accent = C.accent }: Props) {
  const [inner, setInner] = useState(0)
  const active = Math.max(0, Math.min(links.length - 1, Math.round(value ?? inner)))
  const [menu, setMenu] = useState<Menu>(null)
  const [team, setTeam] = useState("Acme Inc.")
  const [unread, setUnread] = useState([true, true, true])
  const [search, setSearch] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const widths = links.map(linkWidth)
  const lefts = widths.map((_, i) => widths.slice(0, i).reduce((a, w) => a + w + GAP, 0))
  const [pill, pillS] = useSpring({ transformTranslateX: lefts[active], width: widths[active] })
  const current = TEAMS.flatMap((g) => g.items).find((t) => t.name === team) ?? TEAMS[1].items[0]
  const count = unread.filter(Boolean).length

  const go = (i: number) => {
    if (value === undefined) setInner(i)
    onChange?.(i)
  }
  const toggle = (m: Menu) => {
    setSearch(false)
    setMenu((o) => (o === m ? null : m))
  }
  const pick = (item: string) => {
    setMenu(null)
    onSelect?.(item)
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={720}
      height={64}
      flexDirection="row"
      alignItems="center"
      paddingX={12}
      gap={6}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={18}
    >
      {/* team switcher */}
      <Press
        width={142}
        height={40}
        flexShrink={0}
        flexDirection="row"
        alignItems="center"
        gap={8}
        paddingX={7}
        borderRadius={11}
        borderWidth={1}
        borderColor={menu === "team" ? withOpacity(accent, 0.5) : C.line}
        backgroundColor={menu === "team" ? C.hover : C.deep}
        hover={{ backgroundColor: C.hover }}
        onClick={() => toggle("team")}
      >
        <Logo name={current.name} tint={current.tint} size={26} />
        <Container flexDirection="column" flexGrow={1} flexShrink={1}>
          <Text fontSize={12} fontWeight="semi-bold" color={C.text}>
            {current.name}
          </Text>
          <Text fontSize={9} color={C.faint}>
            {current.plan}
          </Text>
        </Container>
        <ChevronsUpDown width={14} height={14} color={C.muted} />
      </Press>

      {/* nav links with a sliding pill */}
      <Container flexDirection="row" alignItems="center" gap={GAP} height={36} flexShrink={0}>
        <Container
          ref={pill}
          {...pillS}
          positionType="absolute"
          positionLeft={0}
          positionTop={0}
          height={36}
          borderRadius={10}
          backgroundColor={withOpacity(accent, 0.12)}
          flexDirection="column"
          alignItems="center"
          justifyContent="flex-end"
        >
          <Container width={16} height={3} borderRadius={2} marginBottom={3} backgroundColor={accent} />
        </Container>
        {links.map((l, i) => {
          const on = i === active
          const mega = i === MEGA
          const open = mega && menu === "products"
          return (
            <Press
              key={l + i}
              width={widths[i]}
              height={36}
              borderRadius={10}
              flexDirection="row"
              alignItems="center"
              justifyContent="center"
              gap={4}
              lift={2}
              backgroundColor={withOpacity("#FFFFFF", 0)}
              hover={{ backgroundColor: on ? withOpacity("#FFFFFF", 0) : withOpacity("#FFFFFF", 0.04) }}
              onClick={() => {
                go(i)
                if (mega) toggle("products")
                else setMenu(null)
              }}
            >
              <Text fontSize={13} fontWeight="semi-bold" color={on ? C.text : C.muted}>
                {l}
              </Text>
              {mega ? <ChevronDown width={12} height={12} color={open ? accent : C.faint} transformRotateZ={open ? 180 : 0} /> : null}
            </Press>
          )
        })}
      </Container>

      <Container flexGrow={1} />

      {/* search field look */}
      <Press
        width={104}
        height={34}
        flexShrink={0}
        flexDirection="row"
        alignItems="center"
        gap={6}
        paddingX={9}
        borderRadius={10}
        borderWidth={1}
        lift={1}
        borderColor={search ? accent : C.line}
        backgroundColor={C.deep}
        hover={{ borderColor: search ? accent : C.border }}
        onClick={() => {
          setMenu(null)
          setSearch((s) => !s)
        }}
      >
        <Search width={13} height={13} color={search ? accent : C.faint} />
        {search ? <Container width={1.5} height={14} backgroundColor={accent} /> : null}
        <Text flexGrow={1} fontSize={11} color={search ? C.muted : C.faint}>
          {search ? "Type..." : "Search..."}
        </Text>
        <Container paddingX={5} height={17} borderRadius={4} borderWidth={1} borderColor={C.border} alignItems="center" justifyContent="center">
          <Text fontSize={9} fontWeight="semi-bold" color={C.faint}>
            /
          </Text>
        </Container>
      </Press>

      {/* notifications */}
      <Press
        width={36}
        height={36}
        flexShrink={0}
        borderRadius={18}
        alignItems="center"
        justifyContent="center"
        backgroundColor={menu === "bell" ? C.hover : withOpacity("#FFFFFF", 0)}
        hover={{ backgroundColor: C.hover }}
        onClick={() => toggle("bell")}
      >
        <Bell width={17} height={17} color={menu === "bell" ? accent : C.muted} />
        {count ? (
          <Container positionType="absolute" positionTop={3} positionRight={2} minWidth={15} height={15} paddingX={4} borderRadius={8} borderWidth={2} borderColor={C.panel} backgroundColor={C.danger} alignItems="center" justifyContent="center">
            <Text fontSize={8} fontWeight="bold" color={C.deep}>
              {String(count)}
            </Text>
          </Container>
        ) : null}
      </Press>

      {/* avatar / user menu */}
      <Press
        width={36}
        height={36}
        flexShrink={0}
        borderRadius={18}
        alignItems="center"
        justifyContent="center"
        borderWidth={2}
        borderColor={menu === "user" ? accent : signedOut ? C.line : withOpacity(accent, 0)}
        backgroundColor={signedOut ? C.deep : withOpacity("#B9B4F5", 0.25)}
        hover={{ borderColor: signedOut ? C.border : withOpacity(accent, 0.6) }}
        onClick={() => (signedOut ? (setSignedOut(false), setMenu(null)) : toggle("user"))}
      >
        {signedOut ? (
          <LogIn width={15} height={15} color={accent} />
        ) : (
          <>
            <Text fontSize={11} fontWeight="semi-bold" color="#B9B4F5">
              AK
            </Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- uikit Image, not a DOM img */}
            <Image positionType="absolute" positionTop={0} positionLeft={0} width={32} height={32} borderRadius={16} objectFit="cover" src="https://picsum.photos/id/64/96/96" />
          </>
        )}
      </Press>

      {/* dropdowns: absolute below the bar, floated a little toward the viewer */}
      {menu === "team" ? (
        <Drop left={12} width={232}>
          {TEAMS.map((g) => (
            <Container key={g.group} flexDirection="column" gap={2}>
              <Label>{g.group}</Label>
              {g.items.map((t) => (
                <Item
                  key={t.name}
                  onClick={() => {
                    setTeam(t.name)
                    pick(t.name)
                  }}
                >
                  <Logo name={t.name} tint={t.tint} size={22} />
                  <Text flexGrow={1} fontSize={12} fontWeight="medium" color={C.text}>
                    {t.name}
                  </Text>
                  {t.name === team ? <Check width={13} height={13} color={accent} /> : null}
                </Item>
              ))}
            </Container>
          ))}
          <Rule />
          <Item onClick={() => pick("Create team")}>
            <Container width={22} height={22} borderRadius={6} borderWidth={1} borderColor={C.border} alignItems="center" justifyContent="center">
              <Plus width={12} height={12} color={C.muted} />
            </Container>
            <Text fontSize={12} fontWeight="medium" color={C.muted}>
              Create team
            </Text>
          </Item>
        </Drop>
      ) : null}

      {menu === "products" ? (
        <Drop left={(720 - 568) / 2} width={568} row>
          {PRODUCTS.map((g) => (
            <Container key={g.group} width={200} flexDirection="column" gap={2}>
              <Label>{g.group}</Label>
              {g.items.map((it) => {
                const Icon = it.icon
                return (
                  <Item key={it.label} height={46} onClick={() => pick(it.label)}>
                    <Container width={30} height={30} borderRadius={8} backgroundColor={C.card} borderWidth={1} borderColor={C.line} alignItems="center" justifyContent="center">
                      <Icon width={15} height={15} color={accent} />
                    </Container>
                    <Container flexDirection="column" gap={2} flexShrink={1}>
                      <Text fontSize={12} fontWeight="semi-bold" color={C.text}>
                        {it.label}
                      </Text>
                      <Text fontSize={10} color={C.faint}>
                        {it.desc}
                      </Text>
                    </Container>
                  </Item>
                )
              })}
            </Container>
          ))}
          <Press
            flexGrow={1}
            flexDirection="column"
            justifyContent="space-between"
            padding={12}
            borderRadius={12}
            borderWidth={1}
            borderColor={withOpacity(accent, 0.35)}
            backgroundColor={withOpacity(accent, 0.1)}
            hover={{ backgroundColor: withOpacity(accent, 0.16) }}
            onClick={() => pick("What's new")}
          >
            <Container flexDirection="column" gap={6}>
              <Sparkles width={18} height={18} color={accent} />
              <Text fontSize={13} fontWeight="semi-bold" color={C.text}>
                New in 2.0
              </Text>
              <Text fontSize={10} color={C.muted}>
                Build interfaces you can walk around, then ship to web and headset.
              </Text>
            </Container>
            <Container flexDirection="row" alignItems="center" gap={4}>
              <Text fontSize={11} fontWeight="semi-bold" color={accent}>
                {"See what's new"}
              </Text>
              <ArrowRight width={12} height={12} color={accent} />
            </Container>
          </Press>
        </Drop>
      ) : null}

      {menu === "bell" ? (
        <Drop right={56} width={288}>
          <Container flexDirection="row" alignItems="center" paddingX={8} height={28}>
            <Text flexGrow={1} fontSize={12} fontWeight="semi-bold" color={C.text}>
              Notifications
            </Text>
            <Press paddingX={6} height={24} borderRadius={6} alignItems="center" lift={1} hover={{ backgroundColor: C.hover }} onClick={() => setUnread(NOTES.map(() => false))}>
              <Text fontSize={10} fontWeight="semi-bold" color={count ? accent : C.faint}>
                Mark all read
              </Text>
            </Press>
          </Container>
          <Rule />
          {NOTES.map((n, i) => (
            <Item key={n.title} height={44} alignItems="flex-start" paddingTop={8} onClick={() => setUnread((u) => u.map((x, j) => (j === i ? false : x)))}>
              <Container width={8} height={8} marginTop={4} borderRadius={4} backgroundColor={unread[i] ? "#7FC8F8" : withOpacity("#FFFFFF", 0)} />
              <Container flexDirection="column" gap={3}>
                <Text fontSize={12} fontWeight={unread[i] ? "semi-bold" : "normal"} color={unread[i] ? C.text : C.muted}>
                  {n.title}
                </Text>
                <Text fontSize={10} color={C.faint}>
                  {n.time}
                </Text>
              </Container>
            </Item>
          ))}
        </Drop>
      ) : null}

      {menu === "user" ? (
        <Drop right={12} width={208}>
          <Container flexDirection="column" paddingX={8} paddingY={6} gap={2}>
            <Text fontSize={12} fontWeight="semi-bold" color={C.text}>
              Alicia Koch
            </Text>
            <Text fontSize={10} color={C.faint}>
              alicia@example.com
            </Text>
          </Container>
          <Rule />
          {USER_ITEMS.map((it) => {
            const Icon = it.icon
            return (
              <Item
                key={it.label}
                onClick={() => {
                  if (it.label === "Settings" && links.length > 3) go(links.length - 1)
                  pick(it.label)
                }}
              >
                <Icon width={14} height={14} color={C.muted} />
                <Text flexGrow={1} fontSize={12} fontWeight="medium" color={C.text}>
                  {it.label}
                </Text>
              </Item>
            )
          })}
          <Rule />
          <Item
            onClick={() => {
              setSignedOut(true)
              pick("Sign out")
            }}
          >
            <LogOut width={14} height={14} color={C.danger} />
            <Text fontSize={12} fontWeight="medium" color={C.danger}>
              Sign out
            </Text>
          </Item>
        </Drop>
      ) : null}
    </Container>
  )
}

function Logo({ name, tint, size }: { name: string; tint: string; size: number }) {
  return (
    <Container width={size} height={size} flexShrink={0} borderRadius={size * 0.28} backgroundColor={withOpacity(tint, 0.22)} borderWidth={1} borderColor={withOpacity(tint, 0.45)} alignItems="center" justifyContent="center">
      <Text fontSize={size * 0.4} fontWeight="bold" color={tint}>
        {initials(name)}
      </Text>
    </Container>
  )
}

function Label({ children }: { children: string }) {
  return (
    <Text paddingX={8} paddingTop={4} paddingBottom={2} fontSize={9} fontWeight="semi-bold" letterSpacing={0.6} color={C.faint}>
      {children.toUpperCase()}
    </Text>
  )
}

function Rule() {
  return <Container height={1} marginY={4} marginX={4} backgroundColor={C.line} />
}

function Item({ children, ...props }: ContainerProperties) {
  return (
    <Press
      height={34}
      flexDirection="row"
      alignItems="center"
      gap={9}
      paddingX={8}
      borderRadius={8}
      lift={1}
      backgroundColor={withOpacity("#FFFFFF", 0)}
      hover={{ backgroundColor: C.hover }}
      {...props}
    >
      {children}
    </Press>
  )
}

/** Dropdown sheet: hangs below the bar and springs open from the top edge. */
function Drop({ left, right, width, row, children }: { left?: number; right?: number; width: number; row?: boolean; children: React.ReactNode }) {
  const [ref, s] = useSpring({ transformScaleY: 1, transformTranslateZ: 14 }, { transformScaleY: 0.7, transformTranslateZ: 0 })
  return (
    <Container
      ref={ref}
      {...s}
      positionType="absolute"
      positionTop={70}
      positionLeft={left}
      positionRight={right}
      width={width}
      zIndex={20}
      transformOriginY="top"
      flexDirection={row ? "row" : "column"}
      gap={row ? 10 : 2}
      padding={row ? 12 : 6}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={14}
    >
      {children}
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, lift = 3, ...props }: ContainerProperties & { lift?: number }) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.96 : 1
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
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) {
        x[k] = to[k]
        v[k] = 0
      }
      moved = true
    }
    if (moved) ref.current?.setProperties({ ...x })
  })
  return [ref, s.current.x as T] as const
}
