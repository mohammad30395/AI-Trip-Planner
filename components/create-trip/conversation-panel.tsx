import { Bot, LoaderCircle, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  type CreateTripState,
  type BudgetTier,
  type GroupSelection,
  type UISelector,
} from "./create-trip-flow"
import { renderGenerativeUI } from "./generative-ui"

type ConversationPanelProps = {
  state: CreateTripState
  selector: UISelector
  onSubmitSource: (value: string) => void
  onSubmitDestination: (value: string) => void
  onSubmitDuration: (value: number) => void
  onSelectBudget: (value: BudgetTier) => void
  onSubmitGroup: (value: GroupSelection) => void
  onConfirm: () => void
  onGenerateFinal: () => void
  onSaveTrip: () => void
  onReset: () => void
}

function ConversationPanel({
  onConfirm,
  onGenerateFinal,
  onReset,
  onSaveTrip,
  onSelectBudget,
  onSubmitDestination,
  onSubmitDuration,
  onSubmitGroup,
  onSubmitSource,
  selector,
  state,
}: ConversationPanelProps) {
  const isComplete = state.currentStep === "readyForFinal"
  const isBusy = state.isLoading || state.isGeneratingFinal || state.isSavingTrip
  const statusLabel = getStatusLabel(state, isComplete)

  return (
    <section className="app-panel flex min-h-[30rem] min-w-0 flex-col overflow-hidden sm:min-h-[34rem] xl:h-full xl:min-h-0">
      <header className="flex-none border-b px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge variant="outline">
              <Bot aria-hidden="true" />
              AI planning
            </Badge>
            <h1
              id="create-trip-title"
              className="mt-3 max-w-xl font-heading text-xl leading-tight font-bold tracking-normal text-foreground sm:text-2xl"
            >
              Start Planning new{" "}
              <span className="text-primary">Trip</span> using AI
            </h1>
            <p className="app-muted mt-2 max-w-2xl text-sm leading-6">
              Collect trip requirements with the assistant, then generate and
              save a structured itinerary when the brief is ready.
            </p>
          </div>
          <div className="grid shrink-0 gap-2 sm:justify-items-end">
            <Badge variant={isComplete ? "default" : "secondary"}>
              {statusLabel}
            </Badge>
            <p className="text-sm font-medium text-muted-foreground">
              Step {getStepNumber(state.currentStep)} of 6
            </p>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        <div
          className="min-h-[12rem] flex-1 overflow-y-auto rounded-[var(--app-card-radius)] border bg-soft-surface/70 p-3 sm:min-h-[16rem] sm:p-4 xl:min-h-0"
          aria-live="polite"
        >
          <div className="grid gap-3">
            {state.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[88%] break-words px-3.5 py-2.5 text-sm leading-6 shadow-sm",
                  message.role === "assistant"
                    ? "justify-self-start rounded-[1.25rem] rounded-tl-sm bg-background text-foreground ring-1 ring-border/80"
                    : "justify-self-end rounded-[1.25rem] rounded-tr-sm bg-primary text-primary-foreground shadow-[var(--app-shadow-primary)]"
                )}
              >
                {message.content}
              </div>
            ))}
            {state.isLoading ? <AssistantLoadingBubble /> : null}
          </div>
        </div>

        {state.error !== null ? (
          <p className="rounded-[var(--app-control-radius)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <div className="flex-none overflow-y-auto rounded-[var(--app-card-radius)] border bg-background p-4 xl:max-h-[min(22rem,38dvh)]">
          {renderGenerativeUI({
            disabled: isBusy,
            selector,
            requirements: state.requirements,
            onSubmitSource,
            onSubmitDestination,
            onSubmitDuration,
            onSelectBudget,
            onSubmitGroup,
            onConfirm,
            onGenerateFinal,
            onReset,
            onSaveTrip,
            finalError: state.finalError,
            finalQuota: state.finalQuota,
            finalItinerary: state.finalItinerary,
            generationAccess: state.generationAccess,
            isGeneratingFinal: state.isGeneratingFinal,
            isSavingTrip: state.isSavingTrip,
            saveError: state.saveError,
            savedTripId: state.savedTripId,
          })}
        </div>
      </div>

      <footer className="flex flex-none flex-col gap-3 border-t bg-soft-surface/50 p-4 sm:flex-row sm:justify-between sm:px-5">
        <Button
          className="w-full sm:w-auto"
          disabled={isBusy}
          type="button"
          variant="outline"
          onClick={onReset}
        >
          <RotateCcw aria-hidden="true" />
          Start Over
        </Button>
      </footer>
    </section>
  )
}

function AssistantLoadingBubble() {
  return (
    <div className="flex max-w-[88%] items-center gap-2 justify-self-start rounded-[1.25rem] rounded-tl-sm bg-background px-3.5 py-2.5 text-sm text-muted-foreground shadow-sm ring-1 ring-border/80">
      <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
      <span>Thinking...</span>
    </div>
  )
}

function getStatusLabel(state: CreateTripState, isComplete: boolean) {
  if (state.isSavingTrip) {
    return "Saving"
  }

  if (state.isGeneratingFinal) {
    return "Generating"
  }

  if (state.isLoading) {
    return "Thinking"
  }

  return isComplete ? "Ready" : "Draft"
}

function getStepNumber(step: CreateTripState["currentStep"]) {
  switch (step) {
    case "source":
      return 1
    case "destination":
      return 2
    case "duration":
      return 3
    case "budget":
      return 4
    case "group":
      return 5
    case "review":
    case "readyForFinal":
      return 6
  }
}

export { ConversationPanel }
