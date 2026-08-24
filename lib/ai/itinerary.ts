import {
  parseFinalItineraryResponse,
  type BudgetTier,
  type FinalItineraryResponse,
  type GroupType,
  type ValidationResult,
} from "./contract"
import type { TripGenerationAccessStatus } from "@/lib/billing/trip-generation-access"

type FinalItineraryRequirements = {
  source: string
  destination: string
  durationDays: number
  budgetTier: BudgetTier
  groupSize: number
  groupType: GroupType
}

type FinalItineraryRequest = {
  requirements: FinalItineraryRequirements
}

type FinalItineraryResponseEnvelope =
  | {
      ok: true
      itinerary: FinalItineraryResponse
      access: TripGenerationAccessStatus
    }
  | {
      ok: false
      error: string
      code?: FinalItineraryErrorCode
      quota?: FinalItineraryQuota
      access?: TripGenerationAccessStatus
      missingVariables?: string[]
    }

type FinalItineraryErrorCode =
  | "configuration_error"
  | "provider_error"
  | "quota_exceeded"
  | "validation_error"

type FinalItineraryQuota = {
  limit: number
  remaining: number
  resetSeconds: number
  resetAt?: string
}

type FinalItineraryEnvelopeParseResult =
  | {
      ok: true
      data: FinalItineraryResponse
      access: TripGenerationAccessStatus
    }
  | {
      ok: false
      error: string
      code?: FinalItineraryErrorCode
      quota?: FinalItineraryQuota
      access?: TripGenerationAccessStatus
    }

type JsonObject = Record<string, unknown>

const budgetTiers = ["budget", "mid-range", "premium"] as const
const groupTypes = ["solo", "couple", "family", "friends", "business"] as const
const finalItineraryErrorCodes = [
  "configuration_error",
  "provider_error",
  "quota_exceeded",
  "validation_error",
] as const

function parseFinalItineraryRequest(
  value: unknown
): ValidationResult<FinalItineraryRequest> {
  const object = asObject(value, "request")

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, ["requirements"])

  if (unknownKeysError !== null) {
    return validationError(unknownKeysError)
  }

  const requirements = parseFinalItineraryRequirements(object.data.requirements)

  if (!requirements.ok) {
    return requirements
  }

  return {
    ok: true,
    data: {
      requirements: requirements.data,
    },
  }
}

function parseFinalItineraryResponseEnvelope(
  value: unknown
): FinalItineraryEnvelopeParseResult {
  const object = asObject(value, "response")

  if (!object.ok) {
    return envelopeValidationError(object.error)
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "ok",
    "itinerary",
    "error",
    "code",
    "quota",
    "access",
    "missingVariables",
  ])

  if (unknownKeysError !== null) {
    return envelopeValidationError(unknownKeysError)
  }

  if (object.data.ok !== true) {
    const error = readStringInRange(object.data, "error", 1, 240, "response")

    if (!error.ok) {
      return envelopeValidationError(error.error)
    }

    const code =
      object.data.code === undefined
        ? undefined
        : readEnum(
            object.data,
            "code",
            finalItineraryErrorCodes,
            "response"
          )

    if (code !== undefined && !code.ok) {
      return envelopeValidationError(code.error)
    }

    const quota =
      object.data.quota === undefined
        ? undefined
        : parseFinalItineraryQuota(object.data.quota)

    if (quota !== undefined && !quota.ok) {
      return envelopeValidationError(quota.error)
    }

    const access =
      object.data.access === undefined
        ? undefined
        : parseTripGenerationAccessStatus(object.data.access)

    if (access !== undefined && !access.ok) {
      return envelopeValidationError(access.error)
    }

    return {
      ok: false,
      error: error.data,
      ...(code !== undefined ? { code: code.data } : {}),
      ...(quota !== undefined ? { quota: quota.data } : {}),
      ...(access !== undefined ? { access: access.data } : {}),
    }
  }

  const itinerary = parseFinalItineraryResponse(object.data.itinerary)

  if (!itinerary.ok) {
    return envelopeValidationError(itinerary.error)
  }

  const access = parseTripGenerationAccessStatus(object.data.access)

  if (!access.ok) {
    return envelopeValidationError(access.error)
  }

  return { ok: true, data: itinerary.data, access: access.data }
}

function validateItineraryDuration(
  itinerary: FinalItineraryResponse,
  expectedDurationDays: number
): ValidationResult<FinalItineraryResponse> {
  if (itinerary.travelPlan.durationDays !== expectedDurationDays) {
    return validationError(
      "generated travelPlan duration did not match the requested duration"
    )
  }

  if (itinerary.itinerary.length !== expectedDurationDays) {
    return validationError(
      "generated itinerary day count did not match the requested duration"
    )
  }

  for (const [index, day] of itinerary.itinerary.entries()) {
    const expectedDayNumber = index + 1

    if (day.dayNumber !== expectedDayNumber) {
      return validationError(
        `generated itinerary day ${expectedDayNumber} has an unexpected day number`
      )
    }
  }

  return { ok: true, data: itinerary }
}

