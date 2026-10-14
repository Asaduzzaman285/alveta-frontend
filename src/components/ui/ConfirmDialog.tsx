import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from './Dialog'
import { Button } from './Button'

/**
 * Standardizes the confirm-before-destructive-action shape already proven in
 * admin/transactions/page.tsx's RefundButton (title + description + explicit
 * Cancel/destructive-Confirm footer) so every delete/remove/approve action
 * gets the same gate instead of firing immediately on click. `open`/
 * `onOpenChange` are owned by the caller (not internal state) so a mutation's
 * onSuccess can close the dialog — same requirement RefundButton already had.
 */
interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: ReactNode
  title: string
  description: ReactNode
  confirmLabel?: string
  pendingLabel?: string
  cancelLabel?: string
  destructive?: boolean
  isPending?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  pendingLabel = 'Working…',
  cancelLabel = 'Cancel',
  destructive = true,
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'destructive' : 'primary'} disabled={isPending} onClick={onConfirm}>
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
