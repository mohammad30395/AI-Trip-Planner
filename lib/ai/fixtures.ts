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
          duration: "2 hours",
          place: {
            placeName: "Shinjuku Station area",
            approximateArea: "Shinjuku",
          },
        },
      ],
    },
  ],
  practicalNotes: [
    "Use Google Places enrichment later for canonical place IDs, coordinates, and photos.",
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
            place: {
              placeName: "Tokyo Tower",
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
