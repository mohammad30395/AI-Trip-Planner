"use client"

import { useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  Info,
  MapPin,
  Navigation,
  Route,
  Sparkles,
  UsersRound,
  Wallet,
} from "lucide-react"

import {
  ExternalImageFrame,
  type ExternalImageFrameState,
} from "@/components/images/external-image-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  PlaceAttributionNotice,
  usePlaceEnrichment,
  type PlaceEnrichmentStatus,
} from "@/components/trips/place-enrichment"
import { TripMapSection } from "@/components/trips/trip-map"
import {
  buildActivityPlaceEnrichmentRequest,
  buildHotelPlaceEnrichmentRequest,
} from "@/lib/places/place-lookup-policy"
import type { ExternalImage } from "@/lib/images/external-image"
import type { PlaceEnrichmentRequest } from "@/lib/places/place-enrichment"
import {
  buildTripActivityMapLookup,
  buildTripHotelMapLookup,
  buildTripMapLookups,
} from "@/lib/trips/map"
import type {
  PresentedActivity,
  PresentedHotel,
  TripPresentationData,
} from "@/lib/trips/presentation"
import { cn } from "@/lib/utils"

function TripPresentation({ trip }: { trip: TripPresentationData }) {
  const [focusedMapPointId, setFocusedMapPointId] = useState<
    string | null
  >(null)
  const mapLookups = useMemo(() => buildTripMapLookups(trip), [trip])
  const mapControls = {
    focusedMapPointId,
    onFocusMapPoint: setFocusedMapPointId,
  }

  return (
    <article className="mx-auto grid w-full max-w-6xl gap-8 lg:gap-10">
      <TripSummaryHeader trip={trip} />
      <TripMapSection
        destination={trip.destination}
        durationLabel={trip.durationLabel}
        focusedMapPointId={focusedMapPointId}
        lookups={mapLookups}
        onMarkerFocus={setFocusedMapPointId}
        source={trip.source}
      />
      <HotelList
        destination={trip.destination}
        hotels={trip.hotels}
        mapControls={mapControls}
      />
      <DayByDayItinerary
        days={trip.days}
        destination={trip.destination}
        mapControls={mapControls}
      />
      <TripNotesSection practicalNotes={trip.practicalNotes} />
      <PlaceAttributionNotice />
    </article>
  )
}

function TripSummaryHeader({ trip }: { trip: TripPresentationData }) {
  return (
    <header className="grid gap-5 pt-2">
      <div className="max-w-4xl">
        <Badge variant="outline">Saved itinerary</Badge>
        <h1 className="mt-4 font-heading text-4xl leading-tight font-bold tracking-normal text-foreground sm:text-5xl lg:text-6xl">
          Your trip from{" "}
          <span className="text-foreground">{trip.source}</span> to{" "}
          <span className="text-primary">{trip.destination}</span> is ready
        </h1>
        <p className="app-muted mt-4 max-w-3xl text-base leading-7">
          {trip.summary}
        </p>
      </div>

      <dl className="flex flex-wrap gap-3 text-sm">
        <TripMetaItem
          icon={CalendarDays}
          label="Duration"
          value={trip.durationLabel}
        />
        <TripMetaItem icon={Wallet} label="Budget" value={trip.budgetLabel} />
        <TripMetaItem
          icon={UsersRound}
          label="Travelers"
          value={
            trip.groupTypeLabel === null
              ? trip.groupLabel
              : `${trip.groupLabel} (${trip.groupTypeLabel})`
          }
        />
        <TripMetaItem icon={Route} label="Created" value={trip.createdLabel} />
      </dl>
    </header>
  )
}

function TripNotesSection({ practicalNotes }: { practicalNotes: string[] }) {
  if (practicalNotes.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="practical-notes"
      className="grid gap-4 rounded-[var(--app-card-radius)] border bg-background p-5 shadow-[var(--app-shadow-card)]"
    >
      <SectionHeading
        description="Generated guidance saved with this trip."
        icon={Info}
        id="practical-notes"
        title="Practical Notes"
      />
      <ul className="grid gap-2 text-sm text-muted-foreground">
        {practicalNotes.map((note) => (
          <li key={note} className="leading-6">
            {note}
          </li>
        ))}
      </ul>
    </section>
  )
}

