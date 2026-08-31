import { useId, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  Banknote,
  Briefcase,
  CalendarDays,
  Check,
  Heart,
  Home,
  LoaderCircle,
  MapPin,
  Minus,
  Navigation,
  Plane,
  Plus,
  SendHorizontal,
  Sparkles,
  User,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react"

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
import {
  getFinalPresentationState,
  type FinalPresentationState,
} from "./final-transition-state"

const budgetPresentation = {
  budget: {
    title: "Cheap",
    description: "Stay conscious of costs",
    icon: Banknote,
    iconClassName: "bg-success/10 text-success",
  },
  "mid-range": {
    title: "Moderate",
    description: "Keep cost on the average side",
    icon: Wallet,
    iconClassName: "bg-info/10 text-info",
  },
  premium: {
    title: "Luxury",
    description: "Do not worry about cost",
    icon: Sparkles,
    iconClassName: "bg-primary/10 text-primary",
  },
} satisfies Record<
  BudgetTier,
  {
    title: string
    description: string
    icon: LucideIcon
    iconClassName: string
  }
>

const groupPresentation = {
  solo: {
    title: "Just Me",
    description: "Solo adventure",
    icon: User,
  },
  couple: {
    title: "A Couple",
    description: "Two travelers",
    icon: Heart,
  },
  family: {
    title: "Family",
    description: "Family vacation",
    icon: Home,
  },
  friends: {
    title: "Friends",
    description: "Group getaway",
    icon: Users,
  },
  business: {
    title: "Business",
    description: "Work trip",
    icon: Briefcase,
  },
} satisfies Record<
  GroupType,
  {
    title: string
    description: string
    icon: LucideIcon
  }
>

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
          tone="source"
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
          tone="destination"
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
  tone: "source" | "destination"
  value: string
  disabled: boolean
  onSubmit: (value: string) => void
}

