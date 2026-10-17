import Link from "next/link"

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-display text-xl font-extrabold tracking-tight">
          Spatial
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/components" className="hover:underline">Components</Link>
          <Link href="/studio" className="hover:underline">Studio</Link>
          <a href="#mcp" className="hidden hover:underline sm:inline">MCP</a>
          <a
            href="https://github.com/munchingwolf/molten"
            className="rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  )
}
