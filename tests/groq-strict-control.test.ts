import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import {
  appendStrictControlRecord,
  createStrictControlRecord,
  diffStrictControlRequests,
  historicalStep2ControlRequest,
  readStrictControlRecords,
  step4A2RControlRequest,
  summarizeFailedGeneration,
} from "@/tests/helpers/groq-strict-control"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("Groq strict control reconstruction", () => {
  test("reconstructs the historical Step-2 known-good request", () => {
    expect(historicalStep2ControlRequest).toMatchObject({
      api: "chat.completions.create",
      modelSource: "GROQ_MODEL",
      schemaName: "groq_strict_capability_smoke",
      strict: true,
      temperature: null,
      maxCompletionTokens: 256,
      reasoningEffort: null,
      includeReasoning: null,
      stream: null,
      tools: null,
      timeoutMs: 30_000,
      retries: 0,
    })
    expect(historicalStep2ControlRequest.messages).toHaveLength(2)
    expect(historicalStep2ControlRequest.schema).toEqual({
      type: "object",
      properties: {
        ok: { type: "boolean" },
        message: { type: "string", minLength: 1 },
      },
      required: ["ok", "message"],
      additionalProperties: false,
    })
  })

  test("reconstructs the failed Step-4A.2R request", () => {
    expect(step4A2RControlRequest).toMatchObject({
      api: "chat.completions.create",
      modelSource: "GROQ_MODEL",
      schemaName: "probe_control",
      strict: true,
      temperature: 0,
      maxCompletionTokens: 128,
      reasoningEffort: null,
      includeReasoning: null,
      stream: null,
      tools: null,
      timeoutMs: 30_000,
      retries: 0,
    })
    expect(step4A2RControlRequest.messages).toHaveLength(2)
    expect(step4A2RControlRequest.schema).toEqual({
      type: "object",
      additionalProperties: false,
      required: ["ok", "message"],
      properties: {
        ok: { type: "boolean" },
        message: { type: "string" },
      },
    })
  })

  test("reports only the six actual semantic differences", () => {
    expect(
      diffStrictControlRequests(
        historicalStep2ControlRequest,
        step4A2RControlRequest
      ).map((difference) => difference.setting)
    ).toEqual([
      "messages",
      "schemaName",
      "schema",
      "temperature",
      "maxCompletionTokens",
      "clientInvocation",
    ])
  })
})

describe("Groq failed_generation diagnostics", () => {
  test("classifies explicit completion-token exhaustion", () => {
    const summary = summarizeFailedGeneration({
      error: {
        failed_generation:
          "Maximum completion tokens reached before generating a valid document.",
      },
    })

    expect(summary).toMatchObject({
      present: true,
      kind: "budget_exhausted",
      jsonParseable: false,
      mentionsTokenLimit: true,
      mentionsNoChoices: false,
    })
  })

  test("classifies JSON-like failed generation structurally", () => {
    const summary = summarizeFailedGeneration({
      error: {
        failed_generation: JSON.stringify({
          ok: true,
          message: "unfinished",
        }),
      },
    })

    expect(summary).toMatchObject({
      present: true,
      kind: "json_like",
      jsonParseable: true,
      topLevelKeys: ["ok", "message"],
    })
  })

  test("redacts secrets, caps previews, and suppresses reasoning traces", () => {
    const configuredSecret = "unit-test-secret-value"
    const redacted = summarizeFailedGeneration(
      {
        error: {
          failed_generation: `Invalid document ${configuredSecret} Bearer gsk_abcdefghijklmnopqrstuvwxyz ${"x".repeat(500)}`,
        },
      },
      configuredSecret
    )

    expect(redacted.sanitizedPreview).toHaveLength(300)
    expect(redacted.sanitizedPreview).not.toContain(configuredSecret)
    expect(redacted.sanitizedPreview).not.toContain("gsk_")

    const reasoning = summarizeFailedGeneration({
      error: {
        failed_generation: "<think>private reasoning trace</think>",
      },
    })
    expect(reasoning.sanitizedPreview).toBeNull()
  })
})

describe("Groq strict control persistence", () => {
  test("appends exactly one sanitized JSONL record for one request", () => {
    const reportPath = createTemporaryReportPath()
    const configuredSecret = "unit-test-secret-value"
    const headers = new Headers({
      authorization: `Bearer ${configuredSecret}`,
      "x-account-id": "private-account",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7600",
      "x-ratelimit-reset-tokens": "2.2s",
    })
    const record = createStrictControlRecord({
      attempt: 1,
      variant: "historical-step2",
      maxCompletionTokens: 256,
      accepted: false,
      observation: {
        ok: false,
        error: {
          status: 400,
          headers,
          error: {
            type: "invalid_request_error",
            code: "json_validate_failed",
            failed_generation: `Maximum completion tokens ${configuredSecret}`,
            raw_body: "must-not-persist",
          },
        },
      },
      configuredSecret,
    })

    appendStrictControlRecord(reportPath, record)

    expect(readStrictControlRecords(reportPath)).toEqual([record])
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(1)

    const serialized = JSON.stringify(record)
    expect(serialized).not.toContain(configuredSecret)
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("private-account")
    expect(serialized).not.toContain("must-not-persist")
    expect(record).toMatchObject({
      tokenLimit: 8000,
      remainingTokens: 7600,
      resetSeconds: 3,
    })
  })
})

function createTemporaryReportPath() {
  const directory = mkdtempSync(join(tmpdir(), "groq-strict-control-test-"))
  temporaryDirectories.push(directory)
  return join(directory, "report.jsonl")
}
