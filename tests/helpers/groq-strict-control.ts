import { appendFileSync, readFileSync } from "node:fs"

import type {
  GroqStrictCapabilityProviderObservation,
} from "@/lib/ai/groq"
import {
  getErrorHeaders,
  sanitizeGroqSchemaProbeError,
} from "@/tests/helpers/groq-schema-probes"

type FailedGenerationKind =
  | "empty"
  | "text"
  | "json_like"
  | "budget_exhausted"
  | "other"

type FailedGenerationSummary = {
  present: boolean
  kind: FailedGenerationKind
  length: number
  jsonParseable: boolean
  topLevelKeys: string[]
  mentionsTokenLimit: boolean
  mentionsNoChoices: boolean
  sanitizedPreview: string | null
}

type StrictControlVariant = "historical-step2" | "token-budget-128"

type StrictControlRecord = {
  attempt: number
  variant: StrictControlVariant
  accepted: boolean
  httpStatus: number | null
  errorType: string | null
  errorCode: string | null
  finishReason: string | null
  maxCompletionTokens: number
  reasoningEffort: null
  failedGenerationSummary: FailedGenerationSummary
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  tokenLimit: number | null
  remainingTokens: number | null
  resetSeconds: number | null
}

type StrictControlRequestSnapshot = {
  api: "chat.completions.create"
  modelSource: "GROQ_MODEL"
  messages: readonly { role: "system" | "user"; content: string }[]
  schemaName: string
  schema: Record<string, unknown>
  strict: true
  temperature: number | null
  maxCompletionTokens: number
  reasoningEffort: null
  includeReasoning: null
  stream: null
  tools: null
  timeoutMs: 30_000
  retries: 0
  clientInvocation: string
}

type StrictControlRequestDifference = {
  setting: keyof StrictControlRequestSnapshot
  historical: unknown
  probe: unknown
}

const historicalStep2ControlRequest: StrictControlRequestSnapshot = {
  api: "chat.completions.create",
  modelSource: "GROQ_MODEL",
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
  schema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      message: { type: "string", minLength: 1 },
    },
    required: ["ok", "message"],
    additionalProperties: false,
  },
  strict: true,
  temperature: null,
  maxCompletionTokens: 256,
  reasoningEffort: null,
  includeReasoning: null,
  stream: null,
  tools: null,
  timeoutMs: 30_000,
  retries: 0,
  clientInvocation:
    "runGroqStrictCapabilitySmoke -> runGroqStructuredOutput -> chat.completions.create",
}

const step4A2RControlRequest: StrictControlRequestSnapshot = {
  api: "chat.completions.create",
  modelSource: "GROQ_MODEL",
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
  schemaName: "probe_control",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["ok", "message"],
    properties: {
      ok: { type: "boolean" },
      message: { type: "string" },
    },
  },
  strict: true,
  temperature: 0,
  maxCompletionTokens: 128,
  reasoningEffort: null,
  includeReasoning: null,
  stream: null,
  tools: null,
  timeoutMs: 30_000,
  retries: 0,
  clientInvocation: "direct test OpenAI client -> create().withResponse()",
}

function diffStrictControlRequests(
  historical: StrictControlRequestSnapshot,
  probe: StrictControlRequestSnapshot
) {
  const keys = Object.keys(historical) as (keyof StrictControlRequestSnapshot)[]

  return keys.flatMap<StrictControlRequestDifference>((setting) =>
    JSON.stringify(historical[setting]) === JSON.stringify(probe[setting])
      ? []
      : [
          {
            setting,
            historical: historical[setting],
            probe: probe[setting],
          },
        ]
  )
}

