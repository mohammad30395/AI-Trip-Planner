import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import {
  budgetOptions,
  formatBudget,
  formatGroupType,
  groupTypeOptions,
  type BudgetTier,
  type GroupSelection,
  type GroupType,
  type TripRequirements,
  type UISelector,
} from "./create-trip-flow"

type RenderGenerativeUIProps = {
  selector: UISelector | string
  requirements: TripRequirements
  disabled: boolean
  onSubmitSource: (value: string) => void
  onSubmitDestination: (value: string) => void
  onSubmitDuration: (value: number) => void
  onSelectBudget: (value: BudgetTier) => void
  onSubmitGroup: (value: GroupSelection) => void
  onConfirm: () => void
  onReset: () => void
}

function renderGenerativeUI({
  disabled,
  selector,
  requirements,
  onConfirm,
  onReset,
  onSelectBudget,
  onSubmitDestination,
  onSubmitDuration,
  onSubmitGroup,
  onSubmitSource,
}: RenderGenerativeUIProps) {
  switch (selector) {
    case "source":
      return (
        <SourceDestinationInputUI
          key="source"
          helper="City, airport, or region"
          label="Starting point"
          placeholder="Dhaka"
          value={requirements.source}
          disabled={disabled}
          onSubmit={onSubmitSource}
        />
      )
    case "destination":
      return (
        <SourceDestinationInputUI
          key="destination"
          helper="Where should the trip go?"
          label="Destination"
          placeholder="Tokyo"
          value={requirements.destination}
          disabled={disabled}
          onSubmit={onSubmitDestination}
        />
      )
    case "duration":
      return (
        <DurationSelectionUI
          key="duration"
          disabled={disabled}
          value={requirements.durationDays}
          onSubmit={onSubmitDuration}
        />
      )
    case "budget":
      return (
        <BudgetUI
          disabled={disabled}
          value={requirements.budgetTier}
          onSelect={onSelectBudget}
        />
      )
    case "group":
      return (
        <GroupSizeUI
          key="group"
          disabled={disabled}
          groupSize={requirements.groupSize}
          groupType={requirements.groupType}
          onSubmit={onSubmitGroup}
        />
      )
    case "review":
      return (
        <ReviewConfirmUI
          disabled={disabled}
          requirements={requirements}
          onSubmit={onConfirm}
        />
      )
    case "final":
      return <FinalGeneratingPlaceholder disabled={disabled} onSubmit={onReset} />
    default:
      return <UnknownSelectorFallback selector={selector} />
  }
}

type SourceDestinationInputUIProps = {
  label: string
  helper: string
  placeholder: string
  value: string
  disabled: boolean
  onSubmit: (value: string) => void
}

function SourceDestinationInputUI({
  helper,
  label,
  placeholder,
  value,
  disabled,
  onSubmit,
}: SourceDestinationInputUIProps) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()

        const normalizedDraft = draft.trim()

        if (normalizedDraft.length === 0) {
          setError(`Enter ${label.toLowerCase()}.`)
          return
        }

        setError(null)
        onSubmit(normalizedDraft)
      }}
    >
      <FieldText label={label} helper={helper} />
      <Input
        aria-invalid={error !== null}
        aria-label={label}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          setError(null)
        }}
      />
      {error !== null ? <InlineError message={error} /> : null}
      <Button className="w-full sm:w-fit" disabled={disabled} type="submit">
        Use {label}
      </Button>
    </form>
  )
}

type DurationSelectionUIProps = {
  value: number | null
  disabled: boolean
  onSubmit: (value: number) => void
}

function DurationSelectionUI({
  disabled,
  value,
  onSubmit,
}: DurationSelectionUIProps) {
  const [draft, setDraft] = useState(value?.toString() ?? "")
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()

        const parsedDuration = Number(draft)

        if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
          setError("Enter a whole number of days.")
          return
        }

        if (parsedDuration > 30) {
          setError("Duration must be 30 days or fewer.")
          return
        }

        setError(null)
        onSubmit(parsedDuration)
      }}
    >
      <FieldText label="Duration" helper="Enter 1 to 30 days." />
      <Input
        aria-invalid={error !== null}
        aria-label="Duration in days"
        disabled={disabled}
        inputMode="numeric"
        min={1}
        max={30}
        placeholder="5"
        type="number"
        value={draft}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          setError(null)
        }}
      />
      {error !== null ? <InlineError message={error} /> : null}
      <Button className="w-full sm:w-fit" disabled={disabled} type="submit">
        Use Duration
      </Button>
    </form>
  )
}

type BudgetUIProps = {
  value: BudgetTier | null
  disabled: boolean
  onSelect: (value: BudgetTier) => void
}

