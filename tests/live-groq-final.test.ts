import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import { runGroqFinalItinerary } from "@/lib/ai/groq"
import {
  buildGroqFinalMessages,
  createOneDayDiagnosticRecord,
  expectedOneDayModel,
  oneDayExperimentalCompletionBudget,
  oneDayRequirements,
  readOneDayDiagnosticRecords,
  writeOneDayDiagnosticRecord,
} from "@/tests/helpers/groq-final-one-day"

const runLiveFinal = process.env.RUN_LIVE_GROQ_FINAL_ONE_DAY === "1"
const REPORT_PATH = "/tmp/groq-final-one-day-validation.jsonl"

describe.skipIf(!runLiveFinal)("live isolated Groq one-day final itinerary", () => {
  test("makes exactly one full-schema request and writes one sanitized record", async () => {
    expect(process.env.GROQ_API_KEY?.trim(), "GROQ_API_KEY must be configured")
      .toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe(expectedOneDayModel)
    expect(
      existsSync(REPORT_PATH),
      "Preserve or remove the prior one-day report before another live run"
    ).toBe(false)

    const startedAt = performance.now()
    const result = await runGroqFinalItinerary({
      messages: buildGroqFinalMessages(oneDayRequirements),
      durationDays: 1,
      maxCompletionTokens: oneDayExperimentalCompletionBudget,
    })
    const record = createOneDayDiagnosticRecord({
      result,
      latencyMs: performance.now() - startedAt,
    })

    writeOneDayDiagnosticRecord(REPORT_PATH, record)
    const durableRecords = readOneDayDiagnosticRecords(REPORT_PATH)

    expect(durableRecords).toEqual([record])
    process.stderr.write(
      `GROQ_FINAL_ONE_DAY_SUMMARY ${JSON.stringify(record)}\n`
    )
  }, 120_000)
})
