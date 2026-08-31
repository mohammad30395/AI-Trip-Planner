"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AppStatePanel } from "@/components/ui/app-state-panel"

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

      <AppStatePanel
        className="max-w-2xl"
        description="The saved-trip dashboard hit an unexpected loading error."
        icon={AlertCircle}
        title="Trips could not be loaded"
        tone="destructive"
        action={
          <Button type="button" onClick={reset}>
            Try Again
          </Button>
        }
      />
    </section>
  )
}

export default MyTripsError
