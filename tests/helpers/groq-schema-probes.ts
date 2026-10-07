import { appendFileSync, readFileSync } from "node:fs"

import { groqFinalItineraryWireSchema } from "@/lib/ai/groq-final-schema"

type JsonSchema = Record<string, unknown>

type GroqSchemaProbeDiagnostic = {
  httpStatus?: number
  errorType?: string
  errorCode?: string
  schemaPath?: string
  propertyPath?: string
  rejectedKeyword?: string
  message?: string
}

type GroqSchemaProbeRecord = {
  probe: number
  name: string
  attempted: boolean
  accepted: boolean
  httpStatus: number | null
  errorType: string | null
  errorCode: string | null
  schemaPath: string | null
  keyword: string | null
  message: string | null
  finishReason: string | null
  remainingTokens: number | null
  tokenLimit: number | null
  resetSeconds: number | null
}

type GroqSchemaProbeDefinition<Id extends string = string> = {
  id: Id
  probe: number
  name: string
}

type GroqSchemaProbeSequenceDecision<Definition> =
  | { next: Definition }
  | { stopReason: string }

type GroqSchemaProbeSequenceResult = {
  records: GroqSchemaProbeRecord[]
  stopReason: string
}

const controlProbeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "message"],
  properties: {
    ok: { type: "boolean" },
    message: { type: "string" },
  },
} as const

const nullableStringProbeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: {
    value: { type: ["string", "null"] },
  },
} as const

const currentNullableEnumProbeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: {
    value: {
      type: ["string", "null"],
      enum: ["budget", "mid-range", "premium", null],
    },
  },
} as const

const alternateNullableEnumProbeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: {
    value: {
      anyOf: [
        {
          type: "string",
          enum: ["budget", "mid-range", "premium"],
        },
        { type: "null" },
      ],
    },
  },
} as const

const discriminatedObjectAnyOfProbeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["place"],
  properties: {
    place: {
      anyOf: [
        strictTinyPlaceSchema("specific_place", { type: "string" }),
        strictTinyPlaceSchema("generic_activity", { type: "null" }),
      ],
    },
  },
} as const

const currentPlaceWireSchema =
  groqFinalItineraryWireSchema.properties.itinerary.items.properties.activities
    .items.properties.place

const exactPlaceSubtreeProbeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["place"],
  properties: {
    place: currentPlaceWireSchema,
  },
} as const

const groqSchemaProbeSchemas = {
  control: controlProbeSchema,
  nullableString: nullableStringProbeSchema,
  currentNullableEnum: currentNullableEnumProbeSchema,
  alternateNullableEnum: alternateNullableEnumProbeSchema,
  discriminatedObjectAnyOf: discriminatedObjectAnyOfProbeSchema,
  exactPlaceSubtree: exactPlaceSubtreeProbeSchema,
  fullCurrentSchema: groqFinalItineraryWireSchema,
} as const satisfies Record<string, JsonSchema>

function strictTinyPlaceSchema(
  kind: "specific_place" | "generic_activity",
  nameSchema: { readonly type: "string" } | { readonly type: "null" }
) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["kind", "name"],
    properties: {
      kind: { type: "string", enum: [kind] },
      name: nameSchema,
    },
  } as const
}

function createGroqSchemaProbeRecord({
  probe,
  name,
  accepted,
  httpStatus,
  diagnostic,
  finishReason,
  headers,
}: {
  probe: number
  name: string
  accepted: boolean
  httpStatus?: number
  diagnostic?: GroqSchemaProbeDiagnostic
  finishReason?: string | null
  headers?: Headers
}): GroqSchemaProbeRecord {
  const rateLimit = getSafeProbeRateLimit(headers)

  return {
    probe,
    name,
    attempted: true,
    accepted,
    httpStatus: httpStatus ?? diagnostic?.httpStatus ?? null,
    errorType: diagnostic?.errorType ?? null,
    errorCode: diagnostic?.errorCode ?? null,
    schemaPath: diagnostic?.schemaPath ?? diagnostic?.propertyPath ?? null,
    keyword: diagnostic?.rejectedKeyword ?? null,
    message: diagnostic?.message ?? null,
    finishReason: sanitizeFinishReason(finishReason),
    remainingTokens: rateLimit.remainingTokens,
    tokenLimit: rateLimit.tokenLimit,
    resetSeconds: rateLimit.resetSeconds,
  }
}

