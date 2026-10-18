import Link from "next/link"
import { ComponentCard } from "@/components/site/card"
import { DawDemo } from "@/components/site/daw-demo"
import { Logo } from "@/components/site/header"
import { DriftRow, ScrollLightText, TerminalLines, TiltCard } from "@/components/site/fx"
import { Reveal } from "@/components/site/motion"
import { Preview } from "@/components/site/preview"
import SculptureHero from "@/components/ui/liquid-sculpture-hero"
import { registry } from "@/lib/registry"

// Browsers keep ~16 live WebGL canvases and silently drop the oldest (the hero). Budget for this page:
// hero 1 + DAW demo iframe 1 + sections 3 + drift row 3×2 (it renders its cards twice for a seamless loop) + three looks 3 = 14.
const sections = registry.filter((e) => e.kind === "section" && e.status === "ready").slice(0, 3)
const looks = registry.filter((e) => e.kind === "section" && e.category === "settings").slice(0, 3)
const general = registry.filter((e) => e.kind === "basic" && e.status === "ready").slice(0, 3)
const readyCount = registry.filter((e) => e.status === "ready").length

const faqs = [
  ["What is Spatial?", "A library of UI components for XR apps. You see each one live in 3D, try it in your headset, then copy it into your own WebXR project."],
  ["What do I need to use a component?", "A React Three Fiber app with @react-three/uikit. Each component is one .tsx file with a default export and no required props."],
  ["How do I add one with Claude Code?", "Add the Spatial MCP once, then paste the prompt from any component page. Claude copies the file in and renders it."],
  ["Does it work on Quest?", "Yes. Everything runs in the Quest browser through WebXR. Open any component page there and press View in headset."],
  ["Can I sell my own components?", "Not yet. Publishing and paid components come after launch; every component today is free and MIT."],
]

