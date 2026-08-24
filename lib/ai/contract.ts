export type GenerativeUISelector =
  | "source"
  | "destination"
  | "duration"
  | "budget"
  | "group"
  | "review"
  | "final"

export type BudgetTier = "budget" | "mid-range" | "premium"

export type GroupType = "solo" | "couple" | "family" | "friends" | "business"

export type NormalizedRequirementUpdate = {
  source?: string
  destination?: string
  durationDays?: number
  budgetTier?: BudgetTier
  groupSize?: number
  groupType?: GroupType
}

export type ConversationalStepResponse = {
  assistantText: string
  nextUISelector: GenerativeUISelector
  requirementUpdate?: NormalizedRequirementUpdate
}

export type PlaceTextHint = {
  placeName: string
  address?: string
  approximateArea?: string
}

export type ItineraryActivity = {
  title: string
  description: string
  timeOfDay?: "morning" | "afternoon" | "evening" | "night" | "flexible"
  timeWindow: string
  duration?: string
  estimatedPriceText: string
  place?: PlaceTextHint
}

export type ItineraryDay = {
  dayNumber: number
  title: string
  activities: ItineraryActivity[]
}

export type HotelRecommendation = {
  name: string
  description: string
  area?: string
  address?: string
  priceTier?: BudgetTier
  estimatedPriceText: string
}

export type FinalItineraryResponse = {
  travelPlan: {
    source: string
    destination: string
    durationDays: number
    budgetTier: BudgetTier
    groupSize: number
    groupType?: GroupType
  }
  summary: string
  hotels: HotelRecommendation[]
  itinerary: ItineraryDay[]
  practicalNotes?: string[]
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

type JsonObject = Record<string, unknown>

export const conversationalStepResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assistantText", "nextUISelector"],
  properties: {
    assistantText: {
      type: "string",
      minLength: 1,
    },
    nextUISelector: {
      type: "string",
      enum: ["source", "destination", "duration", "budget", "group", "review", "final"],
    },
    requirementUpdate: {
      type: "object",
      additionalProperties: false,
      properties: {
        source: { type: "string", minLength: 1 },
        destination: { type: "string", minLength: 1 },
        durationDays: { type: "integer", minimum: 1, maximum: 30 },
        budgetTier: {
          type: "string",
          enum: ["budget", "mid-range", "premium"],
        },
        groupSize: { type: "integer", minimum: 1, maximum: 20 },
        groupType: {
          type: "string",
          enum: ["solo", "couple", "family", "friends", "business"],
        },
      },
    },
  },
} as const

export const finalItineraryResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["travelPlan", "summary", "hotels", "itinerary"],
  properties: {
    travelPlan: {
      type: "object",
      additionalProperties: false,
      required: ["source", "destination", "durationDays", "budgetTier", "groupSize"],
      properties: {
        source: { type: "string", minLength: 1 },
        destination: { type: "string", minLength: 1 },
        durationDays: { type: "integer", minimum: 1, maximum: 30 },
        budgetTier: {
          type: "string",
          enum: ["budget", "mid-range", "premium"],
        },
        groupSize: { type: "integer", minimum: 1, maximum: 20 },
        groupType: {
          type: "string",
          enum: ["solo", "couple", "family", "friends", "business"],
        },
      },
    },
    summary: {
      type: "string",
      minLength: 1,
    },
    hotels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "estimatedPriceText"],
        properties: {
          name: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          area: { type: "string", minLength: 1 },
          address: { type: "string", minLength: 1 },
          priceTier: {
            type: "string",
            enum: ["budget", "mid-range", "premium"],
          },
          estimatedPriceText: { type: "string", minLength: 1 },
        },
      },
    },
    itinerary: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dayNumber", "title", "activities"],
        properties: {
          dayNumber: { type: "integer", minimum: 1 },
          title: { type: "string", minLength: 1 },
          activities: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "title",
                "description",
                "timeWindow",
                "estimatedPriceText",
              ],
              properties: {
                title: { type: "string", minLength: 1 },
                description: { type: "string", minLength: 1 },
                timeOfDay: {
                  type: "string",
                  enum: ["morning", "afternoon", "evening", "night", "flexible"],
                },
                timeWindow: { type: "string", minLength: 1 },
                duration: { type: "string", minLength: 1 },
                estimatedPriceText: { type: "string", minLength: 1 },
                place: {
                  type: "object",
                  additionalProperties: false,
                  required: ["placeName"],
                  properties: {
                    placeName: { type: "string", minLength: 1 },
                    address: { type: "string", minLength: 1 },
                    approximateArea: { type: "string", minLength: 1 },
                  },
                },
              },
            },
          },
        },
      },
    },
    practicalNotes: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
} as const

