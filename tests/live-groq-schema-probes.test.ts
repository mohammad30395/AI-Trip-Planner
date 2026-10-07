import { existsSync } from "node:fs"

import OpenAI from "openai"
import { describe, expect, test } from "vitest"

import {
  createGroqSchemaProbeRecord,
  getErrorHeaders,
  groqSchemaProbeSchemas,
  readGroqSchemaProbeRecords,
  runDurableGroqSchemaProbeSequence,
  sanitizeGroqSchemaProbeError,
  type GroqSchemaProbeDefinition,
  type GroqSchemaProbeRecord,
  type GroqSchemaProbeSequenceDecision,
  type JsonSchema,
} from "@/tests/helpers/groq-schema-probes"

const runLiveSchemaProbes =
  process.env.RUN_LIVE_GROQ_SCHEMA_PROBES === "1"
const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const GROQ_SCHEMA_PROBE_REPORT_PATH = "/tmp/groq-schema-probe-report.jsonl"
const MAX_LIVE_GENERATION_REQUESTS = 6

type ProbeId =
  | "control"
  | "nullable-string"
  | "current-nullable-enum"
  | "alternate-nullable-enum"
  | "discriminated-object-anyOf"
  | "exact-place-subtree"
  | "full-current-schema"

type LiveProbeDefinition = GroqSchemaProbeDefinition<ProbeId> & {
  schema: JsonSchema
  maxCompletionTokens: number
  minimumRemainingTokensForNext: number
}

const probeDefinitions = {
  control: defineProbe(
    "control",
    0,
    "control",
    groqSchemaProbeSchemas.control
  ),
  nullableString: defineProbe(
    "nullable-string",
    1,
    "nullable-string",
    groqSchemaProbeSchemas.nullableString
  ),
  currentNullableEnum: defineProbe(
    "current-nullable-enum",
    2,
    "current-nullable-enum",
    groqSchemaProbeSchemas.currentNullableEnum
  ),
  alternateNullableEnum: defineProbe(
    "alternate-nullable-enum",
    2.1,
    "alternate-nullable-enum",
    groqSchemaProbeSchemas.alternateNullableEnum
  ),
  discriminatedObjectAnyOf: defineProbe(
    "discriminated-object-anyOf",
    3,
    "discriminated-object-anyOf",
    groqSchemaProbeSchemas.discriminatedObjectAnyOf
  ),
  exactPlaceSubtree: defineProbe(
    "exact-place-subtree",
    4,
    "exact-place-subtree",
    groqSchemaProbeSchemas.exactPlaceSubtree,
    128,
    2_500
  ),
  fullCurrentSchema: defineProbe(
    "full-current-schema",
    5,
    "full-current-schema",
    groqSchemaProbeSchemas.fullCurrentSchema,
    512,
    0
  ),
} as const