export default function Home() {
  return (
    <main>
      <SculptureHero
        className="landing-hero"
        theme="dark"
        themeToggle={false}
        showNav={false}
        loadFonts={false}
        height="calc(100svh - 61px)" // under the sticky 61px site header
        darkBackground="#0B0C10" // = --color-bg; the WebGL pass needs a literal colour
        textColor="var(--color-text)"
        accentColor="var(--color-accent)"
        headingFont="var(--font-display)"
        accentFont="var(--font-serif)"
        bodyFont="var(--font-sans)"
        eyebrow="React Three Fiber · WebXR · Quest 3"
        headline={"Interfaces you can\nwalk around."}
        headlineAccent="walk around"
        body={`${registry.length} XR components for WebXR and React Three Fiber. Turn them in 3D, try them in your headset, then paste one prompt and your agent ships the code.`}
        primaryCta={{ label: "Browse components", href: "/components" }}
        secondaryCta={{ label: "Open Studio in VR", href: "/studio" }}
        backdropText="" // no word behind the sculpture: plain page background
      />

      <section id="daw" className="mx-auto max-w-[1240px] px-5 pb-16 pt-20">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 font-mono text-[13px] text-faint">Built in Spatial · Night Set</p>
            <H2>A DAW you play with your hands, built by asking.</H2>
            <p className="mt-3.5 max-w-[56ch] text-[17px] text-muted">
              Say &ldquo;Stark, build the Night Set&rdquo; in the Studio: the mixer, synth keys, drum pads and a three-lane track wall drop into place, already wired to one tempo. Then play it in your headset.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/studio" className="inline-flex h-[46px] items-center rounded-[11px] bg-accent px-5 font-semibold text-on-accent">Build it in the Studio</Link>
            <a href="/demo/night-set.html" className="inline-flex h-[46px] items-center rounded-[11px] border border-border-2 bg-surface px-5 font-semibold">Open full screen</a>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <DawDemo />
        </Reveal>
      </section>

      <section className="relative overflow-hidden border-b border-border bg-[linear-gradient(180deg,#0B0C10_0%,#0E1117_60%,#0B0C10_100%)]">
        <Strip title="Sections" note={`${registry.filter((e) => e.kind === "section").length}`} href="/components?kind=section">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((e, i) => (
              <Reveal key={e.name} delay={i * 0.07}>
                <TiltCard className="rounded-[14px]"><ComponentCard entry={e} /></TiltCard>
              </Reveal>
            ))}
          </div>
        </Strip>
      </section>

      <Strip title="Components" note={`${registry.length} · ${readyCount} live`} href="/components">
        <DriftRow speed={36}>
          {general.map((e) => (
            <div key={e.name} className="w-[300px] shrink-0">
              <ComponentCard entry={e} />
            </div>
          ))}
        </DriftRow>
      </Strip>

      <section className="mx-auto max-w-[1240px] px-5 pt-24">
        <ScrollLightText
          className="max-w-[24ch] font-display text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.05] tracking-[-0.035em]"
          text="Every component is live 3D, works with hands and controllers, and lands in your repo as one file you own."
        />
      </section>

      <section id="mcp" className="mx-auto max-w-[1240px] px-5 pt-26">
        <Reveal>
          <H2>Copy the prompt. <span className="accent-word">Paste it</span> anywhere.</H2>
          <p className="mt-3.5 max-w-[52ch] text-[17px] text-muted">
            Every component ships as one self-contained .tsx file and a prompt your coding agent can act on. Or skip the code and place it with your hands in the Studio.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10 grid gap-5 md:grid-cols-3">
          <Agent tone="warm" title="Claude Code" body="Paste the prompt in your terminal. The Spatial MCP finds the file and wires it into your scene." lines={[
            <><span className="text-faint">&gt;</span> add the glass settings panel from Spatial</>,
            <><span className="text-warm">●</span> spatial.get_component(&quot;settings-glass&quot;)</>,
            <><span className="text-warm">●</span> spatial.add_component(...)</>,
            <><span className="text-accent">✓</span> components/spatial/settings-glass.tsx</>,
            <><span className="text-accent">✓</span> rendered in &lt;Scene /&gt;</>,
          ]} />
          <Agent tone="cool" title="Cursor and any MCP client" body="Same tools in every editor. Search, pull, then edit it like code you wrote." lines={[
            <span key="c" className="text-faint">{"// any MCP client"}</span>,
            <>search_components(&quot;settings&quot;)</>,
            <>  → default, glass, horizon</>,
            <>get_component(&quot;settings-glass&quot;)</>,
            <><span className="text-accent">✓</span> source + npm deps</>,
          ]} />
          <Agent tone="mint" title="Studio, in your headset" body="Grab components off a floating shelf, place them with your hands, launch a real app." lines={[
            <span key="s" className="text-faint">Studio · my-daw</span>,
            <>grab   drum-pad   → (0.2, 1.1, -0.6)</>,
            <>grab   knob       → (0.5, 1.2, -0.6)</>,
            <>bind   knob.value → tempo</>,
            <><span className="text-accent">✓</span> Launch → /apps/my-daw</>,
          ]} />
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 pt-26">
        <Reveal>
          <H2>One component, <span className="accent-word">three</span> looks.</H2>
          <p className="mt-3.5 max-w-[52ch] text-[17px] text-muted">Switch styles without touching your app&apos;s state. Same props, same events, different material.</p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10 grid gap-5 md:grid-cols-3">
          {looks.map((e) => (
            <Link key={e.name} href={`/components/${e.name}`} className="group overflow-hidden rounded-[18px] border border-border bg-bg-2 hover:border-border-2">
              <div className="stage-bg aspect-[16/10]">
                <Preview name={e.name} />
              </div>
              <div className="grid gap-1 px-5 pb-5 pt-4.5">
                <b className="font-display text-[17px] font-bold capitalize">{e.style}</b>
                <span className="text-sm text-muted">{e.description}</span>
              </div>
            </Link>
          ))}
        </Reveal>
      </section>

      <section className="relative mt-30 overflow-hidden border-y border-border">
        <div className="floor-grid !h-[90%] !opacity-40" aria-hidden />
        <div className="relative mx-auto grid max-w-[1240px] justify-items-center gap-7 px-5 py-30 text-center">
          <H2 className="max-w-[16ch] !text-[clamp(2.4rem,5vw,4rem)]">Built for hands. <span className="accent-word">Ready</span> for agents.</H2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/components" className="inline-flex h-[46px] items-center rounded-[11px] bg-accent px-5 font-semibold text-on-accent">Browse components</Link>
            <a href="https://github.com/munchingwolf/molten/tree/main/mcp" className="inline-flex h-[46px] items-center rounded-[11px] border border-border-2 bg-surface px-5 font-semibold">Add the MCP</a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] gap-12 px-5 py-26 md:grid-cols-[1fr_1.7fr]">
        <div>
          <H2 className="!text-[clamp(2rem,3.4vw,2.8rem)]">Questions, <span className="accent-word">answered</span></H2>
          <p className="mt-3 text-[15px] text-muted">Using components, the Studio, and the MCP.</p>
        </div>
        <div>
          {faqs.map(([q, a], i) => (
            <details key={q} open={i === 0} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-baseline gap-4 py-4.5 font-medium [&::-webkit-details-marker]:hidden">
                <span className="w-5.5 font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                {q}
                <span className="ml-auto text-faint transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="-mt-1.5 mb-5 ml-9.5 max-w-[60ch] text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-8 px-5 pb-10 pt-14 text-sm md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-[30ch] text-faint">Components built on pmndrs/uikit and React Three Fiber, both MIT.</p>
          </div>
          <FooterCol title="Product" links={[["Components", "/components"], ["Sections", "/components?kind=section"], ["Studio", "/studio"]]} />
          <FooterCol title="Developers" links={[["MCP server", "https://github.com/munchingwolf/molten/tree/main/mcp"], ["Component contract", "https://github.com/munchingwolf/molten/blob/main/SPEC.md"]]} />
          <FooterCol title="Connect" links={[["GitHub", "https://github.com/munchingwolf/molten"]]} />
        </div>
      </footer>
    </main>
  )
}

function H2({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`max-w-[18ch] text-balance font-display text-[clamp(2rem,3.6vw,3rem)] font-bold leading-[1.02] tracking-[-0.035em] ${className}`}>
      {children}
    </h2>
  )
}