const uiSelectors: readonly GenerativeUISelector[] = [
  "source",
  "destination",
  "duration",
  "budget",
  "group",
  "review",
  "final",
]

const budgetTiers: readonly BudgetTier[] = ["budget", "mid-range", "premium"]

const groupTypes: readonly GroupType[] = [
  "solo",
  "couple",
  "family",
  "friends",
  "business",
]

const timeOfDayValues: readonly NonNullable<ItineraryActivity["timeOfDay"]>[] = [
  "morning",
  "afternoon",
  "evening",
  "night",
  "flexible",
]

export function parseConversationalStepResponse(
  value: unknown
): ValidationResult<ConversationalStepResponse> {
  const object = asObject(value, "response")

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "assistantText",
    "nextUISelector",
    "requirementUpdate",
  ])

  if (unknownKeysError !== null) {
    return validationError(unknownKeysError)
  }

  const assistantText = readRequiredString(object.data, "assistantText")

  if (!assistantText.ok) {
    return assistantText
  }

  const nextUISelector = readEnum(
    object.data,
    "nextUISelector",
    uiSelectors
  )

  if (!nextUISelector.ok) {
    return nextUISelector
  }

  const updateResult =
    "requirementUpdate" in object.data
      ? parseRequirementUpdate(object.data.requirementUpdate)
      : ({ ok: true, data: undefined } satisfies ValidationResult<
          NormalizedRequirementUpdate | undefined
        >)

  if (!updateResult.ok) {
    return updateResult
  }

  return {
    ok: true,
    data: {
      assistantText: assistantText.data,
      nextUISelector: nextUISelector.data,
      ...(updateResult.data !== undefined
        ? { requirementUpdate: updateResult.data }
        : {}),
    },
  }
}

export function parseFinalItineraryResponse(
  value: unknown
): ValidationResult<FinalItineraryResponse> {
  const object = asObject(value, "response")

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "travelPlan",
    "summary",
    "hotels",
    "itinerary",
    "practicalNotes",
  ])

  if (unknownKeysError !== null) {
    return validationError(unknownKeysError)
  }

  const travelPlan = parseTravelPlan(object.data.travelPlan)

  if (!travelPlan.ok) {
    return travelPlan
  }

  const summary = readRequiredString(object.data, "summary")

  if (!summary.ok) {
    return summary
  }

  const hotels = parseArray(
    object.data.hotels,
    "hotels",
    parseHotelRecommendation
  )

  if (!hotels.ok) {
    return hotels
  }

  const itinerary = parseArray(object.data.itinerary, "itinerary", parseDay)

  if (!itinerary.ok) {
    return itinerary
  }

  if (itinerary.data.length === 0) {
    return validationError("itinerary must contain at least one day")
  }

  const practicalNotes =
    "practicalNotes" in object.data
      ? parseArray(object.data.practicalNotes, "practicalNotes", (item, path) =>
          readStringValue(item, path)
        )
      : ({ ok: true, data: undefined } satisfies ValidationResult<
          string[] | undefined
        >)

  if (!practicalNotes.ok) {
    return practicalNotes
  }

  return {
    ok: true,
    data: {
      travelPlan: travelPlan.data,
      summary: summary.data,
      hotels: hotels.data,
      itinerary: itinerary.data,
      ...(practicalNotes.data !== undefined
        ? { practicalNotes: practicalNotes.data }
        : {}),
    },
  }
}

