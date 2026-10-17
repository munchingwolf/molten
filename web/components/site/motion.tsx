"use client"

import { MotionConfig, motion, type Variants } from "motion/react"
import type { ReactNode } from "react"

const ease = [0.22, 1, 0.36, 1] as const

/** Site-wide: honor the OS "reduce motion" setting for every animation below. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

const parent: Variants = { show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }
const child: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

/** The hero's one orchestrated load moment: children rise in one after another. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={parent} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={child}>
      {children}
    </motion.div>
  )
}

/** Fades up once when scrolled into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease, delay }}
    >
      {children}
    </motion.div>
  )
}
