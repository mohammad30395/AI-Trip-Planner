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
  parseFinalItineraryResponse,
  type FinalItineraryResponse,
} from "./contract"
import {
  groqFinalItineraryWireSchema,
  normalizeGroqFinalItineraryWire,
} from "./groq-final-schema"
import { validateItineraryDuration } from "./itinerary"

const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const GROQ_CONVERSATION_TIMEOUT_MS = 30_000
const GROQ_SMOKE_TIMEOUT_MS = GROQ_CONVERSATION_TIMEOUT_MS
const GROQ_FINAL_ITINERARY_TIMEOUT_MS = 90_000
const GROQ_FINAL_MAX_COMPLETION_TOKENS_CAP = 4_800

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

type GroqFinalDiagnosticStage =
  | "CONFIG"
  | "MODEL_ACCESS"
  | "REQUEST_BUILD"
  | "PROVIDER_REQUEST"
  | "PROVIDER_RESPONSE"
  | "CONTENT_EXTRACTION"
  | "JSON_PARSE"
  | "WIRE_NORMALIZATION"
  | "RUNTIME_VALIDATION"
  | "DURATION_VALIDATION"
  | "SUCCESS"

type GroqFinalDiagnosticCode =
  | "configuration"
  | "request_rejected"
  | "unsupported_parameter"
  | "authentication_error"
  | "permission_error"
  | "model_or_endpoint_not_found"
  | "request_too_large"
  | "structured_output_or_semantic_failure"
  | "rate_limited"
  | "capacity_exceeded"
  | "request_cancelled"
  | "provider_error"
  | "provider_timeout"
  | "empty_response"
  | "invalid_json"
  | "schema_validation"
  | "duration_validation"
  | "output_truncated"
  | "success"

type GroqFinalDiagnostic = {
  normalizedFailureCode: GroqFinalDiagnosticCode
  stage: GroqFinalDiagnosticStage
  strictSchemaReachedProvider: boolean
  responseFormatAccepted?: boolean
  providerContentReturned: boolean
  httpStatus?: number
  providerErrorCategory?: GroqFinalDiagnosticCode
  providerErrorType?: string
  finishReason?: string
  retryAfterSeconds?: number
  rateLimit?: GroqRateLimit
  jsonParsed: boolean
  wireNormalized: boolean
  runtimeValidated: boolean
  durationValidated: boolean
}

type GroqFailure = {
  ok: false
  code: GroqFailureCode
  error: string
  missingVariables?: string[]
  retryAfterSeconds?: number
  diagnostic?: GroqFinalDiagnostic
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

type GroqStrictCapabilityProviderObservation =
  | {
      ok: true
      finishReason?: string
      usage?: GroqUsage
    }
  | {
      ok: false
      error: unknown
    }

type GroqStrictCapabilityDiagnosticOptions = {
  maxCompletionTokens?: number
  schema?: Record<string, unknown>
  userMessage?: string
  validateResponse?: (value: unknown) => boolean
  observeProviderOutcome?: (
    observation: GroqStrictCapabilityProviderObservation
  ) => void
}

type GroqFinalItineraryRequest = {
  messages: GroqConversationMessage[]
  durationDays: number
  maxCompletionTokens?: number
}

type GroqUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

type GroqRateLimit = {
  limitTokensPerMinute?: number
  remainingTokens?: number
  resetTokensSeconds?: number
}

type GroqFinalItineraryResult = {
  response: FinalItineraryResponse
  modelReturned: boolean
  usage?: GroqUsage
  rateLimit?: GroqRateLimit
  diagnostic: GroqFinalDiagnostic
}

type GroqStructuredOutputRequest = {
  messages: GroqConversationMessage[]
  schemaName: string
  schema: Record<string, unknown>
  strict: boolean
  maxCompletionTokens: number
  temperature?: number
  observeProviderOutcome?: (
    observation: GroqStrictCapabilityProviderObservation
  ) => void
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

function createGroqClient(
  config: GroqConfig,
  timeout = GROQ_CONVERSATION_TIMEOUT_MS
) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: GROQ_BASE_URL,
    timeout,
    maxRetries: 0,
  })
}

