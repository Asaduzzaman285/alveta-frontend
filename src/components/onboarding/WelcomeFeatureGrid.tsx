'use client'

import { Bot, Layers, GitCompare, FolderKanban, Zap, Gauge } from 'lucide-react'

const FEATURES = [
  { icon: Bot, title: '20+ Leading AI Models', body: 'Access GPT, Claude, Gemini and more from one workspace.' },
  { icon: Layers, title: 'Every Format, One Chat', body: 'Upload images, PDFs, audio, and video — Alveta reads it all.' },
  { icon: GitCompare, title: 'Compare & Choose', body: 'Run one prompt across multiple models and pick the response that works best.' },
  { icon: FolderKanban, title: 'Project Workspaces', body: 'Keep chats, files, prompts, and outputs organized in project-based workspaces.' },
  { icon: Zap, title: 'Auto Mode', body: 'Describe your goal, Alveta recommends the right model automatically.' },
  { icon: Gauge, title: 'Smart Usage Control', body: 'Track usage by top-tag, budgeting, and manage your AI spend — all in one place.' },
]

// Compact single-line pills, not cards — matches the Claude Design mockup the
// user provided for the redesigned Welcome screen: a wrapping row of small
// badges under the composer, rather than a block of descriptive cards taking
// up most of the page. `body` (the longer description) is kept in the data
// array for the title attribute (a hover tooltip) rather than dropped outright.
export function WelcomeFeatureGrid() {
  return (
    <div className="flex flex-wrap gap-2">
      {FEATURES.map((f) => (
        <span
          key={f.title}
          title={f.body}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-xs font-medium text-foreground"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <f.icon className="h-3 w-3" />
          </span>
          {f.title}
        </span>
      ))}
    </div>
  )
}
