'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, AlertCircle, RefreshCw, Cloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import type { AutoSaveStatus } from '@/hooks/use-auto-save'

/**
 * Props for the SaveStatus component
 */
export interface SaveStatusProps {
  /**
   * Current save status from useAutoSave hook
   */
  status: AutoSaveStatus

  /**
   * Timestamp of last successful save (null if never saved)
   */
  lastSavedAt: Date | null

  /**
   * Error from last save attempt (only relevant when status is 'error')
   */
  error?: Error | null

  /**
   * Callback to retry saving after an error
   */
  onRetry?: () => void

  /**
   * Whether to show the idle state or hide the component
   * @default true
   */
  showIdle?: boolean

  /**
   * Custom class name for the container
   */
  className?: string

  /**
   * Size variant
   * @default 'default'
   */
  size?: 'sm' | 'default'
}

/**
 * Format a date as relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 5) {
    return 'just now'
  }
  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`
  }
  if (diffMinutes === 1) {
    return '1 minute ago'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`
  }
  if (diffHours === 1) {
    return '1 hour ago'
  }
  if (diffHours < 24) {
    return `${diffHours} hours ago`
  }
  if (diffDays === 1) {
    return 'yesterday'
  }
  return `${diffDays} days ago`
}

/**
 * Save status indicator component
 *
 * Displays the current auto-save status with appropriate icons and messages:
 * - Idle: Shows "Last saved X minutes ago" or hides based on showIdle prop
 * - Pending: Shows "Saving..." with loading spinner
 * - Saving: Shows "Saving..." with loading spinner
 * - Saved: Shows "Saved" with checkmark (fades after animation)
 * - Error: Shows "Failed to save" with retry button
 *
 * @example
 * ```tsx
 * const { status, lastSavedAt, error, forceSave } = useAutoSave({
 *   data: formData,
 *   onSave: saveFormData,
 * })
 *
 * <SaveStatus
 *   status={status}
 *   lastSavedAt={lastSavedAt}
 *   error={error}
 *   onRetry={forceSave}
 * />
 * ```
 */
export function SaveStatus({
  status,
  lastSavedAt,
  error,
  onRetry,
  showIdle = true,
  className,
  size = 'default',
}: SaveStatusProps) {
  // State for forcing re-render to update relative time
  const [tick, setTick] = useState(0)

  // Calculate relative time - use tick to trigger recalculation
  const relativeTime = lastSavedAt ? formatRelativeTime(lastSavedAt) : null

  // Suppress unused variable warning - tick is used to trigger re-render
  void tick

  // Effect: Set up periodic re-render for relative time updates
  useEffect(() => {
    // Re-render every 30 seconds to update relative time
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // Size-based classes
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const containerPadding = size === 'sm' ? 'gap-1' : 'gap-1.5'

  // Base container classes
  const containerClasses = cn(
    'inline-flex items-center transition-all duration-200',
    containerPadding,
    textSize,
    className
  )

  // Render based on status
  if (status === 'pending' || status === 'saving') {
    return (
      <div className={cn(containerClasses, 'text-muted-foreground')} role="status" aria-live="polite">
        <Loader2 className={cn(iconSize, 'animate-spin')} aria-hidden="true" />
        <span>Saving...</span>
      </div>
    )
  }

  if (status === 'saved') {
    return (
      <div
        className={cn(
          containerClasses,
          'text-green-600 dark:text-green-500',
          'animate-in fade-in duration-200'
        )}
        role="status"
        aria-live="polite"
      >
        <Check className={iconSize} aria-hidden="true" />
        <span>Saved</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        className={cn(
          containerClasses,
          'text-destructive'
        )}
        role="alert"
        aria-live="assertive"
      >
        <AlertCircle className={iconSize} aria-hidden="true" />
        <span className="font-medium">Failed to save</span>
        {error && (
          <span className="text-muted-foreground hidden sm:inline">
            : {error.message}
          </span>
        )}
        {onRetry && (
          <Button
            variant="ghost"
            size={size === 'sm' ? 'icon-sm' : 'icon'}
            className={cn(
              'ml-1',
              size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
            )}
            onClick={onRetry}
            title="Retry save"
          >
            <RefreshCw className={cn(iconSize, 'shrink-0')} />
            <span className="sr-only">Retry save</span>
          </Button>
        )}
      </div>
    )
  }

  // Idle state
  if (status === 'idle' && showIdle && lastSavedAt && relativeTime) {
    return (
      <div
        className={cn(
          containerClasses,
          'text-muted-foreground'
        )}
        role="status"
      >
        <Cloud className={iconSize} aria-hidden="true" />
        <span>Last saved {relativeTime}</span>
      </div>
    )
  }

  // Don't render anything if idle without lastSavedAt or showIdle is false
  return null
}

/**
 * Compact save status indicator (just an icon)
 *
 * Useful for tight spaces where full text won't fit.
 * Shows a tooltip on hover with the full status message.
 */
export function SaveStatusIcon({
  status,
  lastSavedAt,
  className,
}: Pick<SaveStatusProps, 'status' | 'lastSavedAt' | 'className'>) {
  const iconSize = 'h-4 w-4'

  const getTitle = (): string => {
    switch (status) {
      case 'pending':
      case 'saving':
        return 'Saving...'
      case 'saved':
        return 'Saved'
      case 'error':
        return 'Failed to save'
      case 'idle':
        return lastSavedAt
          ? `Last saved ${formatRelativeTime(lastSavedAt)}`
          : 'Not saved yet'
    }
  }

  const title = getTitle()

  if (status === 'pending' || status === 'saving') {
    return (
      <span
        className={cn('inline-flex', className)}
        title={title}
        role="status"
        aria-label={title}
      >
        <Loader2 className={cn(iconSize, 'animate-spin text-muted-foreground')} aria-hidden="true" />
      </span>
    )
  }

  if (status === 'saved') {
    return (
      <span
        className={cn('inline-flex', className)}
        title={title}
        role="status"
        aria-label={title}
      >
        <Check className={cn(iconSize, 'text-green-600 dark:text-green-500')} aria-hidden="true" />
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span
        className={cn('inline-flex', className)}
        title={title}
        role="alert"
        aria-label={title}
      >
        <AlertCircle className={cn(iconSize, 'text-destructive')} aria-hidden="true" />
      </span>
    )
  }

  // Idle
  return (
    <span
      className={cn('inline-flex', className)}
      title={title}
      role="status"
      aria-label={title}
    >
      <Cloud className={cn(iconSize, 'text-muted-foreground')} aria-hidden="true" />
    </span>
  )
}
