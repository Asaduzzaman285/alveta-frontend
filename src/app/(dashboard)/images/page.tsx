'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, Download, ImageIcon, Loader2, Paperclip, Pencil, Sparkles, X } from 'lucide-react'
import * as RadixDialog from '@radix-ui/react-dialog'
import apiClient from '@/lib/api-client'
import { generateViaChat, pickGenerationModel } from '@/lib/generate-via-chat'
import { downloadFile, formatDate } from '@/lib/utils'
import { useAvailableModels } from '@/hooks/useAvailableModels'
import { useChatSession } from '@/contexts/ChatSessionContext'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { ProjectPicker } from '@/components/projects/ProjectPicker'
import { ModelIcon } from '@/components/chat/ModelIcon'
import { Folder } from 'lucide-react'
import type { FileAttachment, GeneratedImage } from '@/types'

/**
 * Dedicated generation/edit workspace, not a passive gallery — see
 * aichathub/plans/images-designs-workspaces.md section A1. A user can
 * generate a new image here without first opening a normal chat, and every
 * "Edit this image" always resolves and resends the actual source asset (via
 * attachment_ids, exactly like a manual re-attach in chat) — that explicit
 * action is what section A2's edit-lineage exists to record correctly,
 * without needing to solve the harder "infer which image from bare chat text"
 * problem this workspace deliberately sidesteps.
 */
