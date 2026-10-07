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

const controlProbeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "label"],
  properties: {
    ok: { type: "boolean" },
    label: { type: "string" },
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
        strictProbePlaceSchema("specific_place", { type: "string" }),
        strictProbePlaceSchema("generic_activity", { type: "null" }),
        strictProbePlaceSchema("transport", { type: "null" }),
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

function strictProbePlaceSchema(
  kind: "specific_place" | "generic_activity" | "transport",
  nameSchema: { readonly type: "string" } | { readonly type: "null" }
) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "kind",
      "name",
      "addressHint",
      "areaHint",
      "originHint",
      "destinationHint",
    ],
    properties: {
      kind: { type: "string", enum: [kind] },
      name: nameSchema,
      addressHint: { type: ["string", "null"] },
      areaHint: { type: ["string", "null"] },
      originHint: { type: ["string", "null"] },
      destinationHint: { type: ["string", "null"] },
    },
  } as const
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
    .replace(/\bBearer\s+[^\s"'`]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:gsk_|sk-)[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()

  return sanitized.length > 0 ? sanitized.slice(0, maxLength) : undefined
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export {
  currentPlaceWireSchema,
  groqSchemaProbeSchemas,
  sanitizeGroqSchemaProbeError,
  type GroqSchemaProbeDiagnostic,
  type JsonSchema,
}
