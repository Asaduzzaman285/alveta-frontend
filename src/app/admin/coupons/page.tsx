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
import { SkeletonTableRows } from '@/components/ui/Skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import apiClient from '@/lib/api-client'
import { describeError } from '@/lib/errors'
import { formatDateUTC } from '@/lib/utils'
import { TakaIcon } from '@/components/ui/TakaIcon'
import type { AdminPackage, Coupon } from '@/types'

interface CouponFormState {
  code: string
  description: string
  discount_type: 'percentage' | 'flat'
  discount_percentage: string
  // USD deliberately has no field in this form — flat coupons are BDT-only for now
  // (explicit decision, 2026-09-24: "currently just make for bdt, we will analyse
  // the usd later"). The backend column and validation already accept
  // discount_amount_usd; adding the field here later is a UI-only change, no
  // migration or API work needed.
  discount_amount_bdt: string
  max_redemptions: string
  valid_from: string
  valid_until: string
  is_active: boolean
  package_ids: string[]
}

const EMPTY_FORM: CouponFormState = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_percentage: '',
  discount_amount_bdt: '',
  max_redemptions: '',
  valid_from: '',
  valid_until: '',
  is_active: true,
  package_ids: [],
}

function formFromCoupon(coupon: Coupon): CouponFormState {
  return {
    code: coupon.code,
    description: coupon.description ?? '',
    discount_type: coupon.discount_type,
    discount_percentage: coupon.discount_percentage ?? '',
    discount_amount_bdt: coupon.discount_amount_bdt ?? '',
    max_redemptions: coupon.max_redemptions?.toString() ?? '',
    // <input type="date"> wants YYYY-MM-DD — the API returns a full timestamp.
    valid_from: coupon.valid_from?.slice(0, 10) ?? '',
    valid_until: coupon.valid_until?.slice(0, 10) ?? '',
    is_active: coupon.is_active,
    package_ids: coupon.packages.map((p) => p.id),
  }
}

