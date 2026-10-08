import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqFinalItinerary,
  type GroqFinalProviderErrorMetadata,
} from "@/lib/ai/groq"
import {
  createGroqFinalRepeatabilityRecord,
  getRepeatabilityContinuation,
  getRepeatabilityRequestInput,
  groqFinalRepeatabilityMaximumAttempts,
  readGroqFinalRepeatabilityRecords,
  writeGroqFinalRepeatabilityRecord,
  type RepeatabilityAttemptNumber,
} from "@/tests/helpers/groq-final-repeatability"
import { expectedOneDayModel } from "@/tests/helpers/groq-final-one-day"

const runLiveRepeatability =
  process.env.RUN_LIVE_GROQ_FINAL_REPEATABILITY === "1"
const REPORT_PATH = "/tmp/groq-final-one-day-repeatability.jsonl"

describe.skipIf(!runLiveRepeatability)(
  "live Groq one-day final repeatability",
  () => {
    test("makes up to three spaced requests and records one safe result per call", async () => {
      expect(process.env.GROQ_API_KEY?.trim(), "GROQ_API_KEY must be configured")
        .toBeTruthy()
      expect(process.env.GROQ_MODEL?.trim()).toBe(expectedOneDayModel)
      expect(
        existsSync(REPORT_PATH),
        "The Step 4A.3B destination must not already contain evidence"
      ).toBe(false)

      let providerRequestCount = 0
      let stopReason = "ATTEMPT_LIMIT_REACHED"

      for (
        let attempt = 1;
        attempt <= groqFinalRepeatabilityMaximumAttempts;
        attempt += 1
      ) {
        const attemptNumber = attempt as RepeatabilityAttemptNumber
        let providerError: GroqFinalProviderErrorMetadata | undefined
        const startedAt = performance.now()

        providerRequestCount += 1
        const result = await runGroqFinalItinerary(
          getRepeatabilityRequestInput(),
          undefined,
          {
            observeProviderError: (metadata) => {
              providerError = metadata
            },
          }
        )

        const record = createGroqFinalRepeatabilityRecord({
          attemptNumber,
          result,
          providerError,
          latencyMs: performance.now() - startedAt,
          providerRequestCount: 1,
        })
        writeGroqFinalRepeatabilityRecord(
          REPORT_PATH,
          record,
          providerRequestCount - 1
        )
        process.stderr.write(
          `GROQ_FINAL_REPEATABILITY_SUMMARY ${JSON.stringify(record)}\n`
        )

        const continuation = getRepeatabilityContinuation(record)
        if (!continuation.continue) {
          stopReason = continuation.reason
          break
        }

        await new Promise((resolve) =>
          setTimeout(resolve, continuation.waitMs)
        )
      }

      const records = readGroqFinalRepeatabilityRecords(REPORT_PATH)
      expect(records).toHaveLength(providerRequestCount)
      expect(
        records.reduce(
          (total, record) => total + record.providerRequestCount,
          0
        )
      ).toBe(providerRequestCount)
      expect(providerRequestCount).toBeLessThanOrEqual(
        groqFinalRepeatabilityMaximumAttempts
      )
      process.stderr.write(
        `GROQ_FINAL_REPEATABILITY_ACCOUNTING ${JSON.stringify({
          providerRequestCount,
          recordCount: records.length,
          stopReason,
        })}\n`
      )
    }, 300_000)
  }
)
