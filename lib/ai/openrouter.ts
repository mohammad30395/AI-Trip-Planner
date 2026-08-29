import "server-only"

import OpenAI from "openai"

import {
  conversationalStepResponseSchema,
  finalItineraryResponseSchema,
  parseConversationalStepResponse,
  parseFinalItineraryResponse,
  type ConversationalStepResponse,
  type FinalItineraryResponse,
} from "./contract"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const OPENROUTER_TIMEOUT_MS = 30_000
const OPENROUTER_FINAL_ITINERARY_TIMEOUT_MS = 90_000
const APP_TITLE = "AI Trip Planner"

type OpenRouterConfig = {
  apiKey: string
  model: string
}

type OpenRouterSmokeResult = {
  response: ConversationalStepResponse
  model: string
}

type OpenRouterFinalItineraryResult = {
  response: FinalItineraryResponse
  model: string
}

type OpenRouterFailureCode =
  | "provider_timeout"
  | "provider_error"
  | "empty_response"
  | "invalid_json"
  | "schema_validation"
  | "output_truncated"

type OpenRouterCallResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
      code: OpenRouterFailureCode
    }

type OpenRouterConversationMessage = {
  role: "system" | "assistant" | "user"
  content: string
}

type OpenRouterConversationRequest = {
  messages: OpenRouterConversationMessage[]
  maxTokens?: number
}

type OpenRouterFinalItineraryRequest = {
  messages: OpenRouterConversationMessage[]
  maxTokens?: number
}

type OpenRouterChatCompletionResponse = {
  model?: string
  choices?: Array<{
    finish_reason?: string | null
    native_finish_reason?: string | null
    message?: {
      content?: string | null
    }
  }>
}

class OpenRouterConfigurationError extends Error {
  readonly missingVariables: string[]

  constructor(missingVariables: string[]) {
    super(`Missing OpenRouter configuration: ${missingVariables.join(", ")}`)
    this.name = "OpenRouterConfigurationError"
    this.missingVariables = missingVariables
  }
}

class OpenRouterProviderError extends Error {
  readonly reason: OpenRouterFailureCode

  constructor(reason: OpenRouterProviderError["reason"]) {
    super(`OpenRouter call failed: ${reason}`)
    this.name = "OpenRouterProviderError"
    this.reason = reason
  }
}

function getOpenRouterConfig(): OpenRouterConfig {
  const missingVariables: string[] = []
  const apiKey = process.env.OPEN_ROUTER_API_KEY
  const model = process.env.OPEN_ROUTER_MODEL

  if (!apiKey) {
    missingVariables.push("OPEN_ROUTER_API_KEY")
  }

  if (!model) {
    missingVariables.push("OPEN_ROUTER_MODEL")
  }

  if (missingVariables.length > 0) {
    throw new OpenRouterConfigurationError(missingVariables)
  }

  if (apiKey === undefined || model === undefined) {
    throw new OpenRouterConfigurationError(missingVariables)
  }

  return {
    apiKey,
    model,
  }
}

function createOpenRouterClient(
  config: OpenRouterConfig,
  timeout = OPENROUTER_TIMEOUT_MS
) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout,
    maxRetries: 0,
    defaultHeaders: {
      "X-OpenRouter-Title": APP_TITLE,
    },
  })
}

async function runOpenRouterSmokeCall(
  signal?: AbortSignal
): Promise<OpenRouterCallResult<OpenRouterSmokeResult>> {
  return runOpenRouterConversationStep(
    {
      messages: [
        {
          role: "system",
          content:
            "Return only schema-valid JSON for a smoke test. Do not plan a trip.",
        },
        {
          role: "user",
          content:
            "Return a short assistant text confirming the API is reachable and select the source UI.",
        },
      ],
      maxTokens: 600,
    },
    signal
  )
}