function parseRequirementUpdate(
  value: unknown
): ValidationResult<NormalizedRequirementUpdate> {
  const object = asObject(value, "requirementUpdate")

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
    return validationError(unknownKeysError)
  }

  const update: NormalizedRequirementUpdate = {}

  if ("source" in object.data) {
    const source = readRequiredString(object.data, "source")

    if (!source.ok) {
      return source
    }

    update.source = source.data
  }

  if ("destination" in object.data) {
    const destination = readRequiredString(object.data, "destination")

    if (!destination.ok) {
      return destination
    }

    update.destination = destination.data
  }

  if ("durationDays" in object.data) {
    const durationDays = readIntegerInRange(
      object.data,
      "durationDays",
      1,
      30
    )

    if (!durationDays.ok) {
      return durationDays
    }

    update.durationDays = durationDays.data
  }

  if ("budgetTier" in object.data) {
    const budgetTier = readEnum(object.data, "budgetTier", budgetTiers)

    if (!budgetTier.ok) {
      return budgetTier
    }

    update.budgetTier = budgetTier.data
  }

  if ("groupSize" in object.data) {
    const groupSize = readIntegerInRange(object.data, "groupSize", 1, 20)

    if (!groupSize.ok) {
      return groupSize
    }

    update.groupSize = groupSize.data
  }

  if ("groupType" in object.data) {
    const groupType = readEnum(object.data, "groupType", groupTypes)

    if (!groupType.ok) {
      return groupType
    }

    update.groupType = groupType.data
  }

  return { ok: true, data: update }
}

function parseTravelPlan(
  value: unknown
): ValidationResult<FinalItineraryResponse["travelPlan"]> {
  const object = asObject(value, "travelPlan")

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
    return validationError(unknownKeysError)
  }

  const source = readRequiredString(object.data, "source")
  const destination = readRequiredString(object.data, "destination")
  const durationDays = readIntegerInRange(object.data, "durationDays", 1, 30)
  const budgetTier = readEnum(object.data, "budgetTier", budgetTiers)
  const groupSize = readIntegerInRange(object.data, "groupSize", 1, 20)
  const groupType =
    "groupType" in object.data
      ? readEnum(object.data, "groupType", groupTypes)
      : ({ ok: true, data: undefined } satisfies ValidationResult<
          GroupType | undefined
        >)

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
      ...(groupType.data !== undefined ? { groupType: groupType.data } : {}),
    },
  }
}

function parseHotelRecommendation(
  value: unknown,
  path: string
): ValidationResult<HotelRecommendation> {
  const object = asObject(value, path)

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "name",
    "description",
    "area",
    "address",
    "priceTier",
    "estimatedPriceText",
  ])

  if (unknownKeysError !== null) {
    return validationError(`${path}.${unknownKeysError}`)
  }

  const name = readRequiredString(object.data, "name", path)
  const description = readRequiredString(object.data, "description", path)
  const area =
    "area" in object.data
      ? readRequiredString(object.data, "area", path)
      : optionalString()
  const address =
    "address" in object.data
      ? readRequiredString(object.data, "address", path)
      : optionalString()
  const priceTier =
    "priceTier" in object.data
      ? readEnum(object.data, "priceTier", budgetTiers, path)
      : optionalEnum<BudgetTier>()
  const estimatedPriceText = readRequiredString(
    object.data,
    "estimatedPriceText",
    path
  )

  if (!name.ok) {
    return name
  }
  if (!description.ok) {
    return description
  }
  if (!area.ok) {
    return area
  }
  if (!address.ok) {
    return address
  }
  if (!priceTier.ok) {
    return priceTier
  }
  if (!estimatedPriceText.ok) {
    return estimatedPriceText
  }

  return {
    ok: true,
    data: {
      name: name.data,
      description: description.data,
      ...(area.data !== undefined ? { area: area.data } : {}),
      ...(address.data !== undefined ? { address: address.data } : {}),
      ...(priceTier.data !== undefined ? { priceTier: priceTier.data } : {}),
      estimatedPriceText: estimatedPriceText.data,
    },
  }
}