function summarizeFailedGeneration(
  error: unknown,
  configuredSecret?: string
): FailedGenerationSummary {
  const failedGeneration = extractFailedGeneration(error)

  if (!failedGeneration.present) {
    return emptyFailedGenerationSummary(false)
  }

  const serialized = serializeFailedGeneration(failedGeneration.value)
  const trimmed = serialized.trim()

  if (trimmed.length === 0) {
    return emptyFailedGenerationSummary(true)
  }

  const parsed = parseJsonValue(trimmed)
  const mentionsTokenLimit =
    /(?:max(?:imum)?[\s_-]*(?:completion[\s_-]*)?tokens?|token[\s_-]*limit|budget[\s_-]*exhausted|finish_reason["']?\s*:\s*["']length)/i.test(
      trimmed
    )
  const mentionsNoChoices = /(?:no[\s_-]*choices|choices["']?\s*:\s*\[\s*\])/i.test(
    trimmed
  )
  const jsonLike =
    parsed.ok || trimmed.startsWith("{") || trimmed.startsWith("[")
  const containsReasoningTrace =
    /<\/?think>|<\/?analysis>|["']reasoning["']\s*:/i.test(trimmed)

  return {
    present: true,
    kind: mentionsTokenLimit
      ? "budget_exhausted"
      : jsonLike
        ? "json_like"
        : typeof failedGeneration.value === "string"
          ? "text"
          : "other",
    length: serialized.length,
    jsonParseable: parsed.ok,
    topLevelKeys: parsed.ok ? getSafeTopLevelKeys(parsed.value) : [],
    mentionsTokenLimit,
    mentionsNoChoices,
    sanitizedPreview: containsReasoningTrace
      ? null
      : sanitizeFailedGenerationPreview(trimmed, configuredSecret),
  }
}

function createStrictControlRecord({
  attempt,
  variant,
  maxCompletionTokens,
  accepted,
  observation,
  configuredSecret,
  normalizedErrorCode,
}: {
  attempt: number
  variant: StrictControlVariant
  maxCompletionTokens: number
  accepted: boolean
  observation: GroqStrictCapabilityProviderObservation
  configuredSecret?: string
  normalizedErrorCode?: string
}): StrictControlRecord {
  const diagnostic = observation.ok
    ? undefined
    : sanitizeGroqSchemaProbeError(observation.error, configuredSecret)
  const rateLimit = observation.ok
    ? emptyRateLimit()
    : getSafeStrictControlRateLimit(getErrorHeaders(observation.error))
  const usage = observation.ok ? observation.usage : undefined

  return {
    attempt,
    variant,
    accepted,
    httpStatus: observation.ok ? 200 : diagnostic?.httpStatus ?? null,
    errorType: observation.ok ? null : diagnostic?.errorType ?? null,
    errorCode: diagnostic?.errorCode ?? normalizedErrorCode ?? null,
    finishReason: observation.ok ? observation.finishReason ?? null : null,
    maxCompletionTokens,
    reasoningEffort: null,
    failedGenerationSummary: observation.ok
      ? emptyFailedGenerationSummary(false)
      : summarizeFailedGeneration(observation.error, configuredSecret),
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
    tokenLimit: rateLimit.tokenLimit,
    remainingTokens: rateLimit.remainingTokens,
    resetSeconds: rateLimit.resetSeconds,
  }
}

function appendStrictControlRecord(
  reportPath: string,
  record: StrictControlRecord
) {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  })
}

function readStrictControlRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parseStrictControlRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function extractFailedGeneration(error: unknown) {
  const outer = asRecord(error)
  const provider = asRecord(outer?.error)

  if (provider !== undefined && "failed_generation" in provider) {
    return { present: true, value: provider.failed_generation }
  }

  if (outer !== undefined && "failed_generation" in outer) {
    return { present: true, value: outer.failed_generation }
  }

  return { present: false, value: undefined }
}

function serializeFailedGeneration(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  if (value === undefined || value === null) {
    return ""
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function parseJsonValue(value: string):
  | { ok: true; value: unknown }
  | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown }
  } catch {
    return { ok: false }
  }
}

function getSafeTopLevelKeys(value: unknown) {
  const record = asRecord(value)

  if (record === undefined) {
    return []
  }

  return Object.keys(record)
    .filter((key) => /^[A-Za-z0-9_.-]{1,80}$/.test(key))
    .slice(0, 20)
}

