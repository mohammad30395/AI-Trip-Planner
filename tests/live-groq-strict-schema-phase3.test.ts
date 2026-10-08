import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqStrictCapabilitySmoke,
  type GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import {
  appendPhase3DiagnosticRecord,
  createPhase3DiagnosticRecord,
  expectedPhase3Model,
  getNextPhase3Probe,
  phase3ProbeFixtures,
  readPhase3DiagnosticRecords,
  type Phase3DiagnosticRecord,
  type Phase3ProbeId,
} from "@/tests/helpers/groq-strict-schema-phase3"

const runLivePhase3 =
  process.env.RUN_LIVE_GROQ_STRICT_SCHEMA_PHASE3 === "1"
const PHASE2_REPORT_PATH = "/tmp/groq-strict-schema-phase2.jsonl"
const PHASE3_REPORT_PATH = "/tmp/groq-strict-schema-phase3.jsonl"
const MAX_LIVE_REQUESTS = 2

describe.skipIf(!runLivePhase3)("live Groq strict-schema Phase 3", () => {
  test("runs nullable-enum control then minimal place object until failure", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe(expectedPhase3Model)
    expect(
      existsSync(PHASE2_REPORT_PATH),
      "The preserved Phase-2 evidence file must remain available"
    ).toBe(true)
    expect(
      existsSync(PHASE3_REPORT_PATH),
      "Preserve or remove the prior Phase-3 report before another live run"
    ).toBe(false)

    if (!apiKey) {
      return
    }

    let providerRequestsAttempted = 0
    let currentProbe: Phase3ProbeId | null = "A"
    const records: Phase3DiagnosticRecord[] = []

    while (currentProbe !== null) {
      const fixture = phase3ProbeFixtures[currentProbe]
      providerRequestsAttempted += 1
      expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)

      let observation: GroqStrictCapabilityProviderObservation | undefined
      const result = await runGroqStrictCapabilitySmoke(undefined, {
        schema: fixture.schema,
        validateResponse: fixture.validateResponse,
        observeProviderOutcome: (value) => {
          observation = value
        },
      })

      if (observation === undefined) {
        throw new Error("Provider request completed without an observation.")
      }

      const record = createPhase3DiagnosticRecord({
        fixture,
        observation,
        normalizedFailureCode: result.ok ? null : result.code,
        resultOk: result.ok,
        configuredSecret: apiKey,
      })
      appendPhase3DiagnosticRecord(PHASE3_REPORT_PATH, record)
      records.push(record)
      currentProbe = getNextPhase3Probe(currentProbe, result.ok)
    }

    const durableRecords = readPhase3DiagnosticRecords(PHASE3_REPORT_PATH)
    expect(durableRecords).toEqual(records)
    expect(durableRecords).toHaveLength(providerRequestsAttempted)
    expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)
    process.stderr.write(
      `GROQ_STRICT_SCHEMA_PHASE3_SUMMARY ${JSON.stringify({
        providerRequestsAttempted,
        records: durableRecords.map((record) => ({
          probe: record.probe,
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
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.totalTokens,
          tokenLimit: record.tokenLimit,
          remainingTokens: record.remainingTokens,
          resetSeconds: record.resetSeconds,
          retryCount: record.retryCount,
        })),
      })}\n`
    )
  }, 90_000)
})
