import type {
  ConversationRequirements,
  ConversationRequestMessage,
} from "@/lib/ai/conversation"
import type {
  BudgetTier,
  ConversationalStepResponse,
  GenerativeUISelector,
  GroupType,
  NormalizedRequirementUpdate,
} from "@/lib/ai/contract"

export type { BudgetTier, GroupType } from "@/lib/ai/contract"

export type MessageRole = "assistant" | "user"

export type UISelector = GenerativeUISelector

export type TripRequirementStep =
  | "source"
  | "destination"
  | "duration"
  | "budget"
  | "group"
  | "review"
  | "readyForFinal"

export type ConversationMessage = {
  id: string
  role: MessageRole
  content: string
}

export type TripRequirements = {
  source: string
  destination: string
  durationDays: number | null
  budgetTier: BudgetTier | null
  groupSize: number | null
  groupType: GroupType | null
}

export type GroupSelection = {
  groupType: GroupType
  groupSize: number
}

export type CreateTripState = {
  requirements: TripRequirements
  messages: ConversationMessage[]
  currentStep: TripRequirementStep
  isLoading: boolean
  error: string | null
}

export type CreateTripAction =
  | {
      type: "localValidationFailed"
      requirements: TripRequirements
      error: string
    }
  | {
      type: "aiRequestStarted"
      requirements: TripRequirements
      userMessage: string
    }
  | { type: "aiRequestSucceeded"; response: ConversationalStepResponse }
  | { type: "aiRequestFailed"; error: string }
  | { type: "markReadyForFinal" }
  | { type: "reset" }

export const budgetOptions: Array<{
  value: BudgetTier
  label: string
  description: string
}> = [
  {
    value: "budget",
    label: "Budget",
    description: "Prioritize value stays and low-cost activities.",
  },
  {
    value: "mid-range",
    label: "Mid-range",
    description: "Balance comfort, convenience, and price.",
  },
  {
    value: "premium",
    label: "Premium",
    description: "Favor higher-comfort hotels and standout experiences.",
  },
]

export const groupTypeOptions: Array<{
  value: GroupType
  label: string
}> = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
  { value: "business", label: "Business" },
]

const initialRequirements: TripRequirements = {
  source: "",
  destination: "",
  durationDays: null,
  budgetTier: null,
  groupSize: null,
  groupType: null,
}

export const initialCreateTripState: CreateTripState = {
  requirements: initialRequirements,
  currentStep: "source",
  isLoading: false,
  error: null,
  messages: [
    {
      id: "assistant-source",
      role: "assistant",
      content: "Where will your trip start?",
    },
  ],
}

export function createTripReducer(
  state: CreateTripState,
  action: CreateTripAction
): CreateTripState {
  switch (action.type) {
    case "localValidationFailed":
      return {
        ...state,
        requirements: action.requirements,
        isLoading: false,
        error: action.error,
      }
    case "aiRequestStarted":
      return {
        ...state,
        requirements: action.requirements,
        isLoading: true,
        error: null,
        messages: [
          ...state.messages,
          {
            id: `user-${state.currentStep}-${state.messages.length}`,
            role: "user",
            content: action.userMessage,
          },
        ],
      }
    case "aiRequestSucceeded": {
      const requirements = applyRequirementUpdate(
        state.requirements,
        action.response.requirementUpdate
      )

      return {
        ...state,
        requirements,
        currentStep: getStepFromSelector(
          action.response.nextUISelector,
          requirements
        ),
        isLoading: false,
        error: null,
        messages: [
          ...state.messages,
          {
            id: `assistant-${action.response.nextUISelector}-${state.messages.length}`,
            role: "assistant",
            content: action.response.assistantText,
          },
        ],
      }
    }
    case "aiRequestFailed":
      return {
        ...state,
        isLoading: false,
        error: action.error,
      }
    case "markReadyForFinal":
      if (!areRequirementsComplete(state.requirements)) {
        return {
          ...state,
          isLoading: false,
          error: "Complete all trip requirements before continuing.",
        }
      }

      return {
        ...state,
        currentStep: "readyForFinal",
        isLoading: false,
        error: null,
        messages: [
          ...state.messages,
          {
            id: `user-review-${state.messages.length}`,
            role: "user",
            content: "Trip brief confirmed",
          },
          {
            id: `assistant-ready-${state.messages.length}`,
            role: "assistant",
            content:
              "READY_FOR_FINAL: your trip brief is complete. The next milestone will generate the itinerary.",
          },
        ],
      }
    case "reset":
      return initialCreateTripState
  }
}

export function getCurrentSelector(step: TripRequirementStep): UISelector {
  if (step === "readyForFinal") {
    return "final"
  }

  return step
}

