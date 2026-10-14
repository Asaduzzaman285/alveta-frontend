'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Download, Loader2, Sparkles } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { generateViaChat, pickGenerationModel } from '@/lib/generate-via-chat'
import { downloadFile } from '@/lib/utils'
import { useAvailableModels } from '@/hooks/useAvailableModels'
import { useChatSession } from '@/contexts/ChatSessionContext'
import { Button } from '@/components/ui/Button'
import { ProjectPicker } from '@/components/projects/ProjectPicker'
import type { DesignProject } from '@/types'

/**
 * Sandboxed live preview + "Refine this" — see
 * aichathub/plans/images-designs-workspaces.md section C, point 2. `sandbox`
 * deliberately omits `allow-same-origin`: the generated HTML can run its own
 * scripts (allow-scripts), but can never read this app's own cookies/session
 * or call our API as the logged-in user, since it's treated as a fully
 * separate, untrusted origin. This is the actual security-relevant line the
 * plan calls out — not just "stick it in an iframe."
 */
export default function DesignDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { availableModels, defaultDesignModelId } = useAvailableModels()
  const { projects: projectsData } = useChatSession()
  const projects = projectsData ?? []
  const [refinePrompt, setRefinePrompt] = useState('')

  const { data: design, isLoading } = useQuery({
    queryKey: ['designs', params.id],
    queryFn: async () => (await apiClient.get<{ design: DesignProject }>(`/api/v1/designs/${params.id}`)).data.design,
  })

  const assignProject = useMutation({
    mutationFn: async (projectId: string | null) =>
      (await apiClient.patch<{ design: DesignProject }>(`/api/v1/designs/${params.id}`, { project_id: projectId })).data.design,
    onSuccess: (updated) => {
      queryClient.setQueryData(['designs', params.id], updated)
      queryClient.invalidateQueries({ queryKey: ['designs'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Couldn't move this design."),
  })

  const refine = useMutation({
    mutationFn: async (message: string) => {
      // Same cost-aware default preference as designs/page.tsx's own generate
      // mutation — refining an existing design is a separate generation call
      // and needs the same fix, not just the initial create.
      const defaultModel = defaultDesignModelId ? availableModels.find((m) => m.model_id === defaultDesignModelId) : null
      const model = defaultModel ?? pickGenerationModel(availableModels)
      if (!model) throw new Error('No available model supports design generation right now.')
      await generateViaChat({ message, modelId: model.model_id, designProjectId: params.id })
    },
    onSuccess: () => {
      toast.success('Design updated.')
      setRefinePrompt('')
      queryClient.invalidateQueries({ queryKey: ['designs', params.id] })
      queryClient.invalidateQueries({ queryKey: ['designs'] })
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Refinement failed.'),
  })

  const handleRefine = () => {
    const text = refinePrompt.trim()
    if (!text || refine.isPending) return
    refine.mutate(text)
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>
  }

  if (!design) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>Design not found.</p>
        <Button variant="outline" onClick={() => router.push('/designs')}>Back to Designs</Button>
      </div>
    )
  }

  const attachment = design.current_version?.attachment

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => router.push('/designs')} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Back to Designs">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="truncate text-sm font-semibold text-foreground">{design.title}</h1>
          {projects.length > 0 && (
            <ProjectPicker
              projects={projects}
              currentProjectId={design.project_id}
              disabled={assignProject.isPending}
              onAssign={(projectId) => assignProject.mutate(projectId)}
            />
          )}
        </div>
        {attachment && (
          <Button
            variant="outline"
            className="shrink-0 gap-1.5 rounded-full px-3 py-1.5 text-xs"
            onClick={() => downloadFile(attachment.id, `${design.title}.html`)}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden bg-neutral-100">
        {attachment ? (
          <iframe
            src={attachment.storage_url}
            sandbox="allow-scripts"
            className="h-full w-full border-0"
            title={design.title}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No preview available.</div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            value={refinePrompt}
            onChange={(e) => setRefinePrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRefine() }}
            placeholder="Refine this design…"
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button onClick={handleRefine} disabled={!refinePrompt.trim() || refine.isPending} className="shrink-0 gap-1.5 rounded-full">
            {refine.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {refine.isPending ? 'Refining…' : 'Refine'}
          </Button>
        </div>
      </div>
    </div>
  )
}
