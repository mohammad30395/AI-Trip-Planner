import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqFinalItinerary,
  type GroqFinalProviderErrorMetadata,
} from "@/lib/ai/groq"
import {
  createGroqFinalDurationScreeningRecord,
  getDurationBudgetPlan,
  getDurationScreeningContinuation,
  getDurationScreeningRequestInput,
  groqFinalDurationScreeningMaximumRequests,
  readGroqFinalDurationScreeningRecords,
  screeningDurations,
  writeGroqFinalDurationScreeningRecord,
  type ScreeningAttemptNumber,
} from "@/tests/helpers/groq-final-duration-screening"
import { expectedOneDayModel } from "@/tests/helpers/groq-final-one-day"

const runLiveDurationScreening =
  process.env.RUN_LIVE_GROQ_FINAL_DURATION_SCREENING === "1"
const REPORT_PATH = "/tmp/groq-final-duration-screening-step4a4a.jsonl"

describe.skipIf(!runLiveDurationScreening)(
  "live Groq final duration screening",
  () => {
    test("screens up to four durations sequentially with adaptive stops", async () => {
      expect(process.env.GROQ_API_KEY?.trim(), "GROQ_API_KEY must be configured")
        .toBeTruthy()
      expect(process.env.GROQ_MODEL?.trim()).toBe(expectedOneDayModel)
      expect(
        existsSync(REPORT_PATH),
        "The Step 4A.4A destination must not already contain evidence"
      ).toBe(false)

      let providerRequestCount = 0
      let stopReason = "ATTEMPT_LIMIT_REACHED"

      for (const [index, durationDays] of screeningDurations.entries()) {
        const attemptNumber = (index + 1) as ScreeningAttemptNumber
        let providerError: GroqFinalProviderErrorMetadata | undefined
        const startedAt = performance.now()

        providerRequestCount += 1
        const result = await runGroqFinalItinerary(
          getDurationScreeningRequestInput(durationDays),
          undefined,
          {
            observeProviderError: (metadata) => {
              providerError = metadata
            },
          }
        )
        const record = createGroqFinalDurationScreeningRecord({
          attemptNumber,
          requestedDurationDays: durationDays,
          result,
          providerError,
          latencyMs: performance.now() - startedAt,
          providerRequestCount: 1,
        })
        writeGroqFinalDurationScreeningRecord(
          REPORT_PATH,
          record,
          providerRequestCount - 1
        )
        process.stderr.write(
          `GROQ_FINAL_DURATION_SCREENING_SUMMARY ${JSON.stringify(record)}\n`
        )

        const nextDuration = screeningDurations[index + 1]
        const continuation = getDurationScreeningContinuation(
          record,
          nextDuration === undefined
            ? undefined
            : getDurationBudgetPlan(nextDuration)
        )
        if (!continuation.continue) {
          stopReason = continuation.reason
          break
        }

        await new Promise((resolve) =>
          setTimeout(resolve, continuation.waitMs)
        )
      }

      const records = readGroqFinalDurationScreeningRecords(REPORT_PATH)
      expect(records).toHaveLength(providerRequestCount)
      expect(
        records.reduce(
          (total, record) => total + record.providerRequestCount,
          0
        )
      ).toBe(providerRequestCount)
      expect(providerRequestCount).toBeLessThanOrEqual(
        groqFinalDurationScreeningMaximumRequests
      )
      process.stderr.write(
        `GROQ_FINAL_DURATION_SCREENING_ACCOUNTING ${JSON.stringify({
          providerRequestCount,
          recordCount: records.length,
          stopReason,
        })}\n`
      )
    }, 420_000)
  }
)
