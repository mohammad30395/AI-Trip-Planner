import "server-only"

import {
  conversationalStepResponseSchema,
  parseConversationalStepResponse,
  type ConversationalStepResponse,
  type ValidationResult,
} from "./contract"

export const AGENTROUTER_BASE_URL = "https://co.agentrouter.org"
export const AGENTROUTER_MESSAGES_PATH = "/v1/messages"
export const AGENTROUTER_MESSAGES_ENDPOINT =
  `${AGENTROUTER_BASE_URL}${AGENTROUTER_MESSAGES_PATH}`
export const AGENTROUTER_TIMEOUT_MS = 30_000
export const AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM =
  "anthropic_messages_output_config_json_schema"

const ANTHROPIC_VERSION = "2023-06-01"

type AgentRouterConfig = {
  apiKey: string
  model: string
}

type JsonObject = Record<string, unknown>

type AgentRouterConversationMessage = {
  role: "assistant" | "user"
  content: string
}

type AgentRouterJsonSchemaRequest<T> = {
  system: string
  messages: AgentRouterConversationMessage[]
  schema: JsonObject
  maxTokens: number
  validate: (value: unknown) => ValidationResult<T>
}

type AgentRouterMessagesRequest = {
  model: string
  max_tokens: number
  system: string
  messages: AgentRouterConversationMessage[]
  output_config: {
    format: {
      type: "json_schema"
      schema: JsonObject
    }
  }
  stream: false
}

type AgentRouterMessagesResponse = {
  content?: unknown
  model?: unknown
  stop_reason?: unknown
  type?: unknown
}

type AgentRouterStructuredResult<T> = {
  response: T
  model: string
  contentBlockTypes: string[]
  stopReason: string | null
  structuredOutputMechanism: typeof AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM
}

export type AgentRouterSmokeResponse = {
  ok: true
  message: string
}

type AgentRouterSmokeResult = AgentRouterStructuredResult<AgentRouterSmokeResponse>

type AgentRouterConversationCompatibilityResult =
  AgentRouterStructuredResult<ConversationalStepResponse>

export type AgentRouterFailureCode =
  | "configuration_error"
  | "provider_auth_error"
  | "provider_rate_limited"
  | "provider_timeout"
  | "provider_error"
  | "malformed_response"
  | "structured_output_failed"
  | "output_truncated"

export type AgentRouterCallResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
      code: AgentRouterFailureCode
      status?: number
    }

export class AgentRouterConfigurationError extends Error {
  readonly missingVariables: string[]

  constructor(missingVariables: string[]) {
    super(`Missing AgentRouter configuration: ${missingVariables.join(", ")}`)
    this.name = "AgentRouterConfigurationError"
    this.missingVariables = missingVariables
  }
}

class AgentRouterProviderError extends Error {
  readonly code: AgentRouterFailureCode
  readonly status?: number

  constructor(code: AgentRouterFailureCode, status?: number) {
    super(`AgentRouter provider call failed: ${code}`)
    this.name = "AgentRouterProviderError"
    this.code = code
    this.status = status
  }
}

const smokeResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "message"],
  properties: {
    ok: { type: "boolean", enum: [true] },
    message: { type: "string", minLength: 1 },
  },
}

export async function runAgentRouterStructuredSmoke(
  signal?: AbortSignal
): Promise<AgentRouterCallResult<AgentRouterSmokeResult>> {
  return runAgentRouterJsonSchemaRequest({
    system:
      "Return only schema-valid JSON for a harmless connectivity smoke test.",
    messages: [
      {
        role: "user",
        content:
          "Return ok true and a short message confirming structured output works.",
      },
    ],
    schema: smokeResponseSchema,
    maxTokens: 120,
    validate: parseAgentRouterSmokeResponse,
  }, signal)
}

export async function runAgentRouterConversationCompatibilitySmoke(
  signal?: AbortSignal
): Promise<AgentRouterCallResult<AgentRouterConversationCompatibilityResult>> {
  return runAgentRouterJsonSchemaRequest({
    system:
      "Return only schema-valid JSON for the app's conversational step contract.",
    messages: [
      {
        role: "user",
        content:
          "Confirm readiness for a trip-planning interview and select the source UI.",
      },
    ],
    schema: conversationalStepResponseSchema,
    maxTokens: 180,
    validate: parseConversationalStepResponse,
  }, signal)
}

export function parseAgentRouterSmokeResponse(
  value: unknown
): ValidationResult<AgentRouterSmokeResponse> {
  const object = asObject(value)

  if (!object.ok) {
    return object
  }

  const keys = Object.keys(object.data)

  for (const key of keys) {
    if (key !== "ok" && key !== "message") {
      return validationError(`Unexpected smoke response field: ${key}`)
    }
  }

  if (object.data.ok !== true) {
    return validationError("Smoke response ok must be true")
  }

  if (
    typeof object.data.message !== "string" ||
    object.data.message.trim().length === 0
  ) {
    return validationError("Smoke response message must be a non-empty string")
  }

  return {
    ok: true,
    data: {
      ok: true,
      message: object.data.message,
    },
  }
}