function parseDay(value: unknown, path: string): ValidationResult<ItineraryDay> {
  const object = asObject(value, path)

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "dayNumber",
    "title",
    "activities",
  ])

  if (unknownKeysError !== null) {
    return validationError(`${path}.${unknownKeysError}`)
  }

  const dayNumber = readIntegerInRange(object.data, "dayNumber", 1, 60, path)
  const title = readRequiredString(object.data, "title", path)
  const activities = parseArray(
    object.data.activities,
    `${path}.activities`,
    parseActivity
  )

  if (!dayNumber.ok) {
    return dayNumber
  }
  if (!title.ok) {
    return title
  }
  if (!activities.ok) {
    return activities
  }
  if (activities.data.length === 0) {
    return validationError(`${path}.activities must contain at least one activity`)
  }

  return {
    ok: true,
    data: {
      dayNumber: dayNumber.data,
      title: title.data,
      activities: activities.data,
    },
  }
}

function parseActivity(
  value: unknown,
  path: string
): ValidationResult<ItineraryActivity> {
  const object = asObject(value, path)

  if (!object.ok) {
    return object
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "title",
    "description",
    "timeOfDay",
    "timeWindow",
    "duration",
    "estimatedPriceText",
    "place",
  ])

  if (unknownKeysError !== null) {
    return validationError(`${path}.${unknownKeysError}`)
  }

  const title = readRequiredString(object.data, "title", path)
  const description = readRequiredString(object.data, "description", path)
  const timeOfDay =
    "timeOfDay" in object.data
      ? readEnum(object.data, "timeOfDay", timeOfDayValues, path)
      : optionalEnum<NonNullable<ItineraryActivity["timeOfDay"]>>()
  const timeWindow = readRequiredString(object.data, "timeWindow", path)
  const duration =
    "duration" in object.data
      ? readRequiredString(object.data, "duration", path)
      : optionalString()
  const estimatedPriceText = readRequiredString(
    object.data,
    "estimatedPriceText",
    path
  )
  const place =
    "place" in object.data
      ? parsePlaceTextHint(object.data.place, `${path}.place`)
      : ({ ok: true, data: undefined } satisfies ValidationResult<
          PlaceTextHint | undefined
        >)

  if (!title.ok) {
    return title
  }
  if (!description.ok) {
    return description
  }
  if (!timeOfDay.ok) {
    return timeOfDay
  }
  if (!timeWindow.ok) {
    return timeWindow
  }
  if (!duration.ok) {
    return duration
  }
  if (!estimatedPriceText.ok) {
    return estimatedPriceText
  }
  if (!place.ok) {
    return place
  }

  return {
    ok: true,
    data: {
      title: title.data,
      description: description.data,
      ...(timeOfDay.data !== undefined ? { timeOfDay: timeOfDay.data } : {}),
      timeWindow: timeWindow.data,
      ...(duration.data !== undefined ? { duration: duration.data } : {}),
      estimatedPriceText: estimatedPriceText.data,
      ...(place.data !== undefined ? { place: place.data } : {}),
    },
  }
}