export default function ImagesPage() {
  const queryClient = useQueryClient()
  const { availableModels, availableImageModels, defaultImageModelId } = useAvailableModels()
  const { projects: projectsData } = useChatSession()
  const projects = projectsData ?? []
  const [prompt, setPrompt] = useState('')
  const [detailImage, setDetailImage] = useState<GeneratedImage | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editPrompt, setEditPrompt] = useState('')
  // Filters "My Images" to one Project — assignment itself happens from the
  // detail dialog below, never at generation time (see ProjectPicker's own
  // comment).
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null)

  // Which image model this specific generation uses — defaults to the package's
  // own default_image_model_id (same one used silently inside plain chat), but
  // switchable here to any other model that package grants (see
  // plans/image-generation-model-tiering.md / the 2026-09-17 package-roster plan).
  // A plain useState rather than deriving it inline: the user's explicit choice
  // must survive re-renders even after the query settles, and shouldn't snap back
  // if they'd already picked something non-default before this effect ran.
  const [selectedImageModelId, setSelectedImageModelId] = useState<string | null>(null)
  useEffect(() => {
    if (selectedImageModelId === null && defaultImageModelId) setSelectedImageModelId(defaultImageModelId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultImageModelId])
  const selectedImageModel = availableImageModels.find((m) => m.model_id === selectedImageModelId) ?? null

  // A source image to generate FROM (image-to-image), separate from re-editing an
  // already-generated gallery image below — previously this page had no way to
  // bring in an external/local photo at all, only "Edit this image" on something
  // already in "My Images". Single attachment, not the chat composer's up-to-4 —
  // one clear reference image is what image-to-image generation actually uses.
  const [pendingAttachment, setPendingAttachment] = useState<FileAttachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: images, isLoading } = useQuery({
    queryKey: ['images', 'gallery', filterProjectId],
    queryFn: async () =>
      (await apiClient.get<{ images: GeneratedImage[] }>('/api/v1/images', {
        params: filterProjectId ? { project_id: filterProjectId } : undefined,
      })).data.images,
  })

  const assignImageProject = useMutation({
    mutationFn: async (params: { id: string; projectId: string | null }) =>
      (await apiClient.patch<{ attachment: GeneratedImage }>(`/api/v1/upload/${params.id}`, { project_id: params.projectId })).data,
    onSuccess: (res) => {
      setDetailImage(res.attachment)
      // Invalidates every filtered variant of the gallery query (the old and
      // new project's own filtered lists included), not just the unfiltered one.
      queryClient.invalidateQueries({ queryKey: ['images', 'gallery'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Couldn't move that image."),
  })

  const generate = useMutation({
    mutationFn: async (params: { message: string; attachmentIds?: string[] }) => {
      const model = pickGenerationModel(availableModels, { requireVision: !!params.attachmentIds?.length })
      if (!model) throw new Error('No available model supports image generation right now.')
      if (!selectedImageModelId) throw new Error('No image generation model is available on your plan.')
      await generateViaChat({
        message: params.message,
        modelId: model.model_id,
        attachmentIds: params.attachmentIds,
        imageModelId: selectedImageModelId,
      })
    },
    onSuccess: () => {
      toast.success('Image generated.')
      queryClient.invalidateQueries({ queryKey: ['images', 'gallery'] })
      setPrompt('')
      setEditPrompt('')
      setEditMode(false)
      setPendingAttachment(null)
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Image generation failed.'),
  })

  const handleGenerate = () => {
    const text = prompt.trim()
    if (!text || generate.isPending) return
    generate.mutate({ message: text, attachmentIds: pendingAttachment ? [pendingAttachment.id] : undefined })
  }

  // Same upload endpoint/shape as the chat composer's uploadAttachment — no
  // session_id here (session_id is nullable server-side; this page never has a
  // chat session to attribute the upload to).
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiClient.post<{ attachment: FileAttachment }>('/api/v1/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPendingAttachment(res.data.attachment)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? "We couldn't upload that image — please try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = () => {
    const text = editPrompt.trim()
    if (!text || !detailImage || generate.isPending) return
    generate.mutate({ message: text, attachmentIds: [detailImage.id] })
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Images</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate new images, or open one below to edit it further.
        </p>

        {/* Composer — a real generation entry point, not just a gallery. */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          {pendingAttachment && (
            <div className="mb-2 flex items-center gap-2">
              <div className="group relative h-14 w-14 shrink-0">
                <img src={pendingAttachment.storage_url} alt={pendingAttachment.original_name} className="h-full w-full rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setPendingAttachment(null)}
                  aria-label="Remove attached image"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Generating from this reference image</p>
            </div>
          )}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() }
            }}
            placeholder={pendingAttachment ? 'Describe how to change this image...' : 'Describe a new image...'}
            rows={2}
            className="w-full resize-none rounded-lg border-0 bg-transparent p-1 text-sm focus:outline-none"
          />
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelect} className="hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="Attach a reference image"
                title="Attach a reference image"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
              {/* Which image model this generation actually uses — defaults to the
                  package's own default, switchable to any other model that package
                  grants. No picker like this exists inside plain chat on purpose
                  (the default is applied there silently) — this dedicated workspace
                  is specifically where an explicit choice makes sense. */}
              {availableImageModels.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {selectedImageModel && <ModelIcon provider={selectedImageModel.provider} className="h-3.5 w-3.5" />}
                      {selectedImageModel?.name ?? 'Select model'}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {availableImageModels.map((m) => (
                      <DropdownMenuItem key={m.model_id} onSelect={() => setSelectedImageModelId(m.model_id)}>
                        <ModelIcon provider={m.provider} className="h-4 w-4 shrink-0" />
                        <span className="truncate">{m.name}</span>
                        {m.model_id === defaultImageModelId && (
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">Default</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <Button onClick={handleGenerate} disabled={!prompt.trim() || generate.isPending || uploading} className="gap-1.5 rounded-full">
              {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generate.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>

        {/* Library */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">My Images</h2>
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
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-card" />
              ))}
            </div>
          ) : !images?.length ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No images yet — generate your first one above.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => { setDetailImage(img); setEditMode(false); setEditPrompt('') }}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
                >
                  <img src={img.storage_url} alt={img.original_prompt ?? img.original_name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  {img.parent_asset_id && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Edit
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail view — prompt/model/date + explicit "Edit this image", the
          unambiguous entry point section A2's lineage recording relies on. */}
      <RadixDialog.Root open={!!detailImage} onOpenChange={(open) => !open && setDetailImage(null)}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <RadixDialog.Content
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-card shadow-2xl sm:flex-row"
            aria-describedby={undefined}
          >
            <RadixDialog.Title className="sr-only">Image detail</RadixDialog.Title>
            {detailImage && (
              <>
                <div className="flex-1 bg-black/5">
                  <img src={detailImage.storage_url} alt={detailImage.original_prompt ?? ''} className="h-full max-h-[85vh] w-full object-contain" />
                </div>
                <div className="flex w-full flex-col gap-3 p-5 sm:w-72 sm:shrink-0">
                  {detailImage.original_prompt && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Prompt</p>
                      <p className="mt-0.5 text-sm text-foreground">{detailImage.original_prompt}</p>
                    </div>
                  )}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {detailImage.model && <span>{detailImage.model}</span>}
                    <span>{formatDate(detailImage.created_at)}</span>
                  </div>

                  {projects.length > 0 && (
                    <ProjectPicker
                      projects={projects}
                      currentProjectId={detailImage.project_id}
                      disabled={assignImageProject.isPending}
                      onAssign={(projectId) => assignImageProject.mutate({ id: detailImage.id, projectId })}
                    />
                  )}

                  {editMode ? (
                    <div className="mt-1 space-y-2">
                      <textarea
                        autoFocus
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="Describe the edit…"
                        rows={3}
                        className="w-full resize-none rounded-lg border border-input bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="flex gap-2">
                        <Button className="flex-1 gap-1.5 px-3 py-1.5 text-xs" onClick={handleEdit} disabled={!editPrompt.trim() || generate.isPending}>
                          {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                          {generate.isPending ? 'Editing…' : 'Apply edit'}
                        </Button>
                        <Button className="px-3 py-1.5 text-xs" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-col gap-2">
                      <Button className="gap-1.5 px-3 py-1.5 text-xs" onClick={() => setEditMode(true)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit this image
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-1.5 px-3 py-1.5 text-xs"
                        onClick={() => downloadFile(detailImage.id, detailImage.original_name)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
            <RadixDialog.Close
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </div>
  )
}