function appendGroqSchemaProbeRecord(
  reportPath: string,
  record: GroqSchemaProbeRecord
) {
  appendFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  })
}

function readGroqSchemaProbeRecords(reportPath: string) {
  const contents = readFileSync(reportPath, "utf8")
  const lines = contents.split("\n").filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parseGroqSchemaProbeRecord(JSON.parse(line) as unknown, index + 1)
  )
}

async function runDurableGroqSchemaProbeSequence<
  Definition extends GroqSchemaProbeDefinition,
>({
  initial,
  reportPath,
  maximumRequests,
  attempt,
  decideNext,
}: {
  initial: Definition
  reportPath: string
  maximumRequests: number
  attempt: (definition: Definition) => Promise<GroqSchemaProbeRecord>
  decideNext: (
    definition: Definition,
    record: GroqSchemaProbeRecord
  ) => GroqSchemaProbeSequenceDecision<Definition>
}): Promise<GroqSchemaProbeSequenceResult> {
  const records: GroqSchemaProbeRecord[] = []
  let current = initial

  while (true) {
    if (records.length >= maximumRequests) {
      return { records, stopReason: "maximum_request_count" }
    }

    const record = await attempt(current)

    if (
      record.probe !== current.probe ||
      record.name !== current.name ||
      !record.attempted
    ) {
      throw new Error("Probe attempt returned an invalid durable record.")
    }

    appendGroqSchemaProbeRecord(reportPath, record)
    records.push(record)

    const decision = decideNext(current, record)

    if ("stopReason" in decision) {
      return { records, stopReason: decision.stopReason }
    }

    current = decision.next
  }
}

function sanitizeGroqSchemaProbeError(
  error: unknown,
  configuredSecret?: string
): GroqSchemaProbeDiagnostic {
  const outer = asRecord(error)
  const provider = asRecord(outer?.error)
  const message = sanitizeSchemaMessage(
    readString(provider, "message") ??
      readString(outer, "message") ??
      (error instanceof Error ? error.message : undefined),
    configuredSecret
  )
  const schemaPath = sanitizeShortText(
    firstString(provider, ["schema_path", "schemaPath"]),
    configuredSecret,
    200
  )
  const propertyPath = sanitizeShortText(
    firstString(provider, ["property_path", "propertyPath", "param"]),
    configuredSecret,
    200
  )
  const rejectedKeyword =
    sanitizeShortText(
      firstString(provider, ["rejected_keyword", "rejectedKeyword", "keyword"]),
      configuredSecret,
      80
    ) ?? findRejectedKeyword(message)

  return compactDiagnostic({
    httpStatus: readNumber(outer, "status"),
    errorType: sanitizeShortText(
      readString(provider, "type") ?? readString(outer, "type"),
      configuredSecret,
      80
    ),
    errorCode: sanitizeShortText(
      readString(provider, "code") ?? readString(outer, "code"),
      configuredSecret,
      80
    ),
    schemaPath,
    propertyPath,
    rejectedKeyword,
    message,
  })
}

function getErrorHeaders(error: unknown) {
  const outer = asRecord(error)
  return outer?.headers instanceof Headers ? outer.headers : undefined
}

function compactDiagnostic(
  diagnostic: GroqSchemaProbeDiagnostic
): GroqSchemaProbeDiagnostic {
  return Object.fromEntries(
    Object.entries(diagnostic).filter(([, value]) => value !== undefined)
  ) as GroqSchemaProbeDiagnostic
}

function sanitizeSchemaMessage(value: string | undefined, secret?: string) {
  const sanitized = sanitizeShortText(value, secret, 500)

  if (
    sanitized === undefined ||
    !/(schema|response[_ ]?format|json|additionalproperties|anyof|required|properties|enum|type|null)/i.test(
      sanitized
    )
  ) {
    return undefined
  }

  return sanitized
}

