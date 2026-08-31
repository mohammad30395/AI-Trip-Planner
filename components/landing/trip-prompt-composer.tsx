"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Compass,
  Mountain,
  Plane,
  Send,
  Umbrella,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const suggestions = [
  {
    label: "Create New Trip",
    prompt: "Plan a new trip with my source, destination, budget, and dates.",
    icon: Compass,
    iconClassName: "text-info",
  },
  {
    label: "Inspire me where to go",
    prompt: "Suggest a memorable destination for a flexible vacation.",
    icon: Plane,
    iconClassName: "text-success",
  },
  {
    label: "Discover hidden gems",
    prompt: "Build a trip around local food, culture, and hidden gems.",
    icon: Building2,
    iconClassName: "text-primary",
  },
  {
    label: "Adventure Destination",
    prompt: "Plan an adventure trip with nature, viewpoints, and active days.",
    icon: Mountain,
    iconClassName: "text-rating",
  },
  {
    label: "Beach escape",
    prompt: "Plan a relaxing beach escape with balanced activities.",
    icon: Umbrella,
    iconClassName: "text-info",
  },
]

function TripPromptComposer() {
  const [prompt, setPrompt] = useState("")
  const router = useRouter()

  function submitComposer() {
    router.push("/create-trip")
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-7">
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault()
          submitComposer()
        }}
      >
        <label className="sr-only" htmlFor="landing-trip-prompt">
          Describe the trip you want to plan
        </label>
        <textarea
          id="landing-trip-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault()
              submitComposer()
            }
          }}
          rows={4}
          className="app-focus-ring min-h-[9rem] w-full resize-none rounded-[var(--app-panel-radius)] border border-border bg-background px-5 py-5 pr-20 text-base leading-7 text-foreground shadow-[var(--app-shadow-card)] outline-none transition-colors placeholder:text-muted-foreground sm:min-h-[11rem] sm:px-8 sm:py-7 sm:pr-24 sm:text-lg"
          placeholder="Create a trip for Paris from New York"
        />
        <Button
          type="submit"
          size="icon-lg"
          className="absolute right-4 bottom-4 size-11 rounded-[1rem] sm:right-6 sm:bottom-6 sm:size-12"
          aria-label="Start planning this trip"
        >
          <Send aria-hidden="true" className="size-5" />
        </Button>
      </form>

      <div
        className="flex flex-wrap items-center justify-center gap-3"
        aria-label="Trip prompt suggestions"
      >
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon

          return (
            <button
              key={suggestion.label}
              type="button"
              className="app-focus-ring inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-[var(--app-pill-radius)] border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-[0_8px_22px_rgb(15_23_42_/_0.04)] transition-colors hover:bg-soft-surface"
              onClick={() => setPrompt(suggestion.prompt)}
            >
              <Icon
                aria-hidden="true"
                className={cn("size-4.5", suggestion.iconClassName)}
              />
              <span className="min-w-0 break-words">{suggestion.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { TripPromptComposer }
