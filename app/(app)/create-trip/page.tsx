import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function CreateTripPage() {
  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-2xl">
        <Badge variant="outline">Route placeholder</Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          Create Trip
        </h1>
        <p className="app-muted mt-3 leading-7">
          This route will host the trip planning input flow. Authentication,
          AI generation, quota checks, and persistence are not wired yet.
        </p>
      </div>

      <Card className="app-card max-w-2xl">
        <CardHeader>
          <CardTitle>Planned inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>Source</li>
            <li>Destination</li>
            <li>Duration</li>
            <li>Budget</li>
            <li>Group size</li>
          </ul>
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
