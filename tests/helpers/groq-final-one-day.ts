import { readFileSync, writeFileSync } from "node:fs"

import type { FinalItineraryResponse } from "@/lib/ai/contract"
import { groqFinalItineraryWireSchema } from "@/lib/ai/groq-final-schema"
import type {
  GroqCallResult,
  GroqConversationMessage,
} from "@/lib/ai/groq"
import type { FinalItineraryRequirements } from "@/lib/ai/itinerary"
import { toStoredFinalItineraryPayload } from "@/lib/ai/itinerary-storage"

type JsonObject = Record<string, unknown>

type StrictSchemaValidation =
  | { ok: true }
  | { ok: false; errors: string[] }

type OneDayOutcomeClassification =
  | "ONE_DAY_FINAL_GENERATION_ACCEPTED"
  | "PROVIDER_REQUEST_REJECTED"
  | "GENERATION_FAILED"
  | "APPLICATION_VALIDATION_FAILED"

type OneDayDiagnosticRecord = {
  runIdentifier: "step4a3-one-day-run-1"
  modelIdentifier: "openai/gpt-oss-20b"
  requestedDurationDays: 1
  selectedCompletionBudget: 3500
  httpStatus: number | null
  providerErrorType: string | null
  providerErrorCode: string | null
  finishReason: string | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  latencyMs: number
  jsonParseValid: boolean | null
  wireSchemaValid: boolean | null
  normalizationValid: boolean | null
  applicationSchemaValid: boolean | null
  durationValid: boolean | null
  actualDayCount: number | null
  requiredContentValid: boolean | null
  placeObjectsValid: boolean | null
  forbiddenMetadataAbsent: boolean | null
  storageTransformationCompatible: boolean | null
  reasonablyCoherent: boolean | null
  rateLimit: {
    limitTokensPerMinute: number | null
    remainingTokens: number | null
    resetTokensSeconds: number | null
  }
  sanitizedErrorClassification: OneDayOutcomeClassification
  retryCount: 0
}

const oneDayRunIdentifier = "step4a3-one-day-run-1" as const
const expectedOneDayModel = "openai/gpt-oss-20b" as const
const oneDayExperimentalCompletionBudget = 3_500 as const
const forbiddenProviderFields = [
  "providerPlaceId",
  "providerId",
  "latitude",
  "longitude",
  "imageUrl",
  "photos",
  "rating",
  "availability",
] as const

const oneDayRequirements = {
  source: "Dhaka",
  destination: "Cox's Bazar",
  durationDays: 1,
  budgetTier: "mid-range",
  groupSize: 2,
  groupType: "couple",
} satisfies FinalItineraryRequirements

const completeOneDayWireFixture = {
  travelPlan: {
    source: "Dhaka",
    destination: "Cox's Bazar",
    durationDays: 1,
    budgetTier: "mid-range",
    groupSize: 2,
    groupType: "couple",
  },
  summary:
    "A compact one-day coastal visit with an overnight travel option and flexible pacing.",
  hotels: [
    {
      name: "Hotel Sea Crown",
      description: "A generated mid-range option near the beach area.",
      area: "Kolatoli",
      address: null,
      priceTier: "mid-range",
      estimatedPriceText: "Generated estimate: BDT 4,000-6,000 per night.",
    },
    {
      name: "Long Beach Hotel",
      description: "A generated alternative for a couple seeking central access.",
      area: null,
      address: null,
      priceTier: null,
      estimatedPriceText: "Generated estimate: mid-range nightly pricing.",
    },
  ],
  itinerary: [
    {
      dayNumber: 1,
      title: "Arrival and Cox's Bazar coast",
      activities: [
        {
          title: "Travel to Cox's Bazar",
          description: "Take a scheduled intercity connection from Dhaka.",
          timeOfDay: "morning",
          timeWindow: "Early morning",
          duration: "About 1-2 hours by air",
          estimatedPriceText: "Generated estimate: BDT 5,000-9,000 per person.",
          place: {
            kind: "transport",
            name: null,
            addressHint: null,
            areaHint: null,
            originHint: "Dhaka",
            destinationHint: "Cox's Bazar",
          },
        },
        {
          title: "Walk at Laboni Beach",
          description: "Enjoy a relaxed walk along the public beachfront.",
          timeOfDay: "afternoon",
          timeWindow: "2:00 PM-4:00 PM",
          duration: "2 hours",
          estimatedPriceText: "Free, excluding local transport and refreshments.",
          place: {
            kind: "specific_place",
            name: "Laboni Beach",
            addressHint: null,
            areaHint: "Cox's Bazar beachfront",
            originHint: null,
            destinationHint: null,
          },
        },
        {
          title: "Try a local seafood dinner",
          description: "Choose a suitable local restaurant after checking current options.",
          timeOfDay: "evening",
          timeWindow: "7:00 PM-8:30 PM",
          duration: null,
          estimatedPriceText: "Generated estimate: BDT 1,000-2,000 for two.",
          place: {
            kind: "generic_activity",
            name: null,
            addressHint: null,
            areaHint: null,
            originHint: null,
            destinationHint: null,
          },
        },
      ],
    },
  ],
  practicalNotes: [
    "Generated prices are estimates and should be checked before booking.",
    "Confirm transport schedules and weather conditions before departure.",
  ],
} as const