async function runAgentRouterJsonSchemaRequest<T>(
  request: AgentRouterJsonSchemaRequest<T>,
  signal?: AbortSignal
): Promise<AgentRouterCallResult<AgentRouterStructuredResult<T>>> {
  const config = getAgentRouterConfig()
  const timeout = createTimeoutSignal(signal)
  const body: AgentRouterMessagesRequest = {
    model: config.model,
    max_tokens: request.maxTokens,
    system: request.system,
    messages: request.messages,
    output_config: {
      format: {
        type: "json_schema",
        schema: request.schema,
      },
    },
    stream: false,
  }

  try {
    const response = await fetch(AGENTROUTER_MESSAGES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: timeout.signal,
    })

    if (!response.ok) {
      throw new AgentRouterProviderError(
        failureCodeForProviderStatus(response.status),
        response.status
      )
    }

    const providerJson = await readProviderJson(response)
    const text = extractTextContent(providerJson)

    if (!text.ok) {
      return agentRouterFailure("malformed_response", text.error)
    }

    if (text.stopReason === "max_tokens") {
      return agentRouterFailure(
        "output_truncated",
        "AgentRouter structured output was truncated"
      )
    }

    const parsedJson = parseJson(text.text)

    if (!parsedJson.ok) {
      return agentRouterFailure("structured_output_failed", parsedJson.error)
    }

    const parsedResponse = request.validate(parsedJson.data)

    if (!parsedResponse.ok) {
      return agentRouterFailure(
        "structured_output_failed",
        parsedResponse.error
      )
    }

    return {
      ok: true,
      data: {
        response: parsedResponse.data,
        model: readOptionalString(providerJson.model),
        contentBlockTypes: text.contentBlockTypes,
        stopReason: text.stopReason,
        structuredOutputMechanism: AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM,
      },
    }
  } catch (error) {
    if (error instanceof AgentRouterProviderError) {
      return agentRouterFailure(error.code, safeProviderMessage(error.code), {
        status: error.status,
      })
    }

    if (isAbortError(error)) {
      return agentRouterFailure(
        "provider_timeout",
        "AgentRouter provider call timed out"
      )
    }

    logSafeAgentRouterError(error)

    return agentRouterFailure(
      "provider_error",
      "AgentRouter provider call failed"
    )
  } finally {
    timeout.dispose()
  }
}

function getAgentRouterConfig(): AgentRouterConfig {
  const missingVariables: string[] = []
  const apiKey = process.env.AGENTROUTER_API_KEY
  const model = process.env.AGENTROUTER_MODEL

  if (!apiKey) {
    missingVariables.push("AGENTROUTER_API_KEY")
  }

  if (!model) {
    missingVariables.push("AGENTROUTER_MODEL")
  }

  if (missingVariables.length > 0) {
    throw new AgentRouterConfigurationError(missingVariables)
  }

  if (apiKey === undefined || model === undefined) {
    throw new AgentRouterConfigurationError(missingVariables)
  }

  return {
    apiKey,
    model,
  }
}

async function readProviderJson(
  response: Response
): Promise<AgentRouterMessagesResponse> {
  let value: unknown

  try {
    value = await response.json()
  } catch {
    throw new AgentRouterProviderError("malformed_response")
  }

  if (!isRecord(value)) {
    throw new AgentRouterProviderError("malformed_response")
  }

  return value
}

function extractTextContent(response: AgentRouterMessagesResponse):
  | {
      ok: true
      text: string
      contentBlockTypes: string[]
      stopReason: string | null
    }
  | {
      ok: false
      error: string
    } {
  if (!Array.isArray(response.content)) {
    return validationError("AgentRouter response content must be an array")
  }

  const textParts: string[] = []
  const contentBlockTypes: string[] = []

  for (const block of response.content) {
    if (!isRecord(block)) {
      return validationError("AgentRouter response content block is invalid")
    }

    const blockType = block.type

    if (typeof blockType === "string") {
      contentBlockTypes.push(blockType)
    }

    if (blockType === "text") {
      if (typeof block.text !== "string") {
        return validationError("AgentRouter text content block is invalid")
      }

      textParts.push(block.text)
    }
  }

  const text = textParts.join("").trim()

  if (text.length === 0) {
    return validationError("AgentRouter response did not contain text JSON")
  }

  return {
    ok: true,
    text,
    contentBlockTypes,
    stopReason: readOptionalString(response.stop_reason) || null,
  }
}

function parseJson(value: string): ValidationResult<unknown> {
  try {
    return {
      ok: true,
      data: JSON.parse(value) as unknown,
    }
  } catch {
    return validationError("AgentRouter structured output was not valid JSON")
  }
}

function createTimeoutSignal(signal?: AbortSignal): {
  signal: AbortSignal
  dispose: () => void
} {
  const controller = new AbortController()
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
    controller.abort()
  }, AGENTROUTER_TIMEOUT_MS)
  const abortFromCaller = () => controller.abort()

  if (signal?.aborted) {
    controller.abort()
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true })
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener("abort", abortFromCaller)
    },
  }
}

function failureCodeForProviderStatus(status: number): AgentRouterFailureCode {
  if (status === 401 || status === 403) {
    return "provider_auth_error"
  }

  if (status === 429) {
    return "provider_rate_limited"
  }

  return "provider_error"
}

function safeProviderMessage(code: AgentRouterFailureCode): string {
  switch (code) {
    case "provider_auth_error":
      return "AgentRouter authentication failed"
    case "provider_rate_limited":
      return "AgentRouter rate limit was reached"
    case "malformed_response":
      return "AgentRouter response was malformed"
    default:
      return "AgentRouter provider call failed"
  }
}

function agentRouterFailure(
  code: AgentRouterFailureCode,
  error: string,
  options?: { status?: number }
): AgentRouterCallResult<never> {
  return {
    ok: false,
    code,
    error,
    ...(options?.status !== undefined ? { status: options.status } : {}),
  }
}

function asObject(value: unknown): ValidationResult<Record<string, unknown>> {
  if (!isRecord(value)) {
    return validationError("Smoke response must be an object")
  }

  return {
    ok: true,
    data: value,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readOptionalString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function validationError(error: string): { ok: false; error: string } {
  return {
    ok: false,
    error,
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

function logSafeAgentRouterError(error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return
  }

  console.warn("AgentRouter diagnostic", {
    name: error instanceof Error ? error.name : "UnknownError",
  })
}
