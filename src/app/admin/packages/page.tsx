'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import apiClient from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { describeError } from '@/lib/errors'
import { computeTokenEquivalent } from '@/lib/plan-features'
import type { AdminPackage, AiModel, PackageFeatures } from '@/types'

// Boolean features only — support_tier is a separate select below, not a checkbox.
const FEATURE_LABELS: { key: Exclude<keyof PackageFeatures, 'support_tier'>; label: string }[] = [
  { key: 'file_upload', label: 'File upload' },
  { key: 'api_access', label: 'API access' },
  { key: 'comparison', label: 'Multi-model comparison' },
  { key: 'image_gen', label: 'Image generation model' },
  { key: 'video_gen', label: 'Video generation model' },
  { key: 'voice_gen', label: 'Voice generation model' },
  { key: 'audio', label: 'Audio (TTS/STT)' },
  { key: 'vision', label: 'Vision' },
  { key: 'ide_integration', label: 'Integration support w/ IDE' },
  { key: 'prompt_library', label: 'Access to prompt library' },
]

interface PackageFormState {
  name: string
  slug: string
  description: string
  monthly_price_usd: string
  monthly_price_bdt: string
  monthly_wallet_credit_usd: string
  monthly_wallet_credit_bdt: string
  credit_buffer_percentage: string
  is_active: boolean
  model_access: string[]
  default_image_model_id: string | null
  default_design_model_id: string | null
  // Real, admin-editable data — pre-filled from a calculation (see
  // computeTokenEquivalent) when creating a package or when price changes on
  // one not yet manually edited, but otherwise just a plain stored number from
  // then on. Kept as a string here like every other numeric form field
  // (parsed to int on submit).
  token_value: string
  features: PackageFeatures
  is_team_enabled: boolean
  per_seat_price_usd: string
  per_seat_price_bdt: string
  min_team_seats: string
}

const EMPTY_FEATURES: PackageFeatures = {
  file_upload: false, api_access: false, comparison: false, image_gen: false, audio: false, vision: false,
  video_gen: false, voice_gen: false, ide_integration: false, prompt_library: false, support_tier: 'standard',
}

function emptyForm(): PackageFormState {
  return {
    name: '', slug: '', description: '',
    monthly_price_usd: '', monthly_price_bdt: '', monthly_wallet_credit_usd: '', monthly_wallet_credit_bdt: '',
    credit_buffer_percentage: '30', is_active: true, model_access: [], default_image_model_id: null, default_design_model_id: null,
    token_value: '', features: { ...EMPTY_FEATURES },
    is_team_enabled: false, per_seat_price_usd: '', per_seat_price_bdt: '', min_team_seats: '2',
  }
}

function formFromPackage(pkg: AdminPackage): PackageFormState {
  return {
    name: pkg.name, slug: pkg.slug, description: pkg.description ?? '',
    monthly_price_usd: pkg.monthly_price_usd, monthly_price_bdt: pkg.monthly_price_bdt ?? '',
    monthly_wallet_credit_usd: pkg.monthly_wallet_credit_usd, monthly_wallet_credit_bdt: pkg.monthly_wallet_credit_bdt ?? '',
    credit_buffer_percentage: pkg.credit_buffer_percentage,
    is_active: pkg.is_active, model_access: pkg.model_access, default_image_model_id: pkg.default_image_model_id,
    default_design_model_id: pkg.default_design_model_id,
    token_value: pkg.token_value !== null ? String(pkg.token_value) : String(computeTokenEquivalent(parseFloat(pkg.monthly_price_usd) || 0)),
    features: { ...EMPTY_FEATURES, ...pkg.features },
    is_team_enabled: pkg.is_team_enabled, per_seat_price_usd: pkg.per_seat_price_usd ?? '', per_seat_price_bdt: pkg.per_seat_price_bdt ?? '',
    min_team_seats: String(pkg.min_team_seats ?? 2),
  }
}

