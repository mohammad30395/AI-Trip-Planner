"use client"

import { ConversationPanel } from "./conversation-panel"
import { TripPreviewPanel } from "./trip-preview-panel"
import { useCreateTripController } from "./use-create-trip-controller"

function CreateTripShell() {
  const controller = useCreateTripController()

  return (
    <section className="min-w-0" aria-labelledby="create-trip-title">
      <div className="grid min-w-0 gap-5 lg:h-[calc(100dvh-12rem)] lg:min-h-[40rem] lg:max-h-[56rem] lg:grid-cols-[minmax(22rem,4fr)_minmax(0,6fr)] lg:items-stretch xl:gap-6">
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
