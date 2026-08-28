import { describe, expect, test } from "vitest"

import { resolveWikimediaImage } from "@/lib/images/wikimedia"

const runLiveSmoke = process.env.WIKIMEDIA_LIVE_SMOKE === "1"

describe("live Wikimedia image smoke", () => {
  test.runIf(runLiveSmoke)(
    "resolves safe Sylhet and Ratargul images without hotel false positives",
    async () => {
      const sylhet = await resolveWikimediaImage({
        query: "Sylhet",
        context: "Bangladesh",
        kind: "representative",
        alt: "Sylhet destination",
        strictTitleMatch: false,
        signal: AbortSignal.timeout(10_000),
      })
      const ratargul = await resolveWikimediaImage({
        query: "Ratargul Swamp Forest",
        context: "Sylhet Bangladesh",
        kind: "exact_place",
        alt: "Ratargul Swamp Forest",
        strictTitleMatch: true,
        signal: AbortSignal.timeout(10_000),
      })
      const hotelSupreme = await resolveWikimediaImage({
        query: "Hotel Supreme",
        context: "Zindabazar Sylhet Bangladesh",
        kind: "exact_place",
        alt: "Hotel Supreme",
        strictTitleMatch: true,
        signal: AbortSignal.timeout(10_000),
      })

      expect(sylhet.status).toBe("found")
      expect(ratargul.status).toBe("found")
      expect(hotelSupreme.status).not.toBe("found")

      console.log("LIVE_WIKIMEDIA_IMAGE_SMOKE_SAFE_OBSERVATIONS", [
        toSafeObservation("Sylhet destination", sylhet),
        toSafeObservation("Ratargul exact place", ratargul),
        toSafeObservation("Hotel Supreme safety", hotelSupreme),
      ])
    },
    30_000
  )

  test.skipIf(runLiveSmoke)(
    "is skipped unless WIKIMEDIA_LIVE_SMOKE=1 is set",
    () => {
      expect(process.env.WIKIMEDIA_LIVE_SMOKE).not.toBe("1")
    }
  )
})

function toSafeObservation(
  label: string,
  result: Awaited<ReturnType<typeof resolveWikimediaImage>>
) {
  if (result.status !== "found") {
    return {
      label,
      status: result.status,
    }
  }

  return {
    label,
    status: result.status,
    source: result.image.source,
    kind: result.image.kind,
    host: new URL(result.image.url).hostname,
    matchedTitle: result.matchedTitle,
    license: result.image.license ?? null,
  }
}
