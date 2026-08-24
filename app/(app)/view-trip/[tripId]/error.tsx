"use client"

import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function ViewTripError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="grid min-w-0 gap-6">
      <div className="max-w-2xl">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          View Trip
        </h1>
      </div>

      <Card className="app-card max-w-2xl">
        <CardHeader>
          <CardTitle>Trip could not be loaded</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="app-muted text-sm leading-6">
            The saved trip hit an unexpected loading error. Retry this page, or
            return to your saved trips.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={reset}>
              Try Again
            </Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/my-trips"
            >
              My Trips
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export default ViewTripError
