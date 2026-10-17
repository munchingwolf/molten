# molten

Before doing anything, `git pull` and read [LOG.md](LOG.md) (team status), [SPEC.md](SPEC.md) **§41 (the locked plan; §1–40 are the old brainstorm)** and [COMPONENTS.md](COMPONENTS.md) (component checklist + owners).

After **any** change (a finished task, a decision, a new idea, a changed format or file layout):
1. Update the affected doc: SPEC.md §41 for plan or format changes, COMPONENTS.md to tick or add components.
2. Add an entry to the top of LOG.md's Log section (real Pacific time: `TZ=America/Los_Angeles date`).
3. Re-read what you changed to check it still agrees with the other docs, then `git pull --rebase && git push`.

## Design System
Read DESIGN.md before visual or UI work: it defines the fonts, colors, spacing, and
aesthetic direction. Ask the user before departing from it. When reviewing or QA-ing
UI, flag code that doesn't match DESIGN.md. The step-by-step design process (audit, variants, verify) is in DESIGN-PIPELINE.md.
