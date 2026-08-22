import type { ReactNode } from "react"
import Link from "next/link"

import { AuthControls } from "@/components/auth/auth-controls"
import { AppContainer } from "@/components/app-container"

const appNavItems = [
  { href: "/create-trip", label: "Create Trip" },
  { href: "/my-trips", label: "My Trips" },
  { href: "/pricing", label: "Pricing" },
]

function AppRouteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b bg-background">
        <AppContainer className="flex min-h-16 flex-col items-start justify-between gap-3 py-3 md:flex-row md:items-center md:gap-4">
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

          <div className="flex flex-wrap items-center gap-3">
            <nav
              className="flex flex-wrap items-center justify-end gap-1 text-sm text-muted-foreground"
              aria-label="App navigation"
            >
              {appNavItems.map((item) => (
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
          </div>
        </AppContainer>
      </header>
      <main className="flex-1 bg-muted/20">
        <AppContainer className="py-10 sm:py-14">{children}</AppContainer>
      </main>
    </>
  )
}

export default AppRouteLayout
