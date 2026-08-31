"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useConvexAuth, useQuery } from "convex/react"
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Plane,
} from "lucide-react"

import { ExternalImageFrame } from "@/components/images/external-image-frame"
import { AppStatePanel } from "@/components/ui/app-state-panel"
import { buttonVariants } from "@/components/ui/button"
import { usePlaceEnrichment } from "@/components/trips/place-enrichment"
import { api } from "@/convex/_generated/api"
import { buildDestinationCoverEnrichmentRequest } from "@/lib/places/place-lookup-policy"
import { buildTripCardData, type TripCardData } from "@/lib/trips/dashboard"

function MyTripsDashboard() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const result = useQuery(
    api.trips.listCurrentUserTrips,
    isAuthenticated ? {} : "skip"
  )

  if (isLoading || result === undefined) {
    return <TripGridSkeleton />
  }

  if (!isAuthenticated || result.status === "unauthenticated") {
    return <TripsAuthState />
  }

  const { trips } = result

  if (trips.length === 0) {
    return <EmptyTripsState />
  }

  const cards = trips.map(buildTripCardData)

  return (
    <section aria-label="Saved trips" className="grid gap-5">
      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((trip) => (
          <li key={trip.id}>
            <SavedTripCard trip={trip} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function TripsAuthState() {
  return (
    <AppStatePanel
      className="max-w-2xl"
      description="Clerk is signed in, but Convex has not verified the account token yet. Refresh this page after signing in, or sign out and sign in again if it stays here."
      icon={AlertCircle}
      title="Trips are waiting for account sync"
      tone="primary"
      action={
        <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
          Sign In Again
        </Link>
      }
    />
  )
}

function SavedTripCard({ trip }: { trip: TripCardData }) {
  const coverRequest = useMemo(
    () => buildDestinationCoverEnrichmentRequest(trip.destination),
    [trip.destination]
  )
  const coverState = usePlaceEnrichment(coverRequest)
  const coverImage =
    coverState.status === "success" ? coverState.place.image : undefined

  return (
    <Link
      aria-label={`View trip from ${trip.source} to ${trip.destination}`}
      className="app-focus-ring group block h-full overflow-hidden rounded-[var(--app-card-radius)] border bg-background shadow-[var(--app-shadow-card)] transition-[border-color,box-shadow,transform] hover:border-primary/30 hover:shadow-[var(--app-shadow-elevated)] active:translate-y-px"
      href={trip.href}
    >
      <ExternalImageFrame
        className="aspect-[16/10] w-full transition-transform duration-300 group-hover:scale-[1.02]"
        fallbackDescription={trip.destination}
        fallbackLabel={`${trip.destination} destination`}
        image={coverImage}
        state={
          coverState.status === "loading"
            ? "loading"
            : coverImage === undefined
              ? "missing"
              : "ready"
        }
      />
      <div className="grid gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2
            className="min-w-0 break-words font-heading text-xl leading-snug font-bold tracking-normal text-foreground"
            title={`${trip.source} to ${trip.destination}`}
          >
            <span>{trip.source}</span>
            <ArrowRight
              className="mx-1.5 inline size-5 align-[-0.15em] text-foreground/80"
              aria-hidden="true"
            />
            <span>{trip.destination}</span>
          </h2>
          <span
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border bg-soft-surface text-primary transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>
        <p className="app-muted text-base font-medium leading-6">
          {formatTripSummary(trip)}
        </p>
        <p className="app-muted text-xs font-medium">Saved {trip.createdLabel}</p>
      </div>
    </Link>
  )
}

function EmptyTripsState() {
  return (
    <AppStatePanel
      align="center"
      className="mx-auto max-w-xl"
      description="Generate and save an itinerary to start building your trip dashboard."
      icon={Plane}
      title="No trips yet"
      tone="primary"
      action={
        <Link href="/create-trip" className={buttonVariants()}>
          <MapPin aria-hidden="true" />
          Create Trip
        </Link>
      }
    />
  )
}

function TripGridSkeleton() {
  return (
    <section aria-label="Loading saved trips" aria-busy="true">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[var(--app-card-radius)] border bg-background shadow-[var(--app-shadow-card)]"
          >
            <div className="aspect-[16/10] animate-pulse border-b bg-muted" />
            <div className="grid gap-3 p-4 sm:p-5">
              <div className="h-6 w-4/5 animate-pulse rounded-[var(--app-control-radius)] bg-muted" />
              <div className="h-5 w-3/5 animate-pulse rounded-[var(--app-control-radius)] bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded-[var(--app-control-radius)] bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatTripSummary(trip: TripCardData) {
  const durationText =
    trip.durationLabel === "Unknown duration"
      ? trip.durationLabel
      : `${trip.durationLabel} Trip`
  const budgetText =
    trip.budgetLabel === "Budget"
      ? trip.budgetLabel
      : `${trip.budgetLabel} Budget`

  return `${durationText} with ${budgetText}`
}

export { MyTripsDashboard }
