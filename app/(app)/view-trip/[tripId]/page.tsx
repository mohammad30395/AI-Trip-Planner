import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ViewTripPageProps = {
  params: Promise<{
    tripId: string
  }>
}

async function ViewTripPage({ params }: ViewTripPageProps) {
  const { tripId } = await params

  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-2xl">
        <Badge variant="outline">Dynamic route placeholder</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          View Trip
        </h1>
        <p className="app-muted mt-3 leading-7">
          This page confirms the dynamic route boundary. It does not fetch trip
          data yet.
        </p>
      </div>

      <Card className="app-card max-w-2xl">
        <CardHeader>
          <CardTitle>Trip identifier</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="block rounded-md border bg-background px-3 py-2 text-sm break-all">
            {tripId}
          </code>
        </CardContent>
      </Card>

      <div>
        <Link href="/my-trips" className={buttonVariants({ variant: "outline" })}>
          Back to My Trips
        </Link>
      </div>
    </section>
  )
}

export default ViewTripPage
