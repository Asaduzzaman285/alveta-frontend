'use client'

import { Lightbulb } from 'lucide-react'
import { useAvailableModels } from '@/hooks/useAvailableModels'
import { ModelIcon } from '@/components/chat/ModelIcon'
import { capabilityTags } from '@/components/models/ModelsPopup'
import type { AiModel } from '@/types'

// Display name per provider id — the raw id ("xai", "moonshot") isn't what a
// user would recognize; these are the names that actually appear on the
// provider's own product. Not every id needs an entry — PROVIDER_FRAMING's own
// fallback covers anything new before this map is updated.
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  gemini: 'Gemini',
  xai: 'Grok',
  deepseek: 'DeepSeek',
  perplexity: 'Perplexity',
  moonshot: 'Kimi',
  qwen: 'Qwen',
}

// One stable, honest sentence per provider FAMILY — not per model, and not a
// cost claim (real pricing changes too often to hardcode here; capabilities.
// flagship, a real admin-controlled field, is what drives the Premium/Efficient
// tag on each card below instead). These describe general character only, so
// they don't go stale when a specific model is swapped out.
const PROVIDER_FRAMING: Record<string, string> = {
  openai: 'Great all-round reasoning and writing — a dependable default for most tasks.',
  anthropic: 'Careful, nuanced responses — a strong pick for writing, analysis, and longer documents.',
  gemini: 'Fast and multimodal, with a model in most plans built for everyday use.',
  xai: 'Direct, up-to-date answers with a distinct tone.',
  deepseek: 'Strong reasoning at a very efficient cost — a good everyday workhorse.',
  perplexity: 'Built-in live web search — the right pick when you need current information with sources.',
  moonshot: 'Handles long conversations and long documents well.',
  qwen: 'Efficient image generation.',
}

function groupByProvider(models: AiModel[]): Array<{ provider: string; models: AiModel[] }> {
  const order: string[] = []
  const groups = new Map<string, AiModel[]>()
  for (const m of models) {
    if (!groups.has(m.provider)) {
      groups.set(m.provider, [])
      order.push(m.provider)
    }
    groups.get(m.provider)!.push(m)
  }
  // availableModels/availableImageModels already arrive in the catalog's own
  // provider-priority order (ModelController::sortByProviderThenName) — this
  // just groups without re-sorting, so that sequencing carries over here too.
  return order.map((provider) => ({ provider, models: groups.get(provider)! }))
}

function ModelCard({ model }: { model: AiModel }) {
  const tags = capabilityTags(model)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <ModelIcon provider={model.provider} className="h-6 w-6 text-[10px]" />
        <p className="truncate text-sm font-medium text-foreground">{model.name}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={
            model.capabilities.flagship
              ? 'rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary'
              : 'rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'
          }
        >
          {model.capabilities.flagship ? 'Premium' : 'Efficient'}
        </span>
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function TipsPage() {
  const { availableModels, availableImageModels, modelsLoading } = useAvailableModels()
  const textGroups = groupByProvider(availableModels)
  const imageGroups = groupByProvider(availableImageModels)

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tips & Tricks</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the right model for what you&apos;re doing. <span className="font-medium text-foreground">Premium</span> models
          give the strongest quality; <span className="font-medium text-foreground">Efficient</span> ones are a great everyday
          default and go further on your plan&apos;s credit.
        </p>

        {modelsLoading ? (
          <div className="mt-8 animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-card" />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-8">
              {textGroups.map(({ provider, models }) => (
                <section key={provider}>
                  <div className="flex items-center gap-2">
                    <ModelIcon provider={provider} className="h-5 w-5 text-[10px]" />
                    <h2 className="text-sm font-semibold text-foreground">{PROVIDER_NAMES[provider] ?? provider}</h2>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {PROVIDER_FRAMING[provider] ?? 'Available on your plan.'}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {models.map((m) => (
                      <ModelCard key={m.id} model={m} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {imageGroups.length > 0 && (
              <div className="mt-10 border-t border-border pt-8">
                <h2 className="text-sm font-semibold text-foreground">Images</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Generate images from the Images workspace, or ask for one directly in chat.
                </p>
                <div className="mt-3 space-y-6">
                  {imageGroups.map(({ provider, models }) => (
                    <section key={provider}>
                      <div className="flex items-center gap-2">
                        <ModelIcon provider={provider} className="h-5 w-5 text-[10px]" />
                        <h3 className="text-xs font-semibold text-muted-foreground">{PROVIDER_NAMES[provider] ?? provider}</h3>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {models.map((m) => (
                          <ModelCard key={m.id} model={m} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
