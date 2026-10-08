import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqStrictCapabilitySmoke,
  type GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import {
  appendPhase1DiagnosticRecord,
  createPhase1DiagnosticRecord,
  expectedPhase1Model,
  getNextPhase1Probe,
  phase1ProbeFixtures,
  readPhase1DiagnosticRecords,
  validatePhase1ProbeResponse,
  type Phase1DiagnosticRecord,
  type Phase1ProbeId,
} from "@/tests/helpers/groq-strict-schema-phase1"

const runLivePhase1 =
  process.env.RUN_LIVE_GROQ_STRICT_SCHEMA_PHASE1 === "1"
const PHASE1_REPORT_PATH = "/tmp/groq-strict-schema-phase1.jsonl"
const MAX_LIVE_REQUESTS = 3

describe.skipIf(!runLivePhase1)("live Groq strict-schema Phase 1", () => {
  test("runs baseline-locked probes A, B, and C until the first failure", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe(expectedPhase1Model)
    expect(
      existsSync(PHASE1_REPORT_PATH),
      "Preserve or remove the prior Phase-1 report before another live run"
    ).toBe(false)

    if (!apiKey) {
      return
    }

    let providerRequestsAttempted = 0
    let currentProbe: Phase1ProbeId | null = "A"
    const records: Phase1DiagnosticRecord[] = []

    while (currentProbe !== null) {
      const fixture = phase1ProbeFixtures[currentProbe]
      providerRequestsAttempted += 1
      expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)

      let observation: GroqStrictCapabilityProviderObservation | undefined
      const result = await runGroqStrictCapabilitySmoke(undefined, {
        ...(currentProbe === "A"
          ? {}
          : {
              schema: fixture.schema,
              validateResponse: validatePhase1ProbeResponse,
            }),
        observeProviderOutcome: (value) => {
          observation = value
        },
      })

      if (observation === undefined) {
        throw new Error("Provider request completed without an observation.")
      }

      const record = createPhase1DiagnosticRecord({
        fixture,
        observation,
        normalizedFailureCode: result.ok ? null : result.code,
        resultOk: result.ok,
        configuredSecret: apiKey,
      })
      appendPhase1DiagnosticRecord(PHASE1_REPORT_PATH, record)
      records.push(record)
      currentProbe = getNextPhase1Probe(currentProbe, result.ok)
    }

    const durableRecords = readPhase1DiagnosticRecords(PHASE1_REPORT_PATH)
    expect(durableRecords).toEqual(records)
    expect(durableRecords).toHaveLength(providerRequestsAttempted)
    expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)
    process.stderr.write(
      `GROQ_STRICT_SCHEMA_PHASE1_SUMMARY ${JSON.stringify({
        providerRequestsAttempted,
        records: durableRecords.map((record) => ({
          probe: record.probe,
          accepted: record.accepted,
          httpStatus: record.httpStatus,
          outcomeClassification: record.outcomeClassification,
          providerErrorClassification: record.providerErrorClassification,
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
          retryPerformed: record.retryPerformed,
        })),
      })}\n`
    )
  }, 120_000)
})
