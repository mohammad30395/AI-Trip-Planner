"use client"

import Link from "next/link"
import { useQuery } from "convex/react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import type { FinalItineraryResponse } from "@/lib/ai/contract"

type TripHeaderData = {
  _id: string
  source: string
  destination: string
  durationDays: number
  budget: string
  groupSize: number
  generatedTripPayload: unknown
  enrichmentStatus: string
  createdAt: number
}

function SavedTripDetail({ tripId }: { tripId: string }) {
  const result = useQuery(api.trips.getCurrentUserTripByPublicId, { tripId })

  if (result === undefined) {
    return (
      <TripStateCard
        title="Loading trip"
        message="Fetching the saved itinerary from Convex."
      />
    )
  }

  switch (result.status) {
    case "unauthenticated":
      return (
        <TripStateCard
          title="Sign in required"
          message="Sign in before viewing saved trips."
          actionHref="/sign-in"
          actionLabel="Sign In"
        />
      )
    case "malformed_id":
      return (
        <TripStateCard
          title="Invalid trip link"
          message="This trip URL does not contain a valid saved trip identifier."
        />
      )
    case "not_found":
      return (
        <TripStateCard
          title="Trip not found"
          message="No saved trip exists for this identifier."
        />
      )
    case "unauthorized":
      return (
        <TripStateCard
          title="Access denied"
          message="This trip belongs to another account."
        />
      )
    case "malformed_legacy_data":
      return (
        <MalformedLegacyTrip
          budget={result.trip.budget}
          createdAt={result.trip.createdAt}
          destination={result.trip.destination}
          durationDays={result.trip.durationDays}
          groupSize={result.trip.groupSize}
          source={result.trip.source}
          tripId={result.trip._id}
        />
      )
    case "ok":
      return <TripSummary trip={result.trip} />
  }
}

type TripSummaryProps = {
  trip: TripHeaderData
}

function TripSummary({ trip }: TripSummaryProps) {
  const itinerary = isFinalItineraryPayload(trip.generatedTripPayload)
    ? trip.generatedTripPayload
    : null

  if (itinerary === null) {
    return (
      <TripStateCard
        title="Trip data unavailable"
        message="This saved trip record does not contain a valid generated itinerary."
      />
    )
  }

  return (
    <div className="grid max-w-4xl gap-5">
      <TripHeader
        budget={trip.budget}
        createdAt={trip.createdAt}
        destination={trip.destination}
        durationDays={trip.durationDays}
        groupSize={trip.groupSize}
        source={trip.source}
        tripId={trip._id}
      />

      <Card className="app-card">
        <CardHeader>
          <CardTitle>Generated plan data</CardTitle>
          <p className="app-muted text-sm">
            Place details and prices are generated estimates until enrichment is
            added.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="app-muted text-sm leading-6">{itinerary.summary}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <HeaderItem label="Hotels" value={String(itinerary.hotels.length)} />
            <HeaderItem label="Days" value={String(itinerary.itinerary.length)} />
            <HeaderItem
              label="Enrichment"
              value={formatStatus(trip.enrichmentStatus)}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

function MalformedLegacyTrip({
  budget,
  createdAt,
  destination,
  durationDays,
  groupSize,
  source,
  tripId,
}: {
  budget: string
  createdAt: number
  destination: string
  durationDays: number
  groupSize: number
  source: string
  tripId: string
}) {
  return (
    <div className="grid max-w-4xl gap-5">
      <TripHeader
        budget={budget}
        createdAt={createdAt}
        destination={destination}
        durationDays={durationDays}
        groupSize={groupSize}
        source={source}
        tripId={tripId}
      />
      <TripStateCard
        title="Legacy trip data"
        message="This trip was created before the final itinerary schema was added, so only the header can be displayed."
      />
    </div>
  )
}

function TripHeader({
  budget,
  createdAt,
  destination,
  durationDays,
  groupSize,
  source,
  tripId,
}: {
  budget: string
  createdAt: number
  destination: string
  durationDays: number
  groupSize: number
  source: string
  tripId: string
}) {
  return (
    <Card className="app-card">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="outline">Persisted trip</Badge>
            <CardTitle className="mt-3">
              {destination}
            </CardTitle>
            <p className="app-muted mt-2 text-sm">
              From {source}
            </p>
          </div>
          <Badge>{formatBudget(budget)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <HeaderItem
            label="Duration"
            value={`${durationDays} day${durationDays === 1 ? "" : "s"}`}
          />
          <HeaderItem
            label="Group size"
            value={`${groupSize} traveler${groupSize === 1 ? "" : "s"}`}
          />
          <HeaderItem label="Created" value={formatDate(createdAt)} />
        </dl>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Trip ID
          </p>
          <code className="mt-2 block rounded-md border bg-background px-3 py-2 text-xs break-all">
            {tripId}
          </code>
        </div>
      </CardContent>
    </Card>
  )
}

function TripStateCard({
  actionHref,
  actionLabel,
  message,
  title,
}: {
  actionHref?: string
  actionLabel?: string
  message: string
  title: string
}) {
  return (
    <Card className="app-card max-w-3xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="app-muted text-sm leading-6">{message}</p>
        {actionHref !== undefined && actionLabel !== undefined ? (
          <div>
            <Link href={actionHref} className={buttonVariants()}>
              {actionLabel}
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function HeaderItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/25 p-3 ring-1 ring-border">
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
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

function formatBudget(value: string) {
  if (value === "mid-range") {
    return "Mid-range"
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ")
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(timestamp))
}

export { SavedTripDetail }
