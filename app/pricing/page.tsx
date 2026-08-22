import Link from "next/link"

import { AppContainer } from "@/components/app-container"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b bg-muted/20">
          <AppContainer className="py-12 sm:py-16">
            <div className="max-w-2xl">
              <Badge variant="outline">Route placeholder</Badge>
              <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Pricing
              </h1>
              <p className="app-muted mt-3 leading-7">
                This public route reserves space for Clerk Billing plans. No
                pricing, entitlement checks, or checkout behavior is implemented
                yet.
              </p>
            </div>
          </AppContainer>
        </section>

        <section className="app-section">
          <AppContainer className="grid min-w-0 gap-4 md:grid-cols-2">
            <Card className="app-card">
              <CardHeader>
                <CardTitle>Free access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="app-muted leading-7">
                  Future milestones will enforce the documented free generation
                  quota before expensive AI work runs.
                </p>
              </CardContent>
            </Card>
            <Card className="app-card">
              <CardHeader>
                <CardTitle>Paid access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="app-muted leading-7">
                  Paid entitlement handling will be added with Clerk Billing in
                  a later milestone.
                </p>
              </CardContent>
            </Card>
          </AppContainer>
        </section>

        <AppContainer className="pb-12">
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
