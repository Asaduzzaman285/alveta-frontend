'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import type { AiModel } from '@/types'

// Shared by (dashboard)/layout.tsx (the "+ New chat" caret's private-chat popover) and
// chat/page.tsx (the auto-create-on-empty effect and the model switcher) so both read
// the same React Query cache entry — one network fetch, and "what counts as the
// default model" (first available text model — no is_default/last-used concept exists
// on AiModel) is defined in exactly one place.
export function useAvailableModels() {
  const { data, isLoading: modelsLoading } = useQuery({
    queryKey: ['models'],
    queryFn: async () =>
      (await apiClient.get<{ models: AiModel[]; default_image_model_id: string | null; default_design_model_id: string | null; default_model_id: string | null }>('/api/v1/models')).data,
  })
  const models = data?.models

  const availableModels = useMemo(() => (models ?? []).filter((m) => m.type === 'text' && m.available), [models])
  // Same shape as availableModels above, for the dedicated Images workspace's own
  // model dropdown — see plans/image-generation-model-tiering.md and the
  // 2026-09-17 package-roster plan for why this isn't just a single hardcoded
  // model anymore.
  const availableImageModels = useMemo(() => (models ?? []).filter((m) => m.type === 'image_generation' && m.available), [models])

  return {
    models, availableModels, availableImageModels,
    defaultImageModelId: data?.default_image_model_id ?? null,
    // Same purpose as defaultImageModelId, for the Designs workspace — see that
    // field's own comment and AdminPackage's default_design_model_id.
    defaultDesignModelId: data?.default_design_model_id ?? null,
    // Server-resolved: the user's own override (Account tab) if set and still
    // valid for their plan, else the package's admin-set default, else null
    // (callers fall back to availableModels[0] same as before this existed —
    // see ModelController::index()'s own comment on the backend).
    defaultModelId: data?.default_model_id ?? null,
    modelsLoading,
  }
}