function parsePlaceTextHint(
  value: unknown,
  path: string
): ValidationResult<PlaceTextHint> {
  const object = asObject(value, path)

  if (!object.ok) {
    return object
  }

  const forbiddenCoordinateKeys = ["lat", "lng", "latitude", "longitude"]
  const coordinateKey = forbiddenCoordinateKeys.find((key) => key in object.data)

  if (coordinateKey !== undefined) {
    return validationError(
      `${path}.${coordinateKey} is not accepted; provider enrichment will provide canonical coordinates later`
    )
  }

  const unknownKeysError = rejectUnknownKeys(object.data, [
    "placeName",
    "address",
    "approximateArea",
  ])

  if (unknownKeysError !== null) {
    return validationError(`${path}.${unknownKeysError}`)
  }

  const placeName = readRequiredString(object.data, "placeName", path)
  const address =
    "address" in object.data
      ? readRequiredString(object.data, "address", path)
      : optionalString()
  const approximateArea =
    "approximateArea" in object.data
      ? readRequiredString(object.data, "approximateArea", path)
      : optionalString()

  if (!placeName.ok) {
    return placeName
  }
  if (!address.ok) {
    return address
  }
  if (!approximateArea.ok) {
    return approximateArea
  }

  return {
    ok: true,
    data: {
      placeName: placeName.data,
      ...(address.data !== undefined ? { address: address.data } : {}),
      ...(approximateArea.data !== undefined
        ? { approximateArea: approximateArea.data }
        : {}),
    },
  }
}

function parseArray<T>(
  value: unknown,
  path: string,
  parseItem: (value: unknown, path: string) => ValidationResult<T>
): ValidationResult<T[]> {
  if (!Array.isArray(value)) {
    return validationError(`${path} must be an array`)
  }

  const parsedItems: T[] = []

  for (let index = 0; index < value.length; index += 1) {
    const parsedItem = parseItem(value[index], `${path}[${index}]`)

    if (!parsedItem.ok) {
      return parsedItem
    }

    parsedItems.push(parsedItem.data)
  }

  return { ok: true, data: parsedItems }
}

function asObject(value: unknown, path: string): ValidationResult<JsonObject> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return validationError(`${path} must be an object`)
  }

  return { ok: true, data: value as JsonObject }
}

function rejectUnknownKeys(object: JsonObject, allowedKeys: readonly string[]) {
  const allowed = new Set(allowedKeys)
  const unknownKey = Object.keys(object).find((key) => !allowed.has(key))

  return unknownKey === undefined ? null : `${unknownKey} is not allowed`
}

function readRequiredString(
  object: JsonObject,
  key: string,
  parentPath?: string
): ValidationResult<string> {
  return readStringValue(object[key], formatPath(key, parentPath))
}

function readStringValue(value: unknown, path: string): ValidationResult<string> {
  if (typeof value !== "string") {
    return validationError(`${path} must be a string`)
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return validationError(`${path} must not be empty`)
  }

  return { ok: true, data: trimmed }
}

function readIntegerInRange(
  object: JsonObject,
  key: string,
  minimum: number,
  maximum: number,
  parentPath?: string
): ValidationResult<number> {
  const value = object[key]
  const path = formatPath(key, parentPath)

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return validationError(`${path} must be an integer`)
  }

  if (value < minimum || value > maximum) {
    return validationError(`${path} must be between ${minimum} and ${maximum}`)
  }

  return { ok: true, data: value }
}

function readEnum<T extends string>(
  object: JsonObject,
  key: string,
  allowedValues: readonly T[],
  parentPath?: string
): ValidationResult<T> {
  const value = object[key]
  const path = formatPath(key, parentPath)

  if (typeof value !== "string") {
    return validationError(`${path} must be a string`)
  }

  if (!allowedValues.includes(value as T)) {
    return validationError(`${path} must be one of: ${allowedValues.join(", ")}`)
  }

  return { ok: true, data: value as T }
}

function optionalString(): ValidationResult<string | undefined> {
  return { ok: true, data: undefined }
}

function optionalEnum<T extends string>(): ValidationResult<T | undefined> {
  return { ok: true, data: undefined }
}

function validationError(error: string): ValidationResult<never> {
  return { ok: false, error }
}

function formatPath(key: string, parentPath?: string) {
  return parentPath === undefined ? key : `${parentPath}.${key}`
}
