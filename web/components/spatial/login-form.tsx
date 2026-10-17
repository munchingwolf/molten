"use client"

import { cloneElement, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Container, Input, Text, withOpacity, type ContainerProperties, type VanillaContainer } from "@react-three/uikit"
import { Check, Cuboid, Eye, EyeOff, Fingerprint, Lock, Mail } from "@react-three/uikit-lucide"

const C = { panel: "#15171E", deep: "#101218", border: "#323745", line: "#242833", row: "#1B1E27", hover: "#262A35", text: "#EEF0F4", muted: "#9AA0AD", faint: "#6B7180", accent: "#9FE7D2", onAccent: "#06221B", error: "#F0A6B8" }

type Creds = { email: string; password: string }
type Props = {
  title?: string
  subtitle?: string
  email?: string
  /** return a Promise to show a loading state; reject or resolve false to show an error */
  onSubmit?: (creds: Creds) => void | boolean | Promise<void | boolean>
  onPasskey?: () => void
  onForgot?: () => void
  onSignUp?: () => void
  accent?: string
}

/** Sign-in form: email + password fields with focus rings, show/hide password, loading and success states, passkey option. */
export default function LoginForm({
  title = "Welcome back",
  subtitle = "Sign in to Northwind",
  email: initialEmail = "maya@northwind.app",
  onSubmit,
  onPasskey,
  onForgot,
  onSignUp,
  accent = C.accent,
}: Props) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [state, setState] = useState<"idle" | "busy" | "done">("idle")
  const [error, setError] = useState("")
  const [panel, enter] = useSpring({ transformScaleX: 1, transformScaleY: 1 }, { transformScaleX: 0.94, transformScaleY: 0.94 })

  const submit = async () => {
    if (state !== "idle") return
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address")
    if (!password) return setError("Enter your password")
    setError("")
    setState("busy")
    try {
      const ok = await (onSubmit ? onSubmit({ email: email.trim(), password }) : new Promise((r) => setTimeout(r, 700)))
      if (ok === false) throw new Error()
      setState("done")
    } catch {
      setState("idle")
      setError("Wrong email or password")
    }
  }

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={320}
      flexDirection="column"
      padding={24}
      gap={14}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={22}
    >
      <Container flexDirection="column" alignItems="center" gap={6} paddingBottom={4}>
        <Container width={44} height={44} borderRadius={12} backgroundColor={accent} alignItems="center" justifyContent="center" marginBottom={6}>
          <Cuboid width={22} height={22} color={C.onAccent} />
        </Container>
        <Text fontSize={20} fontWeight="semi-bold" color={C.text}>
          {title}
        </Text>
        <Text fontSize={13} color={C.muted}>
          {subtitle}
        </Text>
      </Container>

      <Field label="Email" icon={Mail} accent={accent}>
        <Input flexGrow={1} fontSize={14} color={C.text} value={email} placeholder="you@company.com" placeholderStyle={{ color: C.faint }} onValueChange={setEmail} />
      </Field>
      <Field
        label="Password"
        icon={Lock}
        accent={accent}
        right={
          <Press width={32} height={32} borderRadius={8} alignItems="center" justifyContent="center" hover={{ backgroundColor: C.hover }} onClick={() => setShow(!show)}>
            {show ? <EyeOff width={16} height={16} color={C.muted} /> : <Eye width={16} height={16} color={C.muted} />}
          </Press>
        }
      >
        <Input
          flexGrow={1}
          fontSize={14}
          color={C.text}
          type={show ? "text" : "password"}
          value={password}
          placeholder="Your password"
          placeholderStyle={{ color: C.faint }}
          onValueChange={setPassword}
        />
      </Field>

      <Container flexDirection="row" alignItems="center" justifyContent="space-between" marginTop={-4}>
        <Text fontSize={12} color={C.error}>
          {error}
        </Text>
        <Press height={28} paddingX={6} borderRadius={6} alignItems="center" hover={{ backgroundColor: C.hover }} onClick={onForgot}>
          <Text fontSize={12} fontWeight="semi-bold" color={accent}>
            Forgot password?
          </Text>
        </Press>
      </Container>

      <Press
        height={46}
        borderRadius={12}
        flexDirection="row"
        gap={8}
        alignItems="center"
        justifyContent="center"
        backgroundColor={accent}
        hover={{ backgroundColor: withOpacity(accent, 0.88) }}
        onClick={submit}
      >
        {state === "done" ? <Check width={18} height={18} color={C.onAccent} /> : null}
        <Text fontSize={15} fontWeight="semi-bold" color={C.onAccent}>
          {state === "busy" ? "Signing in..." : state === "done" ? "Signed in" : "Sign in"}
        </Text>
      </Press>

      <Container flexDirection="row" alignItems="center" gap={10}>
        <Container flexGrow={1} height={1} backgroundColor={C.line} />
        <Text fontSize={11} color={C.faint}>
          or
        </Text>
        <Container flexGrow={1} height={1} backgroundColor={C.line} />
      </Container>

      <Press
        height={46}
        borderRadius={12}
        flexDirection="row"
        gap={8}
        alignItems="center"
        justifyContent="center"
        backgroundColor={C.row}
        borderWidth={1}
        borderColor={C.border}
        hover={{ backgroundColor: C.hover }}
        onClick={onPasskey}
      >
        <Fingerprint width={18} height={18} color={C.text} />
        <Text fontSize={14} fontWeight="semi-bold" color={C.text}>
          Continue with passkey
        </Text>
      </Press>

      <Container flexDirection="row" justifyContent="center" alignItems="center" gap={4}>
        <Text fontSize={12} color={C.muted}>
          No account?
        </Text>
        <Press height={28} paddingX={4} borderRadius={6} alignItems="center" hover={{ backgroundColor: C.hover }} onClick={onSignUp}>
          <Text fontSize={12} fontWeight="semi-bold" color={accent}>
            Create one
          </Text>
        </Press>
      </Container>
    </Container>
  )
}

function Field({
  label,
  icon: Icon,
  accent,
  right,
  children,
}: {
  label: string
  icon: typeof Mail
  accent: string
  right?: React.ReactNode
  children: React.ReactElement<{ onFocusChange?: (f: boolean) => void }>
}) {
  const [focus, setFocus] = useState(false)
  return (
    <Container flexDirection="column" gap={6}>
      <Text fontSize={12} fontWeight="medium" color={C.muted}>
        {label}
      </Text>
      <Container
        height={46}
        flexDirection="row"
        alignItems="center"
        gap={10}
        paddingLeft={14}
        paddingRight={right ? 7 : 14}
        borderRadius={12}
        backgroundColor={C.deep}
        borderWidth={1.5}
        borderColor={focus ? accent : C.border}
      >
        <Icon width={16} height={16} color={focus ? accent : C.faint} />
        {cloneElement(children, { onFocusChange: setFocus })}
        {right}
      </Container>
    </Container>
  )
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({ children, ...props }: ContainerProperties) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const k = down ? 0.96 : 1
  const [ref, s] = useSpring({ transformTranslateZ: hover && !down ? 3 : 0, transformScaleX: k, transformScaleY: k })
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