function SourceDestinationInputUI({
  helper,
  label,
  placeholder,
  tone,
  value,
  disabled,
  onSubmit,
}: SourceDestinationInputUIProps) {
  const inputId = useId()
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const Icon = tone === "source" ? MapPin : Navigation

  return (
    <form
      className="grid gap-4"
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
      <div className="rounded-[var(--app-card-radius)] border bg-soft-surface/70 p-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-primary ring-1 ring-border">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <FieldText
              htmlFor={inputId}
              helper={helper}
              helperId={helperId}
              label={label}
            />
            <Input
              id={inputId}
              aria-describedby={
                error === null ? helperId : `${helperId} ${errorId}`
              }
              aria-invalid={error !== null}
              autoComplete="off"
              className="mt-3 h-11 bg-background text-base"
              disabled={disabled}
              placeholder={placeholder}
              value={draft}
              onChange={(event) => {
                setDraft(event.currentTarget.value)
                setError(null)
              }}
            />
          </div>
        </div>
      </div>
      {error !== null ? <InlineError id={errorId} message={error} /> : null}
      <Button className="w-full sm:w-fit" disabled={disabled} type="submit">
        <SendHorizontal aria-hidden="true" />
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
  const [draft, setDraft] = useState(value?.toString() ?? "4")
  const [error, setError] = useState<string | null>(null)
  const parsedDraft = Number(draft)
  const hasValidDraft = draft.trim().length > 0 && Number.isInteger(parsedDraft)
  const canDecrease = hasValidDraft && parsedDraft > 1
  const canIncrease = hasValidDraft && parsedDraft < 30

  function adjustDuration(delta: number) {
    const current = hasValidDraft ? parsedDraft : 4
    const next = Math.min(30, Math.max(1, current + delta))

    setDraft(next.toString())
    setError(null)
  }

  return (
    <form
      className="grid gap-4"
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
      <div className="grid justify-items-center gap-4 rounded-[var(--app-card-radius)] border bg-soft-surface/70 p-4 text-center">
        <div>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            <span>How many days do you want to travel?</span>
          </div>
          <p className="app-muted mt-1 text-xs" id={helperId}>
            Choose 1 to 30 days.
          </p>
        </div>

        <div className="flex w-full max-w-sm items-center justify-center gap-3">
          <Button
            aria-label="Decrease trip duration"
            disabled={disabled || !canDecrease}
            size="icon-lg"
            type="button"
            variant="outline"
            onClick={() => adjustDuration(-1)}
          >
            <Minus aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1 rounded-[var(--app-control-radius)] border bg-background px-3 py-2">
            <label className="sr-only" htmlFor={inputId}>
              Duration days
            </label>
            <div className="flex items-center justify-center gap-2">
              <Input
                id={inputId}
                aria-describedby={
                  error === null ? helperId : `${helperId} ${errorId}`
                }
                aria-invalid={error !== null}
                className="h-9 w-16 border-0 bg-transparent px-0 text-center text-2xl font-bold shadow-none focus-visible:ring-0"
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
              <span className="text-lg font-bold">
                {Number(draft) === 1 ? "Day" : "Days"}
              </span>
            </div>
          </div>
          <Button
            aria-label="Increase trip duration"
            disabled={disabled || !canIncrease}
            size="icon-lg"
            type="button"
            variant="outline"
            onClick={() => adjustDuration(1)}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
      {error !== null ? <InlineError id={errorId} message={error} /> : null}
      <Button
        className="mx-auto w-full sm:w-fit"
        disabled={disabled}
        type="submit"
      >
        <Check aria-hidden="true" />
        Confirm
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
    <div className="grid gap-4">
      <FieldText
        helper="Choose the planning style."
        label="Budget tier"
        labelId={labelId}
      />
      <div
        className="grid gap-3 sm:grid-cols-3"
        role="group"
        aria-labelledby={labelId}
      >
        {budgetOptions.map((option) => {
          const isSelected = value === option.value
          const presentation = budgetPresentation[option.value]

          return (
            <SelectionCard
              key={option.value}
              description={presentation.description}
              disabled={disabled}
              icon={presentation.icon}
              iconClassName={presentation.iconClassName}
              selected={isSelected}
              title={presentation.title}
              onClick={() => onSelect(option.value)}
            />
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
      <div className="grid gap-3">
        <FieldText
          helper="Pick the closest match."
          label="Group type"
          labelId={groupTypeLabelId}
        />
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="group"
          aria-labelledby={groupTypeLabelId}
        >
          {groupTypeOptions.map((option) => {
            const presentation = groupPresentation[option.value]

            return (
              <SelectionCard
                key={option.value}
                description={presentation.description}
                disabled={disabled}
                icon={presentation.icon}
                selected={selectedType === option.value}
                title={presentation.title}
                onClick={() => {
                  setSelectedType(option.value)
                  setError(null)
                }}
              />
            )
          })}
        </div>
      </div>
      <div className="rounded-[var(--app-card-radius)] border bg-soft-surface/70 p-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-primary ring-1 ring-border">
            <UsersRound className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <FieldText
              htmlFor={inputId}
              helper="Enter 1 to 20 travelers."
              helperId={helperId}
              label="Group size"
            />
            <Input
              id={inputId}
              aria-describedby={
                error === null ? helperId : `${helperId} ${errorId}`
              }
              aria-invalid={error !== null}
              className="mt-3 h-11 bg-background text-base"
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
        </div>
      </div>
      {error !== null ? <InlineError id={errorId} message={error} /> : null}
      <Button className="w-full sm:w-fit" disabled={disabled} type="submit">
        <Check aria-hidden="true" />
        Confirm Travelers
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
  const reviewItems = getReviewItems(requirements)

  return (
    <div className="grid gap-4 rounded-[var(--app-card-radius)] border bg-soft-surface/70 p-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Plane className="size-4 text-primary" aria-hidden="true" />
          <span>Review the local trip brief</span>
        </div>
        <p className="app-muted mt-1 text-sm leading-6">
          Confirming moves this conversation to READY_FOR_FINAL. It does not
          generate an itinerary or save data yet.
        </p>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {reviewItems.map((item) => (
          <ReviewItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
          />
        ))}
      </dl>
      <Button
        className="w-full sm:w-fit"
        disabled={disabled}
        type="button"
        onClick={onSubmit}
      >
        <Check aria-hidden="true" />
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
  const presentationState = getFinalPresentationState({
    finalError: error,
    finalQuota: quota,
    finalItinerary: itinerary,
    isGeneratingFinal: isGenerating,
    isSavingTrip: isSaving,
    saveError,
    savedTripId,
  })
  const hasItinerary = itinerary !== null
  const generationButtonLabel =
    presentationState === "generationError"
      ? "Retry Generation"
      : isGenerating
        ? "Generating Itinerary..."
        : "Generate Itinerary"

  return (
    <div className="grid gap-4 rounded-[var(--app-card-radius)] border bg-soft-surface/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
            READY_FOR_FINAL
          </p>
          <p className="app-muted mt-1 text-sm leading-6">
            Generate a structured itinerary from the confirmed brief. Prices are
            generated estimates until later enrichment verifies real place data.
          </p>
        </div>
        {access !== null ? <AccessStatusBadge access={access} /> : null}
      </div>

      <FinalTransitionStatus state={presentationState} />

      {quota !== null ? (
        <QuotaExceededNotice message={error} quota={quota} />
      ) : presentationState === "generationError" && error !== null ? (
        <GenerationErrorNotice message={error} />
      ) : null}

      {!hasItinerary ? (
        <Button
          className="w-full sm:w-fit"
          disabled={disabled || isGenerating || isSaving}
          type="button"
          onClick={onGenerate}
        >
          {isGenerating ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          {generationButtonLabel}
        </Button>
      ) : (
        <>
          <GeneratedItinerary itinerary={itinerary} />
          {saveError !== null ? <SaveErrorNotice message={saveError} /> : null}
          <Button
            className="w-full sm:w-fit"
            disabled={disabled || isSaving || hasSavedTrip}
            type="button"
            onClick={onSave}
          >
            {isSaving ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : hasSavedTrip ? (
              <Check aria-hidden="true" />
            ) : (
              <Plane aria-hidden="true" />
            )}
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
            <Sparkles aria-hidden="true" />
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
          <Plane aria-hidden="true" />
          Start Another Brief
        </Button>
      </div>
    </div>
  )
}

function FinalTransitionStatus({
  state,
}: {
  state: FinalPresentationState
}) {
  const config = getFinalTransitionConfig(state)
  const Icon = config.icon
  const isLive = state === "generating" || state === "saving"

  return (
    <div
      className={cn(
        "grid gap-3 rounded-[var(--app-card-radius)] border bg-background p-4 text-center shadow-[var(--app-shadow-card)]",
        config.className
      )}
      role={isLive ? "status" : undefined}
      aria-live={isLive ? "polite" : undefined}
    >
      <div
        className={cn(
          "mx-auto grid size-10 place-items-center rounded-full",
          config.iconClassName
        )}
      >
        <Icon
          className={cn("size-5", config.isSpinning && "animate-spin")}
          aria-hidden="true"
        />
      </div>
      <div>
        <p className="font-semibold text-foreground">{config.title}</p>
        <p className="app-muted mt-1 text-sm leading-6">
          {config.description}
        </p>
      </div>
    </div>
  )
}

function getFinalTransitionConfig(state: FinalPresentationState): {
  title: string
  description: string
  icon: LucideIcon
  iconClassName: string
  className?: string
  isSpinning?: boolean
} {
  switch (state) {
    case "generating":
      return {
        title: "Planning your dream trip",
        description:
          "Building your day-by-day itinerary, hotels, and activities.",
        icon: LoaderCircle,
        iconClassName: "bg-primary/10 text-primary",
        className: "border-primary/25",
        isSpinning: true,
      }
    case "quotaBlocked":
      return {
        title: "Free generation limit reached",
        description:
          "Your confirmed brief is still here. Upgrade or try again when access is available.",
        icon: Wallet,
        iconClassName: "bg-primary/10 text-primary",
        className: "border-primary/25 bg-primary/5",
      }
    case "generationError":
      return {
        title: "Generation needs a retry",
        description:
          "The itinerary was not created, but your confirmed brief is preserved.",
        icon: AlertCircle,
        iconClassName: "bg-destructive/10 text-destructive",
        className: "border-destructive/25",
      }
    case "awaitingSave":
      return {
        title: "Itinerary ready",
        description:
          "Review the generated plan, then save it to open the full trip workspace.",
        icon: Check,
        iconClassName: "bg-success/10 text-success",
        className: "border-success/25",
      }
    case "saving":
      return {
        title: "Saving your trip",
        description:
          "Keeping the generated itinerary intact while your saved trip is created.",
        icon: LoaderCircle,
        iconClassName: "bg-primary/10 text-primary",
        className: "border-primary/25",
        isSpinning: true,
      }
    case "saveError":
      return {
        title: "Itinerary ready. Save needs attention",
        description:
          "The generated itinerary is still available. Retry save when ready.",
        icon: AlertCircle,
        iconClassName: "bg-destructive/10 text-destructive",
        className: "border-destructive/25",
      }
    case "savedNavigating":
      return {
        title: "Trip saved",
        description: "Opening your saved itinerary now.",
        icon: Check,
        iconClassName: "bg-success/10 text-success",
        className: "border-success/25",
      }
    case "ready":
      return {
        title: "Ready to build your itinerary",
        description:
          "Use the confirmed brief to generate hotels, daily activities, and practical notes.",
        icon: Sparkles,
        iconClassName: "bg-primary/10 text-primary",
      }
  }
}

function AccessStatusBadge({
  access,
}: {
  access: TripGenerationAccessStatus
}) {
  const isPremium = access.tier === "premium"

  return (
    <div className="grid justify-items-start gap-2 sm:justify-items-end">
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
    <div className="grid gap-3 rounded-[var(--app-card-radius)] border border-primary/25 bg-primary/5 p-3 text-sm">
      <div>
        <p className="flex items-center gap-2 font-medium text-primary">
          <AlertCircle className="size-4" aria-hidden="true" />
          Free allowance used
        </p>
        <p className="app-muted mt-1 leading-6">
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

function GenerationErrorNotice({ message }: { message: string }) {
  return (
    <div className="grid gap-2 rounded-[var(--app-card-radius)] border border-destructive/25 bg-background p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        Could not generate itinerary
      </p>
      <p className="app-muted leading-6">{message}</p>
    </div>
  )
}

function SaveErrorNotice({ message }: { message: string }) {
  return (
    <div className="grid gap-2 rounded-[var(--app-card-radius)] border border-destructive/25 bg-background p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        Could not save trip
      </p>
      <p className="app-muted leading-6">{message}</p>
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
              className="min-w-0 rounded-lg bg-background p-4 ring-1 ring-border"
            >
              <p className="break-words text-sm font-medium">{hotel.name}</p>
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
            className="grid min-w-0 gap-3 rounded-lg bg-background p-4 ring-1 ring-border"
          >
            <div>
              <p className="break-words text-sm font-medium">
                Day {day.dayNumber}: {day.title}
              </p>
            </div>
            <div className="grid gap-3">
              {day.activities.map((activity) => (
                <div
                  key={`${day.dayNumber}-${activity.title}-${activity.timeWindow}`}
                  className="min-w-0 rounded-lg border bg-muted/20 p-3"
                >
                  <p className="break-words text-sm font-medium">
                    {activity.title}
                  </p>
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
                      label="Activity type"
                      value={formatGeneratedPlaceKind(activity.place?.kind)}
                    />
                    <GeneratedDetail
                      label="Place"
                      value={activity.place?.name ?? undefined}
                    />
                    <GeneratedDetail
                      label="Area"
                      value={activity.place?.areaHint ?? undefined}
                    />
                    <GeneratedDetail
                      label="Route"
                      value={formatGeneratedRoute(
                        activity.place?.originHint ?? undefined,
                        activity.place?.destinationHint ?? undefined
                      )}
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

function formatGeneratedPlaceKind(kind: string | undefined) {
  if (kind === "specific_place") {
    return "Specific place"
  }

  if (kind === "generic_activity") {
    return "General activity"
  }

  if (kind === "transport") {
    return "Transport"
  }

  return undefined
}

function formatGeneratedRoute(
  originHint: string | undefined,
  destinationHint: string | undefined
) {
  if (originHint === undefined && destinationHint === undefined) {
    return undefined
  }

  return `${originHint ?? "Trip origin"} to ${destinationHint ?? "destination"}`
}

function UnknownSelectorFallback({ selector }: { selector: string }) {
  return (
    <div className="rounded-[var(--app-card-radius)] border bg-soft-surface/70 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
        Unsupported UI request
      </p>
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
      className="flex items-start gap-2 rounded-[var(--app-control-radius)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      id={id}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  )
}

function ReviewItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-[var(--app-control-radius)] bg-background p-3 ring-1 ring-border">
      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-muted-foreground">
        <Icon className="size-3.5 text-primary" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  )
}

function SelectionCard({
  description,
  disabled,
  icon: Icon,
  iconClassName,
  selected,
  title,
  onClick,
}: {
  description: string
  disabled: boolean
  icon: LucideIcon
  iconClassName?: string
  selected: boolean
  title: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "app-focus-ring min-h-28 rounded-[var(--app-card-radius)] border bg-background p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
        selected && "border-primary bg-accent ring-2 ring-primary/15"
      )}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span
        className={cn(
          "mb-3 grid size-10 place-items-center rounded-full bg-primary/10 text-primary",
          iconClassName
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="block text-sm font-semibold text-foreground">
        {title}
      </span>
      <span className="app-muted mt-1 block text-xs leading-5">
        {description}
      </span>
    </button>
  )
}

function getReviewItems(requirements: TripRequirements) {
  return [
    {
      icon: MapPin,
      label: "Source",
      value: requirements.source || "Not set",
    },
    {
      icon: Navigation,
      label: "Destination",
      value: requirements.destination || "Not set",
    },
    {
      icon: CalendarDays,
      label: "Duration",
      value:
        requirements.durationDays === null
          ? "Not set"
          : `${requirements.durationDays} day${
              requirements.durationDays === 1 ? "" : "s"
            }`,
    },
    {
      icon: Wallet,
      label: "Budget",
      value: formatBudget(requirements.budgetTier),
    },
    {
      icon: UsersRound,
      label: "Travelers",
      value: `${requirements.groupSize ?? "?"} ${formatGroupType(
        requirements.groupType
      )} traveler${requirements.groupSize === 1 ? "" : "s"}`,
    },
  ]
}

export { renderGenerativeUI }
