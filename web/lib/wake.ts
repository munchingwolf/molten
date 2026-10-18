// The assistant is called Stark: "Stark, add a knob". The name (optionally after hey/ok) is stripped before parsing.
// Common speech-to-text spellings are accepted; "start" is not, so "start the music" still means what it says.
export const ASSISTANT_NAME = "Stark"
const WAKE = /^\s*(?:(?:hey|hi|ok|okay|yo)[\s,]+)?(?:stark|starke|starks)\b[\s,.:;!?-]*/i

/** The command without its leading "Stark," (and whether the name was said). */
export function stripName(text: string): { said: boolean; rest: string } {
  const m = WAKE.exec(text)
  return m ? { said: true, rest: text.slice(m[0].length).trim() } : { said: false, rest: text.trim() }
}
