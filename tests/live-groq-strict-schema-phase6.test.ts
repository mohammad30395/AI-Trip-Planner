import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqStrictCapabilitySmoke,
  type GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import { readPhase5DiagnosticRecords } from "@/tests/helpers/groq-strict-schema-phase5"
import {
  appendPhase6DiagnosticRecord,
  createPhase6DiagnosticRecord,
  expectedPhase6Model,
  getGeneratedPlaceVariant,
  getNextPhase6Probe,
  phase6ProbeFixtures,
  readPhase6DiagnosticRecords,
  type Phase6DiagnosticRecord,
  type Phase6PlaceVariant,
  type Phase6ProbeId,
} from "@/tests/helpers/groq-strict-schema-phase6"

const runLivePhase6 =
  process.env.RUN_LIVE_GROQ_STRICT_SCHEMA_PHASE6 === "1"
const PHASE5_REPORT_PATH = "/tmp/groq-strict-schema-phase5.jsonl"
const PHASE6_REPORT_PATH = "/tmp/groq-strict-schema-phase6.jsonl"
const MAX_LIVE_REQUESTS = 2

describe.skipIf(!runLivePhase6)("live Groq strict-schema Phase 6", () => {
  test("compares the accepted place branch with the exact complete anyOf", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe(expectedPhase6Model)
    expect(
      existsSync(PHASE5_REPORT_PATH),
      "The preserved Phase-5 evidence file must remain available"
    ).toBe(true)
    expect(
      existsSync(PHASE6_REPORT_PATH),
      "Preserve or remove the prior Phase-6 report before another live run"
    ).toBe(false)

    const priorRecords = readPhase5DiagnosticRecords(PHASE5_REPORT_PATH)
    expect(priorRecords).toHaveLength(3)
    expect(priorRecords[2]).toMatchObject({
      probe: "C",
      accepted: true,
      schemaValidationPassed: true,
      completionTokenBudget: 512,
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
    let currentProbe: Phase6ProbeId | null = "A"
    const records: Phase6DiagnosticRecord[] = []

    while (currentProbe !== null) {
      const fixture = phase6ProbeFixtures[currentProbe]
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

      const record = createPhase6DiagnosticRecord({
        fixture,
        observation,
        normalizedFailureCode: result.ok ? null : result.code,
        resultOk: result.ok,
        generatedPlaceVariant,
        configuredSecret: apiKey,
      })
      appendPhase6DiagnosticRecord(PHASE6_REPORT_PATH, record)
      records.push(record)
      currentProbe = getNextPhase6Probe(currentProbe, result.ok)
    }

    const durableRecords = readPhase6DiagnosticRecords(PHASE6_REPORT_PATH)
    expect(durableRecords).toEqual(records)
    expect(durableRecords).toHaveLength(providerRequestsAttempted)
    expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)
    process.stderr.write(
      `GROQ_STRICT_SCHEMA_PHASE6_SUMMARY ${JSON.stringify({
        providerRequestsAttempted,
        records: durableRecords.map((record) => ({
          runIdentifier: record.runIdentifier,
          probe: record.probe,
          schemaFingerprint: record.schemaFingerprint,
          schemaDiffClassification: record.schemaDiffClassification,
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
