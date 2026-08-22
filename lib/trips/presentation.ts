import {
  parseFinalItineraryResponse,
  type BudgetTier,
  type GroupType,
  type HotelRecommendation,
  type ItineraryActivity,
  type ItineraryDay,
} from "../ai/contract"

export type StoredTripForPresentation = {
  _id: string
  source: string
  destination: string
  durationDays: number
  budget: string
  groupSize: number
  groupType?: string
  generatedTripPayload: unknown
  enrichmentStatus: string
  createdAt: number
}

export type TripPresentationData = {
  tripId: string
  source: string
  destination: string
  durationLabel: string
  budgetLabel: string
  groupLabel: string
  groupTypeLabel: string | null
  createdLabel: string
  enrichmentLabel: string
  summary: string
  hotels: PresentedHotel[]
  days: PresentedDay[]
  practicalNotes: string[]
}

export type PresentedHotel = {
  id: string
  name: string
  description: string
  area: string | null
  address: string | null
  priceTierLabel: string | null
  estimatedPriceText: string
}

export type PresentedDay = {
  id: string
  dayNumber: number
  title: string
  activities: PresentedActivity[]
}

export type PresentedActivity = {
  id: string
  title: string
  description: string
  timeLabel: string
  timeOfDayLabel: string | null
  duration: string | null
  estimatedPriceText: string
  placeName: string | null
  address: string | null
  approximateArea: string | null
}

export type TripPresentationResult =
  | { ok: true; data: TripPresentationData }
  | { ok: false; error: string }

export function buildTripPresentation(
  trip: StoredTripForPresentation
): TripPresentationResult {
  const parsedPayload = parseFinalItineraryResponse(trip.generatedTripPayload)

  if (!parsedPayload.ok) {
    return {
      ok: false,
      error: "This saved trip record does not contain a valid generated itinerary.",
    }
  }

  const itinerary = parsedPayload.data

  return {
    ok: true,
    data: {
      tripId: trip._id,
      source: safeText(trip.source, itinerary.travelPlan.source),
      destination: safeText(trip.destination, itinerary.travelPlan.destination),
      durationLabel: formatDuration(trip.durationDays),
      budgetLabel: formatBudgetLabel(trip.budget),
      groupLabel: formatGroupSize(trip.groupSize),
      groupTypeLabel: formatOptionalGroupType(trip.groupType),
      createdLabel: formatDate(trip.createdAt),
      enrichmentLabel: formatStatusLabel(trip.enrichmentStatus),
      summary: safeText(itinerary.summary, "No trip summary was saved."),
      hotels: itinerary.hotels.map(toPresentedHotel),
      days: itinerary.itinerary.map(toPresentedDay),
      practicalNotes: normalizeNotes(itinerary.practicalNotes),
    },
  }
}

export function formatBudgetLabel(value: string | BudgetTier) {
  if (value === "mid-range") {
    return "Mid-range"
  }

  return capitalizeWords(value)
}

export function formatStatusLabel(value: string) {
  return capitalizeWords(value.replaceAll("_", " "))
}

export function formatDate(timestamp: number) {
  if (!Number.isFinite(timestamp)) {
    return "Unknown"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(timestamp))
}

function toPresentedHotel(
  hotel: HotelRecommendation,
  index: number
): PresentedHotel {
  return {
    id: stableKey(["hotel", String(index), hotel.name]),
    name: safeText(hotel.name, "Unnamed hotel"),
    description: safeText(hotel.description, "No description saved."),
    area: optionalText(hotel.area),
    address: optionalText(hotel.address),
    priceTierLabel:
      hotel.priceTier === undefined ? null : formatBudgetLabel(hotel.priceTier),
    estimatedPriceText: safeText(
      hotel.estimatedPriceText,
      "No generated estimate saved."
    ),
  }
}

function toPresentedDay(day: ItineraryDay, index: number): PresentedDay {
  return {
    id: stableKey(["day", String(day.dayNumber), day.title]),
    dayNumber: Number.isFinite(day.dayNumber) ? day.dayNumber : index + 1,
    title: safeText(day.title, `Day ${index + 1}`),
    activities: day.activities.map((activity, activityIndex) =>
      toPresentedActivity(activity, day.dayNumber, activityIndex)
    ),
  }
}

function toPresentedActivity(
  activity: ItineraryActivity,
  dayNumber: number,
  index: number
): PresentedActivity {
  return {
    id: stableKey([
      "activity",
      String(dayNumber),
      String(index),
      activity.title,
      activity.timeWindow,
    ]),
    title: safeText(activity.title, "Untitled activity"),
    description: safeText(activity.description, "No description saved."),
    timeLabel: safeText(activity.timeWindow, "Flexible time"),
    timeOfDayLabel:
      activity.timeOfDay === undefined
        ? null
        : formatStatusLabel(activity.timeOfDay),
    duration: optionalText(activity.duration),
    estimatedPriceText: safeText(
      activity.estimatedPriceText,
      "No generated estimate saved."
    ),
    placeName: optionalText(activity.place?.placeName),
    address: optionalText(activity.place?.address),
    approximateArea: optionalText(activity.place?.approximateArea),
  }
}

function formatDuration(durationDays: number) {
  if (!Number.isFinite(durationDays) || durationDays < 1) {
    return "Unknown duration"
  }

  return `${durationDays} day${durationDays === 1 ? "" : "s"}`
}

function formatGroupSize(groupSize: number) {
  if (!Number.isFinite(groupSize) || groupSize < 1) {
    return "Unknown travelers"
  }

  return `${groupSize} traveler${groupSize === 1 ? "" : "s"}`
}

function formatOptionalGroupType(value: string | GroupType | undefined) {
  const normalized = optionalText(value)

  return normalized === null ? null : formatStatusLabel(normalized)
}

function normalizeNotes(notes: string[] | undefined) {
  if (notes === undefined) {
    return []
  }

  return notes.map((note) => note.trim()).filter((note) => note.length > 0)
}

function safeText(value: string, fallback: string) {
  const normalized = value.trim()

  return normalized.length > 0 ? normalized : fallback
}

function optionalText(value: string | undefined) {
  const normalized = value?.trim()

  return normalized === undefined || normalized.length === 0 ? null : normalized
}

function capitalizeWords(value: string) {
  return value
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function stableKey(parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
