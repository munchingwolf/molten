"use client";
// Built for Spatial. Evaluator is our own two-pass (× ÷ then + −) precedence fold; no eval/Function.

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Container,
  Text,
  withOpacity,
  type ContainerProperties,
  type VanillaContainer,
} from "@react-three/uikit";
import {
  Delete,
  Divide,
  Equal,
  History,
  Minus,
  Plus,
  X,
} from "@react-three/uikit-lucide";

const C = {
  panel: "#15171E",
  deep: "#101218",
  border: "#323745",
  line: "#242833",
  row: "#1B1E27",
  hover: "#262A35",
  text: "#EEF0F4",
  muted: "#9AA0AD",
  faint: "#6B7180",
  accent: "#9FE7D2",
  onAccent: "#06221B",
  key: "#232733",
  keyHover: "#2C313E",
  fn: "#3A4050",
  fnHover: "#454C5E",
};
const W = 360;
const H = 440;
const PAD = 12;
const GAP = 8;
const KEY_W = (W - PAD * 2 - GAP * 3) / 4; // 78
const KEY_H = 54;
const PAD_H = KEY_H * 5 + GAP * 4;

type Op = "+" | "-" | "*" | "/";
type Tok = number | Op;
type Calc = { toks: Tok[]; entry: string; done: boolean; err: boolean };
type Props = {
  /** current result */
  value?: number;
  onChange?: (v: number) => void;
  title?: string;
  accent?: string;
};

// <evaluator>
/** Evaluate [n, op, n, op, n...] with × ÷ binding tighter than + −. Divide by zero gives NaN. */
function evaluate(toks: Tok[]): number {
  if (!toks.length) return 0;
  const terms: number[] = [Number(toks[0])];
  for (let i = 1; i + 1 < toks.length; i += 2) {
    const op = toks[i];
    const n = Number(toks[i + 1]);
    const last = terms.length - 1;
    if (op === "*") terms[last] *= n;
    else if (op === "/") terms[last] = n === 0 ? NaN : terms[last] / n;
    else terms.push(op === "-" ? -n : n);
  }
  return tidy(terms.reduce((a, b) => a + b, 0));
}
/** Round away float noise (0.1 + 0.2 → 0.3). */
const tidy = (n: number) =>
  Number.isFinite(n) ? Number(n.toPrecision(12)) : n;
// </evaluator>

if (process.env.NODE_ENV !== "production") {
  const cases: [Tok[], number][] = [
    [[12, "+", 7], 19],
    [[2, "+", 3, "*", 4], 14],
    [[2, "*", 3, "+", 4, "*", 5], 26],
    [[8, "-", 2, "-", 1], 5],
    [[100, "/", 10, "/", 2], 5],
    [[0.1, "+", 0.2], 0.3],
    [[10, "-", 4, "/", 2], 8],
  ];
  for (const [t, want] of cases)
    console.assert(
      evaluate(t) === want,
      `calculator: ${t.join(" ")} should be ${want}, got ${evaluate(t)}`,
    );
  console.assert(
    Number.isNaN(evaluate([1, "/", 0])),
    "calculator: 1 / 0 should be an error",
  );
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "Error";
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e12 || a < 1e-9))
    return n
      .toExponential(5)
      .replace(/\.?0+e/, "e")
      .replace("e+", "e");
  return tidy(n).toLocaleString("en-US", { maximumFractionDigits: 10 });
}
/** Group the integer part while keeping what's typed (trailing "." and zeros). */
function fmtEntry(s: string) {
  if (s.includes("e")) return s;
  const [i, f] = s.split(".");
  const neg = i.startsWith("-");
  return (
    (neg ? "-" : "") +
    Number((neg ? i.slice(1) : i) || "0").toLocaleString("en-US") +
    (f !== undefined ? "." + f : "")
  );
}
const toEntry = (n: number) => String(tidy(n));
const bigSize = (s: string) =>
  s.length <= 7
    ? 48
    : s.length <= 9
      ? 42
      : s.length <= 11
        ? 36
        : s.length <= 13
          ? 31
          : 26;

