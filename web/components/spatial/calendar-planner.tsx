"use client";
// Built for Spatial. Grows the month grid from components/spatial/calendar.tsx into a full planner.

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Container,
  Text,
  withOpacity,
  type ContainerProperties,
  type VanillaContainer,
} from "@react-three/uikit";
import { ChevronLeft, ChevronRight, Plus } from "@react-three/uikit-lucide";

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
  now: "#F0A6B8",
};
const EV = {
  mint: "#9FE7D2",
  blue: "#8AB4F8",
  pink: "#F0A6B8",
  amber: "#F2B48A",
  violet: "#C3A6F0",
  green: "#86E0A6",
};
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// App size: 640 x 400.
const W = 640;
const H = 400;
const PAD = 14;
const HEAD = 38;
const BODY = H - PAD * 2 - HEAD - 10; // 314
const SIDE = 196;
const MAIN = W - PAD * 2 - SIDE - 12; // 400
const CELL_GAP = 3;
const CELL_W = Math.floor((MAIN - CELL_GAP * 6) / 7); // 54
const CELL_H = Math.floor((BODY - 18 - CELL_GAP * 6) / 6); // 46
const GUTTER = 32;
const COL_GAP = 2;
const COL_W = Math.floor((MAIN - GUTTER - COL_GAP * 6) / 7); // 50
const WEEK_HEAD = 36;
const START_H = 8;
const END_H = 19;
const HOUR = Math.floor((BODY - WEEK_HEAD - 4) / (END_H - START_H)); // 24

