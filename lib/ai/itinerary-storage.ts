import type {
  BudgetTier,
  FinalItineraryResponse,
  GroupType,
  HotelRecommendation,
  ItineraryActivity,
  ItineraryDay,
} from "@/lib/ai/contract"

type StoredPlaceTextHint = {
  placeName: string
  address?: string
  approximateArea?: string
}

type StoredItineraryActivity = {
  title: string
  description: string
  timeOfDay?: ItineraryActivity["timeOfDay"]
  timeWindow: string
  duration?: string
  estimatedPriceText: string
  place?: StoredPlaceTextHint
}

type StoredItineraryDay = {
  dayNumber: number
  title: string
  activities: StoredItineraryActivity[]
}

export type StoredFinalItineraryPayload = {
  travelPlan: {
    source: string
    destination: string
    durationDays: number
    budgetTier: BudgetTier
    groupSize: number
    groupType?: GroupType
  }
  summary: string
  hotels: HotelRecommendation[]
  itinerary: StoredItineraryDay[]
  practicalNotes?: string[]
}

export function toStoredFinalItineraryPayload(
  itinerary: FinalItineraryResponse
): StoredFinalItineraryPayload {
  return {
    travelPlan: itinerary.travelPlan,
    summary: itinerary.summary,
    hotels: itinerary.hotels,
    itinerary: itinerary.itinerary.map(toStoredItineraryDay),
    ...(itinerary.practicalNotes !== undefined
      ? { practicalNotes: itinerary.practicalNotes }
      : {}),
  }
}

function toStoredItineraryDay(day: ItineraryDay): StoredItineraryDay {
  return {
    dayNumber: day.dayNumber,
    title: day.title,
    activities: day.activities.map(toStoredItineraryActivity),
  }
}

function toStoredItineraryActivity(
  activity: ItineraryActivity
): StoredItineraryActivity {
  const place = toStoredPlaceHint(activity)

  return {
    title: activity.title,
    description: activity.description,
    ...(activity.timeOfDay !== undefined ? { timeOfDay: activity.timeOfDay } : {}),
    timeWindow: activity.timeWindow,
    ...(activity.duration !== undefined ? { duration: activity.duration } : {}),
    estimatedPriceText: activity.estimatedPriceText,
    ...(place !== undefined ? { place } : {}),
  }
}

function toStoredPlaceHint(
  activity: ItineraryActivity
): StoredPlaceTextHint | undefined {
  const place = activity.place

  if (place === undefined || place.kind !== "specific_place" || place.name === null) {
    return undefined
  }

  return {
    placeName: place.name,
    ...(place.addressHint !== null ? { address: place.addressHint } : {}),
    ...(place.areaHint !== null ? { approximateArea: place.areaHint } : {}),
  }
}
