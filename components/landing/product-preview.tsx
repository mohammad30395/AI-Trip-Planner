import type { ReactNode } from "react"
import Image from "next/image"
import {
  CalendarDays,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Sparkles,
} from "lucide-react"

import { AppContainer } from "@/components/app-container"
import { Card } from "@/components/ui/card"

function ProductPreview() {
  return (
    <section id="product-preview" className="scroll-mt-24 pb-12 sm:pb-16">
      <AppContainer className="flex justify-center">
        <Card className="app-card w-full max-w-5xl overflow-hidden p-0">
          <div className="border-b px-5 py-4 sm:px-7">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Sparkles aria-hidden="true" className="size-5 text-primary" />
                <p className="font-heading text-base font-semibold">
                  Where to today?
                </p>
              </div>
              <div className="flex items-center gap-2" aria-hidden="true">
                <span className="h-2 w-14 rounded-full bg-muted" />
                <span className="h-2 w-10 rounded-full bg-muted" />
                <span className="size-7 rounded-full border bg-background" />
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-0 md:grid-cols-[4.5rem_minmax(0,1fr)]">
            <aside
              className="hidden border-r bg-background px-4 py-6 md:grid md:content-start md:gap-4"
              aria-hidden="true"
            >
              <PreviewIcon active icon={<MessageCircle className="size-4" />} />
              <PreviewIcon icon={<Heart className="size-4" />} />
              <PreviewIcon icon={<MapPin className="size-4" />} />
              <PreviewIcon icon={<CalendarDays className="size-4" />} />
              <PreviewIcon icon={<Home className="size-4" />} />
            </aside>

            <div className="grid min-w-0 gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
              <div className="grid min-w-0 content-start gap-4">
                <div>
                  <h2 className="font-heading text-2xl leading-tight font-bold text-foreground sm:text-3xl">
                    Where to today?
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                    Review your trip brief, compare ideas, and turn the final
                    itinerary into a saved plan.
                  </p>
                </div>

                <div className="rounded-[var(--app-card-radius)] border bg-soft-surface p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Sparkles aria-hidden="true" className="size-4" />
                    </span>
                    <p className="text-sm leading-6 text-foreground">
                      Tell me where you want to go. I&apos;ll help shape the
                      trip into days, places, hotels, and practical notes.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <PreviewTask title="Trip basics" value="Dhaka to Sylhet" />
                  <PreviewTask title="Budget" value="Moderate" />
                  <PreviewTask title="Duration" value="3 days" />
                </div>
              </div>

              <div className="relative min-h-[17rem] overflow-hidden rounded-[var(--app-image-radius)] border bg-soft-surface sm:min-h-[21rem]">
                <Image
                  src="/landing/destination-coastal-v2.png"
                  alt="Sunny coastal destination preview"
                  fill
                  sizes="(min-width: 1024px) 480px, 100vw"
                  className="object-cover"
                  priority={false}
                />
                <div className="absolute inset-x-4 bottom-4 rounded-[var(--app-control-radius)] bg-background/92 p-4 shadow-[var(--app-shadow-card)]">
                  <p className="text-sm font-semibold text-foreground">
                    Day-by-day itinerary
                  </p>
                  <div className="mt-3 grid gap-2">
                    <PreviewLine className="w-11/12" />
                    <PreviewLine className="w-3/4" />
                    <PreviewLine className="w-5/6" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </AppContainer>
    </section>
  )
}

function PreviewIcon({
  active = false,
  icon,
}: {
  active?: boolean
  icon: ReactNode
}) {
  return (
    <span
      className={`flex size-9 items-center justify-center rounded-full ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-soft-surface text-muted-foreground"
      }`}
    >
      {icon}
    </span>
  )
}

function PreviewTask({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[var(--app-control-radius)] border bg-background px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function PreviewLine({ className = "w-full" }: { className?: string }) {
  return <div className={`h-2 rounded-full bg-muted ${className}`} />
}

export { ProductPreview }
