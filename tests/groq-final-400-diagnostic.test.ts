import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import { groqFinalItineraryWireSchema } from "@/lib/ai/groq-final-schema"
import type { GroqFinalProviderErrorMetadata } from "@/lib/ai/groq"
import {
  createGroqFinal400DiagnosticRecord,
  getStep4A3ClientSnapshot,
  getStep4A3OutgoingRequestSnapshot,
  readGroqFinal400DiagnosticRecords,
  writeGroqFinal400DiagnosticRecord,
} from "@/tests/helpers/groq-final-400-diagnostic"
import {
  buildGroqFinalMessages,
  oneDayRequirements,
} from "@/tests/helpers/groq-final-one-day"

describe("Step 4A.3A exact request reconstruction", () => {
  test("locks every outgoing Step 4A.3 request field", () => {
    const request = getStep4A3OutgoingRequestSnapshot()

    expect(request).toEqual({
      model: "openai/gpt-oss-20b",
      messages: buildGroqFinalMessages(oneDayRequirements),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "groq_final_itinerary_wire_response",
          strict: true,
          schema: groqFinalItineraryWireSchema,
        },
      },
      temperature: 0.4,
      max_completion_tokens: 3_500,
    })
    expect(request).not.toHaveProperty("reasoning")
    expect(request).not.toHaveProperty("reasoning_effort")
    expect(request).not.toHaveProperty("include_reasoning")
    expect(request).not.toHaveProperty("stream")
    expect(request).not.toHaveProperty("tools")
    expect(getStep4A3ClientSnapshot()).toEqual({
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 90_000,
      maxRetries: 0,
    })
  })
})

describe("Step 4A.3A durable diagnostic reporting", () => {
  test("records only bounded metadata and refuses a second record", () => {
    const reportPath = join(
      mkdtempSync(join(tmpdir(), "groq-final-400-")),
      "report.jsonl"
    )
    const record = createGroqFinal400DiagnosticRecord({
      result: failedResult(),
      providerError: exhaustionMetadata(),
      latencyMs: 4_250.4,
      providerRequestCount: 1,
    })

    expect(record).toMatchObject({
      httpStatus: 400,
      providerErrorType: "invalid_request_error",
      providerErrorCode: "json_validate_failed",
      providerErrorParameter: "response_format",
      schemaPath: null,
      errorCategory: "COMPLETION_EXHAUSTION_INDICATED",
      failedGenerationPresent: true,
      generationExhaustionIndicated: true,
      unsupportedSchemaStructureIndicated: false,
      latencyMs: 4_250,
      providerRequestCount: 1,
      retryCount: 0,
    })

    writeGroqFinal400DiagnosticRecord(reportPath, record)
    expect(readGroqFinal400DiagnosticRecords(reportPath)).toEqual([record])
    expect(() => writeGroqFinal400DiagnosticRecord(reportPath, record)).toThrow()

    const serialized = JSON.stringify(record)
    expect(serialized).not.toContain("message")
    expect(serialized).not.toContain("failed_generation")
    expect(serialized).not.toContain("reasoning")
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("apiKey")
    expect(serialized).not.toContain("itinerary\":")
  })

  test("uses UNKNOWN when no additional safe provider metadata was observed", () => {
    expect(
      createGroqFinal400DiagnosticRecord({
        result: failedResult(),
        latencyMs: 10,
        providerRequestCount: 1,
      })
    ).toMatchObject({
      errorCategory: "UNKNOWN",
      providerErrorType: null,
      providerErrorCode: null,
      providerErrorParameter: null,
      schemaPath: null,
      failedGenerationPresent: false,
      generationExhaustionIndicated: false,
    })
  })
})

function failedResult() {
  return {
    ok: false as const,
    code: "provider_error" as const,
    error: "Groq provider request failed.",
    diagnostic: {
      normalizedFailureCode: "request_rejected" as const,
      stage: "PROVIDER_REQUEST" as const,
      strictSchemaReachedProvider: true,
      responseFormatAccepted: false,
      providerContentReturned: false,
      httpStatus: 400,
      providerErrorCategory: "request_rejected" as const,
      providerErrorType: "invalid_request_error",
      rateLimit: {
        limitTokensPerMinute: 8_000,
        remainingTokens: 6_500,
        resetTokensSeconds: 10,
      },
      jsonParsed: false,
      wireNormalized: false,
      runtimeValidated: false,
      durationValidated: false,
    },
  }
}

function exhaustionMetadata(): GroqFinalProviderErrorMetadata {
  return {
    httpStatus: 400,
    providerErrorType: "invalid_request_error",
    providerErrorCode: "json_validate_failed",
    providerErrorParameter: "response_format",
    schemaPath: null,
    category: "COMPLETION_EXHAUSTION_INDICATED",
    failedGenerationPresent: true,
    generationExhaustionIndicated: true,
    unsupportedSchemaStructureIndicated: false,
  }
}