function buildGroqFinalMessages(
  requirements: FinalItineraryRequirements
): GroqConversationMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a practical trip itinerary generator.",
        "Return only the strict groq_final_itinerary_wire_response JSON Schema.",
        "Echo the normalized travelPlan exactly from the user request.",
        "The itinerary array must contain exactly one day object per requested duration day, with sequential dayNumber values starting at 1.",
        "Each day must include useful activities with timeWindow, timeOfDay when helpful, duration, concise semantic descriptions, and explicit place semantics.",
        "For every activity, set place.kind to specific_place, generic_activity, or transport.",
        "Use specific_place only for a real named attraction, venue, restaurant, hotel, station, terminal, or other searchable place. Put the exact proper place name in place.name and useful area/address hints when known.",
        "Use generic_activity for actions without a named venue. Use transport for transfers or route movements.",
        "The strict wire schema requires nullable optional fields to be present: use null when groupType, hotel details, activity timing details, practicalNotes, or place text hints are not applicable or unknown.",
        "For generic_activity and transport, set place.name to null. Put useful origin and destination text on transport when known.",
        "Include 2 to 4 hotel recommendations with generated estimatedPriceText.",
        "Keep the summary, descriptions, and practical notes concise and avoid duplicate prose.",
        "Use estimatedPriceText for generated cost guidance only; do not claim exact prices, ratings, business availability, opening hours, or verified coordinates.",
        "Never invent precise coordinates, provider place IDs, image URLs, photos, ratings, or availability. Provider enrichment will verify canonical place data later.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Generate a final itinerary from these normalized requirements.",
        `Source: ${requirements.source}`,
        `Destination: ${requirements.destination}`,
        `Duration days: ${requirements.durationDays}`,
        `Budget tier: ${requirements.budgetTier}`,
        `Group size: ${requirements.groupSize}`,
        `Group type: ${requirements.groupType}`,
      ].join("\n"),
    },
  ]
}

