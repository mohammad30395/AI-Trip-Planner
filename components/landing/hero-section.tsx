import { ArrowDown } from "lucide-react"

import { AppContainer } from "@/components/app-container"
import { TripPromptComposer } from "@/components/landing/trip-prompt-composer"

function HeroSection() {
  return (
    <section className="overflow-hidden bg-background">
      <AppContainer className="grid min-w-0 justify-items-center pt-14 pb-8 text-center sm:pt-24 sm:pb-12 lg:pt-28">
        <div className="max-w-6xl min-w-0">
          <h1 className="font-heading text-[2rem] leading-tight font-bold text-foreground text-balance sm:text-5xl lg:text-6xl">
            Hey, I&apos;m your personal{" "}
            <span className="text-primary">Trip Planner</span>
          </h1>
          <p className="mx-auto mt-5 max-w-4xl text-base leading-7 font-medium text-muted-foreground sm:mt-7 sm:text-lg">
            Tell us your source, destination, duration, budget, and group size.
            The authenticated planner turns those details into a day-by-day trip
            with hotels, activities, maps, and saved itineraries.
          </p>
        </div>

        <div className="mt-8 w-full sm:mt-9">
          <TripPromptComposer />
        </div>

        <a
          href="#product-preview"
          className="app-focus-ring mt-10 inline-flex min-h-11 flex-wrap items-center justify-center gap-2 rounded-[var(--app-pill-radius)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-soft-surface sm:mt-20 sm:text-base"
        >
          <span className="text-muted-foreground">Not sure where to start?</span>
          <span>See how it works</span>
          <ArrowDown aria-hidden="true" className="size-5" />
        </a>
      </AppContainer>
    </section>
  )
}

export { HeroSection }
