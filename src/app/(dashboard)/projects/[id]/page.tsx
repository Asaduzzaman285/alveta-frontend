'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ImageIcon, Pencil, Sparkles, Trash2 } from 'lucide-react'
import apiClient from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { useChatSession } from '@/contexts/ChatSessionContext'
import { Button } from '@/components/ui/Button'
import { SessionRow } from '@/components/chat/SessionRow'
import type { ChatSession, DesignProject, GeneratedImage } from '@/types'

/**
 * Cross-type view for a single Project — chats, images, and designs
 * together, which the sidebar's own per-project expand only ever showed
 * chats for. Reuses the already-fetched project/session lists from
 * useChatSession() (no new GET /projects/{id} or GET /sessions?project_id=
 * endpoint needed for those two); images/designs each get their own
 * project-filtered fetch since there's no equivalent shared context for them.
 *
 * Houses the fuller two-option delete confirmation Sidebar.tsx's own
 * confirmDeleteProject() comment explicitly deferred to "a real project
 * settings view" rather than a plain window.confirm.
 */
export default function ProjectOverviewPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const {
    projects, sessions, renameSession, deleteSession, renameProject, deleteProject,
  } = useChatSession()

  const [renamingProject, setRenamingProject] = useState(false)
  const [projectNameValue, setProjectNameValue] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [sessionRenameValue, setSessionRenameValue] = useState('')

  const project = projects?.find((p) => p.id === params.id) ?? null

  // Same "only a chat with a real message counts" rule Sidebar.tsx applies —
  // an empty "New Chat" placeholder never shows in either list.
  const projectSessions = sessions?.filter((s) => s.project_id === params.id && s.message_count > 0) ?? []

  const { data: images, isLoading: imagesLoading } = useQuery({
    queryKey: ['images', 'gallery', params.id],
    queryFn: async () =>
      (await apiClient.get<{ images: GeneratedImage[] }>('/api/v1/images', { params: { project_id: params.id } })).data.images,
    enabled: !!project,
  })

  const { data: designs, isLoading: designsLoading } = useQuery({
    queryKey: ['designs', params.id],
    queryFn: async () =>
      (await apiClient.get<{ designs: DesignProject[] }>('/api/v1/designs', { params: { project_id: params.id } })).data.designs,
    enabled: !!project,
  })

  const startSessionRename = (s: ChatSession) => {
    setRenamingSessionId(s.id)
    setSessionRenameValue(s.title)
  }

  const commitSessionRename = () => {
    const title = sessionRenameValue.trim()
    if (!renamingSessionId) return
    if (!title) { setRenamingSessionId(null); return }
    renameSession.mutate({ id: renamingSessionId, title })
    setRenamingSessionId(null)
  }

  const confirmDeleteSession = (id: string, title: string) => {
    if (window.confirm(`Delete "${title}"? This can't be undone.`)) {
      deleteSession.mutate(id)
    }
  }

  const commitProjectRename = () => {
    const name = projectNameValue.trim()
    if (!project || !name) { setRenamingProject(false); return }
    renameProject.mutate({ id: project.id, name })
    setRenamingProject(false)
  }

  const handleDelete = (mode: 'orphan' | 'delete_sessions') => {
    if (!project) return
    deleteProject.mutate({ id: project.id, mode }, { onSuccess: () => router.push('/chat') })
  }

  if (!projects) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>Project not found.</p>
        <Button variant="outline" onClick={() => router.push('/chat')}>Back to chat</Button>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <button onClick={() => router.push('/chat')} className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="flex items-center gap-2">
          {project.color && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />}
          {renamingProject ? (
            <input
              autoFocus
              value={projectNameValue}
              onChange={(e) => setProjectNameValue(e.target.value)}
              onBlur={commitProjectRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitProjectRename()
                if (e.key === 'Escape') setRenamingProject(false)
              }}
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xl font-bold"
            />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{project.name}</h1>
          )}
          {!renamingProject && (
            <button
              onClick={() => { setRenamingProject(true); setProjectNameValue(project.name) }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Rename project"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {project.sessions_count} chat{project.sessions_count === 1 ? '' : 's'} · {project.images_count} image{project.images_count === 1 ? '' : 's'} · {project.designs_count} design{project.designs_count === 1 ? '' : 's'}
        </p>

        {/* Delete — two explicit, clearly-labeled actions, never a plain
            confirm() that can't tell a real Cancel from a stray click. */}
        <div className="mt-4">
          {confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <span className="text-muted-foreground">Delete this project —</span>
              <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => handleDelete('orphan')}>
                Keep everything, just remove the project
              </Button>
              <Button variant="outline" className="px-3 py-1.5 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete('delete_sessions')}>
                Also delete its chats
              </Button>
              <button onClick={() => setConfirmingDelete(false)} className="text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete project
            </button>
          )}
        </div>

        {/* Chats */}
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Chats</h2>
          {projectSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chats in this project yet.</p>
          ) : (
            <div className="space-y-1">
              {projectSessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={false}
                  renaming={renamingSessionId === s.id}
                  renameValue={sessionRenameValue}
                  onRenameValueChange={setSessionRenameValue}
                  onOpen={() => router.push(`/chat?session=${s.id}`)}
                  onStartRename={() => startSessionRename(s)}
                  onCommitRename={commitSessionRename}
                  onCancelRename={() => setRenamingSessionId(null)}
                  onDelete={() => confirmDeleteSession(s.id, s.title)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Images */}
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Images</h2>
          {imagesLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !images?.length ? (
            <p className="text-sm text-muted-foreground">No images in this project yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => router.push('/images')}
                  className="aspect-square overflow-hidden rounded-lg border border-border bg-card"
                  title="Open in Images"
                >
                  <img src={img.storage_url} alt={img.original_prompt ?? img.original_name} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {images && images.length > 0 && (
            <button onClick={() => router.push('/images')} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              Open Images workspace
            </button>
          )}
        </section>

        {/* Designs */}
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Designs</h2>
          {designsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !designs?.length ? (
            <p className="text-sm text-muted-foreground">No designs in this project yet.</p>
          ) : (
            <div className="space-y-2">
              {designs.map((design) => (
                <button
                  key={design.id}
                  onClick={() => router.push(`/designs/${design.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
                >
                  {design.current_version?.attachment && (
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-white">
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
                  <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
