"use client"

import { useEffect, useState } from "react"
import { useAssistant } from "@/lib/assistant-store"

export type Mascot2DMood = "idle" | "listening" | "thinking" | "talking" | "happy"

// Stark, front view, 16×16. Same pixel map as the voxel model in components/spatial/mascot.tsx.
// O bulb · A stem · E ear tip · L/B/D body light/base/dark · W eye white · P pupil · H shine · M mouth · C cheek · R arm · F foot
const ART = [
  "................",
  "........O.......",
  "........A.......",
  "....E...A..E....",
  "....LLLLLLLL....",
  "....LLLLLLLL....",
  "...BWWWBBWWWB...",
  "...BWHPBBHPWB...",
  "...BWPPBBPPWB...",
  "..RBCBMBBMBCBR..",
  "..RBBBBMMBBBBR..",
  "...DDDDDDDDDD...",
  "....DDDDDDDD....",
  ".....FF..FF.....",
  "................",
  "................",
]

const FILL: Record<string, string> = {
  O: "#FFD3B0", A: "#89C7B5", E: "#F2B48A", L: "#ABF9E2", B: "#9FE7D2", D: "#89C7B5", W: "#EEF0F4",
  P: "#0B0C10", H: "#FFFFFF", M: "#06221B", C: "#F2B48A", R: "#9FE7D2", F: "#F2B48A",
}

type Px = { x: number; y: number; c: string }
const PX: Px[] = ART.flatMap((row, y) => [...row].flatMap((c, x) => (c === "." ? [] : [{ x, y, c }])))
const pick = (test: (p: Px) => boolean) => PX.filter(test)
const BODY = pick((p) => "LBDACR".includes(p.c) || (p.c === "M" && p.y === 9))
const MOUTH = pick((p) => p.c === "M" && p.y === 10)
const EARS = pick((p) => p.c === "E")
const BULB = pick((p) => p.c === "O")
const FEET = pick((p) => p.c === "F")
const EYE = (left: boolean) => pick((p) => p.c === "W" && (p.x < 8) === left)
const PUPIL = (left: boolean) => pick((p) => (p.c === "P" || p.c === "H") && (p.x < 8) === left)
const HAPPY_EYES: Px[] = [[4, 7], [5, 6], [6, 7], [9, 7], [10, 6], [11, 7]].map(([x, y]) => ({ x, y, c: "P" }))
const RING: Px[] = [[2, 14], [3, 15], [5, 15], [7, 15], [8, 15], [10, 15], [12, 15], [13, 14]].map(([x, y]) => ({ x, y, c: "B" }))
const DOTS: Px[] = [[11, 1], [13, 1], [15, 1]].map(([x, y]) => ({ x, y, c: "W" }))
const CONFETTI: Px[] = [[2, 3, "B"], [13, 2, "E"], [1, 7, "W"], [14, 6, "B"], [5, 0, "E"], [11, 0, "W"]].map(([x, y, c]) => ({ x: +x, y: +y, c: `${c}` }))

const rects = (px: Px[], className?: string) =>
  px.map((p, i) => (
    <rect key={`${p.x}-${p.y}`} className={className} x={p.x} y={p.y} width={1} height={1} fill={FILL[p.c]} style={className ? { animationDelay: `${i * 0.12}s` } : undefined} />
  ))