function PackageFormDialog({ pkg, trigger }: { pkg?: AdminPackage; trigger: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PackageFormState>(pkg ? formFromPackage(pkg) : emptyForm())
  // An existing package's token_value is already real stored data (or was
  // just pre-filled once above) — treat it as touched so price edits never
  // silently overwrite it. A brand-new package keeps auto-following price
  // until the admin types into the token field directly.
  const [tokenValueTouched, setTokenValueTouched] = useState(!!pkg)

  const { data: models } = useQuery({
    queryKey: ['admin', 'models-catalog'],
    queryFn: async () => (await apiClient.get<{ models: AiModel[] }>('/api/v1/models')).data.models,
    enabled: open,
  })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        monthly_price_usd: parseFloat(form.monthly_price_usd),
        monthly_price_bdt: form.monthly_price_bdt ? parseFloat(form.monthly_price_bdt) : null,
        monthly_wallet_credit_usd: parseFloat(form.monthly_wallet_credit_usd),
        monthly_wallet_credit_bdt: form.monthly_wallet_credit_bdt ? parseFloat(form.monthly_wallet_credit_bdt) : null,
        credit_buffer_percentage: parseFloat(form.credit_buffer_percentage),
        is_active: form.is_active,
        model_access: form.model_access,
        default_image_model_id: form.default_image_model_id,
        default_design_model_id: form.default_design_model_id,
        token_value: form.token_value ? parseInt(form.token_value, 10) : null,
        features: form.features,
        is_team_enabled: form.is_team_enabled,
        per_seat_price_usd: form.per_seat_price_usd ? parseFloat(form.per_seat_price_usd) : null,
        per_seat_price_bdt: form.per_seat_price_bdt ? parseFloat(form.per_seat_price_bdt) : null,
        min_team_seats: form.min_team_seats ? parseInt(form.min_team_seats, 10) : 2,
      }
      return pkg
        ? apiClient.patch(`/api/v1/packages/${pkg.slug}`, body)
        : apiClient.post('/api/v1/packages', body)
    },
    onSuccess: () => {
      toast.success(pkg ? 'Package updated.' : 'Package created.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] })
      setOpen(false)
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check the packages list before trying again.").message),
  })

  const toggleModel = (modelId: string) => {
    setForm((f) => {
      const nowChecked = !f.model_access.includes(modelId)
      return {
        ...f,
        model_access: nowChecked ? [...f.model_access, modelId] : f.model_access.filter((m) => m !== modelId),
        // Unchecking the model currently marked default clears the default too —
        // a package can't default to an image model it no longer grants access to.
        default_image_model_id: !nowChecked && f.default_image_model_id === modelId ? null : f.default_image_model_id,
        default_design_model_id: !nowChecked && f.default_design_model_id === modelId ? null : f.default_design_model_id,
      }
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.slug || !form.monthly_price_usd || !form.monthly_wallet_credit_usd) {
      toast.error('Please fill in a name, slug, price, and wallet credit before saving.')
      return
    }
    save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setForm(pkg ? formFromPackage(pkg) : emptyForm()); setTokenValueTouched(!!pkg) } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pkg ? 'Edit package' : 'Create package'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-name">Name</Label>
              <Input id="pkg-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-slug">Slug</Label>
              <Input id="pkg-slug" required disabled={!!pkg} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="e.g. pro" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pkg-description">Description</Label>
            <Input id="pkg-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-price-usd">Price (USD)</Label>
              <Input
                id="pkg-price-usd" type="number" min="0" step="0.01" required value={form.monthly_price_usd}
                onChange={(e) => {
                  const value = e.target.value
                  setForm((f) => ({
                    ...f,
                    monthly_price_usd: value,
                    // Keep following price until the admin edits the token field
                    // directly — see tokenValueTouched's own comment above.
                    token_value: tokenValueTouched ? f.token_value : String(computeTokenEquivalent(parseFloat(value) || 0)),
                  }))
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-price-bdt">Price (BDT)</Label>
              <Input id="pkg-price-bdt" type="number" min="0" step="0.01" value={form.monthly_price_bdt} onChange={(e) => setForm({ ...form, monthly_price_bdt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-credit">Wallet credit (USD)</Label>
              <Input id="pkg-credit" type="number" min="0" step="0.01" required value={form.monthly_wallet_credit_usd} onChange={(e) => setForm({ ...form, monthly_wallet_credit_usd: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-credit-bdt">Wallet credit (BDT)</Label>
              <Input id="pkg-credit-bdt" type="number" min="0" step="0.01" value={form.monthly_wallet_credit_bdt} onChange={(e) => setForm({ ...form, monthly_wallet_credit_bdt: e.target.value })} placeholder="Falls back to USD if blank" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="pkg-token-value">Token value (shown to customers as &quot;Up to N tokens&quot;)</Label>
              <Input
                id="pkg-token-value" type="number" min="0" step="1" value={form.token_value}
                onChange={(e) => { setTokenValueTouched(true); setForm({ ...form, token_value: e.target.value }) }}
              />
              <p className="text-xs text-muted-foreground">
                Pre-filled from an internal reference formula — edit to override, it won&apos;t auto-update again after that. No model name is shown to customers.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pkg-buffer">Credit buffer % <span className="font-normal text-muted-foreground">(overdraft allowance as a % of price)</span></Label>
            <Input id="pkg-buffer" type="number" min="0" max="100" step="1" required value={form.credit_buffer_percentage} onChange={(e) => setForm({ ...form, credit_buffer_percentage: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active (visible on the pricing page)
          </label>

          <div className="space-y-3 rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.is_team_enabled} onChange={(e) => setForm({ ...form, is_team_enabled: e.target.checked })} />
              Sellable as a Team/Organization plan
            </label>
            {form.is_team_enabled && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div className="space-y-1.5">
                  <Label htmlFor="pkg-seat-usd">Per-seat price (USD)</Label>
                  <Input id="pkg-seat-usd" type="number" min="0" step="0.01" value={form.per_seat_price_usd} onChange={(e) => setForm({ ...form, per_seat_price_usd: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pkg-seat-bdt">Per-seat price (BDT)</Label>
                  <Input id="pkg-seat-bdt" type="number" min="0" step="0.01" value={form.per_seat_price_bdt} onChange={(e) => setForm({ ...form, per_seat_price_bdt: e.target.value })} placeholder="Falls back to USD if blank" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="pkg-min-seats">Minimum seats</Label>
                  <Input id="pkg-min-seats" type="number" min="1" step="1" value={form.min_team_seats} onChange={(e) => setForm({ ...form, min_team_seats: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Features</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {FEATURE_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.features[key]}
                    onChange={(e) => setForm({ ...form, features: { ...form.features, [key]: e.target.checked } })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pkg-support-tier">Support tier</Label>
            <Select
              id="pkg-support-tier"
              value={form.features.support_tier}
              onChange={(e) => setForm({ ...form, features: { ...form.features, support_tier: e.target.value as 'standard' | 'priority' } })}
            >
              <option value="standard">Standard</option>
              <option value="priority">Priority</option>
            </Select>
          </div>

          <div>
            <Label>Models included</Label>
            <div className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {!models ? (
                <div className="space-y-1.5">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-40" />)}
                </div>
              ) : (
                models.map((m) => {
                  const checked = form.model_access.includes(m.model_id)
                  const isImageModel = m.type === 'image_generation'
                  // Only a text model with function-calling can drive the Designs
                  // workspace's tool-calling loop at all (see GenerateDesignTool) —
                  // narrower than "isImageModel" above since not every text model
                  // qualifies, only ones capable of actually invoking the tool.
                  const canDriveDesigns = m.type === 'text' && !!m.capabilities?.function_calling
                  return (
                    <div key={m.model_id} className="flex items-center gap-2 text-sm">
                      <label className="flex flex-1 items-center gap-2">
                        <input type="checkbox" checked={checked} onChange={() => toggleModel(m.model_id)} />
                        <span className="capitalize text-muted-foreground">{m.provider}</span> {m.name}
                      </label>
                      {/* Only meaningful for a checked image-generation model — this is
                          the model used automatically inside plain chat with no picker
                          shown there (see GenerateImageTool/ChatController). */}
                      {isImageModel && checked && (
                        <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Used automatically inside chat; the full checked list is still selectable in the dedicated Images workspace.">
                          <input
                            type="radio"
                            name="default_image_model_id"
                            checked={form.default_image_model_id === m.model_id}
                            onChange={() => setForm({ ...form, default_image_model_id: m.model_id })}
                          />
                          Default
                        </label>
                      )}
                      {/* Cost-aware pick for the Designs workspace's conversational/
                          tool-calling model — unset means it falls back to whichever
                          text model happens to sort first (see
                          pickGenerationModel's own comment on why that's risky). */}
                      {canDriveDesigns && checked && (
                        <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Used automatically to drive Designs workspace generations — pick a cost-effective model here rather than leaving this to whichever model sorts first.">
                          <input
                            type="radio"
                            name="default_design_model_id"
                            checked={form.default_design_model_id === m.model_id}
                            onChange={() => setForm({ ...form, default_design_model_id: m.model_id })}
                          />
                          Default (Designs)
                        </label>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminPackagesPage() {
  const queryClient = useQueryClient()
  const [deactivateTarget, setDeactivateTarget] = useState<AdminPackage | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'packages'],
    queryFn: async () => (await apiClient.get<{ packages: AdminPackage[] }>('/api/v1/packages/admin')).data.packages,
  })

  // Mirrors the AI-models admin page's own toggleActive — packages never had a
  // dedicated activate/deactivate route (unlike models), but update() already
  // accepts is_active, so the same plain PATCH does the job without a new endpoint.
  const toggleActive = useMutation({
    mutationFn: async ({ slug, active }: { slug: string; active: boolean }) =>
      apiClient.patch(`/api/v1/packages/${slug}`, { is_active: active }),
    onSuccess: () => {
      toast.success('Package updated.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] })
      setDeactivateTarget(null)
    },
    onError: (err: unknown) => toast.error(describeError(err, "We didn't hear back in time — check whether the package's status actually changed before retrying.").message),
  })

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Packages</h1>
          <p className="mt-1 text-sm text-muted-foreground">Subscription plans, pricing, wallet credit, credit buffer, and model access.</p>
        </div>
        <PackageFormDialog trigger={<Button>Create package</Button>} />
      </div>

      <Card>
        <CardHeader><CardTitle>{data?.length ?? '…'} packages</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </div>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">No packages yet.</p>
          ) : (
            <div className="space-y-3">
              {data.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="font-medium">
                      {pkg.name} <span className="font-normal text-muted-foreground">({pkg.slug})</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(pkg.monthly_price_usd)}/mo · {formatCurrency(pkg.monthly_wallet_credit_usd)} wallet credit ·
                      {' '}{pkg.credit_buffer_percentage}% buffer · {pkg.model_access.length} model{pkg.model_access.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={pkg.is_active ? 'success' : 'neutral'}>{pkg.is_active ? 'active' : 'inactive'}</Badge>
                    <PackageFormDialog pkg={pkg} trigger={<Button variant="outline" className="px-2.5 py-1.5 text-xs">Edit</Button>} />
                    <Button
                      variant={pkg.is_active ? 'destructive' : 'outline'}
                      className="px-2.5 py-1.5 text-xs"
                      disabled={toggleActive.isPending}
                      onClick={() => pkg.is_active
                        ? setDeactivateTarget(pkg)
                        : toggleActive.mutate({ slug: pkg.slug, active: true })}
                    >
                      {pkg.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
        title="Deactivate package"
        description={`Deactivate ${deactivateTarget?.name ?? 'this package'}? New customers won't be able to subscribe to it. You can reactivate it later.`}
        confirmLabel="Deactivate"
        pendingLabel="Deactivating…"
        isPending={toggleActive.isPending}
        onConfirm={() => deactivateTarget && toggleActive.mutate({ slug: deactivateTarget.slug, active: false })}
      />
    </div>
  )
}
