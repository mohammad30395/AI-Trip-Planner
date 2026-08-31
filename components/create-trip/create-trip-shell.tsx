"use client"

import { ConversationPanel } from "./conversation-panel"
import { TripPreviewPanel } from "./trip-preview-panel"
import { useCreateTripController } from "./use-create-trip-controller"

function CreateTripShell() {
  const controller = useCreateTripController()

  return (
    <section className="min-w-0" aria-labelledby="create-trip-title">
      <div className="grid min-w-0 gap-5 xl:h-[calc(100dvh-14rem)] xl:min-h-[28rem] xl:max-h-[52rem] xl:grid-cols-[minmax(22rem,4fr)_minmax(0,6fr)] xl:items-stretch xl:gap-6 2xl:max-h-[56rem]">
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
          hasFinalError={controller.state.finalError !== null}
          hasFinalItinerary={controller.state.finalItinerary !== null}
          hasFinalQuota={controller.state.finalQuota !== null}
          hasSaveError={controller.state.saveError !== null}
          isGeneratingFinal={controller.state.isGeneratingFinal}
          isSavingTrip={controller.state.isSavingTrip}
          requirements={controller.state.requirements}
          savedTripId={controller.state.savedTripId}
          step={controller.state.currentStep}
        />
      </div>
    </section>
  )
}

export { CreateTripShell }