const CSS = `
.pix2d{overflow:visible}
.pix2d g,.pix2d rect{transform-box:fill-box;transform-origin:center}
.pix2d-bob{animation:pix2d-bob 2.8s ease-in-out infinite}
.pix2d-feet{animation:pix2d-bob 2.8s ease-in-out -.35s infinite}
.pix2d-eye{animation:pix2d-blink 4.6s infinite}
.pix2d-bulb{animation:pix2d-glow 2.4s ease-in-out infinite}
.pix2d .pix2d-ear{transform-origin:50% 100%;transition:transform .2s ease-out}
.pix2d-pupil,.pix2d-eyewrap{transition:transform .2s ease-out}
.pix2d .pix2d-mouth{transform-origin:50% 0}
.pix2d-ring{animation:pix2d-glow 1s ease-in-out infinite}
.pix2d-dot{animation:pix2d-dot 1.2s ease-in-out infinite}
.pix2d-confetti{opacity:0;animation:pix2d-pop 1.1s ease-out forwards}
.pix2d:hover .pix2d-hop{animation:pix2d-wiggle .5s ease-in-out}
.pix2d-listening .pix2d-ear{transform:scaleY(1.8)}
.pix2d-listening .pix2d-eyewrap{transform:scale(1.12)}
.pix2d-listening .pix2d-bulb,.pix2d-talking .pix2d-bulb{animation-duration:.8s}
.pix2d-thinking .pix2d-pupil{transform:translateY(-1px)}
.pix2d-talking .pix2d-mouth{animation:pix2d-chatter .26s ease-in-out infinite alternate}
.pix2d-talking .pix2d-squash{transform-origin:50% 100%;animation:pix2d-squash .26s ease-in-out infinite alternate}
.pix2d-happy .pix2d-hop{animation:pix2d-hop .55s ease-out}
@keyframes pix2d-bob{50%{transform:translateY(-.6px)}}
@keyframes pix2d-blink{0%,93%,100%{transform:scaleY(1)}95%{transform:scaleY(.15)}}
@keyframes pix2d-glow{50%{opacity:.55}}
@keyframes pix2d-dot{0%,100%{opacity:.2}40%{opacity:1}}
@keyframes pix2d-chatter{from{transform:scaleY(.6)}to{transform:scaleY(1.9)}}
@keyframes pix2d-squash{from{transform:scale(1.03,.96)}to{transform:scale(.98,1.03)}}
@keyframes pix2d-hop{40%{transform:translateY(-2.5px) scaleY(1.06)}80%{transform:translateY(0) scaleY(.92)}}
@keyframes pix2d-wiggle{25%{transform:rotate(-7deg)}50%{transform:rotate(6deg)}75%{transform:rotate(-3deg)}}
@keyframes pix2d-pop{0%{opacity:0;transform:scale(0)}25%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:translateY(-1.5px) scale(.6)}}
@media (prefers-reduced-motion:reduce){.pix2d *{animation:none!important;transition:none!important}.pix2d-confetti{display:none}}
`

/** Stark as 16×16 pixel art for the desktop assistant panel and the site. Pure SVG + CSS, no JS animation. */
export function Mascot2D({ mood = "idle", size = 40 }: { mood?: Mascot2DMood; size?: number }) {
  const happy = mood === "happy"
  const eye = (left: boolean) => (
    <g className="pix2d-eyewrap">
      <g className="pix2d-eye">
        {rects(EYE(left))}
        <g className="pix2d-pupil">{rects(PUPIL(left))}</g>
      </g>
    </g>
  )
  return (
    <>
      <style href="pix2d" precedence="low">{CSS}</style>
      <svg
        className={`pix2d pix2d-${mood}`}
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Stark, your assistant (${mood})`}
      >
        {mood === "listening" && rects(RING, "pix2d-ring")}
        <g className="pix2d-hop">
          <g className="pix2d-feet">{rects(FEET)}</g>
          <g className="pix2d-bob">
            <g className="pix2d-squash">
              {rects(BODY)}
              <g className="pix2d-ear">{rects(EARS.slice(0, 1))}</g>
              <g className="pix2d-ear">{rects(EARS.slice(1))}</g>
              <g className="pix2d-bulb">{rects(BULB)}</g>
              {happy ? rects(HAPPY_EYES) : (
                <>
                  {eye(true)}
                  {eye(false)}
                </>
              )}
              <g className="pix2d-mouth">{rects(MOUTH)}</g>
            </g>
          </g>
        </g>
        {mood === "thinking" && rects(DOTS, "pix2d-dot")}
        {happy && rects(CONFETTI, "pix2d-confetti")}
      </svg>
    </>
  )
}

/**
 * Stark's mood from the assistant store, for both <Mascot2D> and the 3D <Mascot>: "listening"/"thinking" pass through;
 * after a reply Stark is "happy" for 2.5 s if every edit worked, otherwise "talking" for about as long as the reply takes to read.
 */
export function useAssistantMood(): Mascot2DMood {
  const status = useAssistant((s) => s.status)
  const last = useAssistant((s) => s.messages[s.messages.length - 1])
  const [, rerender] = useState(0)
  const edited = !!last?.ops?.length && last.ops.every((o) => o.ok)
  const until = last?.role === "assistant" ? last.at + (edited ? 2500 : Math.min(4000, 800 + last.text.length * 35)) : 0
  useEffect(() => {
    const ms = until - Date.now()
    if (ms <= 0) return
    const id = setTimeout(() => rerender((n) => n + 1), ms)
    return () => clearTimeout(id)
  }, [until])
  if (status !== "idle") return status
  return until > Date.now() ? (edited ? "happy" : "talking") : "idle"
}
