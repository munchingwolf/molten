"use client"

import Link from "next/link"
import {
  animate, motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform,
  type MotionValue,
} from "motion/react"
import { useEffect, useRef, useState, type ReactNode } from "react"

const ease = [0.22, 1, 0.36, 1] as const

/** Words rise out of a blur one after another (the hero's load moment). */
export function BlurWords({ text, className, delay = 0, accent }: { text: string; className?: string; delay?: number; accent?: string }) {
  const words = text.split(" ")
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease, delay: delay + i * 0.07 }}
        >
          {w}
          {i < words.length - 1 || accent ? " " : ""}
        </motion.span>
      ))}
      {accent && (
        <motion.span
          className="accent-word shimmer-text inline-block"
          initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease, delay: delay + words.length * 0.07 + 0.05 }}
        >
          {accent}
        </motion.span>
      )}
    </span>
  )
}

/** Types each phrase, holds, deletes, moves on. Caret blinks. */
export function Typewriter({ phrases, className }: { phrases: string[]; className?: string }) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  const [n, setN] = useState(0)
  const [del, setDel] = useState(false)
  useEffect(() => {
    if (reduce) return
    const full = phrases[i]
    const t = setTimeout(
      () => {
        if (!del && n < full.length) setN(n + 1)
        else if (!del) setDel(true)
        else if (n > 0) setN(n - 1)
        else (setDel(false), setI((i + 1) % phrases.length))
      },
      !del && n === full.length ? 1600 : del ? 28 : 55,
    )
    return () => clearTimeout(t)
  }, [n, del, i, phrases, reduce])
  return (
    <span className={className}>
      {reduce ? phrases[0] : phrases[i].slice(0, n)}
      <span className="caret" aria-hidden />
    </span>
  )
}

/** Primary CTA with a light running around its border. */
export function GlowButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`spin-border group relative inline-flex h-[46px] items-center rounded-[11px] p-px ${className}`}>
      <span className="relative z-10 inline-flex h-full items-center gap-2 rounded-[10px] bg-accent px-5 font-semibold text-on-accent transition-[filter] group-hover:brightness-110">
        {children}
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  )
}

/** Counts up from 0 when scrolled into view. */
export function Ticker({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!inView || !ref.current) return
    if (reduce) return void (ref.current.textContent = String(value))
    const c = animate(0, value, { duration: 1.4, ease, onUpdate: (v) => ref.current && (ref.current.textContent = String(Math.round(v))) })
    return () => c.stop()
  }, [inView, value, reduce])
  return <span ref={ref} className={`tabular-nums ${className ?? ""}`}>{value}</span>
}

/** Big statement: words light up from grey to white as the paragraph scrolls through the viewport. */
export function ScrollLightText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] })
  const words = text.split(" ")
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {w}
        </Word>
      ))}
    </p>
  )
}
function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.22, 1])
  return (
    <motion.span style={{ opacity }} className="inline-block whitespace-pre">
      {children}{" "}
    </motion.span>
  )
}

/** Card that tilts toward the cursor with a soft spotlight under it. */
export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rx = useSpring(useTransform(my, [0, 1], [5, -5]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(mx, [0, 1], [-6, 6]), { stiffness: 200, damping: 20 })
  const px = useTransform(mx, (v) => `${v * 100}%`)
  const py = useTransform(my, (v) => `${v * 100}%`)
  const spot = useMotionTemplate`radial-gradient(420px circle at ${px} ${py}, rgb(255 255 255 / 0.07), transparent 60%)`
  const reduce = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      className={`relative [transform-style:preserve-3d] ${className}`}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        mx.set((e.clientX - r.left) / r.width)
        my.set((e.clientY - r.top) / r.height)
      }}
      onPointerLeave={() => (mx.set(0.5), my.set(0.5))}
    >
      {children}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: spot }} />
    </motion.div>
  )
}

/** Terminal whose lines appear one by one once it scrolls into view, then a caret blinks on the last line. */
export function TerminalLines({ lines, className = "" }: { lines: ReactNode[]; className?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  return (
    <pre ref={ref} className={className}>
      {lines.map((l, i) => (
        <motion.span
          key={i}
          className="block"
          initial={{ opacity: 0, x: -8 }}
          animate={inView ? { opacity: 1, x: 0 } : undefined}
          transition={{ duration: 0.35, ease, delay: 0.2 + i * 0.32 }}
        >
          {l}
          {i === lines.length - 1 && <span className="caret" aria-hidden />}
        </motion.span>
      ))}
    </pre>
  )
}

/** Horizontal strip that drifts slowly, pauses on hover, and fades out at both edges. */
export function DriftRow({ children, speed = 40 }: { children: ReactNode; speed?: number }) {
  return (
    <div className="edge-fade group overflow-hidden">
      <div className="drift flex w-max gap-5 group-hover:[animation-play-state:paused]" style={{ animationDuration: `${speed}s` }}>
        {children}
        {/* second copy makes the loop seamless; hidden from assistive tech */}
        <div aria-hidden className="flex gap-5">{children}</div>
      </div>
    </div>
  )
}

/** Pill tabs where the active background slides between options. */
export function SlidingTabs({ options, value, onChange, id }: { options: string[]; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o}
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={`relative h-8 rounded-lg px-3 text-sm font-medium transition-colors ${value === o ? "text-text" : "text-muted hover:text-text"}`}
        >
          {value === o && (
            <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-lg bg-surface ring-1 ring-border-2" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
          )}
          <span className="relative">{o}</span>
        </button>
      ))}
    </div>
  )
}
