'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { getCarrierOption, type CarrierOptionId } from '@/lib/carriers'
import { cn } from '@/lib/utils'

export const AUTOMATION_START_PREVIEW_MS = 3500
export const AUTOMATION_ERROR_MIN_READ_MS = 5000

export type CarrierAutomationSuccessVariant = 'email' | 'pdf'

function resolveErrorModalLayout(message: string | null) {
  const text = message?.trim() ?? ''
  const length = text.length
  const lines = text ? text.split('\n').length : 0
  const longestLine = text
    ? Math.max(0, ...text.split('\n').map((line) => line.length))
    : 0

  if (length > 1500 || lines > 25 || longestLine > 100) {
    return {
      dialogClass: 'sm:max-w-4xl',
      messageClass: 'max-h-[min(60vh,32rem)] overflow-y-auto',
    }
  }

  if (length > 500 || lines > 10 || longestLine > 70) {
    return {
      dialogClass: 'sm:max-w-2xl',
      messageClass: 'max-h-[min(50vh,24rem)] overflow-y-auto',
    }
  }

  if (length > 180 || lines > 4 || longestLine > 50) {
    return {
      dialogClass: 'sm:max-w-xl',
      messageClass: '',
    }
  }

  return {
    dialogClass: 'sm:max-w-lg',
    messageClass: '',
  }
}

interface CarrierAutomationStartingModalProps {
  carrierOptionId: CarrierOptionId | null
  currentStep?: number
  totalSteps?: number
}

export function CarrierAutomationStartingModal({
  carrierOptionId,
  currentStep = 1,
  totalSteps = 1,
}: CarrierAutomationStartingModalProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!carrierOptionId) {
      setProgress(0)
      return
    }

    setProgress(0)
    const startedAt = Date.now()
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      setProgress(
        Math.min(100, Math.round((elapsed / AUTOMATION_START_PREVIEW_MS) * 100)),
      )
    }, 50)

    return () => window.clearInterval(tick)
  }, [carrierOptionId])

  if (!carrierOptionId) return null

  const carrierLabel = getCarrierOption(carrierOptionId).label

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        className="gap-0 overflow-hidden border-primary/25 p-0 sm:max-w-lg [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="border-b border-primary/15 bg-primary/5 px-6 py-5">
          <DialogHeader className="space-y-0 text-left">
            <DialogDescription className="sr-only">
              Carrier automation is starting for {carrierLabel}.
            </DialogDescription>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 space-y-2 pt-0.5">
                <DialogTitle className="text-lg font-semibold leading-tight">
                  {carrierLabel}
                </DialogTitle>
                <Badge
                  variant="secondary"
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                >
                  Preparing automation
                </Badge>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Starting carrier automation
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Please wait while we connect to the {carrierLabel} quoting portal.
              </p>
            </div>
          </div>

          {totalSteps > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              Carrier {currentStep} of {totalSteps}
            </p>
          )}

          <div className="space-y-2">
            <Progress value={progress} className="h-1.5" />
            <p className="text-[11px] text-center text-muted-foreground">
              Launching automation…
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface CarrierAutomationErrorModalProps {
  open: boolean
  carrierLabel: string
  message: string | null
  onDismiss: () => void
}

export function CarrierAutomationErrorModal({
  open,
  carrierLabel,
  message,
  onDismiss,
}: CarrierAutomationErrorModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(AUTOMATION_ERROR_MIN_READ_MS / 1000),
  )
  const canDismiss = secondsRemaining <= 0

  useEffect(() => {
    if (!open) {
      setSecondsRemaining(Math.ceil(AUTOMATION_ERROR_MIN_READ_MS / 1000))
      return
    }

    setSecondsRemaining(Math.ceil(AUTOMATION_ERROR_MIN_READ_MS / 1000))
    const interval = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [open, message])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && canDismiss) {
      onDismiss()
    }
  }

  const errorLayout = useMemo(
    () => resolveErrorModalLayout(message),
    [message],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(92vh,100%)] w-full flex-col gap-0 overflow-hidden border-destructive/40 p-0',
          errorLayout.dialogClass,
        )}
        onPointerDownOutside={(e) => {
          if (!canDismiss) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (!canDismiss) e.preventDefault()
        }}
        showCloseButton={canDismiss}
      >
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/5 px-6 py-5 pr-12">
          <DialogHeader className="space-y-0 text-left">
            <DialogDescription className="sr-only">
              Automation error details for {carrierLabel}.
            </DialogDescription>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 space-y-2 pt-0.5">
                <DialogTitle className="text-lg font-semibold leading-tight">
                  {carrierLabel}
                </DialogTitle>
                <Badge
                  variant="destructive"
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                >
                  Automation Error
                </Badge>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-3 px-6 py-5">
          <p className="text-sm font-medium text-foreground">
            The quote automation could not be completed.
          </p>
          <div
            className={cn(
              'rounded-lg border border-destructive/20 bg-muted/40 p-4',
              errorLayout.messageClass,
            )}
          >
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {message}
            </p>
          </div>
          {!canDismiss && (
            <p className="text-xs text-muted-foreground text-center">
              Please review the error. You can close this in {secondsRemaining}s.
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={!canDismiss}
            onClick={onDismiss}
          >
            {canDismiss ? 'Close' : `Close (${secondsRemaining}s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CarrierAutomationSuccessModalProps {
  open: boolean
  carrierLabel: string
  variant: CarrierAutomationSuccessVariant
  email?: string | null
  onDismiss: () => void
}

export function CarrierAutomationSuccessModal({
  open,
  carrierLabel,
  variant,
  email = null,
  onDismiss,
}: CarrierAutomationSuccessModalProps) {
  const badgeLabel =
    variant === 'email' ? 'Quote Sent Successfully' : 'Automation Complete'
  const DetailIcon = variant === 'email' ? Mail : FileText

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss()
      }}
    >
      <DialogContent className="gap-0 overflow-hidden border-emerald-500/30 p-0 sm:max-w-lg">
        <div className="border-b border-emerald-500/20 bg-emerald-500/5 px-6 py-5 pr-12">
          <DialogHeader className="space-y-0 text-left">
            <DialogDescription className="sr-only">
              Carrier automation completed for {carrierLabel}.
            </DialogDescription>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 space-y-2 pt-0.5">
                <DialogTitle className="text-lg font-semibold leading-tight">
                  {carrierLabel}
                </DialogTitle>
                <Badge
                  className="rounded-md border-transparent bg-emerald-600 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white hover:bg-emerald-600"
                >
                  {badgeLabel}
                </Badge>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm font-medium text-foreground">
            {variant === 'pdf'
              ? 'Congratulations! Automation completed successfully.'
              : 'Automation completed successfully.'}
          </p>
          <div className="rounded-lg border border-emerald-500/20 bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <DetailIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 space-y-1">
                {variant === 'email' ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      The quote has been sent to the email address you entered:
                    </p>
                    {email ? (
                      <p className="text-sm font-semibold text-foreground break-all">
                        {email}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-foreground">
                        your entered email address
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your quote PDF has been saved to your system.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button type="button" onClick={onDismiss}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
