import { describe, expect, test } from "vitest"

import {
  checkGroqModelAvailability,
  runGroqConversationStep,
  runGroqConversationSmoke,
  runGroqStrictCapabilitySmoke,
} from "@/lib/ai/groq"

const runLiveSmoke = process.env.RUN_LIVE_GROQ_SMOKE === "1"
const runLiveConversation = process.env.RUN_LIVE_GROQ_CONVERSATION === "1"

describe.skipIf(!runLiveSmoke)("live Groq isolated smoke", () => {
  test("checks the configured model and performs exactly two small generations", async () => {
    const availability = await checkGroqModelAvailability()

    expect(availability).toMatchObject({
      ok: true,
      data: { accessible: true },
    })

    if (!availability.ok) {
      return
    }

    const strictCapability = await runGroqStrictCapabilitySmoke()

    expect(strictCapability).toMatchObject({
      ok: true,
      data: { validated: true },
    })

    if (!strictCapability.ok) {
      return
    }

    const existingSchema = await runGroqConversationSmoke()

    expect(existingSchema).toMatchObject({
      ok: true,
      data: {
        response: { nextUISelector: "source" },
      },
    })

    if (!existingSchema.ok) {
      return
    }

    console.info("Groq live smoke result", {
      modelAccessible: true,
      strictModeAccepted: true,
      strictResponseValidated: true,
      existingSchemaAccepted: true,
      existingSchemaJsonParsed: true,
      existingSchemaRuntimeValidated: true,
      selector: existingSchema.data.response.nextUISelector,
    })
  }, 90_000)
})

describe.skipIf(!runLiveConversation)("live Groq production conversation", () => {
  test("returns a runtime-validated source selector through the production function", async () => {
    const result = await runGroqConversationStep({
      messages: [
        {
          role: "system",
          content:
            "You are a concise trip-planning interviewer. Ask for exactly one missing trip requirement. Return only data matching the supplied JSON schema. Never generate an itinerary or select final.",
        },
        {
          role: "user",
          content:
            "No trip requirements are known yet. Ask for the trip source and set nextUISelector to source.",
        },
      ],
      maxCompletionTokens: 700,
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        response: { nextUISelector: "source" },
      },
    })

    if (!result.ok) {
      return
    }

    console.info("Groq live production conversation result", {
      schemaParsed: true,
      runtimeValidated: true,
      selector: result.data.response.nextUISelector,
    })
  }, 40_000)
})
