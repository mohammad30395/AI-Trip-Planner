import { AppContainer } from "@/components/app-container"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

const steps = [
  {
    title: "Share the basics",
    description:
      "Start with where you are leaving from, where you want to go, how long you have, your budget, and group size.",
  },
  {
    title: "Shape the plan",
    description:
      "The future conversational flow can clarify preferences before producing a structured itinerary.",
  },
  {
    title: "Review and save",
    description:
      "Upcoming milestones will support enriched places, hotel/activity details, maps, and saved trips.",
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="app-section">
      <AppContainer>
        <div className="max-w-2xl">
          <p className="app-muted text-sm font-medium uppercase tracking-wider">
            How it works
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
            A simple path from rough idea to structured trip.
          </h2>
        </div>
        <div className="mt-8 grid min-w-0 gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={step.title} className="app-card min-w-0">
              <CardHeader>
                <div className="flex size-8 items-center justify-center rounded-lg bg-secondary text-sm font-semibold">
                  {index + 1}
                </div>
              </CardHeader>
              <CardContent>
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
