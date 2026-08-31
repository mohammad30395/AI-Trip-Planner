import {
  formatBudgetLabel,
  formatDate,
  formatStatusLabel,
} from "./presentation"

export type StoredTripListItem = {
  _id: string
  source: string
  destination: string
  durationDays: number
  budget: string
  groupSize: number
  groupType?: string
  status: string
  enrichmentStatus: string
  createdAt: number
}

export type TripCardData = {
  id: string
  href: string
  source: string
  destination: string
  durationLabel: string
  budgetLabel: string
  budgetGroupLabel: string
  createdLabel: string
  statusLabel: string
  enrichmentLabel: string
}

export function buildTripCardData(trip: StoredTripListItem): TripCardData {
  return {
    id: trip._id,
    href: `/view-trip/${trip._id}`,
    source: safeText(trip.source, "Unknown source"),
    destination: safeText(trip.destination, "Untitled trip"),
    durationLabel: formatDuration(trip.durationDays),
    budgetLabel: formatBudgetLabel(trip.budget),
    budgetGroupLabel: formatBudgetGroup(trip),
    createdLabel: formatDate(trip.createdAt),
    statusLabel: formatStatusLabel(trip.status),
    enrichmentLabel: formatStatusLabel(trip.enrichmentStatus),
  }
}

function formatDuration(durationDays: number) {
  if (!Number.isFinite(durationDays) || durationDays < 1) {
    return "Unknown duration"
  }

  return `${durationDays} Day${durationDays === 1 ? "" : "s"}`
}

function formatBudgetGroup(trip: StoredTripListItem) {
  const groupType = trip.groupType?.trim()
  const groupLabel =
    groupType === undefined || groupType.length === 0
      ? formatGroupSize(trip.groupSize)
      : `${formatGroupSize(trip.groupSize)} ${formatStatusLabel(groupType)}`

  return `${formatBudgetLabel(trip.budget)} / ${groupLabel}`
}

function formatGroupSize(groupSize: number) {
  if (!Number.isFinite(groupSize) || groupSize < 1) {
    return "unknown travelers"
  }

  return `${groupSize} traveler${groupSize === 1 ? "" : "s"}`
}

function safeText(value: string, fallback: string) {
  const normalized = value.trim()

  return normalized.length > 0 ? normalized : fallback
}
