// Guided-template slots by voice: "Stark, add the drums", "next", "fill the rest" place the slot's component through
// the same placeSlot path as dragging onto a slot (snapped, wired, one undo step each). Plain word matching, no model.
// A template pre-loads each slot's trigger phrases in `say` (several slots sharing a phrase = one group command);
// without `say`, the slot's name/hint and its component's registry names count. Pure, so `node --test` runs it.
import { openSlots, type Filled, type Slot } from "./guides.ts"

export type SayingSlot = Slot & { say?: string[] }
export type SlotCommand = { slotIds: string[]; reply: string }

const NEGATION = /\b(dont|do not|never mind|nevermind|cancel|wait)\b/
// Edits and scene navigation belong to the normal assistant ops ("make the drums bigger", "next scene").
const EDIT = /\b(bigger|smaller|larger|move|rotate|turn|spin|remove|delete|colou?r|make|scale|swap|change|scene)\b/
const NEXT = /^(?:(?:add|place|put|do|give me|bring)\s+)?(?:the\s+)?next(?:\s+(?:one|piece|slot|thing|part))?(?:\s+please)?$/
const ALL = /\b(the rest|everything|all of (it|them)|fill (it|them) (all|up|in)|finish( it| the \w+)?|complete (it|the \w+)|build (it|everything|the whole \w+))\b/
const ADD = /\b(add|put|place|drop|bring|give|build|set up|setup|fill|insert|want|need|get|let us have|lets have)\b/
const FILLER = new Set(["the", "a", "an", "and", "please", "now", "too", "also", "in", "it", "some", "my", "our", "u", "me", "then", "next"])

/** Lowercase words, punctuation dropped, simple plurals folded ("drums" → "drum") so phrases match either way. */
const clean = (s: string) =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ")
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)).join(" ")

const title = (s: Slot) => s.name ?? s.hint ?? s.component
const wiring = (s: Slot) => [...new Set(Object.values(s.bind ?? {}))].filter(Boolean)

type Hit = { slot: SayingSlot; start: number; end: number; rank: number }

export function slotCommand(raw: string, slots: SayingSlot[], filled: Filled, namesOf: (component: string) => string[] = () => []): SlotCommand | null {
  const t = clean(raw)
  if (!t || NEGATION.test(t)) return null
  const open = openSlots(slots, filled)
  const reply = (ids: string[]) => {
    const placed = ids.map((id) => slots.find((s) => s.id === id)!)
    const left = open.length - ids.length
    const what = placed.map((s) => (wiring(s).length ? `${title(s)} (wired to ${wiring(s).join(", ")})` : title(s))).join(", ")
    return `${what}${placed.length > 1 ? " are" : " is"} in. ${left ? `${slots.length - left} of ${slots.length} placed.` : `All ${slots.length} placed.`}`
  }
  const full: SlotCommand = { slotIds: [], reply: "Every slot is already filled." }

  if (NEXT.test(t)) return open[0] ? { slotIds: withChildren([open[0]], open), reply: reply(withChildren([open[0]], open)) } : full
  if (ALL.test(t)) return open.length ? { slotIds: open.map((s) => s.id), reply: reply(open.map((s) => s.id)) } : full
  if (EDIT.test(t)) return null

  // Every slot's longest matching phrase: its `say` triggers outrank its own name/hint, which outrank component names.
  const hits: Hit[] = []
  for (const slot of slots) {
    const groups: [number, (string | undefined)[]][] = [[2, slot.say ?? []], [1, [slot.name, slot.hint]], [0, namesOf(slot.component)]]
    let best: Hit | null = null
    for (const [rank, phrases] of groups)
      for (const p of phrases) {
        const c = p ? clean(p) : ""
        // i is the space before the phrase, so the span [i, i + len + 1) covers " phrase" in ` ${t} ` coordinates
        const i = c ? ` ${t} `.indexOf(` ${c} `) : -1
        if (i < 0) continue
        const len = c.length + 1
        if (!best || len > best.end - best.start || (len === best.end - best.start && rank > best.rank)) best = { slot, start: i, end: i + len, rank }
      }
    if (best) hits.push(best)
  }
  if (!hits.length) return null

  // Longest phrase claims its words ("keys lane" beats "keys"); slots matched by the exact same words form a group.
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || b.rank - a.rank || (a.slot.order ?? 0) - (b.slot.order ?? 0))
  const taken: Hit[] = []
  for (const h of hits) {
    const same = taken.some((k) => k.start === h.start && k.end === h.end)
    if (same || !taken.some((k) => h.start < k.end && k.start < h.end)) taken.push(h)
  }

  // Only a placing request: an add verb, or nothing but the names ("the drums"). "the drums sound great" is not one.
  const rest = taken.reduce((s, h) => s.slice(0, h.start) + " ".repeat(h.end - h.start) + s.slice(h.end), ` ${t} `)
  if (!ADD.test(t) && rest.split(/\s+/).some((w) => w && !FILLER.has(w))) return null

  const wanted = taken.map((h) => h.slot)
  const ids = withChildren(wanted.filter((s) => !filled[s.id]), open)
  if (!ids.length) {
    // Matched only by a component name and already placed: maybe they want another one, so let the normal "add" run.
    if (taken.every((h) => h.rank === 0)) return null
    return { slotIds: [], reply: `${wanted.map(title).join(", ")} ${wanted.length > 1 ? "are" : "is"} already placed.` }
  }
  return { slotIds: ids, reply: reply(ids) }
}

const BUILD = /\b(build|set up|setup|make|create|load|start|open|give me|show me|bring up|put up|do)\b/

/**
 * "Stark, build the Night Set" / "set up the DAW": the template a build request names (its name, or a phrase in the
 * template's own `say` list), longest phrase wins. Null when there's no build verb or no template named.
 */
export function templateCommand<T extends { name: string; say?: string[] }>(raw: string, templates: T[]): T | null {
  const t = clean(raw)
  if (!t || NEGATION.test(t) || !BUILD.test(t)) return null
  let best: { tpl: T; len: number } | null = null
  for (const tpl of templates)
    for (const p of [tpl.name, ...(tpl.say ?? [])]) {
      const c = clean(p)
      if (c && ` ${t} `.includes(` ${c} `) && (!best || c.length > best.len)) best = { tpl, len: c.length }
    }
  return best?.tpl ?? null
}

/** A container slot (the track wall) brings its open child slots (the lanes) with it, in build order. */
function withChildren(chosen: Slot[], open: Slot[]): string[] {
  const ids: string[] = []
  const add = (s: Slot) => {
    if (ids.includes(s.id)) return
    ids.push(s.id)
    for (const c of open) if (c.parentId === s.id) add(c)
  }
  for (const s of [...chosen].sort((a, b) => open.indexOf(a) - open.indexOf(b))) add(s)
  return ids.filter((id) => open.some((s) => s.id === id))
}