describe.skipIf(!runLiveSchemaProbes)("live isolated Groq schema probes", () => {
  test("persists every attempt and stops at the first conclusive rejection", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()
    const model = process.env.GROQ_MODEL?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(model).toBe("openai/gpt-oss-20b")
    expect(
      existsSync(GROQ_SCHEMA_PROBE_REPORT_PATH),
      "Delete the prior probe report before the live run"
    ).toBe(false)

    if (!apiKey || !model) {
      return
    }

    const client = new OpenAI({
      apiKey,
      baseURL: GROQ_BASE_URL,
      timeout: 30_000,
      maxRetries: 0,
    })
    let providerRequestsAttempted = 0

    const attempt = async (
      definition: LiveProbeDefinition
    ): Promise<GroqSchemaProbeRecord> => {
      providerRequestsAttempted += 1

      try {
        const request = client.chat.completions.create(
          {
            model,
            messages: [
              {
                role: "system",
                content:
                  "Return only the smallest valid JSON object matching the supplied schema.",
              },
              {
                role: "user",
                content:
                  definition.id === "full-current-schema"
                    ? "Return the smallest valid object matching this schema using minimal placeholder strings."
                    : "Return the smallest valid object.",
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: `probe_${definition.name.replace(/[^a-z0-9]+/gi, "_")}`,
                strict: true,
                schema: definition.schema,
              },
            },
            temperature: 0,
            max_completion_tokens: definition.maxCompletionTokens,
          },
          { timeout: 30_000 }
        )
        const { data, response } = await request.withResponse()

        return createGroqSchemaProbeRecord({
          probe: definition.probe,
          name: definition.name,
          accepted: true,
          httpStatus: response.status,
          finishReason: data.choices[0]?.finish_reason,
          headers: response.headers,
        })
      } catch (error) {
        return createGroqSchemaProbeRecord({
          probe: definition.probe,
          name: definition.name,
          accepted: false,
          diagnostic: sanitizeGroqSchemaProbeError(error, apiKey),
          headers: getErrorHeaders(error),
        })
      }
    }

    const sequence = await runDurableGroqSchemaProbeSequence({
      initial: probeDefinitions.control,
      reportPath: GROQ_SCHEMA_PROBE_REPORT_PATH,
      maximumRequests: MAX_LIVE_GENERATION_REQUESTS,
      attempt,
      decideNext,
    })
    const durableRecords = readGroqSchemaProbeRecords(
      GROQ_SCHEMA_PROBE_REPORT_PATH
    )

    expect(durableRecords).toEqual(sequence.records)
    expect(durableRecords).toHaveLength(providerRequestsAttempted)
    expect(providerRequestsAttempted).toBeLessThanOrEqual(
      MAX_LIVE_GENERATION_REQUESTS
    )
    process.stderr.write(
      `GROQ_SCHEMA_PROBE_SUMMARY ${JSON.stringify({
        recordCount: durableRecords.length,
        providerRequestsAttempted,
        countsMatch: durableRecords.length === providerRequestsAttempted,
        stopReason: sequence.stopReason,
      })}\n`
    )
  }, 120_000)
})

function defineProbe(
  id: ProbeId,
  probe: number,
  name: string,
  schema: JsonSchema,
  maxCompletionTokens = 128,
  minimumRemainingTokensForNext = 512
): LiveProbeDefinition {
  return {
    id,
    probe,
    name,
    schema,
    maxCompletionTokens,
    minimumRemainingTokensForNext,
  }
}

function decideNext(
  definition: LiveProbeDefinition,
  record: GroqSchemaProbeRecord
): GroqSchemaProbeSequenceDecision<LiveProbeDefinition> {
  if (!record.accepted) {
    if (definition.id === "current-nullable-enum") {
      return nextProbe(record, probeDefinitions.alternateNullableEnum)
    }

    return { stopReason: `${definition.id}_rejected` }
  }

  switch (definition.id) {
    case "control":
      return nextProbe(record, probeDefinitions.nullableString)
    case "nullable-string":
      return nextProbe(record, probeDefinitions.currentNullableEnum)
    case "current-nullable-enum":
      return nextProbe(record, probeDefinitions.discriminatedObjectAnyOf)
    case "alternate-nullable-enum":
      return { stopReason: "nullable_enum_alternative_accepted" }
    case "discriminated-object-anyOf":
      return nextProbe(record, probeDefinitions.exactPlaceSubtree)
    case "exact-place-subtree":
      return nextProbe(record, probeDefinitions.fullCurrentSchema)
    case "full-current-schema":
      return { stopReason: "full_schema_accepted" }
  }
}

function nextProbe(
  currentRecord: GroqSchemaProbeRecord,
  nextDefinition: LiveProbeDefinition
): GroqSchemaProbeSequenceDecision<LiveProbeDefinition> {
  if (
    currentRecord.remainingTokens !== null &&
    currentRecord.remainingTokens <
      nextDefinition.minimumRemainingTokensForNext
  ) {
    return { stopReason: "PROBE_SEQUENCE_DEFERRED_RATE_LIMIT_SAFETY" }
  }

  return { next: nextDefinition }
}
