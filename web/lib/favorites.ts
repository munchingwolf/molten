"use client"

import { useSyncExternalStore } from "react"

/** Starter favorites: what the demo needs to build a music app in the headset. Shown until the viewer edits the list. */
export const DEFAULT_FAVORITES = [
  "transport", "drum-pad", "step-sequencer", "piano-keys", "synth", "arpeggiator",
  "knob", "fader", "mixer-strip", "xy-pad", "tempo-display", "vu-meter",
  "audio-visualizer", "waveform", "loop-player", "hardware-synth", "studio-monitors",
  "press-button", "slider", "glass-card", "label", "acoustic-panels", "neon-sign",
]

const KEY = "spatial:favorites"
const listeners = new Set<() => void>()
let cache: string[] | null = null

function read(): string[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as string[]) : DEFAULT_FAVORITES
  } catch {
    cache = DEFAULT_FAVORITES
  }
  return cache
}

export function toggleFavorite(name: string) {
  const cur = read()
  cache = cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {}
  listeners.forEach((l) => l())
}

/** Favorite component names in the order they were starred (per browser). */
export function useFavorites(): string[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    read,
    () => DEFAULT_FAVORITES,
  )
}
