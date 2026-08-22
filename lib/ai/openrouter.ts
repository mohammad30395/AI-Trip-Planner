import "server-only"

import OpenAI from "openai"

import {
  conversationalStepResponseSchema,
  finalItineraryResponseSchema,
  parseConversationalStepResponse,
  parseFinalItineraryResponse,
  type ConversationalStepResponse,
  type FinalItineraryResponse,
  type ValidationResult,
} from "./contract"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const OPENROUTER_TIMEOUT_MS = 30_000
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
  readonly reason: "timeout" | "empty_response" | "invalid_json" | "validation" | "provider"

  constructor(reason: OpenRouterProviderError["reason"]) {
    super(`OpenRouter smoke call failed: ${reason}`)
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

function createOpenRouterClient(config: OpenRouterConfig) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout: OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
    defaultHeaders: {
      "X-OpenRouter-Title": APP_TITLE,
    },
  })
}

async function runOpenRouterSmokeCall(
  signal?: AbortSignal
): Promise<ValidationResult<OpenRouterSmokeResult>> {
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
): Promise<ValidationResult<OpenRouterSmokeResult>> {
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

    const content = completion.choices?.[0]?.message?.content

    if (!content) {
      throw new OpenRouterProviderError("empty_response")
    }

    const parsedJson = parseJson(content)

    if (!parsedJson.ok) {
      return parsedJson
    }

    const parsedResponse = parseConversationalStepResponse(parsedJson.data)

    if (!parsedResponse.ok) {
      return parsedResponse
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
      return {
        ok: false,
        error: error.message,
      }
    }

    if (isAbortError(error)) {
      return {
        ok: false,
        error: "OpenRouter smoke call timed out",
      }
    }

    logSafeOpenRouterError(error)

    return {
      ok: false,
      error: "OpenRouter provider call failed",
    }
  }
}

async function runOpenRouterFinalItinerary(
  request: OpenRouterFinalItineraryRequest,
  signal?: AbortSignal
): Promise<ValidationResult<OpenRouterFinalItineraryResult>> {
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
        timeout: OPENROUTER_TIMEOUT_MS,
      }
    )

    const content = completion.choices?.[0]?.message?.content

    if (!content) {
      throw new OpenRouterProviderError("empty_response")
    }

    const parsedJson = parseJson(content)

    if (!parsedJson.ok) {
      return parsedJson
    }

    const parsedResponse = parseFinalItineraryResponse(parsedJson.data)

    if (!parsedResponse.ok) {
      return parsedResponse
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
      return {
        ok: false,
        error: error.message,
      }
    }

    if (isAbortError(error)) {
      return {
        ok: false,
        error: "OpenRouter final itinerary call timed out",
      }
    }

    logSafeOpenRouterError(error)

    return {
      ok: false,
      error: "OpenRouter provider call failed",
    }
  }
}

function parseJson(value: string): ValidationResult<unknown> {
  try {
    return {
      ok: true,
      data: JSON.parse(value),
    }
  } catch {
    return {
      ok: false,
      error: "OpenRouter response was not valid JSON",
    }
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
  type OpenRouterConversationMessage,
}