type CalEvent = {
  date: string;
  start: string;
  end: string;
  title: string;
  color?: string;
};
type Mode = "month" | "week";
type Props = {
  /** selected day, "YYYY-MM-DD" */
  value?: string;
  onChange?: (date: string) => void;
  events?: CalEvent[];
  /** view shown first */
  view?: Mode;
  title?: string;
  accent?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
};
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const hours = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
};
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m || 0)}`;
};
const ampm = (t: string) => (hours(t) < 12 ? "AM" : "PM");
const span = (e: CalEvent) =>
  `${clock(e.start)}${ampm(e.start) === ampm(e.end) ? "" : " " + ampm(e.start)} - ${clock(e.end)} ${ampm(e.end)}`;
const byStart = (a: CalEvent, b: CalEvent) => hours(a.start) - hours(b.start);

function sampleEvents(): CalEvent[] {
  const t = new Date();
  const at = (n: number) => iso(addDays(t, n));
  return [
    {
      date: at(0),
      start: "10:00",
      end: "11:00",
      title: "Design review",
      color: EV.mint,
    },
    {
      date: at(0),
      start: "12:30",
      end: "13:30",
      title: "Lunch with Maya",
      color: EV.amber,
    },
    {
      date: at(0),
      start: "16:00",
      end: "17:30",
      title: "Demo day",
      color: EV.pink,
    },
    {
      date: at(-2),
      start: "09:30",
      end: "10:30",
      title: "Sprint planning",
      color: EV.blue,
    },
    {
      date: at(-6),
      start: "18:00",
      end: "19:00",
      title: "Yoga",
      color: EV.green,
    },
    {
      date: at(1),
      start: "14:00",
      end: "16:00",
      title: "Quest playtest",
      color: EV.violet,
    },
    {
      date: at(2),
      start: "08:30",
      end: "09:15",
      title: "Dentist",
      color: EV.green,
    },
    {
      date: at(3),
      start: "11:00",
      end: "12:00",
      title: "Studio walkthrough",
      color: EV.blue,
    },
    {
      date: at(5),
      start: "13:00",
      end: "15:00",
      title: "Launch prep",
      color: EV.mint,
    },
    {
      date: at(9),
      start: "10:00",
      end: "11:30",
      title: "Board sync",
      color: EV.amber,
    },
    {
      date: at(13),
      start: "09:00",
      end: "17:00",
      title: "Team offsite",
      color: EV.violet,
    },
  ];
}
const PRESETS: Omit<CalEvent, "date">[] = [
  { start: "09:00", end: "09:30", title: "Coffee chat", color: EV.amber },
  { start: "13:00", end: "14:30", title: "Focus block", color: EV.violet },
  { start: "17:30", end: "18:30", title: "Gym", color: EV.green },
  { start: "11:00", end: "11:30", title: "1:1 with Sam", color: EV.blue },
];

/** Calendar app: Month and Week views, coloured events, the selected day's agenda, and "Add event" that drops a preset on the selected day. */
export default function CalendarPlanner({
  value,
  onChange,
  events,
  view = "month",
  title = "Calendar",
  accent = C.accent,
}: Props) {
  const today = iso(new Date());
  const [inner, setInner] = useState(today);
  const selected = value ?? inner;
  const [mode, setMode] = useState<Mode>(view);
  const [anchor, setAnchor] = useState({ d: selected, dir: 0 });
  const [seed] = useState(sampleEvents);
  const [added, setAdded] = useState<CalEvent[]>([]);
  const all = [...(events ?? seed), ...added];
  const [panel, enter] = useSpring(
    { transformScaleX: 1, transformScaleY: 1 },
    { transformScaleX: 0.94, transformScaleY: 0.94 },
  );

  const a = parse(anchor.d);
  const sel = parse(selected);
  const onDay = (s: string) => all.filter((e) => e.date === s).sort(byStart);
  const colorOf = (e: CalEvent) => e.color ?? accent;

  const pick = (d: Date) => {
    const s = iso(d);
    if (value === undefined) setInner(s);
    onChange?.(s);
    const off =
      mode === "month"
        ? d.getMonth() !== a.getMonth() || d.getFullYear() !== a.getFullYear()
        : iso(addDays(d, -d.getDay())) !== iso(addDays(a, -a.getDay()));
    setAnchor({ d: s, dir: off ? (d < a ? -1 : 1) : 0 });
  };
  const page = (dir: number) => {
    if (mode === "week") return pick(addDays(sel, dir * 7));
    setAnchor({
      d: iso(new Date(a.getFullYear(), a.getMonth() + dir, 1)),
      dir,
    });
  };
  const switchTo = (m: Mode) => {
    setMode(m);
    setAnchor({ d: selected, dir: 0 });
  };
  const addEvent = () =>
    setAdded((l) => [
      ...l,
      { ...PRESETS[l.length % PRESETS.length], date: selected },
    ]);

  // Month grid: 6 rows from the Sunday on/before the 1st.
  const first = new Date(a.getFullYear(), a.getMonth(), 1);
  const cells = Array.from({ length: 42 }, (_, i) =>
    addDays(first, i - first.getDay()),
  );
  // Week: the Sunday-to-Saturday week holding the anchor.
  const sunday = addDays(a, -a.getDay());
  const week = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  const weekLabel = `${MONTHS[week[0].getMonth()].slice(0, 3)} ${week[0].getDate()} - ${week[0].getMonth() === week[6].getMonth() ? "" : MONTHS[week[6].getMonth()].slice(0, 3) + " "}${week[6].getDate()}`;
  const head = mode === "month" ? a : week[3];
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const agenda = onDay(selected);

  return (
    <Container
      ref={panel}
      {...enter}
      pixelSize={0.002}
      width={W}
      height={H}
      flexDirection="column"
      padding={PAD}
      gap={10}
      backgroundColor={C.panel}
      borderWidth={1}
      borderColor={C.border}
      borderRadius={22}
      overflow="hidden"
    >
      {/* Header */}
      <Container height={HEAD} flexDirection="row" alignItems="center" gap={6}>
        <Container flexGrow={1} flexDirection="column" paddingLeft={4}>
          <Text
            fontSize={10}
            fontWeight="semi-bold"
            color={C.faint}
            letterSpacing={0.8}
          >
            {mode === "week"
              ? `${title.toUpperCase()}  /  ${weekLabel.toUpperCase()}`
              : title.toUpperCase()}
          </Text>
          <Container flexDirection="row" alignItems="baseline" gap={6}>
            <Text fontSize={19} fontWeight="bold" color={C.text}>
              {MONTHS[head.getMonth()]}
            </Text>
            <Text fontSize={19} fontWeight="medium" color={C.muted}>
              {String(head.getFullYear())}
            </Text>
          </Container>
        </Container>
        <Container
          flexDirection="row"
          height={32}
          padding={3}
          gap={2}
          borderRadius={10}
          backgroundColor={C.deep}
          borderWidth={1}
          borderColor={C.line}
        >
          {(["month", "week"] as const).map((m) => (
            <Press
              key={m}
              width={56}
              height={24}
              borderRadius={7}
              alignItems="center"
              justifyContent="center"
              lift={1}
              backgroundColor={mode === m ? C.hover : withOpacity("#FFFFFF", 0)}
              hover={{
                backgroundColor:
                  mode === m ? C.hover : withOpacity("#FFFFFF", 0.05),
              }}
              onClick={() => switchTo(m)}
            >
              <Text
                fontSize={11}
                fontWeight="semi-bold"
                color={mode === m ? C.text : C.muted}
              >
                {m === "month" ? "Month" : "Week"}
              </Text>
            </Press>
          ))}
        </Container>
        <Press
          height={32}
          paddingX={12}
          borderRadius={10}
          alignItems="center"
          justifyContent="center"
          backgroundColor={C.row}
          hover={{ backgroundColor: C.hover }}
          onClick={() => pick(new Date())}
        >
          <Text fontSize={11} fontWeight="semi-bold" color={C.text}>
            Today
          </Text>
        </Press>
        <Press
          width={32}
          height={32}
          borderRadius={10}
          alignItems="center"
          justifyContent="center"
          backgroundColor={C.row}
          hover={{ backgroundColor: C.hover }}
          onClick={() => page(-1)}
        >
          <ChevronLeft width={16} height={16} color={C.text} />
        </Press>
        <Press
          width={32}
          height={32}
          borderRadius={10}
          alignItems="center"
          justifyContent="center"
          backgroundColor={C.row}
          hover={{ backgroundColor: C.hover }}
          onClick={() => page(1)}
        >
          <ChevronRight width={16} height={16} color={C.text} />
        </Press>
      </Container>

      <Container height={BODY} flexDirection="row" gap={12}>
        {/* Main view */}
        <Container width={MAIN} height={BODY} overflow="hidden">
          {mode === "month" ? (
            <Slide
              key={`m-${a.getFullYear()}-${a.getMonth()}`}
              from={anchor.dir * 28}
            >
              <Container flexDirection="row" gap={CELL_GAP} height={15}>
                {DAYS.map((d) => (
                  <Text
                    key={d}
                    width={CELL_W}
                    textAlign="center"
                    fontSize={10}
                    fontWeight="semi-bold"
                    color={C.faint}
                  >
                    {d.toUpperCase()}
                  </Text>
                ))}
              </Container>
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <Container
                  key={r}
                  flexDirection="row"
                  gap={CELL_GAP}
                  marginTop={CELL_GAP}
                >
                  {cells.slice(r * 7, r * 7 + 7).map((d) => {
                    const s = iso(d);
                    const isSel = s === selected;
                    const isToday = s === today;
                    const inMonth = d.getMonth() === a.getMonth();
                    const evs = onDay(s);
                    return (
                      <Press
                        key={s}
                        width={CELL_W}
                        height={CELL_H}
                        borderRadius={10}
                        flexDirection="column"
                        alignItems="center"
                        paddingTop={5}
                        gap={4}
                        lift={2}
                        backgroundColor={
                          isSel
                            ? withOpacity(accent, 0.1)
                            : inMonth
                              ? withOpacity("#FFFFFF", 0.025)
                              : withOpacity("#FFFFFF", 0)
                        }
                        hover={{
                          backgroundColor: isSel
                            ? withOpacity(accent, 0.14)
                            : C.hover,
                        }}
                        onClick={() => pick(d)}
                      >
                        <Container
                          width={24}
                          height={24}
                          borderRadius={12}
                          alignItems="center"
                          justifyContent="center"
                          backgroundColor={
                            isSel ? accent : withOpacity(accent, 0)
                          }
                          borderWidth={isToday && !isSel ? 1.5 : 0}
                          borderColor={accent}
                        >
                          <Text
                            fontSize={12}
                            fontWeight={isSel || isToday ? "bold" : "medium"}
                            color={
                              isSel
                                ? C.onAccent
                                : isToday
                                  ? accent
                                  : inMonth
                                    ? C.text
                                    : C.faint
                            }
                          >
                            {String(d.getDate())}
                          </Text>
                        </Container>
                        <Container flexDirection="row" gap={3} height={5}>
                          {evs.slice(0, 4).map((e, i) => (
                            <Container
                              key={i}
                              width={5}
                              height={5}
                              borderRadius={3}
                              backgroundColor={
                                inMonth
                                  ? colorOf(e)
                                  : withOpacity(colorOf(e), 0.4)
                              }
                            />
                          ))}
                        </Container>
                      </Press>
                    );
                  })}
                </Container>
              ))}
            </Slide>
          ) : (
            <Slide key={`w-${iso(sunday)}`} from={anchor.dir * 28}>
              <Container
                flexDirection="row"
                gap={COL_GAP}
                height={WEEK_HEAD}
                paddingLeft={GUTTER}
              >
                {week.map((d) => {
                  const s = iso(d);
                  const isSel = s === selected;
                  const isToday = s === today;
                  return (
                    <Press
                      key={s}
                      width={COL_W}
                      height={WEEK_HEAD}
                      borderRadius={9}
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      lift={2}
                      backgroundColor={
                        isSel ? accent : withOpacity("#FFFFFF", 0)
                      }
                      hover={{ backgroundColor: isSel ? accent : C.hover }}
                      onClick={() => pick(d)}
                    >
                      <Text
                        fontSize={9}
                        fontWeight="semi-bold"
                        color={isSel ? C.onAccent : isToday ? accent : C.faint}
                      >
                        {DAYS[d.getDay()].toUpperCase()}
                      </Text>
                      <Text
                        fontSize={14}
                        fontWeight="bold"
                        color={isSel ? C.onAccent : isToday ? accent : C.text}
                      >
                        {String(d.getDate())}
                      </Text>
                    </Press>
                  );
                })}
              </Container>
              <Container
                flexDirection="row"
                marginTop={4}
                height={HOUR * (END_H - START_H)}
              >
                <Container width={GUTTER} flexDirection="column">
                  {Array.from({ length: END_H - START_H }, (_, i) => (
                    <Text
                      key={i}
                      height={HOUR}
                      fontSize={8}
                      fontWeight="semi-bold"
                      color={C.faint}
                      marginTop={i ? 0 : -5}
                    >
                      {`${((START_H + i + 11) % 12) + 1} ${START_H + i < 12 ? "AM" : "PM"}`}
                    </Text>
                  ))}
                </Container>
                <Container flexDirection="row" gap={COL_GAP}>
                  {week.map((d) => {
                    const s = iso(d);
                    return (
                      <Press
                        key={s}
                        width={COL_W}
                        height={HOUR * (END_H - START_H)}
                        borderRadius={6}
                        lift={0}
                        backgroundColor={
                          s === selected
                            ? withOpacity(accent, 0.06)
                            : withOpacity("#FFFFFF", 0.02)
                        }
                        hover={{
                          backgroundColor:
                            s === selected
                              ? withOpacity(accent, 0.08)
                              : withOpacity("#FFFFFF", 0.04),
                        }}
                        onClick={() => pick(d)}
                      >
                        {Array.from({ length: END_H - START_H - 1 }, (_, i) => (
                          <Container
                            key={i}
                            positionType="absolute"
                            positionTop={HOUR * (i + 1)}
                            positionLeft={0}
                            width={COL_W}
                            height={1}
                            backgroundColor={C.line}
                          />
                        ))}
                        {onDay(s).map((e, i) => {
                          const top =
                            Math.max(0, hours(e.start) - START_H) * HOUR;
                          const bottom =
                            Math.min(END_H - START_H, hours(e.end) - START_H) *
                            HOUR;
                          if (bottom <= top) return null;
                          const h = Math.max(14, bottom - top - 2);
                          const c = colorOf(e);
                          return (
                            <Container
                              key={i}
                              positionType="absolute"
                              positionTop={top + 1}
                              positionLeft={1}
                              width={COL_W - 2}
                              height={h}
                              borderRadius={5}
                              flexDirection="row"
                              overflow="hidden"
                              backgroundColor={withOpacity(c, 0.22)}
                              transformTranslateZ={2}
                            >
                              <Container
                                width={3}
                                height={h}
                                backgroundColor={c}
                              />
                              <Container
                                flexDirection="column"
                                paddingX={3}
                                paddingTop={2}
                                width={COL_W - 5}
                                overflow="hidden"
                              >
                                <Text
                                  fontSize={8}
                                  fontWeight="bold"
                                  color={C.text}
                                  lineHeight={1.15}
                                >
                                  {e.title}
                                </Text>
                                {h > 34 ? (
                                  <Text
                                    fontSize={7}
                                    fontWeight="medium"
                                    color={withOpacity(C.text, 0.7)}
                                  >
                                    {clock(e.start)}
                                  </Text>
                                ) : null}
                              </Container>
                            </Container>
                          );
                        })}
                        {s === today && nowH >= START_H && nowH <= END_H ? (
                          <Container
                            positionType="absolute"
                            positionTop={(nowH - START_H) * HOUR - 1}
                            positionLeft={0}
                            width={COL_W}
                            height={2}
                            backgroundColor={C.now}
                            transformTranslateZ={3}
                          />
                        ) : null}
                      </Press>
                    );
                  })}
                </Container>
              </Container>
            </Slide>
          )}
        </Container>

        {/* Agenda for the selected day */}
        <Container
          width={SIDE}
          height={BODY}
          flexDirection="column"
          padding={12}
          gap={8}
          borderRadius={16}
          backgroundColor={C.deep}
          borderWidth={1}
          borderColor={C.line}
        >
          <Container flexDirection="column" gap={1}>
            <Text
              fontSize={10}
              fontWeight="semi-bold"
              letterSpacing={0.8}
              color={selected === today ? accent : C.faint}
            >
              {selected === today
                ? `TODAY  ${LONG_DAYS[sel.getDay()].toUpperCase()}`
                : LONG_DAYS[sel.getDay()].toUpperCase()}
            </Text>
            <Text fontSize={18} fontWeight="bold" color={C.text}>
              {`${MONTHS[sel.getMonth()]} ${sel.getDate()}`}
            </Text>
            <Text fontSize={11} color={C.muted}>
              {agenda.length === 0
                ? "Nothing scheduled"
                : `${agenda.length} event${agenda.length === 1 ? "" : "s"}`}
            </Text>
          </Container>
          <Container height={1} backgroundColor={C.line} />
          <Container
            flexGrow={1}
            flexDirection="column"
            gap={6}
            overflow="hidden"
          >
            {agenda.length === 0 ? (
              <Container
                flexGrow={1}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={11} color={C.faint} textAlign="center">
                  A free day. Add something below.
                </Text>
              </Container>
            ) : (
              agenda.slice(0, agenda.length > 5 ? 4 : 5).map((e, i) => (
                <Container
                  key={i}
                  flexDirection="row"
                  gap={8}
                  alignItems="center"
                  height={34}
                  paddingX={6}
                  borderRadius={8}
                  backgroundColor={withOpacity(colorOf(e), 0.08)}
                >
                  <Container
                    width={3}
                    height={24}
                    borderRadius={2}
                    backgroundColor={colorOf(e)}
                  />
                  <Container
                    flexDirection="column"
                    flexGrow={1}
                    flexShrink={1}
                    overflow="hidden"
                  >
                    <Text fontSize={12} fontWeight="semi-bold" color={C.text}>
                      {e.title}
                    </Text>
                    <Text fontSize={10} color={C.muted}>
                      {span(e)}
                    </Text>
                  </Container>
                </Container>
              ))
            )}
            {agenda.length > 5 ? (
              <Text fontSize={11} color={C.muted} paddingLeft={6}>
                {`+${agenda.length - 4} more`}
              </Text>
            ) : null}
          </Container>
          <Press
            height={34}
            borderRadius={10}
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            gap={6}
            backgroundColor={accent}
            hover={{ backgroundColor: withOpacity(accent, 0.85) }}
            onClick={addEvent}
          >
            <Plus width={14} height={14} color={C.onAccent} />
            <Text fontSize={12} fontWeight="bold" color={C.onAccent}>
              Add event
            </Text>
          </Press>
        </Container>
      </Container>
    </Container>
  );
}

/** A view's content; remounts per month/week/view so it slides in from the direction you paged. */
function Slide({
  from,
  children,
}: {
  from: number;
  children: React.ReactNode;
}) {
  const [ref, s] = useSpring(
    { transformTranslateX: 0 },
    { transformTranslateX: from },
  );
  return (
    <Container
      ref={ref}
      {...s}
      width={MAIN}
      height={BODY}
      flexDirection="column"
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
  const k = down ? 0.96 : 1;
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
