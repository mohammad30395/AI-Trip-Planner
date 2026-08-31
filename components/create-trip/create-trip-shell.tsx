"use client"

import { Badge } from "@/components/ui/badge"

import { ConversationPanel } from "./conversation-panel"
import { TripPreviewPanel } from "./trip-preview-panel"
import { useCreateTripController } from "./use-create-trip-controller"

function CreateTripShell() {
  const controller = useCreateTripController()

  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-3xl">
        <Badge variant="outline">AI conversation shell</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          Create Trip
        </h1>
        <p className="app-muted mt-3 max-w-2xl leading-7">
          Collect trip requirements with a server-side AI interviewer, then
          generate a typed itinerary after review. Save the generated trip to
          your account when the itinerary is ready.
        </p>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-start">
        <ConversationPanel
          onConfirm={controller.submitCurrentRequirements}
          onGenerateFinal={controller.generateFinalItinerary}
          onReset={controller.resetFlow}
          onSaveTrip={controller.saveTrip}
          onSelectBudget={controller.selectBudget}
          onSubmitDestination={controller.submitDestination}
          onSubmitDuration={controller.submitDuration}
          onSubmitGroup={controller.submitGroup}
          onSubmitSource={controller.submitSource}
          selector={controller.selector}
          state={controller.state}
        />
        <TripPreviewPanel
          requirements={controller.state.requirements}
          step={controller.state.currentStep}
        />
      </div>
    </section>
  )
}

export { CreateTripShell }
