import type {
  ConversationalStepResponse,
  FinalItineraryResponse,
} from "./contract"

export const validConversationalStepFixture: ConversationalStepResponse = {
  assistantText: "How many days should the Tokyo trip last?",
  nextUISelector: "duration",
  requirementUpdate: {
    source: "Dhaka",
    destination: "Tokyo",
  },
}

export const invalidConversationalStepFixtures: unknown[] = [
  {
    assistantText: "Choose a map view.",
    nextUISelector: "map",
  },
  {
    assistantText: "",
    nextUISelector: "budget",
  },
  {
    assistantText: "Trip length recorded.",
    nextUISelector: "budget",
    requirementUpdate: {
      durationDays: 0,
    },
  },
]

export const validFinalItineraryFixture: FinalItineraryResponse = {
  travelPlan: {
    source: "Dhaka",
    destination: "Tokyo",
    durationDays: 3,
    budgetTier: "mid-range",
    groupSize: 2,
    groupType: "couple",
  },
  summary:
    "A balanced three-day Tokyo plan with neighborhood exploration, food, and cultural stops.",
  hotels: [
    {
      name: "Shinjuku area stay",
      description:
        "Convenient base for rail access, restaurants, and evening walks.",
      area: "Shinjuku",
      priceTier: "mid-range",
      estimatedPriceText: "Generated estimate: mid-range nightly pricing.",
    },
  ],
  itinerary: [
    {
      dayNumber: 1,
      title: "Arrival and west Tokyo",
      activities: [
        {
          title: "Settle in near Shinjuku",
          description:
            "Arrive, check in, and keep the first afternoon light after travel.",
          timeOfDay: "afternoon",
          timeWindow: "Afternoon",
          duration: "2 hours",
          estimatedPriceText: "Generated estimate: transit and snacks only.",
          place: {
            kind: "generic_activity",
            name: null,
            addressHint: null,
            areaHint: null,
            originHint: null,
            destinationHint: null,
          },
        },
        {
          title: "Visit Tokyo Tower",
          description: "See the observation deck and nearby streets.",
          timeOfDay: "evening",
          timeWindow: "Evening",
          duration: "2 hours",
          estimatedPriceText: "Generated estimate: admission and local transit.",
          place: {
            kind: "specific_place",
            name: "Tokyo Tower",
            addressHint: null,
            areaHint: "Minato City",
            originHint: null,
            destinationHint: null,
          },
        },
      ],
    },
  ],
  practicalNotes: [
    "Use provider enrichment later for canonical place IDs, coordinates, optional images, and attribution.",
  ],
}

export const invalidFinalItineraryFixtures: unknown[] = [
  {
    summary: "Missing travel plan.",
    hotels: [],
    itinerary: [],
  },
  {
    travelPlan: {
      source: "Dhaka",
      destination: "Tokyo",
      durationDays: 3,
      budgetTier: "mid-range",
      groupSize: 2,
    },
    summary: "Includes coordinates that should not be authoritative.",
    hotels: [],
    itinerary: [
      {
        dayNumber: 1,
        title: "Coordinate test",
        activities: [
          {
            title: "Visit a place",
            description: "This fixture should fail because coordinates are present.",
            timeWindow: "Morning",
            estimatedPriceText: "Generated estimate.",
            place: {
              kind: "specific_place",
              name: "Tokyo Tower",
              addressHint: null,
              areaHint: null,
              originHint: null,
              destinationHint: null,
              latitude: 35.6586,
              longitude: 139.7454,
            },
          },
        ],
      },
    ],
  },
  {
    travelPlan: {
      source: "Dhaka",
      destination: "Tokyo",
      durationDays: 60,
      budgetTier: "luxury",
      groupSize: 2,
    },
    summary: "Out-of-contract travel plan.",
    hotels: [],
    itinerary: [],
  },
]
