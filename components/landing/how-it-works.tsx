import { AppContainer } from "@/components/app-container"
import { Card, CardContent } from "@/components/ui/card"

const steps = [
  {
    title: "Tell us about your trip",
    description:
      "Share the source, destination, trip length, budget, and who is traveling.",
  },
  {
    title: "AI builds your itinerary",
    description:
      "The authenticated planner clarifies details and generates a structured day-by-day plan.",
  },
  {
    title: "Explore and save",
    description:
      "Review hotels, activities, practical place details, maps, and save trips to your account.",
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t bg-soft-surface/55 py-12 sm:py-16">
      <AppContainer className="grid gap-8 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)] lg:items-start">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-primary">How it works</p>
          <h2 className="mt-3 font-heading text-2xl leading-tight font-bold text-foreground sm:text-3xl">
            From rough idea to structured trip.
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            The public page starts the flow. The real AI planning experience
            remains protected under your account.
          </p>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={step.title} className="min-w-0">
              <CardContent>
                <div className="mb-5 flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                  {index + 1}
                </div>
                <h3 className="font-heading text-lg font-semibold">
                  {step.title}
                </h3>
                <p className="app-muted mt-3 leading-6">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </AppContainer>
    </section>
  )
}

export { HowItWorks }
