"use client"

import Link from "next/link"
import { useQuery } from "convex/react"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TripPresentation } from "@/components/trips/trip-presentation"
import { api } from "@/convex/_generated/api"
import { buildTripPresentation } from "@/lib/trips/presentation"

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
        <TripStateCard
          title="Legacy trip data"
          message="This trip was created before the final itinerary schema was added, so it cannot be rendered as a full itinerary."
        />
      )
    case "ok": {
      const presentation = buildTripPresentation(result.trip)

      if (!presentation.ok) {
        return (
          <TripStateCard
            title="Trip data unavailable"
            message={presentation.error}
          />
        )
      }

      return <TripPresentation trip={presentation.data} />
    }
  }
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

export { SavedTripDetail }