export function applyRequirementUpdate(
  requirements: TripRequirements,
  update: NormalizedRequirementUpdate | undefined
): TripRequirements {
  if (update === undefined) {
    return requirements
  }

  return {
    ...requirements,
    ...(update.source !== undefined ? { source: update.source } : {}),
    ...(update.destination !== undefined
      ? { destination: update.destination }
      : {}),
    ...(update.durationDays !== undefined
      ? { durationDays: update.durationDays }
      : {}),
    ...(update.budgetTier !== undefined ? { budgetTier: update.budgetTier } : {}),
    ...(update.groupSize !== undefined ? { groupSize: update.groupSize } : {}),
    ...(update.groupType !== undefined ? { groupType: update.groupType } : {}),
  }
}

export function getCompactRequirements(
  requirements: TripRequirements
): ConversationRequirements {
  return {
    ...(requirements.source.trim().length > 0
      ? { source: requirements.source.trim() }
      : {}),
    ...(requirements.destination.trim().length > 0
      ? { destination: requirements.destination.trim() }
      : {}),
    ...(requirements.durationDays !== null
      ? { durationDays: requirements.durationDays }
      : {}),
    ...(requirements.budgetTier !== null
      ? { budgetTier: requirements.budgetTier }
      : {}),
    ...(requirements.groupSize !== null ? { groupSize: requirements.groupSize } : {}),
    ...(requirements.groupType !== null ? { groupType: requirements.groupType } : {}),
  }
}

export function getRecentConversationContext(
  messages: ConversationMessage[],
  nextUserMessage: string
): ConversationRequestMessage[] {
  return [
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "user" as const,
      content: nextUserMessage,
    },
  ].slice(-8)
}

export function getStepFromSelector(
  selector: UISelector,
  requirements: TripRequirements
): TripRequirementStep {
  if (selector === "final") {
    return areRequirementsComplete(requirements) ? "readyForFinal" : "review"
  }

  return selector
}

export function areRequirementsComplete(requirements: TripRequirements) {
  return (
    requirements.source.trim().length > 0 &&
    requirements.destination.trim().length > 0 &&
    requirements.durationDays !== null &&
    requirements.durationDays >= 1 &&
    requirements.durationDays <= 30 &&
    requirements.budgetTier !== null &&
    requirements.groupSize !== null &&
    requirements.groupSize >= 1 &&
    requirements.groupSize <= 20 &&
    requirements.groupType !== null
  )
}

export function validateCurrentStep(
  step: TripRequirementStep,
  requirements: TripRequirements
) {
  switch (step) {
    case "source":
      return validateRequiredText(requirements.source, "Enter a starting city.")
    case "destination":
      return validateRequiredText(
        requirements.destination,
        "Enter a destination."
      )
    case "duration":
      if (requirements.durationDays === null) {
        return "Enter a duration between 1 and 30 days."
      }
      if (requirements.durationDays < 1 || requirements.durationDays > 30) {
        return "Duration must be between 1 and 30 days."
      }
      return null
    case "budget":
      return requirements.budgetTier === null ? "Choose a budget tier." : null
    case "group":
      if (requirements.groupType === null) {
        return "Choose a group type."
      }
      if (requirements.groupSize === null) {
        return "Enter a group size between 1 and 20."
      }
      if (requirements.groupSize < 1 || requirements.groupSize > 20) {
        return "Group size must be between 1 and 20."
      }
      return null
    case "review":
    case "readyForFinal":
      return null
  }
}

function validateRequiredText(value: string, message: string) {
  return value.trim().length > 0 ? null : message
}

export function buildUserMessage(
  step: TripRequirementStep,
  requirements: TripRequirements
) {
  switch (step) {
    case "source":
      return `Start from ${requirements.source}`
    case "destination":
      return `Travel to ${requirements.destination}`
    case "duration":
      return `${requirements.durationDays} day${requirements.durationDays === 1 ? "" : "s"}`
    case "budget":
      return `${formatBudget(requirements.budgetTier)} budget`
    case "group":
      return `${requirements.groupSize} ${formatGroupType(requirements.groupType)} traveler${requirements.groupSize === 1 ? "" : "s"}`
    case "review":
      return "Trip brief confirmed"
    case "readyForFinal":
      return "Ready for final itinerary"
  }
}

export function formatBudget(value: BudgetTier | null) {
  if (value === null) {
    return "Not selected"
  }

  return budgetOptions.find((option) => option.value === value)?.label ?? value
}

export function formatGroupType(value: GroupType | null) {
  if (value === null) {
    return "traveler"
  }

  return (
    groupTypeOptions.find((option) => option.value === value)?.label.toLowerCase() ??
    value
  )
}
