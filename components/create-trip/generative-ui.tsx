import { useId, useState } from "react"
import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FinalItineraryResponse } from "@/lib/ai/contract"
import type {
  FinalItineraryQuota,
  TripGenerationAccessStatus,
} from "@/lib/ai/itinerary"
import { buildQuotaExceededMessage } from "@/lib/quota/free-generation-quota"
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
  onGenerateFinal: () => void
  onSaveTrip: () => void
  onReset: () => void
  finalError: string | null
  finalQuota: FinalItineraryQuota | null
  finalItinerary: FinalItineraryResponse | null
  generationAccess: TripGenerationAccessStatus | null
  isGeneratingFinal: boolean
  isSavingTrip: boolean
  saveError: string | null
  savedTripId: string | null
}

function renderGenerativeUI({
  disabled,
  finalError,
  finalQuota,
  finalItinerary,
  generationAccess,
  isGeneratingFinal,
  isSavingTrip,
  saveError,
  savedTripId,
  selector,
  requirements,
  onConfirm,
  onGenerateFinal,
  onReset,
  onSaveTrip,
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
      return (
        <FinalItineraryUI
          disabled={disabled}
          error={finalError}
          quota={finalQuota}
          access={generationAccess}
          isGenerating={isGeneratingFinal}
          isSaving={isSavingTrip}
          itinerary={finalItinerary}
          onGenerate={onGenerateFinal}
          onReset={onReset}
          onSave={onSaveTrip}
          saveError={saveError}
          savedTripId={savedTripId}
        />
      )
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
  const inputId = useId()
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
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
      <FieldText
        htmlFor={inputId}
        helper={helper}
        helperId={helperId}
        label={label}
      />
      <Input
        id={inputId}
        aria-describedby={error === null ? helperId : `${helperId} ${errorId}`}
        aria-invalid={error !== null}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          setError(null)
        }}
      />
      {error !== null ? <InlineError id={errorId} message={error} /> : null}
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
  const inputId = useId()
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
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
      <FieldText
        htmlFor={inputId}
        helper="Enter 1 to 30 days."
        helperId={helperId}
        label="Duration"
      />
      <Input
        id={inputId}
        aria-describedby={error === null ? helperId : `${helperId} ${errorId}`}
        aria-invalid={error !== null}
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
      {error !== null ? <InlineError id={errorId} message={error} /> : null}
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
  const labelId = useId()

  return (
    <div className="grid gap-3">
      <FieldText
        helper="Choose the planning style."
        label="Budget tier"
        labelId={labelId}
      />
      <div
        className="grid gap-2 sm:grid-cols-3"
        role="group"
        aria-labelledby={labelId}
      >
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
  const groupTypeLabelId = useId()
  const inputId = useId()
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
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
        <FieldText
          helper="Pick the closest match."
          label="Group type"
          labelId={groupTypeLabelId}
        />
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-labelledby={groupTypeLabelId}
        >
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
        <FieldText
          htmlFor={inputId}
          helper="Enter 1 to 20 travelers."
          helperId={helperId}
          label="Group size"
        />
        <Input
          id={inputId}
          aria-describedby={error === null ? helperId : `${helperId} ${errorId}`}
          aria-invalid={error !== null}
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
      {error !== null ? <InlineError id={errorId} message={error} /> : null}
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

type FinalItineraryUIProps = {
  disabled: boolean
  error: string | null
  quota: FinalItineraryQuota | null
  access: TripGenerationAccessStatus | null
  itinerary: FinalItineraryResponse | null
  isGenerating: boolean
  isSaving: boolean
  onGenerate: () => void
  onReset: () => void
  onSave: () => void
  saveError: string | null
  savedTripId: string | null
}

function FinalItineraryUI({
  disabled,
  error,
  quota,
  access,
  itinerary,
  isGenerating,
  isSaving,
  onGenerate,
  onReset,
  onSave,
  saveError,
  savedTripId,
}: FinalItineraryUIProps) {
  const hasSavedTrip = savedTripId !== null

  return (
    <div className="grid gap-4 rounded-lg border bg-muted/30 p-4">
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">READY_FOR_FINAL</p>
          {access !== null ? <AccessStatusBadge access={access} /> : null}
        </div>
        <p className="app-muted mt-1 text-sm leading-6">
          Generate a structured itinerary from the confirmed brief. Prices are
          generated estimates until later enrichment verifies real place data.
        </p>
      </div>

      {quota !== null ? (
        <QuotaExceededNotice message={error} quota={quota} />
      ) : error !== null ? (
        <InlineError message={error} />
      ) : null}

      {itinerary === null ? (
        <Button
          className="w-full sm:w-fit"
          disabled={disabled || isGenerating || isSaving}
          type="button"
          onClick={onGenerate}
        >
          {isGenerating ? "Generating Itinerary..." : "Generate Itinerary"}
        </Button>
      ) : (
        <>
          <GeneratedItinerary itinerary={itinerary} />
          {saveError !== null ? <InlineError message={saveError} /> : null}
          <Button
            className="w-full sm:w-fit"
            disabled={disabled || isSaving || hasSavedTrip}
            type="button"
            onClick={onSave}
          >
            {hasSavedTrip
              ? "Saved"
              : isSaving
                ? "Saving Trip..."
                : saveError === null
                  ? "Save Trip"
                  : "Retry Save"}
          </Button>
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {itinerary !== null ? (
          <Button
            className="w-full sm:w-fit"
            disabled={disabled || isGenerating || isSaving || hasSavedTrip}
            type="button"
            variant="outline"
            onClick={onGenerate}
          >
            {isGenerating ? "Regenerating..." : "Retry Generation"}
          </Button>
        ) : null}
        <Button
          className="w-full sm:w-fit"
          disabled={disabled || isGenerating || isSaving}
          type="button"
          variant="outline"
          onClick={onReset}
        >
          Start Another Brief
        </Button>
      </div>
    </div>
  )
}

function AccessStatusBadge({
  access,
}: {
  access: TripGenerationAccessStatus
}) {
  const isPremium = access.tier === "premium"

  return (
    <div className="grid justify-items-start gap-2">
      <span className="w-fit rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {isPremium ? "Premium access" : "Free access"}
        {isPremium && !access.quotaEnforced ? ": quota bypassed" : ": daily quota"}
      </span>
      {access.notice !== undefined ? (
        <p className="max-w-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          {access.notice}
        </p>
      ) : null}
    </div>
  )
}

function QuotaExceededNotice({
  message,
  quota,
}: {
  message: string | null
  quota: FinalItineraryQuota
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
      <div>
        <p className="font-medium text-destructive">Generation quota reached</p>
        <p className="mt-1 leading-6 text-destructive">
          {message ?? buildQuotaExceededMessage(quota)}
        </p>
      </div>
      <Link
        className={buttonVariants({
          className: "w-full sm:w-fit",
          variant: "outline",
        })}
        href="/pricing"
      >
        View Pricing
      </Link>
    </div>
  )
}

function GeneratedItinerary({
  itinerary,
}: {
  itinerary: FinalItineraryResponse
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-lg bg-background p-4 ring-1 ring-border">
        <p className="text-sm font-medium">Trip Summary</p>
        <p className="app-muted mt-2 text-sm leading-6">{itinerary.summary}</p>
      </div>

      <div className="grid gap-3">
        <p className="text-sm font-medium">Hotels</p>
        <div className="grid gap-3">
          {itinerary.hotels.map((hotel) => (
            <div
              key={`${hotel.name}-${hotel.area ?? hotel.address ?? "hotel"}`}
              className="rounded-lg bg-background p-4 ring-1 ring-border"
            >
              <p className="text-sm font-medium">{hotel.name}</p>
              <p className="app-muted mt-1 text-sm leading-6">
                {hotel.description}
              </p>
              <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <GeneratedDetail label="Area" value={hotel.area} />
                <GeneratedDetail label="Address" value={hotel.address} />
                <GeneratedDetail
                  label="Budget"
                  value={hotel.priceTier ?? "Generated estimate"}
                />
                <GeneratedDetail
                  label="Generated estimate"
                  value={hotel.estimatedPriceText}
                />
              </dl>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-sm font-medium">Day-by-day itinerary</p>
        {itinerary.itinerary.map((day) => (
          <div
            key={day.dayNumber}
            className="grid gap-3 rounded-lg bg-background p-4 ring-1 ring-border"
          >
            <div>
              <p className="text-sm font-medium">
                Day {day.dayNumber}: {day.title}
              </p>
            </div>
            <div className="grid gap-3">
              {day.activities.map((activity) => (
                <div
                  key={`${day.dayNumber}-${activity.title}-${activity.timeWindow}`}
                  className="rounded-lg border bg-muted/20 p-3"
                >
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="app-muted mt-1 text-sm leading-6">
                    {activity.description}
                  </p>
                  <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <GeneratedDetail
                      label="Time window"
                      value={activity.timeWindow}
                    />
                    <GeneratedDetail label="Duration" value={activity.duration} />
                    <GeneratedDetail
                      label="Generated estimate"
                      value={activity.estimatedPriceText}
                    />
                    <GeneratedDetail
                      label="Place"
                      value={activity.place?.placeName}
                    />
                    <GeneratedDetail
                      label="Address"
                      value={activity.place?.address}
                    />
                  </dl>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {itinerary.practicalNotes !== undefined ? (
        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
          <p className="text-sm font-medium">Practical notes</p>
          <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
            {itinerary.practicalNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function GeneratedDetail({
  label,
  value,
}: {
  label: string
  value: string | undefined
}) {
  if (value === undefined || value.trim().length === 0) {
    return null
  }

  return (
    <div>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
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

function FieldText({
  helper,
  helperId,
  htmlFor,
  label,
  labelId,
}: {
  helper: string
  helperId?: string
  htmlFor?: string
  label: string
  labelId?: string
}) {
  const labelClassName = "text-sm font-medium"

  return (
    <div>
      {htmlFor === undefined ? (
        <p className={labelClassName} id={labelId}>
          {label}
        </p>
      ) : (
        <label className={labelClassName} htmlFor={htmlFor} id={labelId}>
          {label}
        </label>
      )}
      <p className="app-muted mt-1 text-xs" id={helperId}>
        {helper}
      </p>
    </div>
  )
}

function InlineError({ id, message }: { id?: string; message: string }) {
  return (
    <p
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      id={id}
    >
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
