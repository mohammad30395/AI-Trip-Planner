import { AppContainer } from "@/components/app-container"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

function ProductPreview() {
  return (
    <section id="preview" className="app-section">
      <AppContainer className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-center">
        <div className="min-w-0">
          <p className="app-muted text-sm font-medium uppercase tracking-wider">
            Product preview
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
            A calm workspace for itinerary review.
          </h2>
          <p className="app-muted mt-4 leading-7">
            This placeholder shows where a future generated itinerary preview or
            short product video can live. It is static for now, with no media
            player dependency and no external service connection.
          </p>
        </div>

        <Card className="app-card min-w-0 p-3">
          <figure className="min-w-0 rounded-lg border bg-background p-4">
            <div className="min-h-[360px] rounded-lg bg-[linear-gradient(135deg,oklch(0.97_0_0),oklch(0.88_0.03_220))] p-4 sm:aspect-video sm:min-h-0">
              <div className="flex h-full flex-col justify-between rounded-md border bg-background/85 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">Preview</Badge>
                  <div className="flex gap-1.5" aria-hidden="true">
                    <span className="size-2 rounded-full bg-muted-foreground/40" />
                    <span className="size-2 rounded-full bg-muted-foreground/40" />
                    <span className="size-2 rounded-full bg-muted-foreground/40" />
                  </div>
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
                  <div className="rounded-md border bg-card p-3">
                    <p className="text-sm font-medium">Day 2 itinerary</p>
                    <div className="mt-4 space-y-2">
                      <PreviewLine className="w-11/12" />
                      <PreviewLine className="w-3/4" />
                      <PreviewLine className="w-5/6" />
                    </div>
                  </div>
                  <div className="rounded-md border bg-card p-3">
                    <p className="text-sm font-medium">Place list</p>
                    <div className="mt-4 space-y-2">
                      <PreviewLine />
                      <PreviewLine className="w-2/3" />
                      <PreviewLine className="w-4/5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <figcaption className="app-muted mt-3 text-sm">
              Static preview placeholder. Interactive itinerary tools arrive in
              later milestones.
            </figcaption>
          </figure>
        </Card>
      </AppContainer>
    </section>
  )
}

function PreviewLine({ className = "w-full" }: { className?: string }) {
  return <div className={`h-2 rounded-full bg-muted ${className}`} />
}

export { ProductPreview }
