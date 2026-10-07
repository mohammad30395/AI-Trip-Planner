import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test, vi } from "vitest"

import {
  createGroqSchemaProbeRecord,
  currentPlaceWireSchema,
  groqSchemaProbeSchemas,
  readGroqSchemaProbeRecords,
  runDurableGroqSchemaProbeSequence,
  sanitizeGroqSchemaProbeError,
  type GroqSchemaProbeDefinition,
  type GroqSchemaProbeRecord,
} from "@/tests/helpers/groq-schema-probes"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("isolated Groq strict-schema probes", () => {
  test("preserves the exact current nullable enum representation", () => {
    expect(
      groqSchemaProbeSchemas.currentNullableEnum.properties.value
    ).toEqual({
      type: ["string", "null"],
      enum: ["budget", "mid-range", "premium", null],
    })
  })

  test("provides a documented anyOf nullable-enum alternative", () => {
    expect(
      groqSchemaProbeSchemas.alternateNullableEnum.properties.value
    ).toEqual({
      anyOf: [
        {
          type: "string",
          enum: ["budget", "mid-range", "premium"],
        },
        { type: "null" },
      ],
    })
  })

  test("wraps the exact production place subtree without altering it", () => {
    expect(
      groqSchemaProbeSchemas.exactPlaceSubtree.properties.place
    ).toBe(currentPlaceWireSchema)
  })

  test("keeps the tiny discriminated anyOf branches closed and fully required", () => {
    const place =
      groqSchemaProbeSchemas.discriminatedObjectAnyOf.properties.place

    expect(place.anyOf).toHaveLength(2)

    for (const branch of place.anyOf) {
      expect(branch.additionalProperties).toBe(false)
      expect(branch.required).toEqual(Object.keys(branch.properties))
      expect(branch.properties.kind.enum).toHaveLength(1)
    }
  })

  test("retains only bounded schema diagnostics and redacts secrets", () => {
    const configuredSecret = "unit-test-secret-value"
    const diagnostic = sanitizeGroqSchemaProbeError(
      {
        status: 400,
        request_id: "request-body-must-not-leak",
        error: {
          type: "invalid_request_error",
          code: "json_schema_invalid",
          param: "response_format.json_schema.schema.properties.value",
          schema_path: "$.properties.value.type",
          keyword: "type",
          message: `Invalid JSON schema type near ${configuredSecret}; Bearer gsk_abcdefghijklmnopqrstuvwxyz`,
          body: "must-not-leak",
        },
      },
      configuredSecret
    )

    expect(diagnostic).toEqual({
      httpStatus: 400,
      errorType: "invalid_request_error",
      errorCode: "json_schema_invalid",
      schemaPath: "$.properties.value.type",
      propertyPath: "response_format.json_schema.schema.properties.value",
      rejectedKeyword: "type",
      message:
        "Invalid JSON schema type near [REDACTED]; Bearer [REDACTED]",
    })
    expect(JSON.stringify(diagnostic)).not.toContain(configuredSecret)
    expect(JSON.stringify(diagnostic)).not.toContain("request-body-must-not-leak")
    expect(JSON.stringify(diagnostic)).not.toContain("must-not-leak")
  })

  test("omits unrelated provider messages and caps schema messages", () => {
    expect(
      sanitizeGroqSchemaProbeError(new Error("temporary upstream problem"))
    ).toEqual({})

    const diagnostic = sanitizeGroqSchemaProbeError(
      new Error(`Invalid JSON schema: ${"x".repeat(800)}`)
    )
    expect(diagnostic.message).toHaveLength(500)
  })

  test("persists one exact sanitized JSONL record per probe attempt", async () => {
    const reportPath = createTemporaryReportPath()
    const definition = probeDefinition("control", 0, "control")
    const record = acceptedRecord(definition)

    const result = await runDurableGroqSchemaProbeSequence({
      initial: definition,
      reportPath,
      maximumRequests: 6,
      attempt: vi.fn().mockResolvedValue(record),
      decideNext: () => ({ stopReason: "complete" }),
    })

    expect(result.records).toEqual([record])
    expect(readGroqSchemaProbeRecords(reportPath)).toEqual([record])
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(1)
    expect(Object.keys(record)).toEqual([
      "probe",
      "name",
      "attempted",
      "accepted",
      "httpStatus",
      "errorType",
      "errorCode",
      "schemaPath",
      "keyword",
      "message",
      "finishReason",
      "remainingTokens",
      "tokenLimit",
      "resetSeconds",
    ])
  })

  test("derives request count from two append-only JSONL records", async () => {
    const reportPath = createTemporaryReportPath()
    const first = probeDefinition("control", 0, "control")
    const second = probeDefinition("nullable", 1, "nullable-string")
    const records = new Map([
      [first.id, acceptedRecord(first)],
      [second.id, acceptedRecord(second)],
    ])

    await runDurableGroqSchemaProbeSequence({
      initial: first,
      reportPath,
      maximumRequests: 6,
      attempt: async (definition) => {
        const record = records.get(definition.id)

        if (record === undefined) {
          throw new Error("Missing test probe record.")
        }

        return record
      },
      decideNext: (definition) =>
        definition.id === first.id
          ? { next: second }
          : { stopReason: "complete" },
    })

    expect(readGroqSchemaProbeRecords(reportPath)).toHaveLength(2)
    expect(readFileSync(reportPath, "utf8").trim().split("\n")).toHaveLength(2)
  })

  test("persists no raw headers, provider bodies, or secrets", () => {
    const configuredSecret = "unit-test-secret-value"
    const headers = new Headers({
      authorization: `Bearer ${configuredSecret}`,
      "x-account-id": "private-account",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7123",
      "x-ratelimit-reset-tokens": "1m2.1s",
    })
    const diagnostic = sanitizeGroqSchemaProbeError(
      {
        status: 400,
        headers,
        error: {
          type: "invalid_request_error",
          code: "json_schema_invalid",
          message: `Invalid JSON schema near ${configuredSecret}; Bearer gsk_abcdefghijklmnopqrstuvwxyz`,
          raw_body: "full-provider-body",
        },
      },
      configuredSecret
    )
    const record = createGroqSchemaProbeRecord({
      probe: 1,
      name: "nullable-string",
      accepted: false,
      diagnostic,
      headers,
    })
    const serialized = JSON.stringify(record)

    expect(record.message).toBe(
      "Invalid JSON schema near [REDACTED]; Bearer [REDACTED]"
    )
    expect(record).toMatchObject({
      remainingTokens: 7123,
      tokenLimit: 8000,
      resetSeconds: 63,
    })
    expect(serialized).not.toContain(configuredSecret)
    expect(serialized).not.toContain("authorization")
    expect(serialized).not.toContain("private-account")
    expect(serialized).not.toContain("full-provider-body")
    expect(Object.keys(record)).not.toContain("headers")
  })

  test("stops a durable sequence immediately after a required failure", async () => {
    const reportPath = createTemporaryReportPath()
    const first = probeDefinition("control", 0, "control")
    const second = probeDefinition("nullable", 1, "nullable-string")
    const third = probeDefinition("enum", 2, "current-nullable-enum")
    const attempt = vi.fn(async (definition: TestProbeDefinition) =>
      definition.id === second.id
        ? rejectedRecord(definition)
        : acceptedRecord(definition)
    )

    const result = await runDurableGroqSchemaProbeSequence({
      initial: first,
      reportPath,
      maximumRequests: 6,
      attempt,
      decideNext: (definition, record) => {
        if (!record.accepted) {
          return { stopReason: "schema_rejected" }
        }

        return definition.id === first.id
          ? { next: second }
          : { next: third }
      },
    })

    expect(attempt).toHaveBeenCalledTimes(2)
    expect(result.stopReason).toBe("schema_rejected")
    expect(readGroqSchemaProbeRecords(reportPath)).toHaveLength(2)
  })
})

type TestProbeDefinition = GroqSchemaProbeDefinition<
  "control" | "nullable" | "enum"
>

function createTemporaryReportPath() {
  const directory = mkdtempSync(join(tmpdir(), "groq-schema-probe-test-"))
  temporaryDirectories.push(directory)
  return join(directory, "report.jsonl")
}

function probeDefinition(
  id: TestProbeDefinition["id"],
  probe: number,
  name: string
): TestProbeDefinition {
  return { id, probe, name }
}

function acceptedRecord(
  definition: GroqSchemaProbeDefinition
): GroqSchemaProbeRecord {
  return createGroqSchemaProbeRecord({
    probe: definition.probe,
    name: definition.name,
    accepted: true,
    httpStatus: 200,
    finishReason: "stop",
  })
}

function rejectedRecord(
  definition: GroqSchemaProbeDefinition
): GroqSchemaProbeRecord {
  return createGroqSchemaProbeRecord({
    probe: definition.probe,
    name: definition.name,
    accepted: false,
    diagnostic: {
      httpStatus: 400,
      errorType: "invalid_request_error",
      message: "Invalid JSON schema type.",
    },
  })
}