function validateStrictSchemaValue(
  schema: unknown,
  value: unknown
): StrictSchemaValidation {
  const errors: string[] = []
  validateSchemaNode(schema, value, "$", errors)
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

function validateSchemaNode(
  schema: unknown,
  value: unknown,
  path: string,
  errors: string[]
) {
  const node = asObject(schema)
  if (node === undefined) {
    errors.push(`${path}: invalid schema node`)
    return
  }

  if (Array.isArray(node.anyOf)) {
    const matched = node.anyOf.some((variant) => {
      const branchErrors: string[] = []
      validateSchemaNode(variant, value, path, branchErrors)
      return branchErrors.length === 0
    })
    if (!matched) {
      errors.push(`${path}: value did not match anyOf`)
    }
    return
  }

  if (Array.isArray(node.enum) && !node.enum.some((item) => item === value)) {
    errors.push(`${path}: value is not in enum`)
    return
  }

  const types = Array.isArray(node.type) ? node.type : [node.type]
  if (!types.some((type) => matchesJsonType(type, value))) {
    errors.push(`${path}: expected ${types.join(" or ")}`)
    return
  }

  if (types.includes("object") && isObject(value)) {
    const properties = asObject(node.properties)
    const required = Array.isArray(node.required) ? node.required : []

    for (const key of required) {
      if (typeof key === "string" && !(key in value)) {
        errors.push(`${path}.${key}: required property missing`)
      }
    }

    if (properties !== undefined) {
      for (const key of Object.keys(value)) {
        if (!(key in properties) && node.additionalProperties === false) {
          errors.push(`${path}.${key}: additional property not allowed`)
        } else if (key in properties) {
          validateSchemaNode(properties[key], value[key], `${path}.${key}`, errors)
        }
      }
    }
  }

  if (types.includes("array") && Array.isArray(value) && "items" in node) {
    value.forEach((item, index) =>
      validateSchemaNode(node.items, item, `${path}[${index}]`, errors)
    )
  }
}

function getFullSchemaAudit() {
  const report = {
    objectNodes: 0,
    anyOfBranches: 0,
    maximumSchemaDepth: 0,
    serializedBytes: Buffer.byteLength(
      JSON.stringify(groqFinalItineraryWireSchema),
      "utf8"
    ),
    unsupportedKeywords: [] as string[],
    structuralProblems: [] as string[],
  }
  const supportedKeywords = new Set([
    "additionalProperties",
    "anyOf",
    "enum",
    "items",
    "properties",
    "required",
    "type",
  ])

  function visit(value: unknown, path: string, depth: number) {
    const node = asObject(value)
    if (node === undefined) {
      return
    }
    report.maximumSchemaDepth = Math.max(report.maximumSchemaDepth, depth)

    for (const key of Object.keys(node)) {
      if (!supportedKeywords.has(key)) {
        report.unsupportedKeywords.push(`${path}.${key}`)
      }
    }

    if (node.type === "object") {
      report.objectNodes += 1
      const properties = asObject(node.properties)
      const required = readStringArray(node.required)
      if (properties === undefined || required === undefined) {
        report.structuralProblems.push(`${path}: missing properties or required`)
      } else {
        if (
          JSON.stringify(Object.keys(properties).sort()) !==
          JSON.stringify([...required].sort())
        ) {
          report.structuralProblems.push(
            `${path}: required keys do not match properties`
          )
        }
        for (const [key, property] of Object.entries(properties)) {
          visit(property, `${path}.${key}`, depth + 1)
        }
      }
      if (node.additionalProperties !== false) {
        report.structuralProblems.push(`${path}: object is not closed`)
      }
    }
    if ("items" in node) {
      visit(node.items, `${path}[]`, depth + 1)
    }
    if (Array.isArray(node.anyOf)) {
      report.anyOfBranches += node.anyOf.length
      node.anyOf.forEach((branch, index) =>
        visit(branch, `${path}.anyOf[${index}]`, depth + 1)
      )
    }
  }

  visit(groqFinalItineraryWireSchema, "$", 1)
  report.unsupportedKeywords.sort()
  report.structuralProblems.sort()
  return report
}

function getOneDayTokenBudgetAnalysis() {
  const messages = buildGroqFinalMessages(oneDayRequirements)
  const promptBytes = messages.reduce(
    (total, message) => total + Buffer.byteLength(message.content, "utf8"),
    0
  )
  const schemaBytes = Buffer.byteLength(
    JSON.stringify(groqFinalItineraryWireSchema),
    "utf8"
  )
  const fixtureBytes = Buffer.byteLength(
    JSON.stringify(completeOneDayWireFixture),
    "utf8"
  )

  return {
    estimationMethod: "UTF-8 bytes divided by four and rounded up",
    schemaBytes,
    schemaEstimatedTokens: estimateTokens(schemaBytes),
    promptBytes,
    promptEstimatedTokens: estimateTokens(promptBytes),
    representativeOutputBytes: fixtureBytes,
    representativeOutputEstimatedTokens: estimateTokens(fixtureBytes),
    existingCompletionBudget: 1_700,
    selectedCompletionBudget: oneDayExperimentalCompletionBudget,
    evidencedAccountTokenLimitPerMinute: 8_000,
    estimatedInputTokens: estimateTokens(schemaBytes + promptBytes) + 200,
  } as const
}

function inspectValidatedItinerary(itinerary: FinalItineraryResponse) {
  const activities = itinerary.itinerary.flatMap((day) => day.activities)
  const serialized = JSON.stringify(itinerary)
  const forbiddenMetadataAbsent = forbiddenProviderFields.every(
    (field) => !serialized.includes(`\"${field}\"`)
  )
  const requiredContentValid =
    itinerary.hotels.length >= 2 &&
    itinerary.hotels.length <= 4 &&
    itinerary.itinerary.length === 1 &&
    activities.length > 0
  const placeObjectsValid = activities.every((activity) => {
    const place = activity.place
    if (place === undefined) {
      return false
    }
    if (place.kind === "specific_place") {
      return typeof place.name === "string" && place.name.trim().length > 0
    }
    return place.name === null || place.name === undefined
  })

  let storageTransformationCompatible = false
  try {
    const stored = toStoredFinalItineraryPayload(itinerary)
    storageTransformationCompatible =
      stored.itinerary.length === 1 &&
      stored.itinerary[0]?.activities.length === activities.length
  } catch {
    storageTransformationCompatible = false
  }

  return {
    actualDayCount: itinerary.itinerary.length,
    requiredContentValid,
    placeObjectsValid,
    forbiddenMetadataAbsent,
    storageTransformationCompatible,
    reasonablyCoherent:
      requiredContentValid &&
      placeObjectsValid &&
      forbiddenMetadataAbsent &&
      itinerary.travelPlan.source === oneDayRequirements.source &&
      itinerary.travelPlan.destination === oneDayRequirements.destination,
  }
}

function createOneDayDiagnosticRecord({
  result,
  latencyMs,
}: {
  result: Awaited<ReturnType<typeof import("@/lib/ai/groq").runGroqFinalItinerary>>
  latencyMs: number
}): OneDayDiagnosticRecord {
  const diagnostic = result.ok ? result.data.diagnostic : result.diagnostic
  const inspection = result.ok
    ? inspectValidatedItinerary(result.data.response)
    : undefined
  const rateLimit = result.ok ? result.data.rateLimit : diagnostic?.rateLimit
  const applicationSchemaValid = diagnostic?.runtimeValidated ?? null
  const accepted =
    result.ok &&
    inspection?.storageTransformationCompatible === true &&
    inspection.reasonablyCoherent

  return {
    runIdentifier: oneDayRunIdentifier,
    modelIdentifier: expectedOneDayModel,
    requestedDurationDays: 1,
    selectedCompletionBudget: oneDayExperimentalCompletionBudget,
    httpStatus: result.ok ? 200 : diagnostic?.httpStatus ?? null,
    providerErrorType: result.ok
      ? null
      : diagnostic?.providerErrorType ?? null,
    providerErrorCode: result.ok
      ? null
      : diagnostic?.normalizedFailureCode ?? result.code,
    finishReason: diagnostic?.finishReason ?? null,
    inputTokens: result.ok ? result.data.usage?.inputTokens ?? null : null,
    outputTokens: result.ok ? result.data.usage?.outputTokens ?? null : null,
    totalTokens: result.ok ? result.data.usage?.totalTokens ?? null : null,
    latencyMs: Math.max(0, Math.round(latencyMs)),
    jsonParseValid: diagnostic?.jsonParsed ?? null,
    wireSchemaValid:
      diagnostic?.responseFormatAccepted === true && diagnostic.jsonParsed
        ? true
        : null,
    normalizationValid: diagnostic?.wireNormalized ?? null,
    applicationSchemaValid,
    durationValid: diagnostic?.durationValidated ?? null,
    actualDayCount: inspection?.actualDayCount ?? null,
    requiredContentValid: inspection?.requiredContentValid ?? null,
    placeObjectsValid: inspection?.placeObjectsValid ?? null,
    forbiddenMetadataAbsent: inspection?.forbiddenMetadataAbsent ?? null,
    storageTransformationCompatible:
      inspection?.storageTransformationCompatible ?? null,
    reasonablyCoherent: inspection?.reasonablyCoherent ?? null,
    rateLimit: {
      limitTokensPerMinute: rateLimit?.limitTokensPerMinute ?? null,
      remainingTokens: rateLimit?.remainingTokens ?? null,
      resetTokensSeconds: rateLimit?.resetTokensSeconds ?? null,
    },
    sanitizedErrorClassification: accepted
      ? "ONE_DAY_FINAL_GENERATION_ACCEPTED"
      : classifyFailure(result),
    retryCount: 0,
  }
}

function writeOneDayDiagnosticRecord(
  reportPath: string,
  record: OneDayDiagnosticRecord
) {
  writeFileSync(reportPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "wx",
  })
}

