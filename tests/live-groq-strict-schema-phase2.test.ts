import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqStrictCapabilitySmoke,
  type GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import {
  appendPhase2DiagnosticRecord,
  createPhase2DiagnosticRecord,
  expectedPhase2Model,
  getNextPhase2Probe,
  phase2ProbeFixtures,
  readPhase2DiagnosticRecords,
  type Phase2DiagnosticRecord,
  type Phase2ProbeId,
} from "@/tests/helpers/groq-strict-schema-phase2"

const runLivePhase2 =
  process.env.RUN_LIVE_GROQ_STRICT_SCHEMA_PHASE2 === "1"
const PHASE1_REPORT_PATH = "/tmp/groq-strict-schema-phase1.jsonl"
const PHASE2_REPORT_PATH = "/tmp/groq-strict-schema-phase2.jsonl"
const MAX_LIVE_REQUESTS = 2

describe.skipIf(!runLivePhase2)("live Groq strict-schema Phase 2", () => {
  test("runs nullable-string control then nullable enum until failure", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe(expectedPhase2Model)
    expect(
      existsSync(PHASE1_REPORT_PATH),
      "The preserved Phase-1 evidence file must remain available"
    ).toBe(true)
    expect(
      existsSync(PHASE2_REPORT_PATH),
      "Preserve or remove the prior Phase-2 report before another live run"
    ).toBe(false)

    if (!apiKey) {
      return
    }

    let providerRequestsAttempted = 0
    let currentProbe: Phase2ProbeId | null = "A"
    const records: Phase2DiagnosticRecord[] = []

    while (currentProbe !== null) {
      const fixture = phase2ProbeFixtures[currentProbe]
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

      const record = createPhase2DiagnosticRecord({
        fixture,
        observation,
        normalizedFailureCode: result.ok ? null : result.code,
        resultOk: result.ok,
        configuredSecret: apiKey,
      })
      appendPhase2DiagnosticRecord(PHASE2_REPORT_PATH, record)
      records.push(record)
      currentProbe = getNextPhase2Probe(currentProbe, result.ok)
    }

    const durableRecords = readPhase2DiagnosticRecords(PHASE2_REPORT_PATH)
    expect(durableRecords).toEqual(records)
    expect(durableRecords).toHaveLength(providerRequestsAttempted)
    expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)
    process.stderr.write(
      `GROQ_STRICT_SCHEMA_PHASE2_SUMMARY ${JSON.stringify({
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
