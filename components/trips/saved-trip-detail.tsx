"use client"

import { useQuery } from "convex/react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import type { FinalItineraryResponse } from "@/lib/ai/contract"

function SavedTripDetail({ tripId }: { tripId: string }) {
  const trip = useQuery(api.trips.getCurrentUserTripByPublicId, { tripId })

  if (trip === undefined) {
    return (
      <Card className="app-card max-w-3xl">
        <CardHeader>
          <CardTitle>Loading trip</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="app-muted text-sm">Fetching the saved itinerary.</p>
        </CardContent>
      </Card>
    )
  }

  const itinerary = isFinalItineraryPayload(trip.generatedTripPayload)
    ? trip.generatedTripPayload
    : null

  return (
    <div className="grid max-w-4xl gap-5">
      <Card className="app-card">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>
                {trip.source} to {trip.destination}
              </CardTitle>
              <p className="app-muted mt-2 text-sm">
                {trip.durationDays} day{trip.durationDays === 1 ? "" : "s"},{" "}
                {trip.groupSize} traveler{trip.groupSize === 1 ? "" : "s"},{" "}
                {trip.budget}
              </p>
            </div>
            <Badge variant="outline">{trip.enrichmentStatus}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <code className="block rounded-md border bg-background px-3 py-2 text-xs break-all">
            {trip._id}
          </code>
        </CardContent>
      </Card>

      {itinerary !== null ? (
        <Card className="app-card">
          <CardHeader>
            <CardTitle>Generated Itinerary</CardTitle>
            <p className="app-muted text-sm">
              Prices and place details are generated estimates until Google
              Places enrichment is added.
            </p>
          </CardHeader>
          <CardContent className="grid gap-5">
            <p className="app-muted text-sm leading-6">{itinerary.summary}</p>

            <div className="grid gap-3">
              <p className="text-sm font-medium">Hotels</p>
              {itinerary.hotels.map((hotel) => (
                <div
                  key={`${hotel.name}-${hotel.estimatedPriceText}`}
                  className="rounded-lg border bg-muted/20 p-3"
                >
                  <p className="text-sm font-medium">{hotel.name}</p>
                  <p className="app-muted mt-1 text-sm leading-6">
                    {hotel.description}
                  </p>
                  <p className="app-muted mt-2 text-xs">
                    Generated estimate: {hotel.estimatedPriceText}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-medium">Day-by-day plan</p>
              {itinerary.itinerary.map((day) => (
                <div
                  key={day.dayNumber}
                  className="rounded-lg border bg-muted/20 p-3"
                >
                  <p className="text-sm font-medium">
                    Day {day.dayNumber}: {day.title}
                  </p>
                  <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    {day.activities.map((activity) => (
                      <li key={`${day.dayNumber}-${activity.title}`}>
                        <span className="font-medium text-foreground">
                          {activity.timeWindow}
                        </span>
                        : {activity.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function isFinalItineraryPayload(
  value: unknown
): value is FinalItineraryResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  return (
    "travelPlan" in value &&
    "summary" in value &&
    "hotels" in value &&
    "itinerary" in value
  )
}

export { SavedTripDetail }