const OP_ICON = { "+": Plus, "-": Minus, "*": X, "/": Divide };
const KEYS: { k: string; w?: number }[][] = [
  [{ k: "AC" }, { k: "±" }, { k: "%" }, { k: "/" }],
  [{ k: "7" }, { k: "8" }, { k: "9" }, { k: "*" }],
  [{ k: "4" }, { k: "5" }, { k: "6" }, { k: "-" }],
  [{ k: "1" }, { k: "2" }, { k: "3" }, { k: "+" }],
  [{ k: "0", w: 2 }, { k: "." }, { k: "=" }],
];
const EMPTY: Calc = { toks: [], entry: "", done: false, err: false };

/** Full calculator: precedence-aware keypad, live expression line, tap the display (or ⌫) to backspace, and a history drawer whose results you can reuse. */
export default function Calculator({
  value,
  onChange,
  title = "Calculator",
  accent = C.accent,
}: Props) {
  const [inner, setInner] = useState(0);
  const [s, setS] = useState<Calc>(EMPTY);
  const [history, setHistory] = useState<{ toks: Tok[]; r: number }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [panel, enter] = useSpring(
    { transformScaleX: 1, transformScaleY: 1 },
    { transformScaleX: 0.94, transformScaleY: 0.94 },
  );

  const result = value ?? inner;
  const lastNum = [...s.toks]
    .reverse()
    .find((t): t is number => typeof t === "number");
  const cur =
    s.entry !== ""
      ? Number(s.entry)
      : !s.done && lastNum !== undefined
        ? lastNum
        : result;
  const big = s.err ? "Error" : s.entry !== "" ? fmtEntry(s.entry) : fmt(cur);
  const pendingOp =
    !s.done && s.entry === "" && typeof s.toks[s.toks.length - 1] === "string"
      ? (s.toks[s.toks.length - 1] as Op)
      : null;
  const exprToks: (Tok | "=")[] = s.done
    ? [...s.toks, "="]
    : s.entry !== ""
      ? [...s.toks, Number(s.entry)]
      : s.toks;

  const commit = (n: number) => {
    if (value === undefined) setInner(n);
    onChange?.(n);
  };
  const digit = (d: string) =>
    setS((p) => {
      if (p.err || p.done) return { ...EMPTY, entry: d === "." ? "0." : d };
      if (d === ".")
        return p.entry.includes(".")
          ? p
          : {
              ...p,
              entry:
                (p.entry === "" ? "0" : p.entry === "-" ? "-0" : p.entry) + ".",
            };
      if (p.entry.replace(/[-.]/g, "").length >= 12) return p;
      return {
        ...p,
        entry: p.entry === "0" ? d : p.entry === "-0" ? "-" + d : p.entry + d,
      };
    });
  const op = (o: Op) => {
    if (s.err) return;
    const toks: Tok[] = s.done ? [result] : [...s.toks];
    if (!s.done && s.entry !== "") toks.push(Number(s.entry));
    else if (!toks.length) toks.push(cur);
    if (typeof toks[toks.length - 1] === "string") toks[toks.length - 1] = o;
    else toks.push(o);
    setS({ ...EMPTY, toks });
  };
  const equals = () => {
    if (s.err) return setS(EMPTY);
    if (s.done) return;
    const toks = [...s.toks];
    if (s.entry !== "") toks.push(Number(s.entry));
    if (typeof toks[toks.length - 1] === "string") toks.pop();
    if (toks.length < 3) return;
    const r = evaluate(toks);
    if (!Number.isFinite(r))
      return setS({ ...EMPTY, toks, done: true, err: true });
    setHistory((h) => [{ toks, r }, ...h].slice(0, 8));
    setS({ ...EMPTY, toks, done: true });
    commit(r);
  };
  const negate = () => {
    if (s.err) return;
    if (s.entry !== "")
      return setS({
        ...s,
        entry: s.entry.startsWith("-") ? s.entry.slice(1) : "-" + s.entry,
      });
    if (pendingOp) return setS({ ...s, entry: "-0" });
    setS({ ...EMPTY, entry: toEntry(-cur) });
  };
  const percent = () => {
    if (s.err || pendingOp) return;
    if (s.entry !== "")
      return setS({ ...s, entry: toEntry(Number(s.entry) / 100) });
    setS({ ...EMPTY, entry: toEntry(cur / 100) });
  };
  const back = () => {
    if (s.err) return setS(EMPTY);
    if (s.done) return;
    if (s.entry !== "") {
      const e = s.entry.slice(0, -1);
      return setS({ ...s, entry: e === "-" ? "" : e });
    }
    if (pendingOp) {
      const toks = s.toks.slice(0, -2);
      setS({ ...s, toks, entry: toEntry(s.toks[s.toks.length - 2] as number) });
    }
  };
  const clear = () => {
    setS(EMPTY);
    commit(0);
  };
  const press = (k: string) => {
    if (k === "AC") clear();
    else if (k === "±") negate();
    else if (k === "%") percent();
    else if (k === "=") equals();
    else if (k in OP_ICON) op(k as Op);
    else digit(k);
  };
  const reuse = (r: number) => {
    setS((p) =>
      p.done || p.err
        ? { ...EMPTY, entry: toEntry(r) }
        : { ...p, entry: toEntry(r) },
    );
    setShowHistory(false);
  };

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={W}
      height={H}
      flexDirection="column"
      padding={PAD}
      gap={GAP}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={28}
      overflow="hidden"
    >
      <Container height={H - PAD * 2 - GAP - PAD_H} flexDirection="column">
        <Container flexDirection="row" alignItems="center" height={30}>
          <IconButton
            on={showHistory}
            accent={accent}
            onClick={() => setShowHistory((v) => !v)}
          >
            <History
              width={16}
              height={16}
              color={showHistory ? accent : C.muted}
            />
          </IconButton>
          <Text
            flexGrow={1}
            textAlign="center"
            fontSize={12}
            fontWeight="semi-bold"
            color={C.faint}
            letterSpacing={0.6}
          >
            {title.toUpperCase()}
          </Text>
          <IconButton on={false} accent={accent} onClick={back}>
            <Delete width={16} height={16} color={C.muted} />
          </IconButton>
        </Container>
        <Press
          flexGrow={1}
          flexDirection="column"
          justifyContent="flex-end"
          alignItems="flex-end"
          paddingX={8}
          borderRadius={14}
          lift={0}
          hover={{ backgroundColor: withOpacity("#FFFFFF", 0.03) }}
          onClick={back}
        >
          <Container height={20} alignItems="center">
            {exprToks.length ? (
              <Expr toks={exprToks} size={14} color={C.muted} />
            ) : null}
          </Container>
          <Text
            fontSize={bigSize(big)}
            fontWeight="medium"
            color={s.err ? "#F0A6B8" : C.text}
            lineHeight={1.15}
          >
            {big}
          </Text>
        </Press>
      </Container>

      {showHistory ? (
        <Drawer>
          <Container
            flexDirection="row"
            alignItems="center"
            paddingX={6}
            height={28}
          >
            <Text
              flexGrow={1}
              fontSize={14}
              fontWeight="semi-bold"
              color={C.text}
            >
              History
            </Text>
            {history.length ? (
              <Press
                height={28}
                paddingX={10}
                borderRadius={8}
                alignItems="center"
                backgroundColor={C.row}
                hover={{ backgroundColor: C.hover }}
                onClick={() => setHistory([])}
              >
                <Text fontSize={11} fontWeight="semi-bold" color={C.muted}>
                  Clear
                </Text>
              </Press>
            ) : null}
          </Container>
          {history.length === 0 ? (
            <Container
              flexGrow={1}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
              gap={4}
            >
              <Text fontSize={13} color={C.muted}>
                No calculations yet
              </Text>
              <Text fontSize={11} color={C.faint}>
                Results appear here after =
              </Text>
            </Container>
          ) : (
            history.slice(0, 5).map((h, i) => (
              <Press
                key={history.length - i}
                height={46}
                flexDirection="row"
                alignItems="center"
                paddingX={10}
                gap={8}
                borderRadius={10}
                backgroundColor={withOpacity("#FFFFFF", 0)}
                hover={{ backgroundColor: C.hover }}
                lift={2}
                onClick={() => reuse(h.r)}
              >
                <Container flexGrow={1} flexShrink={1} overflow="hidden">
                  <Expr toks={h.toks} size={12} color={C.muted} max={5} />
                </Container>
                <Text fontSize={17} fontWeight="semi-bold" color={C.text}>
                  {fmt(h.r)}
                </Text>
              </Press>
            ))
          )}
        </Drawer>
      ) : (
        <Container height={PAD_H} flexDirection="column" gap={GAP}>
          {KEYS.map((row, r) => (
            <Container key={r} flexDirection="row" gap={GAP}>
              {row.map(({ k, w = 1 }) => {
                const isOp = k in OP_ICON || k === "=";
                const kind = isOp
                  ? "op"
                  : k === "AC" || k === "±" || k === "%"
                    ? "fn"
                    : "digit";
                const Icon = OP_ICON[k as Op] ?? (k === "=" ? Equal : null);
                const active = pendingOp === k;
                const ink = isOp ? (active ? accent : C.onAccent) : C.text;
                return (
                  <Key
                    key={k}
                    width={KEY_W * w + GAP * (w - 1)}
                    kind={kind}
                    active={active}
                    accent={accent}
                    onPress={() => press(k)}
                  >
                    {Icon ? (
                      <Icon width={22} height={22} color={ink} />
                    ) : (
                      <Text
                        fontSize={kind === "fn" ? 19 : 24}
                        fontWeight={kind === "fn" ? "semi-bold" : "medium"}
                        color={ink}
                      >
                        {k === "±" ? "+/-" : k}
                      </Text>
                    )}
                  </Key>
                );
              })}
            </Container>
          ))}
        </Container>
      )}
    </Container>
  );
}

