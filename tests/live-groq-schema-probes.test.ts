import OpenAI from "openai"
import { describe, expect, test } from "vitest"

import {
  groqSchemaProbeSchemas,
  sanitizeGroqSchemaProbeError,
  type JsonSchema,
} from "@/tests/helpers/groq-schema-probes"

const runLiveSchemaProbes =
  process.env.RUN_LIVE_GROQ_SCHEMA_PROBES === "1"
const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const MAX_LIVE_GENERATION_REQUESTS = 6

type ProbeName =
  | "0-control"
  | "1-nullable-string"
  | "2-current-nullable-enum"
  | "2a-alternate-nullable-enum"
  | "3-discriminated-object-anyOf"
  | "4-exact-place-subtree"
  | "5-full-current-schema"

type ProbeResult =
  | {
      probe: ProbeName
      requestNumber: number
      accepted: true
      httpStatus: number
      finishReason?: string
      contentReturned: boolean
    }
  | {
      probe: ProbeName
      requestNumber: number
      accepted: false
      diagnostic: ReturnType<typeof sanitizeGroqSchemaProbeError>
    }

describe.skipIf(!runLiveSchemaProbes)("live isolated Groq schema probes", () => {
  test("stops at the first conclusive strict-schema rejection", async () => {
    const apiKey = process.env.GROQ_API_KEY?.trim()
    const model = process.env.GROQ_MODEL?.trim()

    expect(apiKey, "GROQ_API_KEY must be configured").toBeTruthy()
    expect(model).toBe("openai/gpt-oss-20b")

    if (!apiKey || !model) {
      return
    }

    const client = new OpenAI({
      apiKey,
      baseURL: GROQ_BASE_URL,
      timeout: 30_000,
      maxRetries: 0,
    })
    let requestCount = 0

    const runProbe = async (
      probe: ProbeName,
      schema: JsonSchema,
      maxCompletionTokens = 128
    ): Promise<ProbeResult> => {
      requestCount += 1
      expect(requestCount).toBeLessThanOrEqual(MAX_LIVE_GENERATION_REQUESTS)

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
                content: "Return the smallest valid object.",
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: `probe_${probe.replace(/[^a-z0-9]+/gi, "_")}`,
                strict: true,
                schema,
              },
            },
            temperature: 0,
            max_completion_tokens: maxCompletionTokens,
          },
          { timeout: 30_000 }
        )
        const { data, response } = await request.withResponse()
        const choice = data.choices[0]

        return {
          probe,
          requestNumber: requestCount,
          accepted: true,
          httpStatus: response.status,
          ...(typeof choice?.finish_reason === "string"
            ? { finishReason: choice.finish_reason }
            : {}),
          contentReturned: Boolean(choice?.message.content?.trim()),
        }
      } catch (error) {
        return {
          probe,
          requestNumber: requestCount,
          accepted: false,
          diagnostic: sanitizeGroqSchemaProbeError(error, apiKey),
        }
      }
    }

    const report = (result: ProbeResult) => {
      process.stderr.write(
        `GROQ_SCHEMA_PROBE_RESULT ${JSON.stringify(result)}\n`
      )
    }

    const control = await runProbe("0-control", groqSchemaProbeSchemas.control)
    report(control)
    expect(control.accepted, "The known-good control schema must be accepted").toBe(
      true
    )
    if (!control.accepted) {
      return
    }

    const nullableString = await runProbe(
      "1-nullable-string",
      groqSchemaProbeSchemas.nullableString
    )
    report(nullableString)
    if (!nullableString.accepted) {
      return
    }

    const currentNullableEnum = await runProbe(
      "2-current-nullable-enum",
      groqSchemaProbeSchemas.currentNullableEnum
    )
    report(currentNullableEnum)
    if (!currentNullableEnum.accepted) {
      const alternateNullableEnum = await runProbe(
        "2a-alternate-nullable-enum",
        groqSchemaProbeSchemas.alternateNullableEnum
      )
      report(alternateNullableEnum)
      return
    }

    const discriminatedObjectAnyOf = await runProbe(
      "3-discriminated-object-anyOf",
      groqSchemaProbeSchemas.discriminatedObjectAnyOf
    )
    report(discriminatedObjectAnyOf)
    if (!discriminatedObjectAnyOf.accepted) {
      return
    }

    const exactPlaceSubtree = await runProbe(
      "4-exact-place-subtree",
      groqSchemaProbeSchemas.exactPlaceSubtree
    )
    report(exactPlaceSubtree)
    if (!exactPlaceSubtree.accepted) {
      return
    }

    const fullCurrentSchema = await runProbe(
      "5-full-current-schema",
      groqSchemaProbeSchemas.fullCurrentSchema,
      512
    )
    report(fullCurrentSchema)
  }, 120_000)
})