function sanitizeFailedGenerationPreview(
  value: string,
  configuredSecret?: string
) {
  let sanitized = value

  if (configuredSecret?.trim()) {
    sanitized = sanitized
      .split(configuredSecret.trim())
      .join("[REDACTED]")
  }

  sanitized = sanitized
    .replace(/\bBearer\s+[^\s"'\x60]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:gsk_|sk-)[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()

  return sanitized.length > 0 ? sanitized.slice(0, 300) : null
}

function emptyFailedGenerationSummary(
  present: boolean
): FailedGenerationSummary {
  return {
    present,
    kind: "empty",
    length: 0,
    jsonParseable: false,
    topLevelKeys: [],
    mentionsTokenLimit: false,
    mentionsNoChoices: false,
    sanitizedPreview: null,
  }
}

function getSafeStrictControlRateLimit(headers: Headers | undefined) {
  if (headers === undefined) {
    return emptyRateLimit()
  }

  return {
    tokenLimit: getSafeHeaderInteger(headers, "x-ratelimit-limit-tokens"),
    remainingTokens: getSafeHeaderInteger(
      headers,
      "x-ratelimit-remaining-tokens"
    ),
    resetSeconds: getSafeResetSeconds(
      headers.get("x-ratelimit-reset-tokens")
    ),
  }
}

function emptyRateLimit() {
  return {
    tokenLimit: null,
    remainingTokens: null,
    resetSeconds: null,
  }
}

function getSafeHeaderInteger(headers: Headers, name: string) {
  const value = headers.get(name)

  if (value === null) {
    return null
  }

  const numericValue = Number(value)
  return Number.isSafeInteger(numericValue) && numericValue >= 0
    ? numericValue
    : null
}

function getSafeResetSeconds(value: string | null) {
  if (value === null) {
    return null
  }

  const match = /^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(
    value.trim()
  )

  if (match === null || (match[1] === undefined && match[2] === undefined)) {
    return null
  }

  const seconds = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(86_400, Math.ceil(seconds))
    : null
}

function parseStrictControlRecord(value: unknown, lineNumber: number) {
  const record = asRecord(value)

  if (
    record === undefined ||
    !Number.isSafeInteger(record.attempt) ||
    (record.variant !== "historical-step2" &&
      record.variant !== "token-budget-128") ||
    typeof record.accepted !== "boolean" ||
    !isNullableNumber(record.httpStatus) ||
    !isNullableString(record.errorType) ||
    !isNullableString(record.errorCode) ||
    !isNullableString(record.finishReason) ||
    !Number.isSafeInteger(record.maxCompletionTokens) ||
    record.reasoningEffort !== null ||
    !isFailedGenerationSummary(record.failedGenerationSummary) ||
    !isNullableNumber(record.inputTokens) ||
    !isNullableNumber(record.outputTokens) ||
    !isNullableNumber(record.totalTokens) ||
    !isNullableNumber(record.tokenLimit) ||
    !isNullableNumber(record.remainingTokens) ||
    !isNullableNumber(record.resetSeconds)
  ) {
    throw new Error(`Invalid strict-control record on JSONL line ${lineNumber}.`)
  }

  return record as StrictControlRecord
}

function isFailedGenerationSummary(value: unknown) {
  const summary = asRecord(value)
  const kinds = new Set<FailedGenerationKind>([
    "empty",
    "text",
    "json_like",
    "budget_exhausted",
    "other",
  ])

  return (
    summary !== undefined &&
    typeof summary.present === "boolean" &&
    typeof summary.kind === "string" &&
    kinds.has(summary.kind as FailedGenerationKind) &&
    typeof summary.length === "number" &&
    Number.isSafeInteger(summary.length) &&
    typeof summary.jsonParseable === "boolean" &&
    Array.isArray(summary.topLevelKeys) &&
    summary.topLevelKeys.every((key) => typeof key === "string") &&
    typeof summary.mentionsTokenLimit === "boolean" &&
    typeof summary.mentionsNoChoices === "boolean" &&
    isNullableString(summary.sanitizedPreview)
  )
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value))
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export {
  appendStrictControlRecord,
  createStrictControlRecord,
  diffStrictControlRequests,
  historicalStep2ControlRequest,
  getSafeStrictControlRateLimit,
  readStrictControlRecords,
  step4A2RControlRequest,
  summarizeFailedGeneration,
  type FailedGenerationSummary,
  type StrictControlRecord,
  type StrictControlRequestDifference,
  type StrictControlRequestSnapshot,
  type StrictControlVariant,
}
