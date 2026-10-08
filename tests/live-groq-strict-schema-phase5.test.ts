import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqStrictCapabilitySmoke,
  type GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import { readPhase4DiagnosticRecords } from "@/tests/helpers/groq-strict-schema-phase4"
import {
  appendPhase5DiagnosticRecord,
  createPhase5DiagnosticRecord,
  expectedPhase5Model,
  getNextPhase5Probe,
  phase5ProbeFixtures,
  readPhase5DiagnosticRecords,
  type Phase5DiagnosticRecord,
  type Phase5ProbeId,
} from "@/tests/helpers/groq-strict-schema-phase5"

const runLivePhase5 =
  process.env.RUN_LIVE_GROQ_STRICT_SCHEMA_PHASE5 === "1"
const PHASE4_REPORT_PATH = "/tmp/groq-strict-schema-phase4.jsonl"
const PHASE5_REPORT_PATH = "/tmp/groq-strict-schema-phase5.jsonl"
const MAX_LIVE_REQUESTS = 3

describe.skipIf(!runLivePhase5)("live Groq strict-schema Phase 5", () => {
  test("compares 256 and 512 tokens for the identical aligned place request", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe(expectedPhase5Model)
    expect(
      existsSync(PHASE4_REPORT_PATH),
      "The preserved Phase-4 evidence file must remain available"
    ).toBe(true)
    expect(
      existsSync(PHASE5_REPORT_PATH),
      "Preserve or remove the prior Phase-5 report before another live run"
    ).toBe(false)

    const priorRecords = readPhase4DiagnosticRecords(PHASE4_REPORT_PATH)
    expect(priorRecords).toHaveLength(3)
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
    let currentProbe: Phase5ProbeId | null = "A"
    const records: Phase5DiagnosticRecord[] = []

    while (currentProbe !== null) {
      const fixture = phase5ProbeFixtures[currentProbe]
      providerRequestsAttempted += 1
      expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)

      let observation: GroqStrictCapabilityProviderObservation | undefined
      const result = await runGroqStrictCapabilitySmoke(undefined, {
        schema: fixture.schema,
        validateResponse: fixture.validateResponse,
        ...(fixture.userMessage === undefined
          ? {}
          : { userMessage: fixture.userMessage }),
        ...(fixture.completionTokenBudget === 256
          ? {}
          : { maxCompletionTokens: fixture.completionTokenBudget }),
        observeProviderOutcome: (value) => {
          observation = value
        },
      })

      if (observation === undefined) {
        throw new Error("Provider request completed without an observation.")
      }

      const record = createPhase5DiagnosticRecord({
        fixture,
        observation,
        normalizedFailureCode: result.ok ? null : result.code,
        resultOk: result.ok,
        configuredSecret: apiKey,
      })
      appendPhase5DiagnosticRecord(PHASE5_REPORT_PATH, record)
      records.push(record)
      currentProbe = getNextPhase5Probe(
        currentProbe,
        result.ok,
        record.providerErrorClassification
      )
    }

    const durableRecords = readPhase5DiagnosticRecords(PHASE5_REPORT_PATH)
    expect(durableRecords).toEqual(records)
    expect(durableRecords).toHaveLength(providerRequestsAttempted)
    expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)
    process.stderr.write(
      `GROQ_STRICT_SCHEMA_PHASE5_SUMMARY ${JSON.stringify({
        providerRequestsAttempted,
        records: durableRecords.map((record) => ({
          runIdentifier: record.runIdentifier,
          probe: record.probe,
          promptVariant: record.promptVariant,
          schemaFingerprint: record.schemaFingerprint,
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
          discriminatorValidationPassed:
            record.discriminatorValidationPassed,
          requiredFieldsComplete: record.requiredFieldsComplete,
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
