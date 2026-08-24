import type {
  ConversationalStepResponse,
  GenerativeUISelector,
} from "@/lib/ai/contract"

type FallbackConversationRequirements = {
  source?: string
  destination?: string
  durationDays?: number
  budgetTier?: string
  groupSize?: number
  groupType?: string
}

function buildFallbackConversationResponse(
  requirements: FallbackConversationRequirements
): ConversationalStepResponse {
  const nextUISelector = getNextConversationSelector(requirements)

  return {
    assistantText: getFallbackAssistantText(nextUISelector),
    nextUISelector,
  }
}

function getNextConversationSelector(
  requirements: FallbackConversationRequirements
): GenerativeUISelector {
  if (requirements.source === undefined) {
    return "source"
  }

  if (requirements.destination === undefined) {
    return "destination"
  }

  if (requirements.durationDays === undefined) {
    return "duration"
  }

  if (requirements.budgetTier === undefined) {
    return "budget"
  }

  if (
    requirements.groupSize === undefined ||
    requirements.groupType === undefined
  ) {
    return "group"
  }

  return "review"
}

function getFallbackAssistantText(selector: GenerativeUISelector) {
  switch (selector) {
    case "source":
      return "Where will your trip start?"
    case "destination":
      return "Got it. Where would you like to go?"
    case "duration":
      return "How many days should the trip last?"
    case "budget":
      return "What budget style should I plan around?"
    case "group":
      return "Who is traveling, and how many people are in the group?"
    case "review":
      return "Your trip brief is complete. Review the details before generating the final itinerary."
    case "final":
      return "Your trip brief is ready for final itinerary generation."
  }
}

export { buildFallbackConversationResponse }
