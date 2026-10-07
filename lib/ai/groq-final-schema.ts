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
        source: { type: "string" },
        destination: { type: "string" },
        durationDays: { type: "integer" },
        budgetTier: {
          type: "string",
          enum: ["budget", "mid-range", "premium"],
        },
        groupSize: { type: "integer" },
        groupType: nullableGroupTypeSchema,
      },
    },
    summary: { type: "string" },
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
          name: { type: "string" },
          description: { type: "string" },
          area: nullableStringSchema,
          address: nullableStringSchema,
          priceTier: nullableBudgetTierSchema,
          estimatedPriceText: { type: "string" },
        },
      },
    },
    itinerary: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dayNumber", "title", "activities"],
        properties: {
          dayNumber: { type: "integer" },
          title: { type: "string" },
          activities: {
            type: "array",
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
                title: { type: "string" },
                description: { type: "string" },
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
                timeWindow: { type: "string" },
                duration: nullableStringSchema,
                estimatedPriceText: { type: "string" },
                place: {
                  anyOf: [
                    strictPlaceSchema("specific_place", {
                      type: "string",
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
      items: { type: "string" },
    },
  },
} as const

type JsonObject = Record<string, unknown>

function strictPlaceSchema(
  kind: "specific_place" | "generic_activity" | "transport",
  nameSchema: { readonly type: "null" } | {
    readonly type: "string"
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
