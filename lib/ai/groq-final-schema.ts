import "server-only"

const nullableBudgetTierSchema = {
  type: ["string", "null"],
  enum: ["budget", "mid-range", "premium", null],
} as const

const nullableGroupTypeSchema = {
  type: ["string", "null"],
  enum: ["solo", "couple", "family", "friends", "business", null],
} as const

const nullableStringSchema = {
  type: ["string", "null"],
  minLength: 1,
} as const

const groqFinalItineraryWireSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "travelPlan",
    "summary",
    "hotels",
    "itinerary",
    "practicalNotes",
  ],
  properties: {
    travelPlan: {
      type: "object",
      additionalProperties: false,
      required: [
        "source",
        "destination",
        "durationDays",
        "budgetTier",
        "groupSize",
        "groupType",
      ],
      properties: {
        source: { type: "string", minLength: 1 },
        destination: { type: "string", minLength: 1 },
        durationDays: { type: "integer", minimum: 1, maximum: 30 },
        budgetTier: {
          type: "string",
          enum: ["budget", "mid-range", "premium"],
        },
        groupSize: { type: "integer", minimum: 1, maximum: 20 },
        groupType: nullableGroupTypeSchema,
      },
    },
    summary: { type: "string", minLength: 1 },
    hotels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "description",
          "area",
          "address",
          "priceTier",
          "estimatedPriceText",
        ],
        properties: {
          name: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          area: nullableStringSchema,
          address: nullableStringSchema,
          priceTier: nullableBudgetTierSchema,
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
                "timeOfDay",
                "timeWindow",
                "duration",
                "estimatedPriceText",
                "place",
              ],
              properties: {
                title: { type: "string", minLength: 1 },
                description: { type: "string", minLength: 1 },
                timeOfDay: {
                  type: ["string", "null"],
                  enum: [
                    "morning",
                    "afternoon",
                    "evening",
                    "night",
                    "flexible",
                    null,
                  ],
                },
                timeWindow: { type: "string", minLength: 1 },
                duration: nullableStringSchema,
                estimatedPriceText: { type: "string", minLength: 1 },
                place: {
                  anyOf: [
                    strictPlaceSchema("specific_place", {
                      type: "string",
                      minLength: 1,
                    }),
                    strictPlaceSchema("generic_activity", { type: "null" }),
                    strictPlaceSchema("transport", { type: "null" }),
                  ],
                },
              },
            },
          },
        },
      },
    },
    practicalNotes: {
      type: ["array", "null"],
      items: { type: "string", minLength: 1 },
    },
  },
} as const

type JsonObject = Record<string, unknown>

function strictPlaceSchema(
  kind: "specific_place" | "generic_activity" | "transport",
  nameSchema: { readonly type: "null" } | {
    readonly type: "string"
    readonly minLength: 1
  }
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
      addressHint: nullableStringSchema,
      areaHint: nullableStringSchema,
      originHint: nullableStringSchema,
      destinationHint: nullableStringSchema,
    },
  } as const
}

function normalizeGroqFinalItineraryWire(value: unknown): unknown {
  if (!isObject(value)) {
    return value
  }

  const normalized = omitNullProperties(value, ["practicalNotes"])

  if (isObject(normalized.travelPlan)) {
    normalized.travelPlan = omitNullProperties(normalized.travelPlan, [
      "groupType",
    ])
  }

  if (Array.isArray(normalized.hotels)) {
    normalized.hotels = normalized.hotels.map((hotel) =>
      isObject(hotel)
        ? omitNullProperties(hotel, ["area", "address", "priceTier"])
        : hotel
    )
  }

  if (Array.isArray(normalized.itinerary)) {
    normalized.itinerary = normalized.itinerary.map(normalizeDay)
  }

  return normalized
}

function normalizeDay(value: unknown) {
  if (!isObject(value)) {
    return value
  }

  const day = { ...value }

  if (Array.isArray(day.activities)) {
    day.activities = day.activities.map(normalizeActivity)
  }

  return day
}

function normalizeActivity(value: unknown) {
  if (!isObject(value)) {
    return value
  }

  const activity = omitNullProperties(value, ["timeOfDay", "duration"])

  if (isObject(activity.place)) {
    activity.place = omitNullProperties(activity.place, [
      "name",
      "addressHint",
      "areaHint",
      "originHint",
      "destinationHint",
    ])
  }

  return activity
}

function omitNullProperties(value: JsonObject, keys: readonly string[]) {
  const normalized = { ...value }

  for (const key of keys) {
    if (normalized[key] === null) {
      delete normalized[key]
    }
  }

  return normalized
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export {
  groqFinalItineraryWireSchema,
  normalizeGroqFinalItineraryWire,
}