/** The expression line: numbers as text, operators as icons (the MSDF font only has ASCII). Long ones keep the tail. */
function Expr({
  toks,
  size,
  color,
  max = 7,
}: {
  toks: (Tok | "=")[];
  size: number;
  color: string;
  max?: number;
}) {
  const cut = toks.length > max;
  const shown = cut
    ? toks.slice(toks.length - max + ((toks.length - max) % 2))
    : toks;
  return (
    <Container flexDirection="row" alignItems="center" gap={4}>
      {cut ? (
        <Text fontSize={size} color={color}>
          ...
        </Text>
      ) : null}
      {shown.map((t, i) => {
        if (typeof t === "number")
          return (
            <Text key={i} fontSize={size} color={color}>
              {fmt(t)}
            </Text>
          );
        const Icon = t === "=" ? Equal : OP_ICON[t];
        return (
          <Icon key={i} width={size - 2} height={size - 2} color={color} />
        );
      })}
    </Container>
  );
}

/** A calculator key: a dark well with a cap that floats above it, rises on hover and sinks on press. */
function Key({
  width,
  kind,
  active,
  accent,
  onPress,
  children,
}: {
  width: number;
  kind: "digit" | "fn" | "op";
  active: boolean;
  accent: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const k = down ? 0.93 : 1;
  const [ref, s] = useSpring({
    transformTranslateZ: down ? 0 : hover ? 9 : 5,
    transformScaleX: k,
    transformScaleY: k,
  });
  const bg =
    kind === "op" ? (active ? C.text : accent) : kind === "fn" ? C.fn : C.key;
  const hoverBg =
    kind === "op"
      ? active
        ? "#FFFFFF"
        : withOpacity(accent, 0.85)
      : kind === "fn"
        ? C.fnHover
        : C.keyHover;
  return (
    <Container
      width={width}
      height={KEY_H}
      borderRadius={KEY_H / 2}
      backgroundColor={C.deep}
    >
      <Container
        ref={ref}
        {...s}
        width={width}
        height={KEY_H}
        borderRadius={KEY_H / 2}
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        backgroundColor={bg}
        hover={{ backgroundColor: hoverBg }}
        borderWidth={1}
        borderColor={withOpacity("#FFFFFF", kind === "op" ? 0 : 0.05)}
        onHoverChange={setHover}
        onActiveChange={setDown}
        onClick={onPress}
      >
        {children}
      </Container>
    </Container>
  );
}

function IconButton({
  on,
  accent,
  onClick,
  children,
}: {
  on: boolean;
  accent: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Press
      width={34}
      height={30}
      borderRadius={10}
      alignItems="center"
      justifyContent="center"
      backgroundColor={
        on ? withOpacity(accent, 0.14) : withOpacity("#FFFFFF", 0)
      }
      hover={{ backgroundColor: on ? withOpacity(accent, 0.2) : C.hover }}
      onClick={onClick}
    >
      {children}
    </Press>
  );
}

/** History panel: takes the keypad's place and slides up into it. */
function Drawer({ children }: { children: React.ReactNode }) {
  const [ref, s] = useSpring(
    { transformTranslateY: 0 },
    { transformTranslateY: 30 },
  );
  return (
    <Container
      ref={ref}
      {...s}
      height={PAD_H}
      flexDirection="column"
      gap={2}
      padding={8}
      borderRadius={20}
      backgroundColor={C.deep}
      borderWidth={1}
      borderColor={C.line}
      overflow="hidden"
    >
      {children}
    </Container>
  );
}

/** Pressable Container: lifts toward you on hover, dips on press. */
function Press({
  children,
  lift = 3,
  ...props
}: ContainerProperties & { lift?: number }) {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const k = down ? 0.97 : 1;
  const [ref, s] = useSpring({
    transformTranslateZ: hover && !down ? lift : 0,
    transformScaleX: k,
    transformScaleY: k,
  });
  return (
    <Container
      ref={ref}
      cursor="pointer"
      {...props}
      {...s}
      onHoverChange={setHover}
      onActiveChange={setDown}
    >
      {children}
    </Container>
  );
}

/** uikit has no CSS transitions: spring numeric props toward `to` each frame. Spread the returned values on the Container too. */
function useSpring<T extends Record<string, number>>(
  to: T,
  from: Partial<T> = {},
) {
  const ref = useRef<VanillaContainer>(null);
  const s = useRef<{ x: Record<string, number>; v: Record<string, number> }>(
    null,
  );
  if (!s.current) s.current = { x: { ...to, ...from }, v: {} };
  useFrame((_, dt) => {
    const { x, v } = s.current!;
    const h = Math.min(dt, 1 / 30);
    let moved = false;
    for (const k in to) {
      if (x[k] === to[k] && !v[k]) continue;
      v[k] = (v[k] ?? 0) + ((to[k] - x[k]) * 320 - (v[k] ?? 0) * 24) * h;
      x[k] += v[k] * h;
      if (Math.abs(to[k] - x[k]) < 0.01 && Math.abs(v[k]) < 0.05) {
        x[k] = to[k];
        v[k] = 0;
      }
      moved = true;
    }
    if (moved) ref.current?.setProperties({ ...x });
  });
  return [ref, s.current.x as T] as const;
}