function getGroqFinalMaxCompletionTokens(durationDays: number) {
  const boundedDuration = Math.min(30, Math.max(1, Math.trunc(durationDays)))

  return Math.min(
    GROQ_FINAL_MAX_COMPLETION_TOKENS_CAP,
    1_200 + boundedDuration * 500
  )
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

async function runGroqFinalItinerary(
  request: GroqFinalItineraryRequest,
  signal?: AbortSignal
): Promise<GroqCallResult<GroqFinalItineraryResult>> {
  const config = getGroqConfig()

  if (!config.ok) {
    return {
      ...config,
      diagnostic: createGroqFinalDiagnostic("configuration", "CONFIG"),
    }
  }

  const client = createGroqClient(config.data, GROQ_FINAL_ITINERARY_TIMEOUT_MS)

  try {
    const completionRequest = client.chat.completions.create(
      {
        model: config.data.model,
        messages: request.messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "groq_final_itinerary_wire_response",
            strict: true,
            schema: groqFinalItineraryWireSchema,
          },
        },
        temperature: 0.4,
        max_completion_tokens:
          request.maxCompletionTokens ??
          getGroqFinalMaxCompletionTokens(request.durationDays),
      },
      {
        signal,
        timeout: GROQ_FINAL_ITINERARY_TIMEOUT_MS,
      }
    )
    const { data: completion, response } = await completionRequest.withResponse()
    const choice = completion.choices[0]
    const content = choice?.message.content
    const providerContentReturned = Boolean(content?.trim())
    const finishReason = getSafeFinishReason(choice?.finish_reason)
    const usage = getSafeGroqUsage(completion.usage)
    const rateLimit = getSafeGroqRateLimit(response.headers)

    if (choice?.finish_reason === "length") {
      return groqFailure(
        "output_truncated",
        "Groq response reached its output limit.",
        {
          diagnostic: createGroqFinalDiagnostic(
            "output_truncated",
            "PROVIDER_RESPONSE",
            {
              strictSchemaReachedProvider: true,
              responseFormatAccepted: true,
              providerContentReturned,
              ...(finishReason !== undefined ? { finishReason } : {}),
              ...(rateLimit !== undefined ? { rateLimit } : {}),
            }
          ),
        }
      )
    }

    if (!content?.trim()) {
      return groqFailure("empty_response", "Groq returned an empty response.", {
        diagnostic: createGroqFinalDiagnostic(
          "empty_response",
          "PROVIDER_RESPONSE",
          {
            strictSchemaReachedProvider: true,
            responseFormatAccepted: true,
            ...(finishReason !== undefined ? { finishReason } : {}),
            ...(rateLimit !== undefined ? { rateLimit } : {}),
          }
        ),
      })
    }

    const parsedJson = parseJson(content)

    if (!parsedJson.ok) {
      return groqFailure("invalid_json", parsedJson.error, {
        diagnostic: createGroqFinalDiagnostic(
          "invalid_json",
          "CONTENT_EXTRACTION",
          {
            strictSchemaReachedProvider: true,
            responseFormatAccepted: true,
            providerContentReturned: true,
            ...(finishReason !== undefined ? { finishReason } : {}),
            ...(rateLimit !== undefined ? { rateLimit } : {}),
          }
        ),
      })
    }

    const normalizedWireValue = normalizeGroqFinalItineraryWire(parsedJson.data)
    const parsedResponse = parseFinalItineraryResponse(normalizedWireValue)

    if (!parsedResponse.ok) {
      return groqFailure(
        "schema_validation",
        "Groq final itinerary failed runtime validation.",
        {
          diagnostic: createGroqFinalDiagnostic(
            "schema_validation",
            "WIRE_NORMALIZATION",
            {
              strictSchemaReachedProvider: true,
              responseFormatAccepted: true,
              providerContentReturned: true,
              finishReason,
              rateLimit,
              jsonParsed: true,
              wireNormalized: true,
            }
          ),
        }
      )
    }

    const durationValidation = validateItineraryDuration(
      parsedResponse.data,
      request.durationDays
    )

    if (!durationValidation.ok) {
      return groqFailure(
        "schema_validation",
        "Groq final itinerary failed duration validation.",
        {
          diagnostic: createGroqFinalDiagnostic(
            "duration_validation",
            "RUNTIME_VALIDATION",
            {
              strictSchemaReachedProvider: true,
              responseFormatAccepted: true,
              providerContentReturned: true,
              finishReason,
              rateLimit,
              jsonParsed: true,
              wireNormalized: true,
              runtimeValidated: true,
            }
          ),
        }
      )
    }

    return {
      ok: true,
      data: {
        response: durationValidation.data,
        modelReturned: completion.model.length > 0,
        ...(usage !== undefined ? { usage } : {}),
        ...(rateLimit !== undefined ? { rateLimit } : {}),
        diagnostic: createGroqFinalDiagnostic("success", "SUCCESS", {
          strictSchemaReachedProvider: true,
          responseFormatAccepted: true,
          providerContentReturned: true,
          finishReason,
          rateLimit,
          jsonParsed: true,
          wireNormalized: true,
          runtimeValidated: true,
          durationValidated: true,
        }),
      },
    }
  } catch (error) {
    return normalizeGroqError(error, "PROVIDER_REQUEST")
  }
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
  signal?: AbortSignal,
  diagnosticOptions?: GroqStrictCapabilityDiagnosticOptions
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
            diagnosticOptions?.userMessage ??
            "Return ok as true and a very short message confirming strict structured output.",
        },
      ],
      schemaName: "groq_strict_capability_smoke",
      schema: diagnosticOptions?.schema ?? groqStrictCapabilitySchema,
      strict: true,
      maxCompletionTokens: diagnosticOptions?.maxCompletionTokens ?? 256,
      ...(diagnosticOptions?.observeProviderOutcome !== undefined
        ? {
            observeProviderOutcome:
              diagnosticOptions.observeProviderOutcome,
          }
        : {}),
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

  const validateResponse =
    diagnosticOptions?.validateResponse ?? isValidStrictCapabilityResponse

  if (!validateResponse(parsedJson.data)) {
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

    request.observeProviderOutcome?.({
      ok: true,
      ...(getSafeFinishReason(choice?.finish_reason) !== undefined
        ? { finishReason: getSafeFinishReason(choice?.finish_reason) }
        : {}),
      ...(getSafeGroqUsage(completion.usage) !== undefined
        ? { usage: getSafeGroqUsage(completion.usage) }
        : {}),
    })

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
    request.observeProviderOutcome?.({ ok: false, error })
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

function normalizeGroqError(
  error: unknown,
  finalStage?: GroqFinalDiagnosticStage
): GroqFailure {
  const status = getErrorStatus(error)
  const diagnostic =
    finalStage === undefined
      ? undefined
      : createGroqProviderFailureDiagnostic(error, finalStage)

  if (error instanceof RateLimitError || status === 429) {
    const retryAfterSeconds = getSafeRetryAfterSeconds(error)

    return groqFailure("rate_limited", "Groq rate limit was reached.", {
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      ...(diagnostic !== undefined ? { diagnostic } : {}),
    })
  }

  if (
    error instanceof APIConnectionTimeoutError ||
    error instanceof APIUserAbortError ||
    isPlatformTimeoutError(error)
  ) {
    return groqFailure("provider_timeout", "Groq provider request timed out.", {
      ...(diagnostic !== undefined ? { diagnostic } : {}),
    })
  }

  logSafeGroqError(error)

  return groqFailure("provider_error", "Groq provider request failed.", {
    ...(diagnostic !== undefined ? { diagnostic } : {}),
  })
}

function getErrorStatus(error: unknown) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined

  return status !== undefined && Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : undefined
}

