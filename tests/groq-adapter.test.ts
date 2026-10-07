import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const openAiMocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  clientOptions: [] as unknown[],
  modelsList: vi.fn(),
}))

vi.mock("openai", () => {
  class MockAPIConnectionTimeoutError extends Error {}
  class MockAPIUserAbortError extends Error {}
  class MockRateLimitError extends Error {
    readonly status = 429
    readonly headers: Headers

    constructor(
      _status: 429,
      _error: object | undefined,
      _message: string | undefined,
      headers: Headers
    ) {
      super("rate limited")
      this.headers = headers
    }
  }

  class MockOpenAI {
    readonly chat = {
      completions: {
        create: openAiMocks.chatCreate,
      },
    }

    readonly models = {
      list: openAiMocks.modelsList,
    }

    constructor(options: unknown) {
      openAiMocks.clientOptions.push(options)
    }
  }

  return {
    default: MockOpenAI,
    APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
    APIUserAbortError: MockAPIUserAbortError,
    RateLimitError: MockRateLimitError,
  }
})

import {
  APIConnectionTimeoutError,
  RateLimitError,
} from "openai"

import {
  checkGroqModelAvailability,
  GROQ_BASE_URL,
  runGroqConversationStep,
  runGroqConversationSmoke,
  runGroqStrictCapabilitySmoke,
} from "@/lib/ai/groq"

const originalGroqApiKey = process.env.GROQ_API_KEY
const originalGroqModel = process.env.GROQ_MODEL

beforeEach(() => {
  process.env.GROQ_API_KEY = "unit-test-secret"
  process.env.GROQ_MODEL = "unit-test-model"
  openAiMocks.chatCreate.mockReset()
  openAiMocks.clientOptions.length = 0
  openAiMocks.modelsList.mockReset()
})

afterEach(() => {
  restoreEnvironmentVariable("GROQ_API_KEY", originalGroqApiKey)
  restoreEnvironmentVariable("GROQ_MODEL", originalGroqModel)
})

