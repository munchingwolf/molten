import Link from "next/link"

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-display text-[19px] font-bold tracking-[-0.02em]">
      <span aria-hidden className="relative size-[22px] [transform:perspective(60px)_rotateX(18deg)_rotateY(-18deg)]">
        <i className="absolute inset-0 rounded-[5px] border-[1.5px] border-text" />
        <i className="absolute inset-[4px_-4px_-4px_4px] rounded-[5px] border-[1.5px] border-accent" />
      </span>
      Spatial
    </Link>
  )
}

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center gap-7 px-5">
        <Logo />
        <nav className="hidden gap-5.5 text-[14.5px] text-muted lg:flex">
          <Link href="/components" className="hover:text-text">Components</Link>
          <Link href="/components?kind=section" className="hover:text-text">Sections</Link>
          <Link href="/studio" className="hover:text-text">Studio</Link>
          <Link href="/#mcp" className="hover:text-text">MCP</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/components"
            className="hidden h-9 w-60 items-center rounded-[9px] border border-border bg-bg-2 px-3 text-sm text-faint lg:flex"
          >
            Search components
            <kbd className="ml-auto rounded-[5px] border border-border-2 px-1.5 font-mono text-[11px] text-muted">/</kbd>
          </Link>
          <Link href="/studio" className="inline-flex h-9 items-center rounded-[9px] bg-accent px-3.5 text-sm font-semibold text-on-accent hover:brightness-105">
            Open Studio
          </Link>
        </div>
      </div>
    </header>
  )
}
