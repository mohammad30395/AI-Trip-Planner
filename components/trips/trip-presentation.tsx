"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ActivityPlaceEnrichment,
  HotelPlaceEnrichment,
  PlaceAttributionNotice,
} from "@/components/trips/place-enrichment"
import { TripMapSection } from "@/components/trips/trip-map"
import { buildTripMapLookups } from "@/lib/trips/map"
import type {
  PresentedActivity,
  PresentedHotel,
  TripPresentationData,
} from "@/lib/trips/presentation"

function TripPresentation({ trip }: { trip: TripPresentationData }) {
  const [focusedProviderPlaceId, setFocusedProviderPlaceId] = useState<
    string | null
  >(null)
  const mapLookups = useMemo(() => buildTripMapLookups(trip), [trip])
  const mapControls = {
    focusedProviderPlaceId,
    onFocusPlace: setFocusedProviderPlaceId,
  }

  return (
    <article className="grid max-w-5xl gap-6">
      <TripSummaryHeader trip={trip} />
      <TripSummarySection
        practicalNotes={trip.practicalNotes}
        summary={trip.summary}
      />
      <TripMapSection
        focusedProviderPlaceId={focusedProviderPlaceId}
        lookups={mapLookups}
        onMarkerFocus={setFocusedProviderPlaceId}
      />
      <HotelList
        destination={trip.destination}
        hotels={trip.hotels}
        mapControls={mapControls}
      />
      <DayByDayItinerary
        days={trip.days}
        destination={trip.destination}
        mapControls={mapControls}
      />
      <PlaceAttributionNotice />
    </article>
  )
}

