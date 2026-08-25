"use client"

import Link from "next/link"
import { useConvexAuth, useQuery } from "convex/react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { buildTripCardData, type TripCardData } from "@/lib/trips/dashboard"
import { cn } from "@/lib/utils"

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
    <section aria-labelledby="saved-trips" className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="saved-trips" className="font-heading text-xl font-semibold">
            Saved Trips
          </h2>
          <p className="app-muted mt-1 text-sm">
            Newest trips appear first.
          </p>
        </div>
        <Link href="/create-trip" className={buttonVariants()}>
          Create Trip
        </Link>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((trip) => (
          <li key={trip.id}>
            <TripCard trip={trip} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function TripsAuthState() {
  return (
    <Card className="app-card max-w-2xl">
      <CardHeader>
        <CardTitle>Trips are waiting for account sync</CardTitle>
        <CardDescription>
          Clerk is signed in, but Convex has not verified the account token yet.
          Refresh this page after signing in, or sign out and sign in again if it
          stays here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
          Sign In Again
        </Link>
      </CardContent>
    </Card>
  )
}

function TripCard({ trip }: { trip: TripCardData }) {
  return (
    <Card className="app-card h-full">
      <div
        aria-hidden="true"
        className="flex aspect-[16/9] items-center justify-center border-b bg-muted/40 text-xs font-medium uppercase text-muted-foreground"
      >
        Photo pending
      </div>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="break-words">{trip.destination}</CardTitle>
            <CardDescription className="mt-1 break-words">
              From {trip.source}
            </CardDescription>
          </div>
          <Badge variant="outline">{trip.statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-2 text-sm">
          <CardFact label="Duration" value={trip.durationLabel} />
          <CardFact label="Budget / group" value={trip.budgetGroupLabel} />
          <CardFact label="Created" value={trip.createdLabel} />
          <CardFact label="Enrichment" value={trip.enrichmentLabel} />
        </dl>
        <Link
          href={trip.href}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          View Trip
        </Link>
      </CardContent>
    </Card>
  )
}

function CardFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  )
}

function EmptyTripsState() {
  return (
    <Card className="app-card max-w-2xl">
      <CardHeader>
        <CardTitle>No saved trips yet</CardTitle>
        <CardDescription>
          Generate and save an itinerary to build your trip dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/create-trip" className={buttonVariants()}>
          Create Trip
        </Link>
      </CardContent>
    </Card>
  )
}

function TripGridSkeleton() {
  return (
    <section aria-label="Loading saved trips" className="grid gap-4">
      <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} className="app-card">
            <div className="aspect-[16/9] animate-pulse border-b bg-muted" />
            <CardHeader>
              <div className="h-5 w-3/4 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

export { MyTripsDashboard }