function getSafeRetryAfterSeconds(error: unknown) {
  const headers = getErrorHeaders(error)

  if (headers === undefined) {
    return undefined
  }

  const value = headers.get("retry-after")

  if (value === null) {
    return undefined
  }

  const seconds = Number(value)

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined
  }

  return Math.min(3_600, Math.ceil(seconds))
}

function getSafeGroqUsage(
  usage:
    | {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
    | undefined
): GroqUsage | undefined {
  if (
    usage === undefined ||
    !isSafeNonNegativeInteger(usage.prompt_tokens) ||
    !isSafeNonNegativeInteger(usage.completion_tokens) ||
    !isSafeNonNegativeInteger(usage.total_tokens)
  ) {
    return undefined
  }

  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  }
}

function getSafeGroqRateLimit(headers: Headers): GroqRateLimit | undefined {
  const limitTokensPerMinute = getSafeHeaderInteger(
    headers,
    "x-ratelimit-limit-tokens"
  )
  const remainingTokens = getSafeHeaderInteger(
    headers,
    "x-ratelimit-remaining-tokens"
  )
  const resetTokensSeconds = getSafeResetSeconds(
    headers.get("x-ratelimit-reset-tokens")
  )

  if (
    limitTokensPerMinute === undefined &&
    remainingTokens === undefined &&
    resetTokensSeconds === undefined
  ) {
    return undefined
  }

  return {
    ...(limitTokensPerMinute !== undefined ? { limitTokensPerMinute } : {}),
    ...(remainingTokens !== undefined ? { remainingTokens } : {}),
    ...(resetTokensSeconds !== undefined ? { resetTokensSeconds } : {}),
  }
}

