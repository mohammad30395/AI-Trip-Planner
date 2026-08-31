import Link from "next/link"
import { auth } from "@clerk/nextjs/server"

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
    <section className="grid min-w-0 gap-8">
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