function Strip({ title, note, href, children }: { title: string; note: string; href: string; children: React.ReactNode }) {
  return (
    <section className="relative mx-auto max-w-[1240px] px-5 pb-14 pt-6">
      <div className="mb-5 flex items-baseline gap-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="text-[15px] text-faint">{note}</span>
        <Link href={href} className="ml-auto text-sm text-muted hover:text-text">View all →</Link>
      </div>
      {children}
    </section>
  )
}

const tones = {
  warm: "border-[#3A2A20] bg-[linear-gradient(180deg,#2A1D16,#17110D)]",
  cool: "border-border bg-[linear-gradient(180deg,#171C26,#11141B)]",
  mint: "border-[#1F3A33] bg-[linear-gradient(180deg,#13231F,#0E1715)]",
}

function Agent({ tone, title, body, lines }: { tone: keyof typeof tones; title: string; body: string; lines: React.ReactNode[] }) {
  return (
    <TiltCard className="h-full rounded-[18px]">
      <article className={`grid h-full content-start gap-4.5 rounded-[18px] border p-5.5 ${tones[tone]}`}>
        <TerminalLines
          lines={lines}
          className="min-h-[164px] overflow-x-auto rounded-xl border border-white/8 bg-black/40 p-3.5 font-mono text-[12.5px] leading-[1.7] text-[#D9DCE3]"
        />
        <h3 className="font-display text-lg font-bold tracking-[-0.01em]">{title}</h3>
        <p className="-mt-2.5 text-[15px] text-muted">{body}</p>
      </article>
    </TiltCard>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-3 text-[13px] font-semibold">{title}</h4>
      <ul className="grid gap-2 text-muted">
        {links.map(([label, href]) => (
          <li key={label}><a href={href} className="hover:text-text">{label}</a></li>
        ))}
      </ul>
    </div>
  )
}