function parseFinalItineraryRequirements(
  value: unknown
): ValidationResult<FinalItineraryRequirements> {
  const object = asObject(value, "requirements")

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "source",
    "destination",
    "durationDays",
    "budgetTier",
    "groupSize",
    "groupType",
  ])

  if (unknownKeysError !== null) {
    return validationError(`requirements.${unknownKeysError}`)
  }

  const source = readStringInRange(object.data, "source", 1, 120, "requirements")
  const destination = readStringInRange(
    object.data,
    "destination",
    1,
    120,
    "requirements"
  )
  const durationDays = readIntegerInRange(
    object.data,
    "durationDays",
    1,
    30,
    "requirements"
  )
  const budgetTier = readEnum(
    object.data,
    "budgetTier",
    budgetTiers,
    "requirements"
  )
  const groupSize = readIntegerInRange(
    object.data,
    "groupSize",
    1,
    20,
    "requirements"
  )
  const groupType = readEnum(
    object.data,
    "groupType",
    groupTypes,
    "requirements"
  )

  if (!source.ok) {
    return source
  }
  if (!destination.ok) {
    return destination
  }
  if (!durationDays.ok) {
    return durationDays
  }
  if (!budgetTier.ok) {
    return budgetTier
  }
  if (!groupSize.ok) {
    return groupSize
  }
  if (!groupType.ok) {
    return groupType
  }

  return {
    ok: true,
    data: {
      source: source.data,
      destination: destination.data,
      durationDays: durationDays.data,
      budgetTier: budgetTier.data,
      groupSize: groupSize.data,
      groupType: groupType.data,
    },
  }
}

function parseFinalItineraryQuota(
  value: unknown
): ValidationResult<FinalItineraryQuota> {
  const object = asObject(value, "response.quota")

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "limit",
    "remaining",
    "resetSeconds",
    "resetAt",
  ])

  if (unknownKeysError !== null) {
    return validationError(`response.quota.${unknownKeysError}`)
  }

  const limit = readIntegerInRange(object.data, "limit", 0, 10_000, "response.quota")
  const remaining = readIntegerInRange(
    object.data,
    "remaining",
    0,
    10_000,
    "response.quota"
  )
  const resetSeconds = readIntegerInRange(
    object.data,
    "resetSeconds",
    0,
    31_536_000,
    "response.quota"
  )
  const resetAt =
    object.data.resetAt === undefined
      ? undefined
      : readStringInRange(object.data, "resetAt", 1, 80, "response.quota")

  if (!limit.ok) {
    return limit
  }
  if (!remaining.ok) {
    return remaining
  }
  if (!resetSeconds.ok) {
    return resetSeconds
  }
  if (resetAt !== undefined && !resetAt.ok) {
    return resetAt
  }

  return {
    ok: true,
    data: {
      limit: limit.data,
      remaining: remaining.data,
      resetSeconds: resetSeconds.data,
      ...(resetAt !== undefined ? { resetAt: resetAt.data } : {}),
    },
  }
}

function parseTripGenerationAccessStatus(
  value: unknown
): ValidationResult<TripGenerationAccessStatus> {
  const object = asObject(value, "response.access")

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "tier",
    "quotaEnforced",
  ])

  if (unknownKeysError !== null) {
    return validationError(`response.access.${unknownKeysError}`)
  }

  const tier = readEnum(object.data, "tier", ["free", "premium"], "response.access")
  const quotaEnforced = readBoolean(
    object.data,
    "quotaEnforced",
    "response.access"
  )

  if (!tier.ok) {
    return tier
  }
  if (!quotaEnforced.ok) {
    return quotaEnforced
  }

  return {
    ok: true,
    data: {
      tier: tier.data,
      quotaEnforced: quotaEnforced.data,
    },
  }
}

function asObject(value: unknown, path: string): ValidationResult<JsonObject> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return validationError(`${path} must be an object`)
  }

  return { ok: true, data: value as JsonObject }
}

function rejectUnknownKeys(object: JsonObject, allowedKeys: string[]) {
  const unknownKey = Object.keys(object).find((key) => !allowedKeys.includes(key))

  return unknownKey === undefined ? null : `${unknownKey} is not allowed`
}

function readStringInRange(
  object: JsonObject,
  key: string,
  minLength: number,
  maxLength: number,
  path: string
): ValidationResult<string> {
  const value = object[key]

  if (typeof value !== "string") {
    return validationError(`${path}.${key} must be a string`)
  }

  const trimmed = value.trim()

  if (trimmed.length < minLength || trimmed.length > maxLength) {
    return validationError(
      `${path}.${key} must be ${minLength} to ${maxLength} characters`
    )
  }

  return { ok: true, data: trimmed }
}

function readIntegerInRange(
  object: JsonObject,
  key: string,
  minimum: number,
  maximum: number,
  path: string
): ValidationResult<number> {
  const value = object[key]

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return validationError(`${path}.${key} must be an integer`)
  }

  if (value < minimum || value > maximum) {
    return validationError(
      `${path}.${key} must be between ${minimum} and ${maximum}`
    )
  }

  return { ok: true, data: value }
}

function readEnum<T extends string>(
  object: JsonObject,
  key: string,
  allowedValues: readonly T[],
  path: string
): ValidationResult<T> {
  const value = object[key]

  if (
    typeof value !== "string" ||
    !allowedValues.includes(value as T)
  ) {
    return validationError(`${path}.${key} is not supported`)
  }

  return { ok: true, data: value as T }
}

function readBoolean(
  object: JsonObject,
  key: string,
  path: string
): ValidationResult<boolean> {
  const value = object[key]

  if (typeof value !== "boolean") {
    return validationError(`${path}.${key} must be a boolean`)
  }

  return { ok: true, data: value }
}

function validationError(error: string): ValidationResult<never> {
  return { ok: false, error }
}

function envelopeValidationError(error: string): FinalItineraryEnvelopeParseResult {
  return { ok: false, error }
}

export {
  parseFinalItineraryRequest,
  parseFinalItineraryResponseEnvelope,
  validateItineraryDuration,
  type FinalItineraryRequest,
  type FinalItineraryRequirements,
  type FinalItineraryQuota,
  type FinalItineraryResponseEnvelope,
  type TripGenerationAccessStatus,
}