describe("Groq isolated server adapter", () => {
  test("reports a missing GROQ_API_KEY without provider work", async () => {
    delete process.env.GROQ_API_KEY

    const result = await runProductionConversation()

    expect(result).toMatchObject({
      ok: false,
      code: "configuration",
      missingVariables: ["GROQ_API_KEY"],
    })
    expect(openAiMocks.chatCreate).not.toHaveBeenCalled()
  })

  test("reports a missing GROQ_MODEL without provider work", async () => {
    delete process.env.GROQ_MODEL

    const result = await runProductionConversation()

    expect(result).toMatchObject({
      ok: false,
      code: "configuration",
      missingVariables: ["GROQ_MODEL"],
    })
    expect(openAiMocks.chatCreate).not.toHaveBeenCalled()
  })

  test("configures the official Groq base URL without OpenRouter headers", async () => {
    openAiMocks.modelsList.mockResolvedValueOnce({
      data: [{ id: "unit-test-model" }],
    })

    await expect(checkGroqModelAvailability()).resolves.toMatchObject({ ok: true })

    expect(openAiMocks.clientOptions[0]).toEqual({
      apiKey: "unit-test-secret",
      baseURL: GROQ_BASE_URL,
      timeout: 30_000,
      maxRetries: 0,
    })
    expect(openAiMocks.clientOptions[0]).not.toHaveProperty("defaultHeaders")
  })

  test("sends the existing conversation schema in best-effort mode", async () => {
    openAiMocks.chatCreate.mockResolvedValueOnce(completion(validConversationJson))

    const result = await runGroqConversationSmoke()
    const body = getFirstChatRequest()

    expect(result).toMatchObject({
      ok: true,
      data: {
        response: {
          nextUISelector: "source",
        },
      },
    })
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "groq_conversational_step_response_smoke",
        strict: false,
        schema: expect.objectContaining({
          type: "object",
          required: ["assistantText", "nextUISelector"],
        }),
      },
    })
    expect(body).toHaveProperty("max_completion_tokens", 512)
    expect(body).not.toHaveProperty("provider")
    expect(body).not.toHaveProperty("reasoning")
    expect(body).not.toHaveProperty("reasoning_effort")
  })

  test("configures the production conversation request for Groq", async () => {
    openAiMocks.chatCreate.mockResolvedValueOnce(completion(validConversationJson))

    const result = await runProductionConversation()
    const body = getFirstChatRequest()

    expect(result).toMatchObject({
      ok: true,
      data: {
        response: { nextUISelector: "source" },
      },
    })
    expect(body).toMatchObject({
      model: "unit-test-model",
      messages: productionMessages,
      temperature: 0,
      max_completion_tokens: 700,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "conversational_step_response",
          strict: false,
          schema: expect.objectContaining({
            type: "object",
            required: ["assistantText", "nextUISelector"],
          }),
        },
      },
    })
    expect(body).not.toHaveProperty("provider")
    expect(body).not.toHaveProperty("reasoning")
    expect(body).not.toHaveProperty("reasoning_effort")
    expect(body).not.toHaveProperty("tools")
  })

  test("uses a tiny fully required schema for strict capability mode", async () => {
    openAiMocks.chatCreate.mockResolvedValueOnce(
      completion(JSON.stringify({ ok: true, message: "Strict output works." }))
    )

    const result = await runGroqStrictCapabilitySmoke()
    const body = getFirstChatRequest()

    expect(result).toMatchObject({
      ok: true,
      data: { validated: true },
    })
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "groq_strict_capability_smoke",
        strict: true,
        schema: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            message: { type: "string", minLength: 1 },
          },
          required: ["ok", "message"],
          additionalProperties: false,
        },
      },
    })
  })

  test("returns invalid_json for malformed provider content", async () => {
    openAiMocks.chatCreate.mockResolvedValueOnce(completion("not-json"))

    await expect(runProductionConversation()).resolves.toMatchObject({
      ok: false,
      code: "invalid_json",
    })
  })

  test("returns schema_validation for JSON outside the shared contract", async () => {
    openAiMocks.chatCreate.mockResolvedValueOnce(
      completion(JSON.stringify({ assistantText: "Where from?", nextUISelector: "map" }))
    )

    await expect(runProductionConversation()).resolves.toMatchObject({
      ok: false,
      code: "schema_validation",
    })
  })

  test("returns empty_response when no message content is present", async () => {
    openAiMocks.chatCreate.mockResolvedValueOnce(completion(null))

    await expect(runProductionConversation()).resolves.toMatchObject({
      ok: false,
      code: "empty_response",
    })
  })

  test("returns empty_response when message content is blank", async () => {
    openAiMocks.chatCreate.mockResolvedValueOnce(completion("   "))

    await expect(runProductionConversation()).resolves.toMatchObject({
      ok: false,
      code: "empty_response",
    })
  })

  test("returns output_truncated for a length finish reason", async () => {
    openAiMocks.chatCreate.mockResolvedValueOnce(
      completion(validConversationJson, "length")
    )

    await expect(runProductionConversation()).resolves.toMatchObject({
      ok: false,
      code: "output_truncated",
    })
  })

  test("sanitizes provider failures and never returns secret-bearing errors", async () => {
    openAiMocks.chatCreate.mockRejectedValueOnce(
      new Error(`provider rejected ${process.env.GROQ_API_KEY}`)
    )

    const result = await runProductionConversation()

    expect(result).toEqual({
      ok: false,
      code: "provider_error",
      error: "Groq provider request failed.",
    })
    expect(JSON.stringify(result)).not.toContain("unit-test-secret")
  })

  test("normalizes HTTP 429 and bounds a safe retry hint", async () => {
    const headers = new Headers({ "retry-after": "7200" })
    openAiMocks.chatCreate.mockRejectedValueOnce(
      new RateLimitError(429, undefined, "rate limited", headers)
    )

    await expect(runProductionConversation()).resolves.toEqual({
      ok: false,
      code: "rate_limited",
      error: "Groq rate limit was reached.",
      retryAfterSeconds: 3_600,
    })
  })

  test("normalizes the OpenAI SDK timeout class", async () => {
    openAiMocks.chatCreate.mockRejectedValueOnce(
      new APIConnectionTimeoutError()
    )

    await expect(runProductionConversation()).resolves.toEqual({
      ok: false,
      code: "provider_timeout",
      error: "Groq provider request timed out.",
    })
  })

  test("reports an inaccessible configured model without generation", async () => {
    openAiMocks.modelsList.mockResolvedValueOnce({
      data: [{ id: "different-model" }],
    })

    const result = await checkGroqModelAvailability()

    expect(result).toMatchObject({
      ok: false,
      code: "provider_error",
    })
    expect(openAiMocks.chatCreate).not.toHaveBeenCalled()
  })
})

function completion(content: string | null, finishReason = "stop") {
  return {
    model: "unit-test-model",
    choices: [
      {
        finish_reason: finishReason,
        message: { content },
      },
    ],
  }
}

function runProductionConversation() {
  return runGroqConversationStep({
    messages: productionMessages,
    maxCompletionTokens: 700,
  })
}

function getFirstChatRequest() {
  const request: unknown = openAiMocks.chatCreate.mock.calls[0]?.[0]

  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    throw new Error("Expected a chat completion request object.")
  }

  return request as Record<string, unknown>
}

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

const validConversationJson = JSON.stringify({
  assistantText: "Where will your trip start?",
  nextUISelector: "source",
})

const productionMessages = [
  {
    role: "system" as const,
    content: "Collect the next missing trip requirement.",
  },
  {
    role: "user" as const,
    content: "Current requirements are empty.",
  },
]
