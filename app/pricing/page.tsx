import { PricingTable } from "@clerk/nextjs"
import Link from "next/link"
import { ArrowRight, BadgeCheck, Sparkles, WalletCards } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { AppContainer } from "@/components/app-container"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-background">
        <section className="border-b border-border/70">
          <AppContainer className="grid justify-items-center py-14 text-center sm:py-16 lg:py-20">
            <div className="max-w-3xl">
              <Badge variant="outline" className="bg-background">
                Clerk Billing
              </Badge>
              <h1 className="mt-5 font-heading text-4xl leading-tight font-bold tracking-normal sm:text-5xl">
                Choose your trip planning access
              </h1>
              <p className="app-muted mx-auto mt-4 max-w-2xl text-base leading-7 sm:text-lg">
                Review the Clerk-managed access options for final itinerary
                generation. Checkout, subscriptions, and account billing stay
                inside Clerk.
              </p>
            </div>
          </AppContainer>
        </section>

        <section className="app-section">
          <AppContainer className="grid min-w-0 gap-8">
            <div className="mx-auto grid max-w-5xl gap-4 text-center">
              <h2 className="font-heading text-2xl font-bold tracking-normal sm:text-3xl">
                Plans are managed by Clerk
              </h2>
              <p className="app-muted mx-auto max-w-2xl leading-7">
                The table below is the live Clerk PricingTable. It remains the
                source of truth for plan names, pricing, checkout, and current
                subscription state.
              </p>
            </div>

            <div className="app-panel mx-auto w-full max-w-6xl overflow-x-auto p-3 sm:p-5 lg:p-6">
              <PricingTable
                for="user"
                newSubscriptionRedirectUrl="/create-trip"
              />
            </div>

            <div className="mx-auto grid w-full max-w-5xl gap-3 text-left md:grid-cols-3">
              <PricingFact
                icon={Sparkles}
                title="Final generation"
                description="Free quota and paid access are checked when a final itinerary is generated."
              />
              <PricingFact
                icon={WalletCards}
                title="Account billing"
                description="Clerk owns checkout, subscription state, and account billing management."
              />
              <PricingFact
                icon={BadgeCheck}
                title="Saved trips"
                description="Trip ownership and saved itinerary access remain protected by existing auth."
              />
            </div>
          </AppContainer>
        </section>

        <AppContainer className="pb-14 sm:pb-16">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 rounded-[var(--app-card-radius)] border bg-soft-surface p-5 sm:flex-row sm:items-center">
            <p className="app-muted max-w-2xl text-sm leading-6">
              Ready to continue? The trip workspace uses the same route whether
              you are signed in now or Clerk needs to finish authentication
              first.
            </p>
            <Link
              href="/create-trip"
              className={buttonVariants({ className: "w-full sm:w-auto" })}
            >
              Create Trip
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </AppContainer>
      </main>
      <SiteFooter />
    </>
  )
}

function PricingFact({
  description,
  icon: Icon,
  title,
}: {
  description: string
  icon: LucideIcon
  title: string
}) {
  return (
    <div className="rounded-[var(--app-card-radius)] border bg-background p-4 shadow-[var(--app-shadow-card)]">
      <span
        className="grid size-10 place-items-center rounded-[var(--app-control-radius)] bg-accent text-primary"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-heading text-base font-semibold">{title}</h3>
      <p className="app-muted mt-2 text-sm leading-6">{description}</p>
    </div>
  )
}

export default PricingPage
