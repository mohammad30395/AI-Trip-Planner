"use client"

import { AlertCircle } from "lucide-react"

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
    <section className="grid min-w-0 gap-8">
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl leading-tight font-bold tracking-normal sm:text-5xl">
          My Trips
        </h1>
      </header>

      <Card className="app-panel max-w-2xl p-0">
        <CardHeader className="px-5 py-5">
          <div className="flex items-start gap-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-[var(--app-control-radius)] bg-accent text-primary"
              aria-hidden="true"
            >
              <AlertCircle className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Trips could not be loaded</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5">
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
