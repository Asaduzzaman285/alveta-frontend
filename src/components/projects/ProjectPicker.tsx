'use client'

import { ChevronDown, Folder } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import type { Project } from '@/types'

/**
 * Shared "which Project does this belong to" control for the Images and
 * Designs workspaces — assignment always happens after generation (see
 * plan: extending Projects to group images/designs), never at generation
 * time, so this is a plain dropdown over the already-fetched project list,
 * not a creation flow. `projects` is passed in by the caller (pulled from
 * useChatSession(), the same source Sidebar.tsx already uses) rather than
 * refetched here.
 */
export function ProjectPicker({
  projects,
  currentProjectId,
  onAssign,
  disabled,
}: {
  projects: Project[]
  currentProjectId: string | null
  onAssign: (projectId: string | null) => void
  disabled?: boolean
}) {
  const current = projects.find((p) => p.id === currentProjectId) ?? null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <Folder className="h-3.5 w-3.5" />
          {current?.name ?? 'No project'}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onSelect={() => onAssign(null)}>
          <span className="truncate">No project</span>
        </DropdownMenuItem>
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => onAssign(p.id)}>
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{p.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