function getSafeResetSeconds(value: string | null) {
  if (value === null) {
    return undefined
  }

  const match = /^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(
    value.trim()
  )

  if (match === null || (match[1] === undefined && match[2] === undefined)) {
    return undefined
  }

  const seconds = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)

  if (!Number.isFinite(seconds) || seconds < 0) {
    return undefined
  }

  return Math.min(86_400, Math.ceil(seconds))
}

function getSafeHeaderInteger(headers: Headers, name: string) {
  const value = headers.get(name)

  if (value === null) {
    return undefined
  }

  const numericValue = Number(value)

  return isSafeNonNegativeInteger(numericValue) ? numericValue : undefined
}

function isSafeNonNegativeInteger(value: number) {
  return Number.isSafeInteger(value) && value >= 0
}

function isPlatformTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
}

function createGroqProviderFailureDiagnostic(
  error: unknown,
  stage: GroqFinalDiagnosticStage
): GroqFinalDiagnostic {
  const status = getErrorStatus(error)
  const normalizedFailureCode = getGroqDiagnosticCode(error, status)
  const retryAfterSeconds = getSafeRetryAfterSeconds(error)
  const headers = getErrorHeaders(error)
  const rateLimit =
    headers === undefined ? undefined : getSafeGroqRateLimit(headers)
  const providerErrorType = getSafeProviderErrorType(error)

  return createGroqFinalDiagnostic(normalizedFailureCode, stage, {
    strictSchemaReachedProvider: status !== undefined,
    ...(status === 400
      ? { responseFormatAccepted: false }
      : status === 422
        ? { responseFormatAccepted: true }
        : {}),
    ...(status !== undefined ? { httpStatus: status } : {}),
    providerErrorCategory: normalizedFailureCode,
    ...(providerErrorType !== undefined ? { providerErrorType } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    ...(rateLimit !== undefined ? { rateLimit } : {}),
  })
}

function createGroqFinalDiagnostic(
  normalizedFailureCode: GroqFinalDiagnosticCode,
  stage: GroqFinalDiagnosticStage,
  details: Partial<
    Omit<GroqFinalDiagnostic, "normalizedFailureCode" | "stage">
  > = {}
): GroqFinalDiagnostic {
  return {
    normalizedFailureCode,
    stage,
    strictSchemaReachedProvider: false,
    providerContentReturned: false,
    jsonParsed: false,
    wireNormalized: false,
    runtimeValidated: false,
    durationValidated: false,
    ...details,
  }
}

function getGroqDiagnosticCode(
  error: unknown,
  status: number | undefined
): GroqFinalDiagnosticCode {
  if (
    error instanceof APIConnectionTimeoutError ||
    error instanceof APIUserAbortError ||
    isPlatformTimeoutError(error)
  ) {
    return "provider_timeout"
  }

  switch (status) {
    case 400:
      return isUnsupportedParameterError(error)
        ? "unsupported_parameter"
        : "request_rejected"
    case 401:
      return "authentication_error"
    case 403:
      return "permission_error"
    case 404:
      return "model_or_endpoint_not_found"
    case 413:
      return "request_too_large"
    case 422:
      return "structured_output_or_semantic_failure"
    case 429:
      return "rate_limited"
    case 498:
      return "capacity_exceeded"
    case 499:
      return "request_cancelled"
    case 500:
    case 502:
    case 503:
      return "provider_error"
    default:
      return "provider_error"
  }
}

function isUnsupportedParameterError(error: unknown) {
  const unsupportedParameterNames = new Set([
    "frequency_penalty",
    "logit_bias",
    "logprobs",
    "messages[].name",
    "metadata",
    "n",
    "presence_penalty",
    "top_logprobs",
  ])
  const param = getStringProperty(error, "param")

  if (param !== undefined && unsupportedParameterNames.has(param)) {
    return true
  }

  const code = getStringProperty(error, "code")?.toLowerCase()
  const message = error instanceof Error ? error.message.toLowerCase() : ""

  return (
    code === "unsupported_parameter" ||
    message.includes("unsupported parameter") ||
    message.includes("parameter is not supported") ||
    message.includes("unknown parameter") ||
    message.includes("unrecognized request argument")
  )
}

function getSafeProviderErrorType(error: unknown) {
  const type = getStringProperty(error, "type")

  return type !== undefined && safeGroqProviderErrorTypes.has(type)
    ? type
    : undefined
}

function getStringProperty(
  error: unknown,
  property: string
): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !(property in error)
  ) {
    return undefined
  }

  const value = (error as Record<string, unknown>)[property]

  return typeof value === "string" ? value : undefined
}