function TripSummaryHeader({ trip }: { trip: TripPresentationData }) {
  return (
    <Card className="app-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="outline">Persisted trip</Badge>
            <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {trip.destination}
            </h2>
            <p className="app-muted mt-2 text-sm">From {trip.source}</p>
          </div>
          <Badge>{trip.budgetLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat label="Duration" value={trip.durationLabel} />
          <SummaryStat label="Group size" value={trip.groupLabel} />
          <SummaryStat
            label="Group type"
            value={trip.groupTypeLabel ?? "Not specified"}
          />
          <SummaryStat label="Created" value={trip.createdLabel} />
        </dl>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Trip ID
          </p>
          <code className="mt-2 block rounded-md border bg-background px-3 py-2 text-xs break-all">
            {trip.tripId}
          </code>
        </div>
      </CardContent>
    </Card>
  )
}

function TripSummarySection({
  practicalNotes,
  summary,
}: {
  practicalNotes: string[]
  summary: string
}) {
  return (
    <section aria-labelledby="trip-summary" className="grid gap-4">
      <div>
        <h2 id="trip-summary" className="font-heading text-xl font-semibold">
          Trip Summary
        </h2>
        <p className="app-muted mt-2 max-w-3xl text-sm leading-6">{summary}</p>
      </div>

      {practicalNotes.length > 0 ? (
        <Card className="app-card">
          <CardHeader>
            <CardTitle>Practical Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm text-muted-foreground">
              {practicalNotes.map((note) => (
                <li key={note} className="leading-6">
                  {note}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}

function HotelList({
  destination,
  hotels,
  mapControls,
}: {
  destination: string
  hotels: PresentedHotel[]
  mapControls: MapControls
}) {
  return (
    <section aria-labelledby="hotel-options" className="grid gap-4">
      <div>
        <h2 id="hotel-options" className="font-heading text-xl font-semibold">
          Hotels
        </h2>
        <p className="app-muted mt-2 text-sm">
          Hotel prices and details are AI-generated estimates until verified by
          place enrichment.
        </p>
      </div>

      {hotels.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {hotels.map((hotel) => (
            <li key={hotel.id}>
              <HotelCard
                destination={destination}
                hotel={hotel}
                mapControls={mapControls}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyContent message="No hotel recommendations were saved for this trip." />
      )}
    </section>
  )
}

function HotelCard({
  destination,
  hotel,
  mapControls,
}: {
  destination: string
  hotel: PresentedHotel
  mapControls: MapControls
}) {
  return (
    <Card className="app-card h-full">
      <CardHeader>
        <CardTitle>{hotel.name}</CardTitle>
        <CardDescription>{hotel.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <dl className="grid gap-2 text-sm">
          <OptionalDetail label="Area" value={hotel.area} />
          <OptionalDetail label="Address" value={hotel.address} />
          <OptionalDetail label="Price tier" value={hotel.priceTierLabel} />
          <RequiredDetail
            label="AI-generated estimate"
            value={hotel.estimatedPriceText}
          />
        </dl>
        <HotelPlaceEnrichment
          address={hotel.address}
          destination={destination}
          mapControls={mapControls}
          name={hotel.name}
        />
      </CardContent>
    </Card>
  )
}

function DayByDayItinerary({
  days,
  destination,
  mapControls,
}: {
  days: TripPresentationData["days"]
  destination: string
  mapControls: MapControls
}) {
  return (
    <section aria-labelledby="day-by-day-itinerary" className="grid gap-4">
      <div>
        <h2
          id="day-by-day-itinerary"
          className="font-heading text-xl font-semibold"
        >
          Day-by-Day Itinerary
        </h2>
        <p className="app-muted mt-2 text-sm">
          Activities use stored model content only. Place photos are placeholders
          until enrichment is added.
        </p>
      </div>

      <ol className="grid gap-6">
        {days.map((day) => (
          <li key={day.id} className="grid gap-3 border-l pl-4 sm:pl-5">
            <div>
              <Badge variant="outline">Day {day.dayNumber}</Badge>
              <h3 className="mt-2 font-heading text-lg font-semibold">
                {day.title}
              </h3>
            </div>

            {day.activities.length > 0 ? (
              <ol className="grid gap-3">
                {day.activities.map((activity) => (
                  <li key={activity.id}>
                    <ActivityPlaceCard
                      activity={activity}
                      destination={destination}
                      mapControls={mapControls}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyContent message="No activities were saved for this day." />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function ActivityPlaceCard({
  activity,
  destination,
  mapControls,
}: {
  activity: PresentedActivity
  destination: string
  mapControls: MapControls
}) {
  const hasPlaceDetails =
    activity.placeName !== null ||
    activity.address !== null ||
    activity.approximateArea !== null

  return (
    <Card className="app-card">
      <div className="grid gap-0 sm:grid-cols-[minmax(120px,180px)_minmax(0,1fr)]">
        <div
          aria-hidden="true"
          className="flex aspect-[16/9] items-center justify-center border-b bg-muted/40 text-xs font-medium uppercase text-muted-foreground sm:aspect-auto sm:border-r sm:border-b-0"
        >
          Photo pending
        </div>
        <div className="grid gap-4 py-4">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{activity.title}</CardTitle>
                <CardDescription>{activity.description}</CardDescription>
              </div>
              <Badge variant="secondary">{activity.timeLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <OptionalDetail label="Time of day" value={activity.timeOfDayLabel} />
              <OptionalDetail label="Duration" value={activity.duration} />
              <RequiredDetail
                label="AI-generated estimate"
                value={activity.estimatedPriceText}
              />
            </dl>

            {hasPlaceDetails ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <h4 className="text-sm font-medium">Place</h4>
                <dl className="mt-2 grid gap-2 text-sm">
                  <OptionalDetail label="Name" value={activity.placeName} />
                  <OptionalDetail label="Address" value={activity.address} />
                  <OptionalDetail
                    label="Approximate area"
                    value={activity.approximateArea}
                  />
                </dl>
              </div>
            ) : (
              <p className="app-muted text-sm">
                No place details were saved for this activity.
              </p>
            )}
            <ActivityPlaceEnrichment
              address={activity.address}
              approximateArea={activity.approximateArea}
              destination={destination}
              mapControls={mapControls}
              placeName={activity.placeName}
            />
          </CardContent>
        </div>
      </div>
    </Card>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/25 p-3 ring-1 ring-border">
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  )
}

function RequiredDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="mt-1 break-words text-muted-foreground">{value}</dd>
    </div>
  )
}

function OptionalDetail({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  if (value === null) {
    return null
  }

  return <RequiredDetail label={label} value={value} />
}

function EmptyContent({ message }: { message: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="app-muted text-sm">{message}</p>
    </div>
  )
}

type MapControls = {
  focusedProviderPlaceId: string | null
  onFocusPlace: (providerPlaceId: string) => void
}

export { TripPresentation }
