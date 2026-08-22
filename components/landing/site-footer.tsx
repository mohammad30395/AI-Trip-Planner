import Link from "next/link"

import { AppContainer } from "@/components/app-container"

function SiteFooter() {
  return (
    <footer className="border-t">
      <AppContainer className="flex flex-col gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>AI Trip Planner</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <Link className="app-focus-ring rounded-md hover:text-foreground" href="/">
            Home
          </Link>
          <Link
            className="app-focus-ring rounded-md hover:text-foreground"
            href="/#how-it-works"
          >
            How it works
          </Link>
          <Link
            className="app-focus-ring rounded-md hover:text-foreground"
            href="/my-trips"
          >
            My Trips
          </Link>
          <Link
            className="app-focus-ring rounded-md hover:text-foreground"
            href="/pricing"
          >
            Pricing
          </Link>
          <Link
            className="app-focus-ring rounded-md hover:text-foreground"
            href="/create-trip"
          >
            Create Trip
          </Link>
        </nav>
      </AppContainer>
    </footer>
  )
}

export { SiteFooter }