function readOneDayDiagnosticRecords(reportPath: string) {
  const lines = readFileSync(reportPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)

  return lines.map((line, index) =>
    parseOneDayDiagnosticRecord(JSON.parse(line) as unknown, index + 1)
  )
}

function parseOneDayDiagnosticRecord(value: unknown, lineNumber: number) {
  const record = asObject(value)
  if (
    record === undefined ||
    record.runIdentifier !== oneDayRunIdentifier ||
    record.modelIdentifier !== expectedOneDayModel ||
    record.requestedDurationDays !== 1 ||
    record.selectedCompletionBudget !== oneDayExperimentalCompletionBudget ||
    !isNullableNumber(record.httpStatus) ||
    !isNullableString(record.providerErrorType) ||
    !isNullableString(record.providerErrorCode) ||
    !isNullableString(record.finishReason) ||
    !isNullableNumber(record.inputTokens) ||
    !isNullableNumber(record.outputTokens) ||
    !isNullableNumber(record.totalTokens) ||
    !isNonNegativeNumber(record.latencyMs) ||
    !isNullableBoolean(record.jsonParseValid) ||
    !isNullableBoolean(record.wireSchemaValid) ||
    !isNullableBoolean(record.normalizationValid) ||
    !isNullableBoolean(record.applicationSchemaValid) ||
    !isNullableBoolean(record.durationValid) ||
    !isNullableNumber(record.actualDayCount) ||
    !isNullableBoolean(record.requiredContentValid) ||
    !isNullableBoolean(record.placeObjectsValid) ||
    !isNullableBoolean(record.forbiddenMetadataAbsent) ||
    !isNullableBoolean(record.storageTransformationCompatible) ||
    !isNullableBoolean(record.reasonablyCoherent) ||
    !isRateLimitRecord(record.rateLimit) ||
    !isOutcomeClassification(record.sanitizedErrorClassification) ||
    record.retryCount !== 0
  ) {
    throw new Error(`Invalid one-day diagnostic record on line ${lineNumber}.`)
  }

  return record as OneDayDiagnosticRecord
}

