import * as Tone from "tone"

/**
 * Browsers only start audio inside a user gesture, and in an XR session there's no DOM click to use.
 * Call this synchronously from a click/pointerdown (Enter AR/VR, first tap in a launched app) so every
 * Tone-based component (piano keys, drum pads, sequencer, transport…) can play afterwards.
 */
export function unlockAudio() {
  if (Tone.getContext().state !== "running") void Tone.start()
}
