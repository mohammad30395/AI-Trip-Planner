import type {
  BudgetTier,
  GenerativeUISelector,
  GroupType,
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
  | "complete"

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
  | { type: "submitSource"; value: string }
  | { type: "submitDestination"; value: string }
  | { type: "submitDuration"; value: number }
  | { type: "submitBudget"; value: BudgetTier }
  | { type: "submitGroup"; value: GroupSelection }
  | { type: "confirm" }
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
    case "submitSource":
      return continueFlow(state, {
        ...state.requirements,
        source: action.value.trim(),
      })
    case "submitDestination":
      return continueFlow(state, {
        ...state.requirements,
        destination: action.value.trim(),
      })
    case "submitDuration":
      return continueFlow(state, {
        ...state.requirements,
        durationDays: action.value,
      })
    case "submitBudget":
      return continueFlow(state, {
        ...state.requirements,
        budgetTier: action.value,
      })
    case "submitGroup":
      return continueFlow(state, {
        ...state.requirements,
        groupSize: action.value.groupSize,
        groupType: action.value.groupType,
      })
    case "confirm":
      return continueFlow(state, state.requirements)
    case "reset":
      return initialCreateTripState
  }
}

export function getCurrentSelector(step: TripRequirementStep): UISelector {
  if (step === "complete") {
    return "final"
  }

  return step
}

function continueFlow(
  state: CreateTripState,
  requirements: TripRequirements
): CreateTripState {
  const validationError = validateCurrentStep(state.currentStep, requirements)

  if (validationError !== null) {
    return {
      ...state,
      error: validationError,
      requirements,
    }
  }

  if (state.currentStep === "complete") {
    return state
  }

  const nextStep = getNextStep(state.currentStep)
  const userMessage = buildUserMessage(state.currentStep, requirements)
  const assistantMessage =
    nextStep === "complete"
      ? "Your local trip brief is ready. The AI itinerary generator will replace this mock flow in a later milestone."
      : getAssistantPrompt(nextStep, requirements)

  return {
    ...state,
    requirements,
    currentStep: nextStep,
    isLoading: false,
    error: null,
    messages: [
      ...state.messages,
      {
        id: `user-${state.currentStep}-${state.messages.length}`,
        role: "user",
        content: userMessage,
      },
      {
        id: `assistant-${nextStep}-${state.messages.length}`,
        role: "assistant",
        content: assistantMessage,
      },
    ],
  }
}

function getNextStep(step: TripRequirementStep): TripRequirementStep {
  switch (step) {
    case "source":
      return "destination"
    case "destination":
      return "duration"
    case "duration":
      return "budget"
    case "budget":
      return "group"
    case "group":
      return "review"
    case "review":
      return "complete"
    case "complete":
      return "complete"
  }
}

function getAssistantPrompt(
  step: TripRequirementStep,
  requirements: TripRequirements
) {
  switch (step) {
    case "destination":
      return `Starting from ${requirements.source}. Where do you want to go?`
    case "duration":
      return `Great. How many days should the ${requirements.destination} trip last?`
    case "budget":
      return "What budget tier should guide the plan?"
    case "group":
      return "Who is traveling, and how many people are in the group?"
    case "review":
      return "Review the trip brief. If it looks right, continue to lock this local shell state."
    case "source":
    case "complete":
      return "Where will your trip start?"
  }
}

function validateCurrentStep(
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
    case "complete":
      return null
  }
}

function validateRequiredText(value: string, message: string) {
  return value.trim().length > 0 ? null : message
}

function buildUserMessage(
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
    case "complete":
      return "Complete"
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
