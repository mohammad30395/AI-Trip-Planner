import { existsSync } from "node:fs"

import { describe, expect, test } from "vitest"

import {
  runGroqStrictCapabilitySmoke,
  type GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import {
  appendPhase4DiagnosticRecord,
  createPhase4DiagnosticRecord,
  expectedPhase4Model,
  getNextPhase4Probe,
  phase4ProbeFixtures,
  readPhase4DiagnosticRecords,
  type Phase4DiagnosticRecord,
  type Phase4ProbeId,
} from "@/tests/helpers/groq-strict-schema-phase4"

const runLivePhase4 =
  process.env.RUN_LIVE_GROQ_STRICT_SCHEMA_PHASE4 === "1"
const PHASE3_REPORT_PATH = "/tmp/groq-strict-schema-phase3.jsonl"
const PHASE4_REPORT_PATH = "/tmp/groq-strict-schema-phase4.jsonl"
const MAX_LIVE_REQUESTS = 3

describe.skipIf(!runLivePhase4)("live Groq strict-schema Phase 4", () => {
  test("compares historical and aligned prompts for the same place schema", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(process.env.GROQ_MODEL?.trim()).toBe(expectedPhase4Model)
    expect(
      existsSync(PHASE3_REPORT_PATH),
      "The preserved Phase-3 evidence file must remain available"
    ).toBe(true)
    expect(
      existsSync(PHASE4_REPORT_PATH),
      "Preserve or remove the prior Phase-4 report before another live run"
    ).toBe(false)

    if (!apiKey) {
      return
    }

    let providerRequestsAttempted = 0
    let currentProbe: Phase4ProbeId | null = "A"
    const records: Phase4DiagnosticRecord[] = []

    while (currentProbe !== null) {
      const fixture = phase4ProbeFixtures[currentProbe]
      providerRequestsAttempted += 1
      expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)

      let observation: GroqStrictCapabilityProviderObservation | undefined
      const result = await runGroqStrictCapabilitySmoke(undefined, {
        schema: fixture.schema,
        validateResponse: fixture.validateResponse,
        ...(fixture.userMessage === undefined
          ? {}
          : { userMessage: fixture.userMessage }),
        observeProviderOutcome: (value) => {
          observation = value
        },
      })

      if (observation === undefined) {
        throw new Error("Provider request completed without an observation.")
      }

      const record = createPhase4DiagnosticRecord({
        fixture,
        observation,
        normalizedFailureCode: result.ok ? null : result.code,
        resultOk: result.ok,
        configuredSecret: apiKey,
      })
      appendPhase4DiagnosticRecord(PHASE4_REPORT_PATH, record)
      records.push(record)
      currentProbe = getNextPhase4Probe(
        currentProbe,
        result.ok,
        record.providerErrorClassification
      )
    }

    const durableRecords = readPhase4DiagnosticRecords(PHASE4_REPORT_PATH)
    expect(durableRecords).toEqual(records)
    expect(durableRecords).toHaveLength(providerRequestsAttempted)
    expect(providerRequestsAttempted).toBeLessThanOrEqual(MAX_LIVE_REQUESTS)
    process.stderr.write(
      `GROQ_STRICT_SCHEMA_PHASE4_SUMMARY ${JSON.stringify({
        providerRequestsAttempted,
        records: durableRecords.map((record) => ({
          runIdentifier: record.runIdentifier,
          probe: record.probe,
          promptVariant: record.promptVariant,
          schemaFingerprint: record.schemaFingerprint,
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
  }, 120_000)
})
