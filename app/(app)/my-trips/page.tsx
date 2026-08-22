import Link from "next/link"
import { auth } from "@clerk/nextjs/server"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
          Saved trips will appear here after authentication and Convex
          persistence are implemented in later milestones.
        </p>
      </div>

      <Card className="app-card max-w-2xl">
        <CardHeader>
          <CardTitle>No saved trips yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="app-muted leading-7">
            This placeholder does not read from a database or external service.
          </p>
        </CardContent>
      </Card>

      <div>
        <Link href="/create-trip" className={buttonVariants()}>
          Create Trip
        </Link>
      </div>
    </section>
  )
}

export default MyTripsPage
