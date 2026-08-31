"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"

import { AppStatePanel } from "@/components/ui/app-state-panel"
import { Button, buttonVariants } from "@/components/ui/button"

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

      <AppStatePanel
        className="max-w-2xl"
        description="The saved trip hit an unexpected loading error. Retry this page, or return to your saved trips."
        icon={AlertCircle}
        title="Trip could not be loaded"
        tone="destructive"
        action={
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
        }
      />
    </section>
  )
}

export default ViewTripError