function HotelList({
  destination,
  hotels,
  mapControls,
}: {
  destination: string
  hotels: PresentedHotel[]
  mapControls: MapControls
}) {
  return (
    <section aria-labelledby="hotel-options" className="grid gap-5">
      <SectionHeading
        description="Hotel details and prices are generated estimates unless provider enrichment adds a verified place."
        icon={BedDouble}
        id="hotel-options"
        title="Hotels"
      />

      {hotels.length > 0 ? (
        <ul className="grid gap-5 md:grid-cols-2">
          {hotels.map((hotel, index) => (
            <li key={hotel.id}>
              <HotelCard
                destination={destination}
                hotel={hotel}
                hotelIndex={index}
                mapControls={mapControls}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyContent message="No hotel recommendations were saved for this trip." />
      )}
    </section>
  )
}

function HotelCard({
  destination,
  hotel,
  hotelIndex,
  mapControls,
}: {
  destination: string
  hotel: PresentedHotel
  hotelIndex: number
  mapControls: MapControls
}) {
  const mapPointId = useMemo(
    () =>
      buildTripHotelMapLookup({
        destination,
        hotel,
        index: hotelIndex,
      }).id,
    [destination, hotel, hotelIndex]
  )
  const request = useMemo(
    () =>
      buildHotelPlaceEnrichmentRequest({
        address: hotel.address,
        area: hotel.area,
        destination,
        name: hotel.name,
      }),
    [destination, hotel.address, hotel.area, hotel.name]
  )
  const { retryLookup, state } = useRetriablePlaceEnrichment(request)
  const placeImage = state.status === "success" ? state.place.image : undefined
  const canFocusMap = state.status === "success"
  const isFocused = mapControls.focusedMapPointId === mapPointId

  return (
    <article
      className={cn(
        "group h-full scroll-mt-28 overflow-hidden rounded-[var(--app-card-radius)] border bg-background shadow-[var(--app-shadow-card)] transition-[box-shadow,border-color,background-color]",
        "hover:border-primary/30 hover:shadow-[var(--app-shadow-elevated)]",
        isFocused && "border-primary/45 bg-primary/[0.025] ring-3 ring-brand-orange/20"
      )}
      data-map-point-id={mapPointId}
      data-provider-place-id={
        state.status === "success" ? state.place.providerPlaceId : undefined
      }
    >
      <ExternalImageFrame
        className="h-52 w-full border-b"
        fallbackLabel={hotel.name}
        image={placeImage}
        state={getCardImageState(state, placeImage)}
      />

      <div className="grid gap-4 p-4 sm:p-5">
        <div className="grid gap-2">
          <h3 className="font-heading text-xl leading-snug font-semibold">
            {hotel.name}
          </h3>
          <p className="app-muted text-sm leading-6">{hotel.description}</p>
        </div>

        <dl className="grid gap-3 text-sm">
          <OptionalIconDetail icon={MapPin} label="Area" value={hotel.area} />
          <OptionalIconDetail
            icon={Navigation}
            label="Address"
            value={hotel.address}
          />
        </dl>

        <div className="flex flex-wrap gap-2">
          <MetadataPill
            icon={Wallet}
            label="Estimated"
            tone="success"
            value={hotel.estimatedPriceText}
          />
          {hotel.priceTierLabel !== null ? (
            <MetadataPill
              icon={Sparkles}
              label="Style"
              tone="neutral"
              value={hotel.priceTierLabel}
            />
          ) : null}
        </div>

        <PlaceCapability
          emptyMessage="Map location unavailable for this hotel."
          kind="hotel"
          state={state}
          onRetry={retryLookup}
        />

        <MapFocusButton
          canFocusMap={canFocusMap}
          mapControls={mapControls}
          mapPointId={mapPointId}
          unavailableLabel="Hotel map location unavailable"
        />
      </div>
    </article>
  )
}

function DayByDayItinerary({
  days,
  destination,
  mapControls,
}: {
  days: TripPresentationData["days"]
  destination: string
  mapControls: MapControls
}) {
  return (
    <section aria-labelledby="day-by-day-itinerary" className="grid gap-6">
      <SectionHeading
        description="Activities use saved itinerary text with provider-enriched place details when a safe canonical match is available."
        icon={Compass}
        id="day-by-day-itinerary"
        title="Day-by-Day Itinerary"
      />

      <ol className="grid gap-8">
        {days.map((day) => (
          <li
            key={day.id}
            className="relative grid gap-4 pl-7 before:absolute before:top-10 before:bottom-0 before:left-2 before:w-px before:bg-border last:before:hidden sm:pl-9 sm:before:left-2.5"
          >
            <div className="relative">
              <span
                className="absolute top-1 -left-7 size-4 rounded-full bg-primary ring-4 ring-background sm:-left-9 sm:size-5"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-primary">
                Day {day.dayNumber}
              </p>
              <h2 className="mt-1 font-heading text-2xl leading-tight font-bold tracking-normal sm:text-3xl">
                {day.title}
              </h2>
            </div>

            {day.activities.length > 0 ? (
              <ol className="grid gap-5 md:grid-cols-2">
                {day.activities.map((activity, index) => (
                  <li key={activity.id}>
                    <ActivityPlaceCard
                      activity={activity}
                      activityIndex={index}
                      dayNumber={day.dayNumber}
                      destination={destination}
                      mapControls={mapControls}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyContent message="No activities were saved for this day." />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function ActivityPlaceCard({
  activity,
  activityIndex,
  dayNumber,
  destination,
  mapControls,
}: {
  activity: PresentedActivity
  activityIndex: number
  dayNumber: number
  destination: string
  mapControls: MapControls
}) {
  const placeImageRequest = useMemo(
    () =>
      buildActivityPlaceEnrichmentRequest({
        address: activity.address,
        approximateArea: activity.approximateArea,
        destination,
        placeKind: activity.place.kind,
        placeName: activity.placeName,
        title: activity.title,
      }),
    [
      activity.address,
      activity.approximateArea,
      activity.place.kind,
      activity.placeName,
      activity.title,
      destination,
    ]
  )
  const { retryLookup, state: placeImageState } =
    useRetriablePlaceEnrichment(placeImageRequest)
  const placeImage =
    placeImageState.status === "success" ? placeImageState.place.image : undefined
  const mapPointId = useMemo(
    () =>
      buildTripActivityMapLookup({
        activity,
        dayNumber,
        destination,
        index: activityIndex,
        sequence: 1,
      })?.id ?? null,
    [activity, activityIndex, dayNumber, destination]
  )
  const hasPlaceDetails =
    activity.place.kind === "specific_place" &&
    (activity.placeName !== null ||
      activity.address !== null ||
      activity.approximateArea !== null)
  const hasTransportDetails =
    activity.place.kind === "transport" &&
    (activity.place.originHint !== null || activity.place.destinationHint !== null)
  const canFocusMap = placeImageState.status === "success" && mapPointId !== null
  const isFocused = mapPointId !== null && mapControls.focusedMapPointId === mapPointId

  return (
    <article
      className={cn(
        "group h-full scroll-mt-28 overflow-hidden rounded-[var(--app-card-radius)] border bg-background shadow-[var(--app-shadow-card)] transition-[box-shadow,border-color,background-color]",
        "hover:border-primary/30 hover:shadow-[var(--app-shadow-elevated)]",
        isFocused &&
          "border-primary/45 bg-primary/[0.025] ring-3 ring-brand-orange/20"
      )}
      data-map-point-id={mapPointId ?? undefined}
      data-provider-place-id={
        placeImageState.status === "success"
          ? placeImageState.place.providerPlaceId
          : undefined
      }
    >
      <ExternalImageFrame
        className="h-48 w-full border-b"
        fallbackLabel={activity.placeName ?? activity.title}
        image={placeImage}
        state={getCardImageState(placeImageState, placeImage)}
      />

      <div className="grid gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              {activity.timeLabel}
            </p>
            <h3 className="font-heading text-xl leading-snug font-semibold">
              {activity.title}
            </h3>
          </div>
        </div>

        <p className="app-muted text-sm leading-6">{activity.description}</p>

        <div className="grid gap-2">
          <MetadataPill
            icon={Wallet}
            label="Estimated cost"
            tone="info"
            value={activity.estimatedPriceText}
          />
          {activity.timeOfDayLabel !== null ? (
            <MetadataPill
              icon={Clock3}
              label="Best time"
              tone="primary"
              value={activity.timeOfDayLabel}
            />
          ) : null}
          {activity.duration !== null ? (
            <MetadataPill
              icon={CalendarDays}
              label="Duration"
              tone="neutral"
              value={activity.duration}
            />
          ) : null}
        </div>

        <ActivityPlaceSummary
          activity={activity}
          hasPlaceDetails={hasPlaceDetails}
          hasTransportDetails={hasTransportDetails}
        />

        {activity.place.kind === "specific_place" ? (
          <PlaceCapability
            emptyMessage="Map location unavailable for this activity."
            kind="activity"
            state={placeImageState}
            onRetry={retryLookup}
          />
        ) : null}

        <MapFocusButton
          canFocusMap={canFocusMap}
          mapControls={mapControls}
          mapPointId={mapPointId}
          unavailableLabel="Activity map location unavailable"
        />
      </div>
    </article>
  )
}

function TripMetaItem({
  icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  const Icon = icon

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-full border bg-background px-3 py-2 shadow-sm">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="truncate font-medium text-foreground">{value}</dd>
      </div>
    </div>
  )
}

function SectionHeading({
  description,
  icon,
  id,
  title,
}: {
  description: string
  icon: LucideIcon
  id: string
  title: string
}) {
  const Icon = icon

  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary"
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h2
          id={id}
          className="font-heading text-3xl leading-tight font-bold tracking-normal"
        >
          {title}
        </h2>
        <p className="app-muted mt-2 max-w-3xl text-sm leading-6">
          {description}
        </p>
      </div>
    </div>
  )
}

function MetadataPill({
  icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon
  label: string
  tone: "info" | "neutral" | "primary" | "success"
  value: string
}) {
  const Icon = icon

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-[var(--app-control-radius)] border px-3 py-2 text-sm",
        getMetadataToneClassName(tone)
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-normal opacity-80">
          {label}
        </p>
        <p className="mt-1 break-words font-semibold">{value}</p>
      </div>
    </div>
  )
}

function getMetadataToneClassName(
  tone: "info" | "neutral" | "primary" | "success"
) {
  if (tone === "success") {
    return "border-success/25 bg-success/10 text-success"
  }

  if (tone === "info") {
    return "border-info/25 bg-info/10 text-info"
  }

  if (tone === "primary") {
    return "border-primary/25 bg-primary/10 text-primary"
  }

  return "border-border bg-soft-surface text-foreground"
}

function OptionalIconDetail({
  icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string | null
}) {
  if (value === null) {
    return null
  }

  const Icon = icon

  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
      </div>
    </div>
  )
}

function ActivityPlaceSummary({
  activity,
  hasPlaceDetails,
  hasTransportDetails,
}: {
  activity: PresentedActivity
  hasPlaceDetails: boolean
  hasTransportDetails: boolean
}) {
  if (hasPlaceDetails) {
    return (
      <div className="rounded-[var(--app-control-radius)] border bg-soft-surface p-3">
        <h4 className="text-sm font-semibold">Place details</h4>
        <dl className="mt-3 grid gap-3 text-sm">
          <OptionalIconDetail
            icon={MapPin}
            label="Place"
            value={activity.placeName}
          />
          <OptionalIconDetail
            icon={Navigation}
            label="Address"
            value={activity.address}
          />
          <OptionalIconDetail
            icon={Compass}
            label="Area"
            value={activity.approximateArea}
          />
        </dl>
      </div>
    )
  }

  if (hasTransportDetails) {
    return (
      <div className="rounded-[var(--app-control-radius)] border bg-soft-surface p-3">
        <h4 className="text-sm font-semibold">Transport</h4>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <OptionalIconDetail
            icon={MapPin}
            label="From"
            value={activity.place.originHint}
          />
          <OptionalIconDetail
            icon={Navigation}
            label="To"
            value={activity.place.destinationHint}
          />
        </dl>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--app-control-radius)] border bg-soft-surface p-3">
      <p className="app-muted text-sm">
        {activity.place.kind === "transport"
          ? "Transport between trip stops."
          : "Flexible activity, no venue needed."}
      </p>
    </div>
  )
}

function PlaceCapability({
  emptyMessage,
  kind,
  onRetry,
  state,
}: {
  emptyMessage: string
  kind: "activity" | "hotel"
  onRetry?: () => void
  state: PlaceEnrichmentStatus
}) {
  if (state.status === "success") {
    return (
      <div className="rounded-[var(--app-control-radius)] border border-success/25 bg-success/10 p-3 text-sm text-success">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Map location verified
        </p>
        <p className="mt-1 break-words leading-6">{state.place.formattedAddress}</p>
      </div>
    )
  }

  if (state.status === "loading") {
    return (
      <div
        aria-busy="true"
        className="rounded-[var(--app-control-radius)] border bg-soft-surface p-3 text-sm"
      >
        <p className="font-medium">Verifying map location</p>
        <div className="mt-3 grid gap-2" aria-hidden="true">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (state.status === "empty" || state.status === "error") {
    const canRetry =
      onRetry !== undefined &&
      (state.status === "error" || state.retryable !== false)

    return (
      <div className="grid gap-3 rounded-[var(--app-control-radius)] border bg-soft-surface p-3 text-sm">
        <p className="app-muted leading-6">{state.message}</p>
        {canRetry ? (
          <div>
            <Button size="sm" type="button" variant="outline" onClick={onRetry}>
              Retry Place Lookup
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-[var(--app-control-radius)] border bg-soft-surface p-3">
      <p className="app-muted text-sm">
        {kind === "hotel"
          ? emptyMessage
          : "This activity does not need a mapped place."}
      </p>
    </div>
  )
}

function MapFocusButton({
  canFocusMap,
  mapControls,
  mapPointId,
  unavailableLabel,
}: {
  canFocusMap: boolean
  mapControls: MapControls
  mapPointId: string | null
  unavailableLabel: string
}) {
  if (canFocusMap && mapPointId !== null) {
    return (
      <Button
        className="w-full"
        type="button"
        variant="outline"
        onClick={() => {
          mapControls.onFocusMapPoint(mapPointId)
          scrollTripMapIntoView()
        }}
      >
        <MapPin aria-hidden="true" />
        View on Map
      </Button>
    )
  }

  return (
    <Button
      aria-label={unavailableLabel}
      className="w-full"
      disabled
      type="button"
      variant="outline"
    >
      <MapPin aria-hidden="true" />
      Map location unavailable
    </Button>
  )
}

function scrollTripMapIntoView() {
  document.getElementById("trip-map-panel")?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  })
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function useRetriablePlaceEnrichment(request: PlaceEnrichmentRequest | null) {
  const [retryToken, setRetryToken] = useState(0)
  const state = usePlaceEnrichment(request, retryToken)

  return {
    retryLookup: () => {
      setRetryToken((currentToken) => currentToken + 1)
    },
    state,
  }
}

function getCardImageState(
  state: PlaceEnrichmentStatus,
  image: ExternalImage | undefined
): ExternalImageFrameState {
  if (state.status === "loading") {
    return "loading"
  }

  return image === undefined ? "missing" : "ready"
}

function EmptyContent({ message }: { message: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="app-muted text-sm">{message}</p>
    </div>
  )
}

type MapControls = {
  focusedMapPointId: string | null
  onFocusMapPoint: (mapPointId: string) => void
}

export { TripPresentation }
