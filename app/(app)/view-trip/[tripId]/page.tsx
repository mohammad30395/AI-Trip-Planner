import Link from "next/link"
import { auth } from "@clerk/nextjs/server"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { SavedTripDetail } from "@/components/trips/saved-trip-detail"

type ViewTripPageProps = {
  params: Promise<{
    tripId: string
  }>
}

async function ViewTripPage({ params }: ViewTripPageProps) {
  await auth.protect()

  const { tripId } = await params

  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-2xl">
        <Badge variant="outline">Saved trip</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          View Trip
        </h1>
        <p className="app-muted mt-3 leading-7">
          This page loads the saved itinerary through an owner-authorized Convex
          query.
        </p>
      </div>

      <SavedTripDetail tripId={tripId} />

      <div>
        <Link href="/my-trips" className={buttonVariants({ variant: "outline" })}>
          Back to My Trips
        </Link>
      </div>
    </section>
  )
}

export default ViewTripPage