function getErrorHeaders(error: unknown) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("headers" in error) ||
    !(error.headers instanceof Headers)
  ) {
    return undefined
  }

  return error.headers
}

function getSafeFinishReason(value: string | null | undefined) {
  return value !== undefined && value !== null && safeGroqFinishReasons.has(value)
    ? value
    : undefined
}

const safeGroqProviderErrorTypes = new Set([
  "api_error",
  "authentication_error",
  "invalid_request_error",
  "not_found_error",
  "permission_error",
  "rate_limit_error",
  "server_error",
])

const safeGroqFinishReasons = new Set([
  "stop",
  "length",
  "content_filter",
  "tool_calls",
  "function_call",
])

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
    "diagnostic" | "missingVariables" | "retryAfterSeconds"
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
  runGroqFinalItinerary,
  runGroqStrictCapabilitySmoke,
  getGroqFinalMaxCompletionTokens,
  GROQ_BASE_URL,
  GROQ_CONVERSATION_TIMEOUT_MS,
  GROQ_FINAL_ITINERARY_TIMEOUT_MS,
  GROQ_FINAL_MAX_COMPLETION_TOKENS_CAP,
  GROQ_SMOKE_TIMEOUT_MS,
  type GroqCallResult,
  type GroqConversationMessage,
  type GroqFailureCode,
  type GroqFinalDiagnostic,
  type GroqFinalDiagnosticCode,
  type GroqFinalDiagnosticStage,
  type GroqFinalItineraryRequest,
  type GroqStrictCapabilityDiagnosticOptions,
  type GroqStrictCapabilityProviderObservation,
}
