import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import {
  formatBudget,
  formatGroupType,
  type TripRequirementStep,
  type TripRequirements,
} from "./create-trip-flow"

type TripPreviewPanelProps = {
  requirements: TripRequirements
  step: TripRequirementStep
}

const previewItems: Array<{
  key: keyof TripRequirements
  label: string
  format: (requirements: TripRequirements) => string
}> = [
  {
    key: "source",
    label: "Source",
    format: (requirements) => requirements.source.trim() || "Not set",
  },
  {
    key: "destination",
    label: "Destination",
    format: (requirements) => requirements.destination.trim() || "Not set",
  },
  {
    key: "durationDays",
    label: "Duration",
    format: (requirements) =>
      requirements.durationDays === null
        ? "Not set"
        : `${requirements.durationDays} day${requirements.durationDays === 1 ? "" : "s"}`,
  },
  {
    key: "budgetTier",
    label: "Budget",
    format: (requirements) => formatBudget(requirements.budgetTier),
  },
  {
    key: "groupType",
    label: "Travelers",
    format: (requirements) => {
      if (requirements.groupSize === null && requirements.groupType === null) {
        return "Not set"
      }

      const groupSize = requirements.groupSize ?? "?"

      return `${groupSize} ${formatGroupType(requirements.groupType)} traveler${
        requirements.groupSize === 1 ? "" : "s"
      }`
    },
  },
]

function TripPreviewPanel({ requirements, step }: TripPreviewPanelProps) {
  return (
    <aside className="grid min-w-0 gap-5 lg:sticky lg:top-6">
      <Card className="app-card">
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Trip Brief</CardTitle>
              <p className="app-muted mt-1 text-sm">Local preview</p>
            </div>
            <Badge variant={step === "readyForFinal" ? "default" : "outline"}>
              {step === "readyForFinal" ? "Ready" : "In progress"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3">
            {previewItems.map((item) => (
              <div
                key={item.key}
                className="grid gap-1 rounded-lg border bg-background p-3"
              >
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  {item.label}
                </dt>
                <dd className="min-w-0 break-words text-sm font-medium">
                  {item.format(requirements)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="app-card">
        <CardHeader>
          <CardTitle>Next Integration Points</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-muted-foreground">
            <li>Final itinerary generation starts from READY_FOR_FINAL.</li>
            <li>Convex persistence saves generated trips after generation.</li>
            <li>Free quota and premium access are checked server-side.</li>
            <li>Maps remain disconnected until the Leaflet map milestone.</li>
          </ul>
        </CardContent>
      </Card>
    </aside>
  )
}

export { TripPreviewPanel }
