"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function MyTripsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-2xl">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          My Trips
        </h1>
      </div>

      <Card className="app-card max-w-2xl">
        <CardHeader>
          <CardTitle>Trips could not be loaded</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="app-muted text-sm leading-6">
            The saved-trip dashboard hit an unexpected loading error.
          </p>
          <div>
            <Button type="button" onClick={reset}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export default MyTripsError
