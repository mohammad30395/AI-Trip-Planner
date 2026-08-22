import {
  parseConversationalStepResponse,
  type BudgetTier,
  type ConversationalStepResponse,
  type GroupType,
  type ValidationResult,
} from "./contract"

type ConversationRequestMessage = {
  role: "assistant" | "user"
  content: string
}

type ConversationRequirements = {
  source?: string
  destination?: string
  durationDays?: number
  budgetTier?: BudgetTier
  groupSize?: number
  groupType?: GroupType
}

type TripConversationRequest = {
  messages: ConversationRequestMessage[]
  requirements: ConversationRequirements
}

type TripConversationResponseEnvelope =
  | {
      ok: true
      response: ConversationalStepResponse
    }
  | {
      ok: false
      error: string
    }

type JsonObject = Record<string, unknown>

const messageRoles = ["assistant", "user"] as const
const budgetTiers = ["budget", "mid-range", "premium"] as const
const groupTypes = ["solo", "couple", "family", "friends", "business"] as const

function parseTripConversationRequest(
  value: unknown
): ValidationResult<TripConversationRequest> {
  const object = asObject(value, "request")

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "messages",
    "requirements",
  ])

  if (unknownKeysError !== null) {
    return validationError(unknownKeysError)
  }

  const messages = parseMessages(object.data.messages)

  if (!messages.ok) {
    return messages
  }

  const requirements = parseConversationRequirements(object.data.requirements)

  if (!requirements.ok) {
    return requirements
  }

  return {
    ok: true,
    data: {
      messages: messages.data,
      requirements: requirements.data,
    },
  }
}

function parseTripConversationResponseEnvelope(
  value: unknown
): ValidationResult<ConversationalStepResponse> {
  const object = asObject(value, "response")

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "ok",
    "response",
    "error",
  ])

  if (unknownKeysError !== null) {
    return validationError(unknownKeysError)
  }

  if (object.data.ok !== true) {
    return validationError("AI response was not successful")
  }

  return parseConversationalStepResponse(object.data.response)
}

function parseMessages(
  value: unknown
): ValidationResult<ConversationRequestMessage[]> {
  if (!Array.isArray(value)) {
    return validationError("messages must be an array")
  }

  if (value.length === 0) {
    return validationError("messages must include at least one message")
  }

  if (value.length > 10) {
    return validationError("messages must include 10 or fewer messages")
  }

  const messages: ConversationRequestMessage[] = []

  for (const [index, item] of value.entries()) {
    const object = asObject(item, `messages.${index}`)

    if (!object.ok) {
      return object
    }

    const unknownKeysError = rejectUnknownKeys(object.data, ["role", "content"])

    if (unknownKeysError !== null) {
      return validationError(`messages.${index}.${unknownKeysError}`)
    }

    const role = readEnum(object.data, "role", messageRoles, `messages.${index}`)

    if (!role.ok) {
      return role
    }

    const content = readStringInRange(
      object.data,
      "content",
      1,
      500,
      `messages.${index}`
    )

    if (!content.ok) {
      return content
    }

    messages.push({
      role: role.data,
      content: content.data,
    })
  }

  return { ok: true, data: messages }
}

function parseConversationRequirements(
  value: unknown
): ValidationResult<ConversationRequirements> {
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

  const requirements: ConversationRequirements = {}

  if ("source" in object.data) {
    const source = readStringInRange(object.data, "source", 1, 120, "requirements")

    if (!source.ok) {
      return source
    }

    requirements.source = source.data
  }

  if ("destination" in object.data) {
    const destination = readStringInRange(
      object.data,
      "destination",
      1,
      120,
      "requirements"
    )

    if (!destination.ok) {
      return destination
    }

    requirements.destination = destination.data
  }

  if ("durationDays" in object.data) {
    const durationDays = readIntegerInRange(
      object.data,
      "durationDays",
      1,
      30,
      "requirements"
    )

    if (!durationDays.ok) {
      return durationDays
    }

    requirements.durationDays = durationDays.data
  }

  if ("budgetTier" in object.data) {
    const budgetTier = readEnum(
      object.data,
      "budgetTier",
      budgetTiers,
      "requirements"
    )

    if (!budgetTier.ok) {
      return budgetTier
    }

    requirements.budgetTier = budgetTier.data
  }

  if ("groupSize" in object.data) {
    const groupSize = readIntegerInRange(
      object.data,
      "groupSize",
      1,
      20,
      "requirements"
    )

    if (!groupSize.ok) {
      return groupSize
    }

    requirements.groupSize = groupSize.data
  }

  if ("groupType" in object.data) {
    const groupType = readEnum(
      object.data,
      "groupType",
      groupTypes,
      "requirements"
    )

    if (!groupType.ok) {
      return groupType
    }

    requirements.groupType = groupType.data
  }

  return { ok: true, data: requirements }
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

function validationError(error: string): ValidationResult<never> {
  return { ok: false, error }
}

export {
  parseTripConversationRequest,
  parseTripConversationResponseEnvelope,
  type ConversationRequestMessage,
  type ConversationRequirements,
  type TripConversationRequest,
  type TripConversationResponseEnvelope,
}
