"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { AlertCircle, Loader2 } from "lucide-react"

import { AppStatePanel } from "@/components/ui/app-state-panel"
import { buttonVariants } from "@/components/ui/button"
import { TripPresentation } from "@/components/trips/trip-presentation"
import { api } from "@/convex/_generated/api"
import { buildTripPresentation } from "@/lib/trips/presentation"

function SavedTripDetail({ tripId }: { tripId: string }) {
  const result = useQuery(api.trips.getCurrentUserTripByPublicId, { tripId })

  if (result === undefined) {
    return (
      <TripStateCard
        busy
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
          actionHref="/my-trips"
          actionLabel="Back to My Trips"
        />
      )
    case "not_found":
      return (
        <TripStateCard
          title="Trip not found"
          message="No saved trip exists for this identifier."
          actionHref="/my-trips"
          actionLabel="Back to My Trips"
        />
      )
    case "unauthorized":
      return (
        <TripStateCard
          title="Access denied"
          message="You do not have access to this saved trip."
          actionHref="/my-trips"
          actionLabel="Back to My Trips"
        />
      )
    case "malformed_legacy_data":
      return (
        <TripStateCard
          title="Legacy trip data"
          message="This trip was created before the final itinerary schema was added, so it cannot be rendered as a full itinerary."
          actionHref="/my-trips"
          actionLabel="Back to My Trips"
        />
      )
    case "ok": {
      const presentation = buildTripPresentation(result.trip)

      if (!presentation.ok) {
        return (
          <TripStateCard
            title="Trip data unavailable"
            message={presentation.error}
            actionHref="/my-trips"
            actionLabel="Back to My Trips"
          />
        )
      }

      return (
        <div className="grid gap-6">
          <TripPresentation trip={presentation.data} />
          <div>
            <Link
              href="/my-trips"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to My Trips
            </Link>
          </div>
        </div>
      )
    }
  }
}

function TripStateCard({
  actionHref,
  actionLabel,
  busy = false,
  message,
  title,
}: {
  actionHref?: string
  actionLabel?: string
  busy?: boolean
  message: string
  title: string
}) {
  const Icon = busy ? Loader2 : AlertCircle

  return (
    <AppStatePanel
      busy={busy}
      className="mx-auto max-w-2xl"
      description={message}
      icon={Icon}
      title={title}
      tone={busy ? "primary" : "neutral"}
      action={
        actionHref !== undefined && actionLabel !== undefined ? (
          <Link href={actionHref} className={buttonVariants()}>
            {actionLabel}
          </Link>
        ) : undefined
      }
    />
  )
}

export { SavedTripDetail }