function sanitizeShortText(
  value: string | undefined,
  secret: string | undefined,
  maxLength: number
) {
  if (value === undefined) {
    return undefined
  }

  let sanitized = value

  if (secret?.trim()) {
    sanitized = sanitized.split(secret.trim()).join("[REDACTED]")
  }

  sanitized = sanitized
    .replace(/\bBearer\s+[^\s"'\x60]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:gsk_|sk-)[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()

  return sanitized.length > 0 ? sanitized.slice(0, maxLength) : undefined
}

function sanitizeFinishReason(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null
  }

  const safeFinishReasons = new Set([
    "stop",
    "length",
    "content_filter",
    "tool_calls",
    "function_call",
  ])

  return safeFinishReasons.has(value) ? value : null
}

function getSafeProbeRateLimit(headers: Headers | undefined) {
  if (headers === undefined) {
    return {
      remainingTokens: null,
      tokenLimit: null,
      resetSeconds: null,
    }
  }

  return {
    remainingTokens: readSafeHeaderInteger(
      headers,
      "x-ratelimit-remaining-tokens"
    ),
    tokenLimit: readSafeHeaderInteger(headers, "x-ratelimit-limit-tokens"),
    resetSeconds: readSafeResetSeconds(
      headers.get("x-ratelimit-reset-tokens")
    ),
  }
}

function readSafeHeaderInteger(headers: Headers, name: string) {
  const value = headers.get(name)

  if (value === null) {
    return null
  }

  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}

function readSafeResetSeconds(value: string | null) {
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

function parseGroqSchemaProbeRecord(value: unknown, lineNumber: number) {
  const record = asRecord(value)

  if (record === undefined) {
    throw new Error(`Invalid probe record on JSONL line ${lineNumber}.`)
  }

  const expectedKeys = [
    "probe",
    "name",
    "attempted",
    "accepted",
    "httpStatus",
    "errorType",
    "errorCode",
    "schemaPath",
    "keyword",
    "message",
    "finishReason",
    "remainingTokens",
    "tokenLimit",
    "resetSeconds",
  ] as const

  if (
    Object.keys(record).length !== expectedKeys.length ||
    expectedKeys.some((key) => !(key in record)) ||
    typeof record.probe !== "number" ||
    !Number.isFinite(record.probe) ||
    typeof record.name !== "string" ||
    record.attempted !== true ||
    typeof record.accepted !== "boolean" ||
    !isNullableFiniteNumber(record.httpStatus) ||
    !isNullableString(record.errorType) ||
    !isNullableString(record.errorCode) ||
    !isNullableString(record.schemaPath) ||
    !isNullableString(record.keyword) ||
    !isNullableString(record.message) ||
    !isNullableString(record.finishReason) ||
    !isNullableFiniteNumber(record.remainingTokens) ||
    !isNullableFiniteNumber(record.tokenLimit) ||
    !isNullableFiniteNumber(record.resetSeconds)
  ) {
    throw new Error(`Invalid probe record on JSONL line ${lineNumber}.`)
  }

  return record as GroqSchemaProbeRecord
}

function findRejectedKeyword(message: string | undefined) {
  if (message === undefined) {
    return undefined
  }

  const keywords = [
    "additionalProperties",
    "anyOf",
    "required",
    "properties",
    "enum",
    "type",
    "null",
  ] as const

  return keywords.find((keyword) =>
    message.toLowerCase().includes(keyword.toLowerCase())
  )
}

function firstString(record: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = readString(record, key)

    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

function readString(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key]
  return typeof value === "string" ? value : undefined
}

function readNumber(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value))
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export {
  appendGroqSchemaProbeRecord,
  createGroqSchemaProbeRecord,
  currentPlaceWireSchema,
  getErrorHeaders,
  groqSchemaProbeSchemas,
  readGroqSchemaProbeRecords,
  runDurableGroqSchemaProbeSequence,
  sanitizeGroqSchemaProbeError,
  type GroqSchemaProbeDefinition,
  type GroqSchemaProbeDiagnostic,
  type GroqSchemaProbeRecord,
  type GroqSchemaProbeSequenceDecision,
  type GroqSchemaProbeSequenceResult,
  type JsonSchema,
}
