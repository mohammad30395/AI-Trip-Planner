import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqStrictCapabilitySmoke,
  type GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import {
  appendStrictControlRecord,
  createStrictControlRecord,
  readStrictControlRecords,
  type StrictControlRecord,
  type StrictControlVariant,
} from "@/tests/helpers/groq-strict-control"

const runLiveStrictControl =
  process.env.RUN_LIVE_GROQ_STRICT_CONTROL === "1"
const STRICT_CONTROL_REPORT_PATH = "/tmp/groq-strict-control-report.jsonl"
const MAX_LIVE_REQUESTS = 2

describe.skipIf(!runLiveStrictControl)("live Groq strict control reproduction", () => {
  test("reproduces Step 2 then changes only the completion-token budget", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe("openai/gpt-oss-20b")
    expect(
      existsSync(STRICT_CONTROL_REPORT_PATH),
      "Delete the prior strict-control report before the live run"
    ).toBe(false)

    if (!apiKey) {
      return
    }

    let providerRequestsAttempted = 0

    const runAttempt = async ({
      attempt,
      variant,
      maxCompletionTokens,
      overrideHistoricalBudget,
    }: {
      attempt: number
      variant: StrictControlVariant
      maxCompletionTokens: number
      overrideHistoricalBudget: boolean
    }) => {
      providerRequestsAttempted += 1
      expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)

      let observation: GroqStrictCapabilityProviderObservation | undefined
      const result = await runGroqStrictCapabilitySmoke(undefined, {
        ...(overrideHistoricalBudget ? { maxCompletionTokens } : {}),
        observeProviderOutcome: (value) => {
          observation = value
        },
      })

      if (observation === undefined) {
        throw new Error("Provider request completed without an observation.")
      }

      const record = createStrictControlRecord({
        attempt,
        variant,
        maxCompletionTokens,
        accepted: result.ok,
        observation,
        configuredSecret: apiKey,
        ...(!result.ok ? { normalizedErrorCode: result.code } : {}),
      })
      appendStrictControlRecord(STRICT_CONTROL_REPORT_PATH, record)
      return record
    }

    const historical = await runAttempt({
      attempt: 1,
      variant: "historical-step2",
      maxCompletionTokens: 256,
      overrideHistoricalBudget: false,
    })
    let differential: StrictControlRecord | undefined

    if (historical.accepted) {
      process.stderr.write(
        "GROQ_STRICT_CONTROL_DIFFERENTIAL max_completion_tokens 256 -> 128\n"
      )
      differential = await runAttempt({
        attempt: 2,
        variant: "token-budget-128",
        maxCompletionTokens: 128,
        overrideHistoricalBudget: true,
      })
    }

    const durableRecords = readStrictControlRecords(
      STRICT_CONTROL_REPORT_PATH
    )
    expect(durableRecords).toHaveLength(providerRequestsAttempted)
    expect(durableRecords).toEqual(
      differential === undefined ? [historical] : [historical, differential]
    )
    process.stderr.write(
      `GROQ_STRICT_CONTROL_SUMMARY ${JSON.stringify({
        recordCount: durableRecords.length,
        providerRequestsAttempted,
        countsMatch: durableRecords.length === providerRequestsAttempted,
      })}\n`
    )
  }, 90_000)
})
