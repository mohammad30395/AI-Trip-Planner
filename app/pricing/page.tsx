import { PricingTable } from "@clerk/nextjs"
import Link from "next/link"

import { AppContainer } from "@/components/app-container"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b bg-muted/20">
          <AppContainer className="py-12 sm:py-16">
            <div className="max-w-2xl">
              <Badge variant="outline">Clerk Billing</Badge>
              <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Pricing
              </h1>
              <p className="app-muted mt-3 leading-7">
                Start with the free generation quota, or choose a Clerk-managed
                paid plan once billing is configured in the dashboard.
              </p>
            </div>
          </AppContainer>
        </section>

        <section className="app-section">
          <AppContainer className="grid min-w-0 gap-8">
            <div className="max-w-3xl">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                Choose access
              </h2>
              <p className="app-muted mt-2 leading-7">
                Checkout and subscription management are handled by Clerk
                Billing. The AI authorization bypass for paid users is not
                active until the next milestone.
              </p>
            </div>
            <div className="min-w-0">
              <PricingTable
                for="user"
                newSubscriptionRedirectUrl="/create-trip"
              />
            </div>
          </AppContainer>
        </section>

        <AppContainer className="grid gap-3 pb-12">
          <p className="app-muted max-w-2xl text-sm leading-6">
            Your account menu opens Clerk account management. When user billing
            plans are enabled and public in Clerk, Clerk-managed subscription
            management is exposed there as part of the account experience.
          </p>
          <Link href="/create-trip" className={buttonVariants()}>
            Create Trip
          </Link>
        </AppContainer>
      </main>
      <SiteFooter />
    </>
  )
}

export default PricingPage
