import "server-only"

import OpenAI, {
  APIConnectionTimeoutError,
  APIUserAbortError,
  RateLimitError,
} from "openai"

import {
  conversationalStepResponseSchema,
  parseConversationalStepResponse,
  type ConversationalStepResponse,
} from "./contract"

const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const GROQ_CONVERSATION_TIMEOUT_MS = 30_000
const GROQ_SMOKE_TIMEOUT_MS = GROQ_CONVERSATION_TIMEOUT_MS

const groqStrictCapabilitySchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    message: { type: "string", minLength: 1 },
  },
  required: ["ok", "message"],
  additionalProperties: false,
} as const

type GroqConfig = {
  apiKey: string
  model: string
}

type GroqFailureCode =
  | "configuration"
  | "provider_error"
  | "provider_timeout"
  | "invalid_json"
  | "schema_validation"
  | "empty_response"
  | "output_truncated"
  | "rate_limited"

type GroqFailure = {
  ok: false
  code: GroqFailureCode
  error: string
  missingVariables?: string[]
  retryAfterSeconds?: number
}

type GroqCallResult<T> =
  | {
      ok: true
      data: T
    }
  | GroqFailure

type GroqModelAvailability = {
  accessible: true
}

type GroqConversationSmokeResult = {
  response: ConversationalStepResponse
  modelReturned: boolean
}

type GroqConversationMessage = {
  role: "system" | "assistant" | "user"
  content: string
}

type GroqConversationRequest = {
  messages: GroqConversationMessage[]
  maxCompletionTokens?: number
}

type GroqStrictCapabilityResult = {
  validated: true
  modelReturned: boolean
}

type GroqStructuredOutputRequest = {
  messages: GroqConversationMessage[]
  schemaName: string
  schema: Record<string, unknown>
  strict: boolean
  maxCompletionTokens: number
  temperature?: number
}

type GroqStructuredOutput = {
  content: string
  modelReturned: boolean
}

function getGroqConfig(): GroqCallResult<GroqConfig> {
  const missingVariables: string[] = []
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL

  if (!apiKey?.trim()) {
    missingVariables.push("GROQ_API_KEY")
  }

  if (!model?.trim()) {
    missingVariables.push("GROQ_MODEL")
  }

  if (missingVariables.length > 0 || apiKey === undefined || model === undefined) {
    return groqFailure(
      "configuration",
      "Groq configuration is incomplete.",
      { missingVariables }
    )
  }

  return {
    ok: true,
    data: {
      apiKey: apiKey.trim(),
      model: model.trim(),
    },
  }
}

function createGroqClient(config: GroqConfig) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: GROQ_BASE_URL,
    timeout: GROQ_CONVERSATION_TIMEOUT_MS,
    maxRetries: 0,
  })
}

async function runGroqConversationStep(
  request: GroqConversationRequest,
  signal?: AbortSignal
): Promise<GroqCallResult<GroqConversationSmokeResult>> {
  const completion = await runGroqStructuredOutput(
    {
      messages: request.messages,
      schemaName: "conversational_step_response",
      schema: conversationalStepResponseSchema,
      strict: false,
      maxCompletionTokens: request.maxCompletionTokens ?? 700,
      temperature: 0,
    },
    signal
  )

  if (!completion.ok) {
    return completion
  }

  return parseGroqConversationResponse(completion.data)
}

async function checkGroqModelAvailability(
  signal?: AbortSignal
): Promise<GroqCallResult<GroqModelAvailability>> {
  const config = getGroqConfig()

  if (!config.ok) {
    return config
  }

  const client = createGroqClient(config.data)

  try {
    const models = await client.models.list({
      signal,
      timeout: GROQ_SMOKE_TIMEOUT_MS,
    })
    const accessible = models.data.some((model) => model.id === config.data.model)

    if (!accessible) {
      return groqFailure(
        "provider_error",
        "The configured Groq model is not accessible."
      )
    }

    return {
      ok: true,
      data: { accessible: true },
    }
  } catch (error) {
    return normalizeGroqError(error)
  }
}

async function runGroqConversationSmoke(
  signal?: AbortSignal
): Promise<GroqCallResult<GroqConversationSmokeResult>> {
  const completion = await runGroqStructuredOutput(
    {
      messages: [
        {
          role: "system",
          content:
            "You are performing a provider connectivity and structured-output test. Return only data matching the supplied JSON schema. Do not create an itinerary.",
        },
        {
          role: "user",
          content:
            "Return a very short assistant message asking for the trip source and set nextUISelector to source.",
        },
      ],
      schemaName: "groq_conversational_step_response_smoke",
      schema: conversationalStepResponseSchema,
      strict: false,
      maxCompletionTokens: 512,
    },
    signal
  )

  if (!completion.ok) {
    return completion
  }

  return parseGroqConversationResponse(completion.data)
}

