import Link from "next/link"

import { AuthControls } from "@/components/auth/auth-controls"
import { AppContainer } from "@/components/app-container"

const navItems = [
  { href: "/my-trips", label: "My Trips" },
  { href: "/pricing", label: "Pricing" },
]

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <AppContainer className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
        <Link
          href="/"
          className="app-focus-ring inline-flex min-w-0 items-center gap-3 rounded-md"
          aria-label="AI Trip Planner home"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            AI
          </span>
          <span className="max-w-[9rem] truncate font-heading text-base font-semibold tracking-tight sm:max-w-none">
            AI Trip Planner
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 text-sm text-muted-foreground md:flex"
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="app-focus-ring rounded-md px-3 py-2 transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <AuthControls />
      </AppContainer>
    </header>
  )
}

export { SiteHeader }