function CouponFormDialog({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CouponFormState>(coupon ? formFromCoupon(coupon) : EMPTY_FORM)

  const { data: packages } = useQuery({
    queryKey: ['admin', 'packages'],
    queryFn: async () => (await apiClient.get<{ packages: AdminPackage[] }>('/api/v1/packages/admin')).data.packages,
  })

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        code: form.code,
        description: form.description || null,
        discount_type: form.discount_type,
        max_redemptions: form.max_redemptions ? parseInt(form.max_redemptions, 10) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        is_active: form.is_active,
        package_ids: form.package_ids,
      }
      if (form.discount_type === 'percentage') {
        body.discount_percentage = parseFloat(form.discount_percentage)
      } else {
        body.discount_amount_bdt = parseFloat(form.discount_amount_bdt)
      }
      return coupon
        ? apiClient.patch(`/api/v1/subscription/coupons/admin/${coupon.id}`, body)
        : apiClient.post('/api/v1/subscription/coupons/admin', body)
    },
    onSuccess: () => {
      toast.success(coupon ? 'Coupon updated.' : 'Coupon created.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] })
      onClose()
    },
    onError: (err: unknown) => toast.error(describeError(err, 'Could not save this coupon.').message),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.code.trim()) {
      toast.error('A coupon code is required.')
      return
    }
    if (form.discount_type === 'percentage' && !form.discount_percentage) {
      toast.error('Enter a discount percentage.')
      return
    }
    if (form.discount_type === 'flat' && !form.discount_amount_bdt) {
      toast.error('Enter a flat discount amount (BDT).')
      return
    }
    if (form.package_ids.length === 0) {
      toast.error('Select at least one package this coupon applies to.')
      return
    }
    save.mutate()
  }

  const togglePackage = (id: string) => {
    setForm((f) => ({
      ...f,
      package_ids: f.package_ids.includes(id) ? f.package_ids.filter((p) => p !== id) : [...f.package_ids, id],
    }))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{coupon ? 'Edit coupon' : 'New coupon'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-code">Code</Label>
            {/* Uppercased as the admin types, matching how the backend stores and
                matches it (Coupon::findByCode() compares case-insensitively, but
                storage is always uppercase) — what's typed here is what a customer
                will actually need to type at checkout. */}
            <Input
              id="coupon-code"
              required
              disabled={!!coupon}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="PLAY50"
            />
            {coupon && <p className="text-xs text-muted-foreground">Code can&apos;t be changed after creation.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="coupon-description">Description (internal)</Label>
            <Input
              id="coupon-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Marketing team — September campaign"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-type">Discount type</Label>
              <Select
                id="coupon-type"
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'flat' })}
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat amount (BDT)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              {form.discount_type === 'percentage' ? (
                <>
                  <Label htmlFor="coupon-percentage">Discount %</Label>
                  <Input
                    id="coupon-percentage"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    required
                    value={form.discount_percentage}
                    onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })}
                  />
                </>
              ) : (
                <>
                  <Label htmlFor="coupon-flat">Discount (৳)</Label>
                  <Input
                    id="coupon-flat"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={form.discount_amount_bdt}
                    onChange={(e) => setForm({ ...form, discount_amount_bdt: e.target.value })}
                  />
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Applies to packages</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-input p-3">
              {packages?.map((pkg) => (
                <label key={pkg.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={form.package_ids.includes(pkg.id)}
                    onChange={() => togglePackage(pkg.id)}
                  />
                  {pkg.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-max">Max redemptions</Label>
              <Input
                id="coupon-max"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={form.max_redemptions}
                onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-from">Valid from</Label>
              <Input id="coupon-from" type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-until">Valid until</Label>
              <Input id="coupon-until" type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save coupon'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminCouponsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Coupon | null | 'new'>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: async () => (await apiClient.get<{ coupons: Coupon[] }>('/api/v1/subscription/coupons/admin?per_page=100')).data.coupons,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/v1/subscription/coupons/admin/${id}`),
    onSuccess: (res) => {
      // Deactivated instead of deleted when it has redemptions — see
      // CouponAdminController::destroy()'s own comment; either way, the list just
      // needs refetching to reflect whichever happened.
      toast.success((res.data as { message?: string })?.message ?? 'Coupon removed.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] })
    },
    onError: (err: unknown) => toast.error(describeError(err, 'Could not remove this coupon.').message),
  })

  const discountLabel = (c: Coupon) =>
    c.discount_type === 'percentage'
      ? `${c.discount_percentage}%`
      : <><TakaIcon className="mr-0.5" />{c.discount_amount_bdt}</>

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coupons</h1>
          <p className="mt-1 text-sm text-muted-foreground">Discount codes attached to one or more packages.</p>
        </div>
        <Button onClick={() => setEditing('new')}>New coupon</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{data?.length ?? '…'} coupons</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody><SkeletonTableRows columns={6} /></tbody>
              </table>
            </div>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">No coupons yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Code</th>
                    <th className="pb-2 font-medium">Discount</th>
                    <th className="pb-2 font-medium">Packages</th>
                    <th className="pb-2 font-medium">Redemptions</th>
                    <th className="pb-2 font-medium">Valid</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="py-2 font-mono text-xs font-medium">{c.code}</td>
                      <td className="py-2">{discountLabel(c)}</td>
                      <td className="py-2 text-muted-foreground">{c.packages.map((p) => p.name).join(', ') || '—'}</td>
                      <td className="py-2 text-muted-foreground">
                        {c.redemptions_count ?? 0}{c.max_redemptions ? ` / ${c.max_redemptions}` : ''}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {c.valid_from ? formatDateUTC(c.valid_from) : 'Any time'}
                        {c.valid_until ? ` – ${formatDateUTC(c.valid_until)}` : ''}
                      </td>
                      <td className="py-2">
                        <Badge variant={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" className="px-3 py-1 text-xs" onClick={() => setEditing(c)}>Edit</Button>
                          <Button
                            variant="destructive"
                            className="px-3 py-1 text-xs"
                            disabled={remove.isPending}
                            onClick={() => confirm(`Remove coupon ${c.code}?`) && remove.mutate(c.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <CouponFormDialog coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
