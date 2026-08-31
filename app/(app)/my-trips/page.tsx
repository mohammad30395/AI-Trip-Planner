import { auth } from "@clerk/nextjs/server"

import { MyTripsDashboard } from "@/components/trips/my-trips-dashboard"

async function MyTripsPage() {
  await auth.protect()

  return (
    <section className="grid min-w-0 gap-8">
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl leading-tight font-bold tracking-normal sm:text-5xl">
          My Trips
        </h1>
        <p className="app-muted mt-3 max-w-2xl text-base leading-7">
          Saved itineraries from your account, ready to reopen whenever you are
          planning the next step.
        </p>
      </header>

      <MyTripsDashboard />
    </section>
  )
}

export default MyTripsPage
