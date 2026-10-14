import { getApiUrl } from '@/lib/api-url'
import { useAuthStore } from '@/stores/auth-store'
import type { AiModel } from '@/types'

// The five generation tools (ChargesForGeneratedFile.php) never throw on a real
// failure (insufficient OpenAI credits, wallet issues, etc.) — they catch it,
// correctly refund the wallet reservation, and return a plain string like
// "Image generation failed..." as the TOOL'S OWN successful result, so the
// model can narrate it to the user in plain chat. That means the SSE stream
// completes with no top-level `type: 'error'` event at all — indistinguishable
// from real success to the loop below, which only watches for that one event.
// Confirmed live, 2026-10-12: GPT Image 2 failed on every attempt (OpenAI org
// out of credits) while this workspace's toast still said "Image generated."
// Every one of these tools' successMessage literally contains "generated
// successfully" and none of unavailableMessage/generationFailedMessage/the
// wallet-refund strings do — checking for that substring on the known
// generator tools' own tool-output-available event is what actually tells
// success apart from a gracefully-narrated failure.
const GENERATOR_TOOL_NAMES = new Set([
  'GenerateImageTool',
  'GenerateDesignTool',
  'GeneratePresentationTool',
  'GeneratePdfTool',
  'GenerateDocxTool',
  'GenerateSpreadsheetTool',
])

/**
 * The Images and Designs workspaces trigger generation through the exact same
 * chat-completion + tool-calling mechanism as an ordinary chat message —
 * there's no separate "just generate a file" REST endpoint, since the model
 * itself decides whether/how to call GenerateImageTool/GenerateDesignTool (see
 * ChatController::stream()). This is a minimal, self-contained version of
 * chat/page.tsx's own streaming fetch — it doesn't parse or surface the
 * streamed text deltas at all, since neither workspace shows a chat transcript;
 * callers just await completion, then re-fetch their own gallery/list to pick
 * up whatever the tool call produced (chargeAndStore's own DB writes complete
 * synchronously mid-stream, well before the stream itself finishes).
 *
 * No session_id is sent — these aren't meant to create a visible chat thread
 * in the user's ordinary Chats list; the resulting file is what's persistent,
 * not the ephemeral prompt that produced it.
 */
export async function generateViaChat(params: {
  message: string
  modelId: string
  attachmentIds?: string[]
  designProjectId?: string
  // Explicit image-model override for the dedicated Images workspace's own model
  // dropdown — independent of `modelId` above, which picks the CONVERSATION/tool-
  // calling model, not which image-generation backend GenerateImageTool actually
  // calls. Omitted for plain in-chat generation, which silently uses the user's
  // package default instead (see ChatController::stream()).
  imageModelId?: string
}): Promise<void> {
  const accessToken = useAuthStore.getState().accessToken

  const controller = new AbortController()
  // Same generous timeout as chat/page.tsx's own — image/design generation
  // routinely takes well over a minute once wallet reserve/deduct and the
  // actual provider call are included.
  const timeoutId = setTimeout(() => controller.abort(), 180000)

  try {
    const res = await fetch(`${getApiUrl()}/api/v1/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: params.message,
        model_id: params.modelId,
        ...(params.attachmentIds?.length ? { attachment_ids: params.attachmentIds } : {}),
        ...(params.designProjectId ? { design_project_id: params.designProjectId } : {}),
        ...(params.imageModelId ? { image_model_id: params.imageModelId } : {}),
      }),
      signal: controller.signal,
    })

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.message ?? data?.error ?? 'Generation request failed.')
    }

    // The initial 200 only means the stream STARTED — the provider call can still
    // fail mid-stream (confirmed live, 2026-10-08: a Gemini connection drop produces
    // a 200 that completes normally with zero bytes "missing", just an SSE
    // `{type: "error"}` event buried in the body). Draining the reader without
    // decoding it, like this used to, treated that identically to a real success —
    // callers showed "Design generated"/"Image generated" while nothing was ever
    // stored. Mirrors chat/page.tsx's own line-based SSE parsing.
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    // tool-output-available/tool-output-error events carry only toolCallId +
    // output — NOT toolName (confirmed against the real SSE wire shape; this is
    // exactly why chat/page.tsx's own parser looks the name up from the earlier
    // tool-input-available event instead of reading it off the output event).
    // Checking GENERATOR_TOOL_NAMES.has(event.toolName) directly on the output
    // event was therefore always false, so no generation — successful or not —
    // was ever recorded, and every single Images/Designs workspace generation
    // showed a false "Generation failed" toast regardless of real outcome
    // (confirmed live, 2026-10-13). toolNames here mirrors that same lookup.
    const toolNames = new Map<string, string>()
    const generatorOutputs = new Map<string, string>()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const payload = line.replace(/^data:\s*/, '').trim()
        if (!payload || payload === '[DONE]') continue

        const event = JSON.parse(payload)
        if (event.type === 'error') {
          throw new Error(event.errorText ?? 'Generation failed partway through. Please try again.')
        }
        if (event.type === 'tool-input-available') {
          toolNames.set(event.toolCallId, event.toolName)
        }
        if (event.type === 'tool-output-available' && GENERATOR_TOOL_NAMES.has(toolNames.get(event.toolCallId) ?? '')) {
          generatorOutputs.set(event.toolCallId, String(event.output ?? ''))
        }
        if ((event.type === 'tool-output-error' || event.type === 'tool-output-denied') && GENERATOR_TOOL_NAMES.has(toolNames.get(event.toolCallId) ?? '')) {
          generatorOutputs.set(event.toolCallId, '')
        }
      }
    }

    // The stream itself completed cleanly, but that only means the CONVERSATION
    // turn finished — it says nothing about whether the generator tool the
    // model called (if any) actually produced a file. Verify that explicitly
    // rather than trusting completion as a proxy for success (same principle
    // ChatController::looksLikeUnverifiedFileClaim() already applies server-side
    // for the plain-chat case — this is the workspace-side equivalent).
    const outputs = [...generatorOutputs.values()]
    if (outputs.length === 0 || !outputs.some((output) => output.includes('generated successfully'))) {
      const failureMessage = outputs.find((output) => output.length > 0)
      throw new Error(failureMessage || 'Generation failed. Please try again.')
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Picks a sensible default model for a workspace generation call — the first
 * available model with function-calling support (required for any tool call
 * at all), and additionally vision support when editing an existing image
 * (ChatController rejects an attached image outright otherwise, even though
 * the actual edit happens via GenerateImageTool's own separate Gemini call,
 * not this chat model itself).
 */
export function pickGenerationModel(models: AiModel[], options: { requireVision?: boolean } = {}): AiModel | null {
  const candidates = models.filter((m) => m.capabilities?.function_calling && (!options.requireVision || m.capabilities?.vision))
  return candidates[0] ?? null
}