async function runGroqStrictCapabilitySmoke(
  signal?: AbortSignal
): Promise<GroqCallResult<GroqStrictCapabilityResult>> {
  const completion = await runGroqStructuredOutput(
    {
      messages: [
        {
          role: "system",
          content:
            "Return only data matching the supplied JSON schema for a provider capability test.",
        },
        {
          role: "user",
          content:
            "Return ok as true and a very short message confirming strict structured output.",
        },
      ],
      schemaName: "groq_strict_capability_smoke",
      schema: groqStrictCapabilitySchema,
      strict: true,
      maxCompletionTokens: 256,
    },
    signal
  )

  if (!completion.ok) {
    return completion
  }

  const parsedJson = parseJson(completion.data.content)

  if (!parsedJson.ok) {
    return parsedJson
  }

  if (!isValidStrictCapabilityResponse(parsedJson.data)) {
    return groqFailure(
      "schema_validation",
      "Groq strict capability response failed validation."
    )
  }

  return {
    ok: true,
    data: {
      validated: true,
      modelReturned: completion.data.modelReturned,
    },
  }
}

async function runGroqStructuredOutput(
  request: GroqStructuredOutputRequest,
  signal?: AbortSignal
): Promise<GroqCallResult<GroqStructuredOutput>> {
  const config = getGroqConfig()

  if (!config.ok) {
    return config
  }

  const client = createGroqClient(config.data)

  try {
    const completion = await client.chat.completions.create(
      {
        model: config.data.model,
        messages: request.messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: request.schemaName,
            strict: request.strict,
            schema: request.schema,
          },
        },
        max_completion_tokens: request.maxCompletionTokens,
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
      },
      {
        signal,
        timeout: GROQ_CONVERSATION_TIMEOUT_MS,
      }
    )
    const choice = completion.choices[0]

    if (choice?.finish_reason === "length") {
      return groqFailure(
        "output_truncated",
        "Groq response reached its output limit."
      )
    }

    const content = choice?.message.content

    if (!content?.trim()) {
      return groqFailure("empty_response", "Groq returned an empty response.")
    }

    return {
      ok: true,
      data: {
        content,
        modelReturned: completion.model.length > 0,
      },
    }
  } catch (error) {
    return normalizeGroqError(error)
  }
}

function parseGroqConversationResponse(
  completion: GroqStructuredOutput
): GroqCallResult<GroqConversationSmokeResult> {
  const parsedJson = parseJson(completion.content)

  if (!parsedJson.ok) {
    return parsedJson
  }

  const parsedResponse = parseConversationalStepResponse(parsedJson.data)

  if (!parsedResponse.ok) {
    return groqFailure(
      "schema_validation",
      "Groq response failed runtime validation."
    )
  }

  return {
    ok: true,
    data: {
      response: parsedResponse.data,
      modelReturned: completion.modelReturned,
    },
  }
}

function parseJson(value: string): GroqCallResult<unknown> {
  try {
    return {
      ok: true,
      data: JSON.parse(value),
    }
  } catch {
    return groqFailure("invalid_json", "Groq response was not valid JSON.")
  }
}

function isValidStrictCapabilityResponse(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const object = value as Record<string, unknown>

  return (
    Object.keys(object).length === 2 &&
    object.ok === true &&
    typeof object.message === "string" &&
    object.message.trim().length > 0
  )
}

function normalizeGroqError(error: unknown): GroqFailure {
  if (error instanceof RateLimitError || getErrorStatus(error) === 429) {
    const retryAfterSeconds = getSafeRetryAfterSeconds(error)

    return groqFailure("rate_limited", "Groq rate limit was reached.", {
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    })
  }

  if (
    error instanceof APIConnectionTimeoutError ||
    error instanceof APIUserAbortError ||
    isPlatformTimeoutError(error)
  ) {
    return groqFailure("provider_timeout", "Groq provider request timed out.")
  }

  logSafeGroqError(error)

  return groqFailure("provider_error", "Groq provider request failed.")
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined
}

function getSafeRetryAfterSeconds(error: unknown) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("headers" in error) ||
    !(error.headers instanceof Headers)
  ) {
    return undefined
  }

  const value = error.headers.get("retry-after")

  if (value === null) {
    return undefined
  }

  const seconds = Number(value)

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined
  }

  return Math.min(3_600, Math.ceil(seconds))
}

function isPlatformTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
}

function logSafeGroqError(error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return
  }

  console.warn("Groq provider diagnostic", {
    name: error instanceof Error ? error.name : "UnknownError",
    status: getErrorStatus(error),
  })
}

function groqFailure(
  code: GroqFailureCode,
  error: string,
  details: Pick<
    GroqFailure,
    "missingVariables" | "retryAfterSeconds"
  > = {}
): GroqFailure {
  return {
    ok: false,
    code,
    error,
    ...details,
  }
}

export {
  checkGroqModelAvailability,
  runGroqConversationStep,
  runGroqConversationSmoke,
  runGroqStrictCapabilitySmoke,
  GROQ_BASE_URL,
  GROQ_CONVERSATION_TIMEOUT_MS,
  GROQ_SMOKE_TIMEOUT_MS,
  type GroqCallResult,
  type GroqConversationMessage,
  type GroqFailureCode,
}
