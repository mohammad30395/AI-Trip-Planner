import Link from "next/link"
import { auth } from "@clerk/nextjs/server"

import { ConvexAuthStatus } from "@/components/auth/convex-auth-status"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

async function CreateTripPage() {
  await auth.protect()

  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-2xl">
        <Badge variant="outline">Authenticated route</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          Create Trip
        </h1>
        <p className="app-muted mt-3 leading-7">
          You are signed in and can access the trip planning workspace. AI
          generation, quota checks, and persistence are not wired yet.
        </p>
      </div>

      <Card className="app-card max-w-2xl">
        <CardHeader>
          <CardTitle>Authentication status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="app-muted leading-7">
            Clerk verified an active session for this request. Convex must also
            verify the session before any data access.
          </p>
        </CardContent>
      </Card>

      <Card className="app-card max-w-2xl">
        <CardHeader>
          <CardTitle>Convex identity check</CardTitle>
        </CardHeader>
        <CardContent>
          <ConvexAuthStatus />
        </CardContent>
      </Card>

      <div>
        <Link href="/my-trips" className={buttonVariants({ variant: "outline" })}>
          View My Trips
        </Link>
      </div>
    </section>
  )
}

export default CreateTripPage
