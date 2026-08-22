import type { Dispatch } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

import {
  type CreateTripAction,
  type CreateTripState,
  type UISelector,
} from "./create-trip-flow"
import { renderGenerativeUI } from "./generative-ui"

type ConversationPanelProps = {
  state: CreateTripState
  selector: UISelector
  dispatch: Dispatch<CreateTripAction>
}

function ConversationPanel({
  dispatch,
  selector,
  state,
}: ConversationPanelProps) {
  const isComplete = state.currentStep === "complete"

  return (
    <Card className="app-card min-w-0">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Planning Conversation</CardTitle>
            <p className="app-muted mt-1 text-sm">
              Step {getStepNumber(state.currentStep)} of 6
            </p>
          </div>
          <Badge variant={isComplete ? "default" : "secondary"}>
            {isComplete ? "Ready" : "Draft"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div
          className="grid max-h-[360px] min-h-[280px] gap-3 overflow-y-auto rounded-lg border bg-muted/25 p-3"
          aria-live="polite"
        >
          {state.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[92%] rounded-lg px-3 py-2 text-sm leading-6",
                message.role === "assistant"
                  ? "justify-self-start bg-background text-foreground ring-1 ring-border"
                  : "justify-self-end bg-primary text-primary-foreground"
              )}
            >
              {message.content}
            </div>
          ))}
        </div>

        {state.error !== null ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        {renderGenerativeUI({
          selector,
          requirements: state.requirements,
          onSubmitSource: (value) =>
            dispatch({ type: "submitSource", value }),
          onSubmitDestination: (value) =>
            dispatch({ type: "submitDestination", value }),
          onSubmitDuration: (value) =>
            dispatch({ type: "submitDuration", value }),
          onSelectBudget: (value) =>
            dispatch({ type: "submitBudget", value }),
          onSubmitGroup: (value) => dispatch({ type: "submitGroup", value }),
          onConfirm: () => dispatch({ type: "confirm" }),
          onReset: () => dispatch({ type: "reset" }),
        })}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button
          className="w-full sm:w-auto"
          disabled={state.isLoading}
          type="button"
          variant="outline"
          onClick={() => dispatch({ type: "reset" })}
        >
          Start Over
        </Button>
      </CardFooter>
    </Card>
  )
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
    case "complete":
      return 6
  }
}

export { ConversationPanel }