function BudgetUI({ disabled, value, onSelect }: BudgetUIProps) {
  return (
    <div className="grid gap-3">
      <FieldText label="Budget tier" helper="Choose the planning style." />
      <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Budget tier">
        {budgetOptions.map((option) => {
          const isSelected = value === option.value

          return (
            <button
              key={option.value}
              aria-pressed={isSelected}
              className={cn(
                "app-focus-ring rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted",
                isSelected &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary"
              )}
              disabled={disabled}
              type="button"
              onClick={() => onSelect(option.value)}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span
                className={cn(
                  "mt-1 block text-xs leading-5 text-muted-foreground",
                  isSelected && "text-primary-foreground/80"
                )}
              >
                {option.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

type GroupSizeUIProps = {
  groupType: GroupType | null
  groupSize: number | null
  disabled: boolean
  onSubmit: (value: GroupSelection) => void
}

function GroupSizeUI({
  disabled,
  groupSize,
  groupType,
  onSubmit,
}: GroupSizeUIProps) {
  const [selectedType, setSelectedType] = useState<GroupType | null>(groupType)
  const [draftSize, setDraftSize] = useState(groupSize?.toString() ?? "")
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()

        const parsedSize = Number(draftSize)

        if (selectedType === null) {
          setError("Choose a group type.")
          return
        }

        if (!Number.isInteger(parsedSize) || parsedSize < 1) {
          setError("Enter a whole group size.")
          return
        }

        if (parsedSize > 20) {
          setError("Group size must be 20 travelers or fewer.")
          return
        }

        setError(null)
        onSubmit({
          groupSize: parsedSize,
          groupType: selectedType,
        })
      }}
    >
      <div className="grid gap-2">
        <FieldText label="Group type" helper="Pick the closest match." />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Group type">
          {groupTypeOptions.map((option) => (
            <Button
              key={option.value}
              aria-pressed={selectedType === option.value}
              disabled={disabled}
              type="button"
              variant={selectedType === option.value ? "default" : "outline"}
              onClick={() => {
                setSelectedType(option.value)
                setError(null)
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <FieldText label="Group size" helper="Enter 1 to 20 travelers." />
        <Input
          aria-invalid={error !== null}
          aria-label="Group size"
          disabled={disabled}
          inputMode="numeric"
          min={1}
          max={20}
          placeholder="2"
          type="number"
          value={draftSize}
          onChange={(event) => {
            setDraftSize(event.currentTarget.value)
            setError(null)
          }}
        />
      </div>
      {error !== null ? <InlineError message={error} /> : null}
      <Button className="w-full sm:w-fit" disabled={disabled} type="submit">
        Use Travelers
      </Button>
    </form>
  )
}

type ReviewConfirmUIProps = {
  requirements: TripRequirements
  disabled: boolean
  onSubmit: () => void
}

function ReviewConfirmUI({
  disabled,
  requirements,
  onSubmit,
}: ReviewConfirmUIProps) {
  return (
    <div className="grid gap-4 rounded-lg border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium">Review the local trip brief</p>
        <p className="app-muted mt-1 text-sm leading-6">
          Confirming moves this conversation to READY_FOR_FINAL. It does not
          generate an itinerary or save data yet.
        </p>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <ReviewItem label="Source" value={requirements.source || "Not set"} />
        <ReviewItem
          label="Destination"
          value={requirements.destination || "Not set"}
        />
        <ReviewItem
          label="Duration"
          value={
            requirements.durationDays === null
              ? "Not set"
              : `${requirements.durationDays} day${requirements.durationDays === 1 ? "" : "s"}`
          }
        />
        <ReviewItem label="Budget" value={formatBudget(requirements.budgetTier)} />
        <ReviewItem
          label="Travelers"
          value={`${requirements.groupSize ?? "?"} ${formatGroupType(
            requirements.groupType
          )} traveler${requirements.groupSize === 1 ? "" : "s"}`}
        />
      </dl>
      <Button
        className="w-full sm:w-fit"
        disabled={disabled}
        type="button"
        onClick={onSubmit}
      >
        Confirm Brief
      </Button>
    </div>
  )
}

type FinalGeneratingPlaceholderProps = {
  disabled: boolean
  onSubmit: () => void
}

function FinalGeneratingPlaceholder({
  disabled,
  onSubmit,
}: FinalGeneratingPlaceholderProps) {
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium">READY_FOR_FINAL</p>
        <p className="app-muted mt-1 text-sm leading-6">
          The trip brief is complete. A later milestone will generate the final
          itinerary from this state.
        </p>
      </div>
      <Button
        className="w-full sm:w-fit"
        disabled={disabled}
        type="button"
        onClick={onSubmit}
      >
        Start Another Brief
      </Button>
    </div>
  )
}

function UnknownSelectorFallback({ selector }: { selector: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium">Unsupported UI request</p>
      <p className="app-muted mt-1 text-sm leading-6">
        The selected UI block could not be rendered safely.
      </p>
      <p className="app-muted mt-3 break-words text-xs">Selector: {selector}</p>
    </div>
  )
}

function FieldText({ helper, label }: { helper: string; label: string }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="app-muted mt-1 text-xs">{helper}</p>
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background p-3 ring-1 ring-border">
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  )
}

export { renderGenerativeUI }
