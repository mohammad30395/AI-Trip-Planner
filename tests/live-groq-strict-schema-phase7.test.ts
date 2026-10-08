import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqStrictCapabilitySmoke,
  type GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import {
  getGeneratedPlaceVariant,
  readPhase6DiagnosticRecords,
  type Phase6PlaceVariant,
} from "@/tests/helpers/groq-strict-schema-phase6"
import {
  appendPhase7DiagnosticRecord,
  createPhase7DiagnosticRecord,
  expectedPhase7Model,
  getNextPhase7Probe,
  phase7ProbeFixtures,
  readPhase7DiagnosticRecords,
  type Phase7DiagnosticRecord,
  type Phase7ProbeId,
} from "@/tests/helpers/groq-strict-schema-phase7"

const runLivePhase7 =
  process.env.RUN_LIVE_GROQ_STRICT_SCHEMA_PHASE7 === "1"
const PHASE6_REPORT_PATH = "/tmp/groq-strict-schema-phase6.jsonl"
const PHASE7_REPORT_PATH = "/tmp/groq-strict-schema-phase7.jsonl"
const MAX_LIVE_REQUESTS = 2

describe.skipIf(!runLivePhase7)("live Groq strict-schema Phase 7", () => {
  test("validates generic_activity and transport through the exact place union", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe(expectedPhase7Model)
    expect(
      existsSync(PHASE6_REPORT_PATH),
      "The preserved Phase-6 evidence file must remain available"
    ).toBe(true)
    expect(
      existsSync(PHASE7_REPORT_PATH),
      "Preserve or remove the prior Phase-7 report before another live run"
    ).toBe(false)

    const priorRecords = readPhase6DiagnosticRecords(PHASE6_REPORT_PATH)
    expect(priorRecords).toHaveLength(2)
    expect(priorRecords[1]).toMatchObject({
      probe: "B",
      schemaFingerprint: "da1a8dda005763d4",
      accepted: true,
      schemaValidationPassed: true,
      outcomeClassification: "FULL_PLACE_ANYOF_ACCEPTED",
    })
    expect(
      priorRecords.some(
        (record) =>
          record.providerErrorClassification === "PROVIDER_RATE_LIMITED"
      ),
      "The previous evidence must not contain a known rate-limit blocker"
    ).toBe(false)

    if (!apiKey) {
      return
    }

    let providerRequestsAttempted = 0
    let currentProbe: Phase7ProbeId | null = "A"
    const records: Phase7DiagnosticRecord[] = []

    while (currentProbe !== null) {
      const fixture = phase7ProbeFixtures[currentProbe]
      providerRequestsAttempted += 1
      expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)

      let observation: GroqStrictCapabilityProviderObservation | undefined
      let generatedPlaceVariant: Phase6PlaceVariant | null = null
      const result = await runGroqStrictCapabilitySmoke(undefined, {
        schema: fixture.schema,
        userMessage: fixture.userMessage,
        maxCompletionTokens: fixture.completionTokenBudget,
        validateResponse: (value) => {
          generatedPlaceVariant = getGeneratedPlaceVariant(value)
          return fixture.validateResponse(value)
        },
        observeProviderOutcome: (value) => {
          observation = value
        },
      })

      if (observation === undefined) {
        throw new Error("Provider request completed without an observation.")
      }

      const record = createPhase7DiagnosticRecord({
        fixture,
        observation,
        normalizedFailureCode: result.ok ? null : result.code,
        resultOk: result.ok,
        generatedPlaceVariant,
        configuredSecret: apiKey,
      })
      appendPhase7DiagnosticRecord(PHASE7_REPORT_PATH, record)
      records.push(record)
      currentProbe = getNextPhase7Probe(
        currentProbe,
        result.ok,
        record.providerErrorClassification
      )
    }

    const durableRecords = readPhase7DiagnosticRecords(PHASE7_REPORT_PATH)
    expect(durableRecords).toEqual(records)
    expect(durableRecords).toHaveLength(providerRequestsAttempted)
    expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)
    process.stderr.write(
      `GROQ_STRICT_SCHEMA_PHASE7_SUMMARY ${JSON.stringify({
        providerRequestsAttempted,
        records: durableRecords.map((record) => ({
          runIdentifier: record.runIdentifier,
          probe: record.probe,
          schemaFingerprint: record.schemaFingerprint,
          requestedPlaceVariant: record.requestedPlaceVariant,
          generatedPlaceVariant: record.generatedPlaceVariant,
          completionTokenBudget: record.completionTokenBudget,
          accepted: record.accepted,
          httpStatus: record.httpStatus,
          outcomeClassification: record.outcomeClassification,
          providerErrorClassification: record.providerErrorClassification,
          providerErrorType: record.providerErrorType,
          errorCode: record.errorCode,
          finishReason: record.finishReason,
          parsedOutputValid: record.parsedOutputValid,
          schemaValidationPassed: record.schemaValidationPassed,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.totalTokens,
          tokenLimit: record.tokenLimit,
          remainingTokens: record.remainingTokens,
          resetSeconds: record.resetSeconds,
          failedGenerationSummary: record.failedGenerationSummary,
          retryCount: record.retryCount,
        })),
      })}\n`
    )
  }, 120_000)
})
