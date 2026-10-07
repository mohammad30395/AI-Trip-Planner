import { describe, expect, test } from "vitest"

import {
  currentPlaceWireSchema,
  groqSchemaProbeSchemas,
  sanitizeGroqSchemaProbeError,
} from "@/tests/helpers/groq-schema-probes"

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

  test("keeps every discriminated anyOf object closed and fully required", () => {
    const place =
      groqSchemaProbeSchemas.discriminatedObjectAnyOf.properties.place

    expect(place.anyOf).toHaveLength(3)

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
})
