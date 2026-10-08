import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqFinalItinerary,
  type GroqFinalProviderErrorMetadata,
} from "@/lib/ai/groq"
import { expectedOneDayModel } from "@/tests/helpers/groq-final-one-day"
import {
  createGroqFinalTargetedRepeatabilityRecord,
  getTargetedRepeatabilityContinuation,
  getTargetedRepeatabilityRequestInput,
  groqFinalTargetedRepeatabilityMaximumRequests,
  readGroqFinalTargetedRepeatabilityRecords,
  targetedRepeatabilityDurations,
  writeGroqFinalTargetedRepeatabilityRecord,
  type TargetedAttemptNumber,
} from "@/tests/helpers/groq-final-targeted-repeatability"

const runLiveTargetedRepeatability =
  process.env.RUN_LIVE_GROQ_FINAL_TARGETED_REPEATABILITY === "1"
const REPORT_PATH = "/tmp/groq-final-targeted-repeatability-step4a4b.jsonl"

describe.skipIf(!runLiveTargetedRepeatability)(
  "live Groq targeted duration repeatability",
  () => {
    test("runs the five planned observations sequentially", async () => {
      expect(process.env.GROQ_API_KEY?.trim(), "GROQ_API_KEY must be configured")
        .toBeTruthy()
      expect(process.env.GROQ_MODEL?.trim()).toBe(expectedOneDayModel)
      expect(
        existsSync(REPORT_PATH),
        "The Step 4A.4B destination must not already contain evidence"
      ).toBe(false)

      let providerRequestCount = 0
      let stopReason = "ATTEMPT_LIMIT_REACHED"

      for (const [index] of targetedRepeatabilityDurations.entries()) {
        const attemptNumber = (index + 1) as TargetedAttemptNumber
        let providerError: GroqFinalProviderErrorMetadata | undefined
        const startedAt = performance.now()

        providerRequestCount += 1
        const result = await runGroqFinalItinerary(
          getTargetedRepeatabilityRequestInput(attemptNumber),
          undefined,
          {
            observeProviderError: (metadata) => {
              providerError = metadata
            },
          }
        )
        const record = createGroqFinalTargetedRepeatabilityRecord({
          attemptNumber,
          result,
          providerError,
          latencyMs: performance.now() - startedAt,
          providerRequestCount: 1,
        })
        writeGroqFinalTargetedRepeatabilityRecord(
          REPORT_PATH,
          record,
          providerRequestCount - 1
        )
        process.stderr.write(
          `GROQ_FINAL_TARGETED_REPEATABILITY_SUMMARY ${JSON.stringify(record)}\n`
        )

        const continuation = getTargetedRepeatabilityContinuation(record)
        if (!continuation.continue) {
          stopReason = continuation.reason
          break
        }

        await new Promise((resolve) =>
          setTimeout(resolve, continuation.waitMs)
        )
      }

      const records = readGroqFinalTargetedRepeatabilityRecords(REPORT_PATH)
      expect(records).toHaveLength(providerRequestCount)
      expect(
        records.reduce(
          (total, record) => total + record.providerRequestCount,
          0
        )
      ).toBe(providerRequestCount)
      expect(providerRequestCount).toBeLessThanOrEqual(
        groqFinalTargetedRepeatabilityMaximumRequests
      )
      process.stderr.write(
        `GROQ_FINAL_TARGETED_REPEATABILITY_ACCOUNTING ${JSON.stringify({
          providerRequestCount,
          recordCount: records.length,
          stopReason,
        })}\n`
      )
    }, 500_000)
  }
)
