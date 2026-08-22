import type { Dispatch, ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import {
  budgetOptions,
  groupTypeOptions,
  type CreateTripAction,
  type CreateTripState,
  type UISelector,
} from "./create-trip-flow"

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

        <StepInput
          dispatch={dispatch}
          isComplete={isComplete}
          selector={selector}
          state={state}
        />
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
        <Button
          className="w-full sm:w-auto"
          disabled={state.isLoading || isComplete}
          type="button"
          onClick={() => dispatch({ type: "continue" })}
        >
          {state.currentStep === "review" ? "Confirm Brief" : "Continue"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function StepInput({
  dispatch,
  isComplete,
  selector,
  state,
}: ConversationPanelProps & { isComplete: boolean }) {
  if (isComplete) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">Local brief complete</p>
        <p className="app-muted mt-1 text-sm leading-6">
          Start over to test another set of trip requirements.
        </p>
      </div>
    )
  }

  switch (selector) {
    case "source":
      return (
        <FieldBlock label="Starting point" helper="City, airport, or region">
          <Input
            aria-label="Starting point"
            autoComplete="off"
            placeholder="Dhaka"
            value={state.requirements.source}
            onChange={(event) =>
              dispatch({
                type: "setText",
                field: "source",
                value: event.currentTarget.value,
              })
            }
          />
        </FieldBlock>
      )
    case "destination":
      return (
        <FieldBlock label="Destination" helper="Where should the trip go?">
          <Input
            aria-label="Destination"
            autoComplete="off"
            placeholder="Tokyo"
            value={state.requirements.destination}
            onChange={(event) =>
              dispatch({
                type: "setText",
                field: "destination",
                value: event.currentTarget.value,
              })
            }
          />
        </FieldBlock>
      )
    case "duration":
      return (
        <FieldBlock label="Duration" helper="Enter 1 to 30 days">
          <Input
            aria-label="Duration in days"
            inputMode="numeric"
            min={1}
            max={30}
            placeholder="5"
            type="number"
            value={state.requirements.durationDays ?? ""}
            onChange={(event) =>
              dispatch({
                type: "setDuration",
                value: event.currentTarget.value,
              })
            }
          />
        </FieldBlock>
      )
    case "budget":
      return (
        <FieldBlock label="Budget tier" helper="Choose the planning style">
          <div className="grid gap-2 sm:grid-cols-3">
            {budgetOptions.map((option) => (
              <button
                key={option.value}
                className={cn(
                  "app-focus-ring rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted",
                  state.requirements.budgetTier === option.value &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary"
                )}
                type="button"
                onClick={() =>
                  dispatch({ type: "setBudget", value: option.value })
                }
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span
                  className={cn(
                    "mt-1 block text-xs leading-5 text-muted-foreground",
                    state.requirements.budgetTier === option.value &&
                      "text-primary-foreground/80"
                  )}
                >
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </FieldBlock>
      )
    case "group":
      return (
        <div className="grid gap-4">
          <FieldBlock label="Group type" helper="Pick the closest match">
            <div className="flex flex-wrap gap-2">
              {groupTypeOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={
                    state.requirements.groupType === option.value
                      ? "default"
                      : "outline"
                  }
                  onClick={() =>
                    dispatch({ type: "setGroupType", value: option.value })
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </FieldBlock>
          <FieldBlock label="Group size" helper="Enter 1 to 20 travelers">
            <Input
              aria-label="Group size"
              inputMode="numeric"
              min={1}
              max={20}
              placeholder="2"
              type="number"
              value={state.requirements.groupSize ?? ""}
              onChange={(event) =>
                dispatch({
                  type: "setGroupSize",
                  value: event.currentTarget.value,
                })
              }
            />
          </FieldBlock>
        </div>
      )
    case "review":
      return (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">Review ready</p>
          <p className="app-muted mt-1 text-sm leading-6">
            Confirm the brief to complete this local interaction shell.
          </p>
        </div>
      )
  }
}

function FieldBlock({
  children,
  helper,
  label,
}: {
  children: ReactNode
  helper: string
  label: string
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      <span className="app-muted text-xs">{helper}</span>
    </div>
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
