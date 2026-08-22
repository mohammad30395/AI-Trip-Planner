import Image from "next/image"

import { AppContainer } from "@/components/app-container"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

const destinations = [
  {
    title: "Coastal city break",
    description: "Waterfront stays, slow lunches, and compact city walks.",
    imageSrc: "/landing/destination-coastal-v2.png",
    imageAlt: "Sunny coastal city along blue water",
  },
  {
    title: "Alpine lake reset",
    description: "Quiet mornings, scenic routes, and nature-first pacing.",
    imageSrc: "/landing/destination-alpine-v2.png",
    imageAlt: "Mountain lake with boats and alpine peaks",
  },
  {
    title: "Desert heritage route",
    description: "Old towns, warm evenings, and culture-rich day plans.",
    imageSrc: "/landing/destination-desert-v2.png",
    imageAlt: "Historic desert town at sunset",
  },
  {
    title: "Night market weekend",
    description: "Food streets, flexible nights, and easy urban exploring.",
    imageSrc: "/landing/destination-market-v2.png",
    imageAlt: "Colorful night market with lanterns",
  },
]

function PopularDestinations() {
  return (
    <section id="destinations" className="border-y bg-muted/35 py-12 sm:py-16">
      <AppContainer>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="app-muted text-sm font-medium uppercase tracking-wider">
              Popular starting points
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
              Placeholder destination styles for future planning data.
            </h2>
          </div>
          <Badge variant="secondary" className="w-fit">
            Local sample data
          </Badge>
        </div>

        <div className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {destinations.map((destination) => (
            <Card key={destination.title} className="app-card min-w-0 p-0">
              <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg">
                <Image
                  src={destination.imageSrc}
                  alt={destination.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-heading text-base font-semibold">
                  {destination.title}
                </h3>
                <p className="app-muted mt-2 text-sm leading-6">
                  {destination.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </AppContainer>
    </section>
  )
}

export { PopularDestinations }
