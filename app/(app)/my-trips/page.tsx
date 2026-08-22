import { auth } from "@clerk/nextjs/server"

import { Badge } from "@/components/ui/badge"
import { MyTripsDashboard } from "@/components/trips/my-trips-dashboard"

async function MyTripsPage() {
  await auth.protect()

  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-2xl">
        <Badge variant="outline">Authenticated route</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          My Trips
        </h1>
        <p className="app-muted mt-3 leading-7">
          Review the itineraries saved to your account. Trip ownership is
          resolved from your authenticated session.
        </p>
      </div>

      <MyTripsDashboard />
    </section>
  )
}

export default MyTripsPage
