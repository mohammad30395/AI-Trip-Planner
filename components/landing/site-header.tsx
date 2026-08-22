import Link from "next/link"

import { AppContainer } from "@/components/app-container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/my-trips", label: "My Trips" },
  { href: "/pricing", label: "Pricing" },
]

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <AppContainer className="flex min-h-16 items-center justify-between gap-4 py-3">
        <Link
          href="/"
          className="app-focus-ring inline-flex items-center gap-3 rounded-md"
          aria-label="AI Trip Planner home"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            AI
          </span>
          <span className="font-heading text-base font-semibold tracking-tight">
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

        <Link
          href="/create-trip"
          className={cn(buttonVariants({ size: "lg" }), "sm:inline-flex")}
        >
          Create Trip
        </Link>
      </AppContainer>
    </header>
  )
}

export { SiteHeader }
