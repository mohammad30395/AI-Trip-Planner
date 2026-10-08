import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqFinalItinerary,
  type GroqFinalProviderErrorMetadata,
} from "@/lib/ai/groq"
import {
  createGroqFinal400DiagnosticRecord,
  readGroqFinal400DiagnosticRecords,
  writeGroqFinal400DiagnosticRecord,
} from "@/tests/helpers/groq-final-400-diagnostic"
import {
  buildGroqFinalMessages,
  expectedOneDayModel,
  oneDayExperimentalCompletionBudget,
  oneDayRequirements,
} from "@/tests/helpers/groq-final-one-day"

const runLiveDiagnostic =
  process.env.RUN_LIVE_GROQ_FINAL_400_DIAGNOSTIC === "1"
const REPORT_PATH = "/tmp/groq-final-400-diagnostic.jsonl"

describe.skipIf(!runLiveDiagnostic)("live Groq final HTTP 400 diagnostic", () => {
  test("reproduces Step 4A.3 once and writes only safe metadata", async () => {
    expect(process.env.GROQ_API_KEY?.trim(), "GROQ_API_KEY must be configured")
      .toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe(expectedOneDayModel)
    expect(
      existsSync(REPORT_PATH),
      "Preserve or remove the prior Step 4A.3A report before another live run"
    ).toBe(false)

    let providerRequestCount = 0
    let providerError: GroqFinalProviderErrorMetadata | undefined
    const startedAt = performance.now()

    providerRequestCount += 1
    expect(providerRequestCount).toBe(1)
    const result = await runGroqFinalItinerary(
      {
        messages: buildGroqFinalMessages(oneDayRequirements),
        durationDays: 1,
        maxCompletionTokens: oneDayExperimentalCompletionBudget,
      },
      undefined,
      {
        observeProviderError: (metadata) => {
          providerError = metadata
        },
      }
    )

    const record = createGroqFinal400DiagnosticRecord({
      result,
      providerError,
      latencyMs: performance.now() - startedAt,
      providerRequestCount,
    })
    writeGroqFinal400DiagnosticRecord(REPORT_PATH, record)

    expect(readGroqFinal400DiagnosticRecords(REPORT_PATH)).toEqual([record])
    expect(providerRequestCount).toBe(1)
    process.stderr.write(
      `GROQ_FINAL_400_DIAGNOSTIC_SUMMARY ${JSON.stringify(record)}\n`
    )
  }, 120_000)
})
