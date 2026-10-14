'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, Folder, Loader2, Sparkles, Trash2 } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { generateViaChat, pickGenerationModel } from '@/lib/generate-via-chat'
import { describeError } from '@/lib/errors'
import { formatDate } from '@/lib/utils'
import { useAvailableModels } from '@/hooks/useAvailableModels'
import { useChatSession } from '@/contexts/ChatSessionContext'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import type { DesignProject } from '@/types'

/**
 * Dedicated prototype/design-generation workspace — see
 * aichathub/plans/images-designs-workspaces.md section C. Each row here is a
 * persistent, versioned design_project (see the detail page for the sandboxed
 * live preview + "Refine this"), not a one-shot file in a flat list.
 */
export default function DesignsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { availableModels, defaultDesignModelId } = useAvailableModels()
  const { projects: projectsData } = useChatSession()
  const projects = projectsData ?? []
  const [prompt, setPrompt] = useState('')
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null)

  const { data: designs, isLoading } = useQuery({
    queryKey: ['designs', filterProjectId],
    queryFn: async () =>
      (await apiClient.get<{ designs: DesignProject[] }>('/api/v1/designs', {
        params: filterProjectId ? { project_id: filterProjectId } : undefined,
      })).data.designs,
  })

  const generate = useMutation({
    mutationFn: async (message: string) => {
      // Prefer the package's admin-set, cost-aware default over the generic
      // "first available model" pick — see default_design_model_id's own
      // comment on why: an unset/ungranted default here used to mean whichever
      // text model happened to sort first drove every design generation,
      // confirmed live landing on the most expensive model in the catalog.
      const defaultModel = defaultDesignModelId ? availableModels.find((m) => m.model_id === defaultDesignModelId) : null
      const model = defaultModel ?? pickGenerationModel(availableModels)
      if (!model) throw new Error('No available model supports design generation right now.')
      await generateViaChat({ message, modelId: model.model_id })
    },
    onSuccess: async () => {
      toast.success('Design generated.')
      setPrompt('')
      // Invalidates every filtered variant of the list — a new design always
      // starts with no project, so it only shows up in the unfiltered list.
      await queryClient.invalidateQueries({ queryKey: ['designs'] })
      const latest = queryClient.getQueryData<DesignProject[]>(['designs', filterProjectId])?.[0]
      if (latest) router.push(`/designs/${latest.id}`)
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Design generation failed.'),
  })

  const deleteDesign = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/v1/designs/${id}`),
    onSuccess: () => {
      toast.success('Design deleted.')
      queryClient.invalidateQueries({ queryKey: ['designs'] })
    },
    onError: (err: unknown) => toast.error(describeError(err, "We couldn't delete that design — please try again.").message),
  })

  const handleGenerate = () => {
    const text = prompt.trim()
    if (!text || generate.isPending) return
    generate.mutate(text)
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Designs</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe a page or mockup — preview it live, refine it, and download the source.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A premium SaaS pricing page with three tiers"
            rows={2}
            className="w-full resize-none rounded-lg border-0 bg-transparent p-1 text-sm focus:outline-none"
          />
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={!prompt.trim() || generate.isPending} className="gap-1.5 rounded-full">
              {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generate.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">My Designs</h2>
          {projects.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Folder className="h-3.5 w-3.5" />
                  {projects.find((p) => p.id === filterProjectId)?.name ?? 'All projects'}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setFilterProjectId(null)}>
                  <span className="truncate">All projects</span>
                </DropdownMenuItem>
                {projects.map((p) => (
                  <DropdownMenuItem key={p.id} onSelect={() => setFilterProjectId(p.id)}>
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{p.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />)
          ) : !designs?.length ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No designs yet — describe one above to get started.
            </div>
          ) : (
            designs.map((design) => (
              <div
                key={design.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent"
              >
                <button onClick={() => router.push(`/designs/${design.id}`)} className="flex flex-1 items-center gap-3 text-left">
                  {design.current_version?.attachment && (
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-white">
                      {/* A tiny scaled-down live render — genuinely the design's own
                          HTML, not a screenshot, so the thumbnail is never stale. */}
                      <iframe
                        src={design.current_version.attachment.storage_url}
                        sandbox=""
                        className="h-[300%] w-[300%] origin-top-left scale-[0.333] border-0"
                        tabIndex={-1}
                        title={design.title}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{design.title}</p>
                    <p className="text-xs text-muted-foreground">Updated {formatDate(design.updated_at)}</p>
                  </div>
                </button>
                <button
                  onClick={() => window.confirm(`Delete "${design.title}"?`) && deleteDesign.mutate(design.id)}
                  className="p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete design"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
