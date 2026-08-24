import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import {
  parseTripConversationRequest,
  type ConversationRequirements,
  type TripConversationRequest,
  type TripConversationResponseEnvelope,
} from "@/lib/ai/conversation"
import {
  OpenRouterConfigurationError,
  OPENROUTER_TIMEOUT_MS,
  runOpenRouterConversationStep,
  type OpenRouterConversationMessage,
} from "@/lib/ai/openrouter"
import { buildFallbackConversationResponse } from "@/lib/ai/conversation-fallback"
import type {
  ConversationalStepResponse,
  GenerativeUISelector,
  NormalizedRequirementUpdate,
} from "@/lib/ai/contract"

export const runtime = "nodejs"

export async function POST(request: Request) {
  await auth.protect()

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return conversationError("Request body must be valid JSON.", 400)
  }

  const parsedRequest = parseTripConversationRequest(body)

  if (!parsedRequest.ok) {
    return conversationError("Trip conversation request is invalid.", 400)
  }

  try {
    const result = await runOpenRouterConversationStep(
      {
        messages: buildConversationMessages(parsedRequest.data),
        maxTokens: 700,
      },
      AbortSignal.timeout(OPENROUTER_TIMEOUT_MS)
    )

    if (!result.ok) {
      return conversationFallback(parsedRequest.data.requirements)
    }

    const response = normalizeConversationResponse(
      result.data.response,
      parsedRequest.data.requirements
    )

    return NextResponse.json({
      ok: true,
      response,
    } satisfies TripConversationResponseEnvelope)
  } catch (error) {
    if (error instanceof OpenRouterConfigurationError) {
      return conversationFallback(parsedRequest.data.requirements)
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("AI conversation route diagnostic", {
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }

    return conversationFallback(parsedRequest.data.requirements)
  }
}

function buildConversationMessages(
  request: TripConversationRequest
): OpenRouterConversationMessage[] {
  return [
    {
      role: "system",
      content: buildSystemInstruction(),
    },
    {
      role: "user",
      content: `Current normalized requirements JSON: ${JSON.stringify(
        request.requirements
      )}`,
    },
    ...request.messages,
  ]
}

function buildSystemInstruction() {
  return [
    "You are a concise trip-planning interviewer for an authenticated AI trip planner.",
    "Collect only these required inputs: source, destination, durationDays, budgetTier, groupSize, and groupType.",
    "Ask for exactly one missing requirement at a time using the matching nextUISelector: source, destination, duration, budget, or group.",
    "When all required inputs are known, set nextUISelector to review. Do not set final, do not generate an itinerary, and do not mention hotels or activities yet.",
    "Use requirementUpdate only for normalized values that are already known from the user or current requirements.",
    "Use budgetTier values only: budget, mid-range, premium.",
    "Use groupType values only: solo, couple, family, friends, business.",
    "Return only the strict JSON Schema response. No prose outside JSON.",
  ].join(" ")
}

function normalizeConversationResponse(
  response: ConversationalStepResponse,
  currentRequirements: ConversationRequirements
): ConversationalStepResponse {
  const requirements = mergeRequirements(
    currentRequirements,
    response.requirementUpdate
  )
  const missingSelector = getFirstMissingSelector(requirements)

  if (missingSelector !== null && response.nextUISelector === "review") {
    return {
      ...response,
      nextUISelector: missingSelector,
    }
  }

  if (response.nextUISelector === "final") {
    return {
      ...response,
      nextUISelector: missingSelector ?? "review",
    }
  }

  return response
}

function mergeRequirements(
  requirements: ConversationRequirements,
  update: NormalizedRequirementUpdate | undefined
): ConversationRequirements {
  if (update === undefined) {
    return requirements
  }

  return {
    ...requirements,
    ...update,
  }
}

function getFirstMissingSelector(
  requirements: ConversationRequirements
): Exclude<GenerativeUISelector, "review" | "final"> | null {
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

  return null
}

function conversationError(error: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error,
    } satisfies TripConversationResponseEnvelope,
    { status }
  )
}

function conversationFallback(requirements: ConversationRequirements) {
  return NextResponse.json({
    ok: true,
    response: buildFallbackConversationResponse(requirements),
  } satisfies TripConversationResponseEnvelope)
}
