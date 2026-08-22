import Link from "next/link"

import { AppContainer } from "@/components/app-container"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function HeroSection() {
  return (
    <section className="overflow-hidden border-b">
      <AppContainer className="grid min-w-0 gap-10 py-14 sm:py-18 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)] lg:items-center lg:py-24">
        <div className="min-w-0 max-w-3xl">
          <Badge variant="outline" className="mb-5">
            Public trip planning shell
          </Badge>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Plan the shape of a trip before the details get messy.
          </h1>
          <p className="app-muted mt-5 max-w-2xl text-lg leading-8">
            Give the planner a source, destination, duration, budget, and group
            size. The product milestones ahead will turn those inputs into a
            conversational itinerary with places, hotels, and saved trips.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/create-trip"
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
            >
              Create Trip
            </Link>
            <Link
              href="#how-it-works"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto"
              )}
            >
              See how it works
            </Link>
          </div>
        </div>

        <Card className="app-card relative min-h-[360px] min-w-0 p-5">
          <div className="grid h-full gap-3">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Trip brief
              </p>
              <div className="mt-4 grid gap-3 text-sm">
                <PreviewRow label="From" value="Dhaka" />
                <PreviewRow label="To" value="Coastal escape" />
                <PreviewRow label="Duration" value="5 days" />
                <PreviewRow label="Budget" value="Comfort focused" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm font-medium">Day-by-day plan</p>
                <p className="app-muted mt-2 text-sm leading-6">
                  Balanced mornings, flexible afternoons, and practical travel
                  notes.
                </p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm font-medium">Place context</p>
                <p className="app-muted mt-2 text-sm leading-6">
                  Hotels and activities prepared for future Places enrichment.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </AppContainer>
    </section>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 rounded-md bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium break-words">{value}</span>
    </div>
  )
}

export { HeroSection }