async function runOpenRouterConversationStep(
  request: OpenRouterConversationRequest,
  signal?: AbortSignal
): Promise<OpenRouterCallResult<OpenRouterSmokeResult>> {
  const config = getOpenRouterConfig()
  const client = createOpenRouterClient(config)

  try {
    const completion = await client.post<OpenRouterChatCompletionResponse>(
      "/chat/completions",
      {
        body: {
          model: config.model,
          messages: request.messages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "conversational_step_response",
              strict: true,
              schema: conversationalStepResponseSchema,
            },
          },
          temperature: 0,
          max_tokens: request.maxTokens ?? 700,
          provider: {
            require_parameters: true,
          },
        },
        signal,
        timeout: OPENROUTER_TIMEOUT_MS,
      }
    )

    const choice = completion.choices?.[0]
    const content = choice?.message?.content

    if (choice?.finish_reason === "length") {
      throw new OpenRouterProviderError("output_truncated")
    }

    if (!content) {
      throw new OpenRouterProviderError("empty_response")
    }

    const parsedJson = parseJson(content)

    if (!parsedJson.ok) {
      return openRouterFailure("invalid_json", parsedJson.error)
    }

    const parsedResponse = parseConversationalStepResponse(parsedJson.data)

    if (!parsedResponse.ok) {
      return openRouterFailure("schema_validation", parsedResponse.error)
    }

    return {
      ok: true,
      data: {
        response: parsedResponse.data,
        model: completion.model ?? "",
      },
    }
  } catch (error) {
    if (error instanceof OpenRouterProviderError) {
      return openRouterFailure(error.reason, error.message)
    }

    if (isAbortError(error)) {
      return openRouterFailure("provider_timeout", "OpenRouter smoke call timed out")
    }

    logSafeOpenRouterError(error)

    return openRouterFailure("provider_error", "OpenRouter provider call failed")
  }
}

async function runOpenRouterFinalItinerary(
  request: OpenRouterFinalItineraryRequest,
  signal?: AbortSignal
): Promise<OpenRouterCallResult<OpenRouterFinalItineraryResult>> {
  const config = getOpenRouterConfig()
  const client = createOpenRouterClient(config, OPENROUTER_FINAL_ITINERARY_TIMEOUT_MS)

  try {
    const completion = await client.post<OpenRouterChatCompletionResponse>(
      "/chat/completions",
      {
        body: {
          model: config.model,
          messages: request.messages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "final_itinerary_response",
              strict: true,
              schema: finalItineraryResponseSchema,
            },
          },
          temperature: 0.4,
          max_tokens: request.maxTokens ?? 8_000,
          reasoning: {
            effort: "minimal",
            exclude: true,
          },
          provider: {
            require_parameters: true,
          },
        },
        signal,
        timeout: OPENROUTER_FINAL_ITINERARY_TIMEOUT_MS,
      }
    )

    const choice = completion.choices?.[0]
    const content = choice?.message?.content

    if (choice?.finish_reason === "length") {
      throw new OpenRouterProviderError("output_truncated")
    }

    if (!content) {
      throw new OpenRouterProviderError("empty_response")
    }

    const parsedJson = parseJson(content)

    if (!parsedJson.ok) {
      return openRouterFailure("invalid_json", parsedJson.error)
    }

    const parsedResponse = parseFinalItineraryResponse(parsedJson.data)

    if (!parsedResponse.ok) {
      return openRouterFailure("schema_validation", parsedResponse.error)
    }

    return {
      ok: true,
      data: {
        response: parsedResponse.data,
        model: completion.model ?? "",
      },
    }
  } catch (error) {
    if (error instanceof OpenRouterProviderError) {
      return openRouterFailure(error.reason, error.message)
    }

    if (isAbortError(error)) {
      return openRouterFailure(
        "provider_timeout",
        "OpenRouter final itinerary call timed out"
      )
    }

    logSafeOpenRouterError(error)

    return openRouterFailure("provider_error", "OpenRouter provider call failed")
  }
}

function parseJson(value: string): OpenRouterCallResult<unknown> {
  try {
    return {
      ok: true,
      data: JSON.parse(value),
    }
  } catch {
    return openRouterFailure(
      "invalid_json",
      "OpenRouter response was not valid JSON"
    )
  }
}

function openRouterFailure(
  code: OpenRouterFailureCode,
  error: string
): OpenRouterCallResult<never> {
  return {
    ok: false,
    code,
    error,
  }
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
}

function logSafeOpenRouterError(error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return
  }

  const diagnostic = {
    name: error instanceof Error ? error.name : "UnknownError",
    status:
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : undefined,
  }

  console.warn("OpenRouter smoke diagnostic", diagnostic)
}

export {
  OpenRouterConfigurationError,
  runOpenRouterConversationStep,
  runOpenRouterFinalItinerary,
  runOpenRouterSmokeCall,
  OPENROUTER_TIMEOUT_MS,
  OPENROUTER_FINAL_ITINERARY_TIMEOUT_MS,
  type OpenRouterFailureCode,
  type OpenRouterConversationMessage,
}