function classifyFailure(
  result: GroqCallResult<unknown>
): OneDayOutcomeClassification {
  if (result.ok) {
    return "APPLICATION_VALIDATION_FAILED"
  }
  if (result.code === "schema_validation") {
    return "APPLICATION_VALIDATION_FAILED"
  }
  if (
    result.diagnostic?.stage === "PROVIDER_REQUEST" &&
    result.diagnostic.httpStatus === 400
  ) {
    return "PROVIDER_REQUEST_REJECTED"
  }
  return "GENERATION_FAILED"
}

function matchesJsonType(type: unknown, value: unknown) {
  switch (type) {
    case "null":
      return value === null
    case "string":
      return typeof value === "string"
    case "boolean":
      return typeof value === "boolean"
    case "integer":
      return typeof value === "number" && Number.isInteger(value)
    case "number":
      return typeof value === "number" && Number.isFinite(value)
    case "array":
      return Array.isArray(value)
    case "object":
      return isObject(value)
    default:
      return false
  }
}

function estimateTokens(bytes: number) {
  return Math.ceil(bytes / 4)
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? [...value]
    : undefined
}

function asObject(value: unknown): JsonObject | undefined {
  return isObject(value) ? value : undefined
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean"
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNonNegativeNumber(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function isRateLimitRecord(value: unknown) {
  const record = asObject(value)
  return (
    record !== undefined &&
    isNullableNumber(record.limitTokensPerMinute) &&
    isNullableNumber(record.remainingTokens) &&
    isNullableNumber(record.resetTokensSeconds)
  )
}

function isOutcomeClassification(
  value: unknown
): value is OneDayOutcomeClassification {
  return (
    value === "ONE_DAY_FINAL_GENERATION_ACCEPTED" ||
    value === "PROVIDER_REQUEST_REJECTED" ||
    value === "GENERATION_FAILED" ||
    value === "APPLICATION_VALIDATION_FAILED"
  )
}

export {
  buildGroqFinalMessages,
  completeOneDayWireFixture,
  createOneDayDiagnosticRecord,
  expectedOneDayModel,
  forbiddenProviderFields,
  getFullSchemaAudit,
  getOneDayTokenBudgetAnalysis,
  inspectValidatedItinerary,
  oneDayExperimentalCompletionBudget,
  oneDayRequirements,
  oneDayRunIdentifier,
  readOneDayDiagnosticRecords,
  validateStrictSchemaValue,
  writeOneDayDiagnosticRecord,
  type OneDayDiagnosticRecord,
}
