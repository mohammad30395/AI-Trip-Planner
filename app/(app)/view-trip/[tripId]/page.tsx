import { auth } from "@clerk/nextjs/server"

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
    <section className="min-w-0">
      <SavedTripDetail tripId={tripId} />
    </section>
  )
}

export default ViewTripPage
