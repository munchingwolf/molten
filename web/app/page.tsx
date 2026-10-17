import Link from "next/link"
import { ComponentCard } from "@/components/site/card"
import { registry } from "@/lib/registry"

const sections = registry.filter((e) => e.kind === "section")
const tier1 = registry.filter((e) => e.kind === "basic" && e.tier === 1)

const waysIn = [
  {
    title: "Claude Code",
    body: "Paste the prompt in your terminal. The Spatial MCP finds the component and copies the .tsx into your project.",
    sample: "> add the glass settings panel from Spatial\n  ✓ components/spatial/settings-glass.tsx",
  },
  {
    title: "Cursor & any MCP client",
    body: "Same tools, any editor: search the catalog, pull a component, then edit it like your own code.",
    sample: "search_components(\"settings\")\nadd_component(\"settings-glass\")",
  },
  {
    title: "Studio, in your headset",
    body: "Grab components off a floating shelf, place them with your hands, tap to restyle. Claude turns the layout into code.",
    sample: "get_layout(\"my-room\")\n  → 4 components placed",
  },
]

const kits = [
  { name: "Default", note: "Clean and neutral. Built on uikit-default (MIT)." },
  { name: "Glass", note: "Frosted panels that float over passthrough." },
  { name: "Horizon", note: "Quest-native look. Built on uikit-horizon (MIT)." },
]

const faqs = [
  ["What is Spatial?", "A catalog of UI components for XR apps. You see each one live in 3D, then copy it into your own WebXR project."],
  ["What do I need to use a component?", "A React Three Fiber app with @react-three/uikit. Each component is one .tsx file with a default export and no required props."],
  ["How do I install one?", "Copy the code, run the CLI command, or ask your coding agent to add it through the Spatial MCP."],
  ["Does it work on Quest?", "Yes. Components run in the Quest browser through WebXR, and you can try them in the Studio."],
  ["Can I change a component after adding it?", "Yes. It's your file. Edit it freely, or switch styles before you copy it."],
]

export default function Home() {
  return (
    <main>
      <section className="bg-stage text-stage-text">
        <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-16 sm:px-6">
          <h1 className="max-w-[16ch] font-display text-[clamp(2.4rem,5vw,4.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
            The component library for spatial apps
          </h1>
          <p className="mt-4 max-w-[54ch] text-stage-text/70">
            {registry.length} XR components you can see live in 3D, try in your headset, and drop into any WebXR
            project.
          </p>
          <Strip title="Sections" count={sections.length}>
            {sections.map((e) => (
              <ComponentCard key={e.name} entry={e} />
            ))}
          </Strip>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
        <Strip title="Components" count={tier1.length} href="/components">
          {tier1.slice(0, 8).map((e) => (
            <ComponentCard key={e.name} entry={e} />
          ))}
        </Strip>

        <section id="mcp" className="py-20">
          <h2 className="max-w-[20ch] font-display text-4xl font-extrabold tracking-tight">
            Copy the prompt. Paste it anywhere.
          </h2>
          <p className="mt-3 max-w-[56ch] text-muted">
            Every component ships as a prompt your coding agent can act on, plus the plain .tsx if you&apos;d rather paste it
            yourself.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {waysIn.map((w) => (
              <article key={w.title} className="flex flex-col rounded-xl border border-border bg-surface p-5">
                <pre className="overflow-x-auto rounded-lg bg-stage p-4 font-mono text-xs leading-relaxed text-stage-text">
                  {w.sample}
                </pre>
                <h3 className="mt-5 font-semibold">{w.title}</h3>
                <p className="mt-1 text-sm text-muted">{w.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-12">
          <h2 className="max-w-[22ch] font-display text-4xl font-extrabold tracking-tight">
            One component, three styles. Switch without touching your app.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {kits.map((k) => (
              <div key={k.name} className="rounded-xl border border-border bg-surface p-5">
                <p className="font-semibold">{k.name}</p>
                <p className="mt-1 text-sm text-muted">{k.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-24 text-center">
          <h2 className="font-display text-5xl font-extrabold tracking-tight">Built for hands. Ready for agents.</h2>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/components" className="rounded-md bg-accent px-5 py-2.5 font-medium text-on-accent">
              Browse components
            </Link>
            <Link href="/studio" className="rounded-md border border-border bg-surface px-5 py-2.5 font-medium">
              Open Studio
            </Link>
          </div>
        </section>

        <section className="grid gap-10 border-t border-border py-20 md:grid-cols-[1fr_2fr]">
          <h2 className="font-display text-4xl font-extrabold tracking-tight">Questions</h2>
          <div className="divide-y divide-border">
            {faqs.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none justify-between font-medium">
                  {q}
                  <span className="text-muted group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-6 px-4 py-10 text-sm text-muted sm:px-6">
          <p>Spatial · built at MOLTEN 2026</p>
          <p>Components built on pmndrs/uikit (MIT) and React Three Fiber.</p>
        </div>
      </footer>
    </main>
  )
}

function Strip({
  title,
  count,
  href,
  children,
}: {
  title: string
  count: number
  href?: string
  children: React.ReactNode
}) {
  return (
    <section className="pt-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">
          {title} <span className="opacity-60">{count}</span>
        </h2>
        {href && (
          <Link href={href} className="text-sm opacity-70 hover:opacity-100">
            View all →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  )
}
