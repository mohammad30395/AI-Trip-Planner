import Link from "next/link"
import { Compass } from "lucide-react"

import { AppContainer } from "@/components/app-container"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { AppStatePanel } from "@/components/ui/app-state-panel"
import { buttonVariants } from "@/components/ui/button"

function NotFoundPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-background">
        <AppContainer className="grid min-h-[calc(100dvh-13rem)] place-items-center py-12 sm:py-16">
          <AppStatePanel
            align="center"
            className="max-w-xl"
            description="The page you requested could not be found. Return home or start a new trip from an existing route."
            icon={Compass}
            title="Page not found"
            tone="neutral"
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/" className={buttonVariants()}>
                  Go Home
                </Link>
                <Link
                  href="/create-trip"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Create Trip
                </Link>
              </div>
            }
          />
        </AppContainer>
      </main>
      <SiteFooter />
    </>
  )
}

export default NotFoundPage
