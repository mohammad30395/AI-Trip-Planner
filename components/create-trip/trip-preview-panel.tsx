import type { LucideIcon } from "lucide-react"
import {
  CalendarDays,
  CheckCircle2,
  Compass,
  MapPin,
  Navigation,
  UsersRound,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import {
  formatBudget,
  formatGroupType,
  type TripRequirementStep,
  type TripRequirements,
} from "./create-trip-flow"

type TripPreviewPanelProps = {
  requirements: TripRequirements
  step: TripRequirementStep
}

type BriefItem = {
  icon: LucideIcon
  label: string
  value: string
  isComplete: boolean
}

function TripPreviewPanel({ requirements, step }: TripPreviewPanelProps) {
  const briefItems = getBriefItems(requirements)
  const completedCount = briefItems.filter((item) => item.isComplete).length
  const isReady = step === "readyForFinal"
  const destination = requirements.destination.trim()
  const source = requirements.source.trim()

  return (
    <aside
      className="app-panel flex min-h-[30rem] min-w-0 flex-col overflow-hidden lg:h-full lg:min-h-0"
      aria-labelledby="trip-context-title"
    >
      <header className="flex flex-none flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">Trip context</p>
          <h2
            id="trip-context-title"
            className="mt-2 font-heading text-2xl leading-tight font-bold tracking-normal"
          >
            Your planning workspace
          </h2>
          <p className="app-muted mt-2 max-w-2xl text-sm leading-6">
            The visual brief updates from your answers. Verified maps appear
            later from provider-enriched saved trips.
          </p>
        </div>
        <Badge variant={isReady ? "default" : "outline"}>
          {isReady ? "Ready" : `${completedCount}/5 set`}
        </Badge>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="relative flex min-h-[23rem] flex-1 flex-col overflow-hidden rounded-[calc(var(--app-panel-radius)-0.35rem)] border bg-soft-surface p-4 sm:p-5 lg:min-h-0">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: "46px 46px",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[32%] h-24 -rotate-3 bg-info/10"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-[18%] h-20 rotate-2 bg-success/10"
          />

          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-sm rounded-[var(--app-card-radius)] border bg-background/90 p-4 shadow-[var(--app-shadow-card)]">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Compass className="size-4 text-primary" aria-hidden="true" />
                Planning status
              </div>
              <p className="app-muted mt-2 text-sm leading-6">
                {getWorkspaceStatus({
                  completedCount,
                  destination,
                  isReady,
                  source,
                })}
              </p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-full border bg-background/90 px-3 py-2 text-xs font-medium text-muted-foreground">
              <Navigation className="size-3.5 text-primary" aria-hidden="true" />
              Illustrative route surface
            </div>
          </div>

          <div className="relative z-10 grid flex-1 place-items-center py-6">
            <div className="relative h-full min-h-[8rem] w-full max-w-2xl">
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 640 260"
                role="presentation"
                aria-hidden="true"
                preserveAspectRatio="none"
              >
                <path
                  d="M72 190 C 190 40, 372 245, 560 78"
                  fill="none"
                  stroke="var(--primary)"
                  strokeDasharray="10 12"
                  strokeLinecap="round"
                  strokeWidth="5"
                />
              </svg>

              <RoutePoint
                className="left-[4%] top-[62%]"
                label="From"
                value={source || "Not set"}
              />
              <RoutePoint
                className="right-[5%] top-[12%]"
                label="To"
                value={destination || "Not set"}
                variant="destination"
              />
            </div>
          </div>

          <dl className="relative z-10 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {briefItems.map((item) => (
              <BriefTile key={item.label} item={item} />
            ))}
          </dl>
        </div>

        <div className="grid flex-none gap-3 rounded-[var(--app-card-radius)] border bg-background p-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <CheckCircle2
            className={cn(
              "size-5",
              isReady ? "text-success" : "text-muted-foreground"
            )}
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">
              {isReady ? "Brief ready for generation" : "Brief in progress"}
            </p>
            <p className="app-muted mt-1 leading-6">
              Final generation, saving, and the real Leaflet map remain behind
              the existing controller and saved-trip enrichment flow.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function RoutePoint({
  className,
  label,
  value,
  variant = "source",
}: {
  className: string
  label: string
  value: string
  variant?: "source" | "destination"
}) {
  return (
    <div
      className={cn(
        "absolute grid max-w-[11rem] gap-2 rounded-[var(--app-card-radius)] border bg-background/95 p-3 text-sm shadow-[var(--app-shadow-card)]",
        className
      )}
    >
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-muted-foreground">
        <MapPin
          className={cn(
            "size-3.5",
            variant === "destination" ? "text-info" : "text-primary"
          )}
          aria-hidden="true"
        />
        {label}
      </span>
      <span className="min-w-0 break-words font-semibold">{value}</span>
    </div>
  )
}

function BriefTile({ item }: { item: BriefItem }) {
  const Icon = item.icon

  return (
    <div
      className={cn(
        "min-w-0 rounded-[var(--app-control-radius)] border bg-background/90 p-3",
        !item.isComplete && "text-muted-foreground"
      )}
    >
      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-normal">
        <Icon
          className={cn("size-3.5", item.isComplete && "text-primary")}
          aria-hidden="true"
        />
        {item.label}
      </dt>
      <dd className="mt-2 min-w-0 break-words text-sm font-semibold text-foreground">
        {item.value}
      </dd>
    </div>
  )
}

function getBriefItems(requirements: TripRequirements): BriefItem[] {
  const source = requirements.source.trim()
  const destination = requirements.destination.trim()

  return [
    {
      icon: MapPin,
      label: "Source",
      value: source || "Not set",
      isComplete: source.length > 0,
    },
    {
      icon: Navigation,
      label: "Destination",
      value: destination || "Not set",
      isComplete: destination.length > 0,
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
      isComplete: requirements.durationDays !== null,
    },
    {
      icon: Wallet,
      label: "Budget",
      value: formatBudget(requirements.budgetTier),
      isComplete: requirements.budgetTier !== null,
    },
    {
      icon: UsersRound,
      label: "Travelers",
      value: formatTravelers(requirements),
      isComplete:
        requirements.groupSize !== null && requirements.groupType !== null,
    },
  ]
}

function getWorkspaceStatus({
  completedCount,
  destination,
  isReady,
  source,
}: {
  completedCount: number
  destination: string
  isReady: boolean
  source: string
}) {
  if (isReady) {
    return "Your confirmed brief is ready for itinerary generation."
  }

  if (source.length > 0 && destination.length > 0) {
    return `Building a trip brief from ${source} to ${destination}.`
  }

  if (completedCount > 0) {
    return "Your trip details are being assembled as you answer each step."
  }

  return "Your trip will come together here as the conversation collects the brief."
}

function formatTravelers(requirements: TripRequirements) {
  if (requirements.groupSize === null && requirements.groupType === null) {
    return "Not set"
  }

  const groupSize = requirements.groupSize ?? "?"

  return `${groupSize} ${formatGroupType(requirements.groupType)} traveler${
    requirements.groupSize === 1 ? "" : "s"
  }`
}

export { TripPreviewPanel }
