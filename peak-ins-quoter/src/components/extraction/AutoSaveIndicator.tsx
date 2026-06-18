'use client'

import { useEffect, useState, useMemo } from 'react'
import { AutoSaveStatus } from '@/hooks/use-auto-save'
import { cn } from '@/lib/utils'
import { Loader2, Check, AlertCircle, Cloud, CloudOff } from 'lucide-react'

interface AutoSaveIndicatorProps {
  /**
   * Current auto-save status
   */
  status: AutoSaveStatus

  /**
   * Last saved timestamp
   */
  lastSavedAt: Date | null

  /**
   * Error message if save failed (currently unused but available for future use)
   */
  error: Error | null

  /**
   * Optional callback to retry save
   */
  onRetry?: () => void

  /**
   * Optional callback to dismiss error
   */
  onDismiss?: () => void

  /**
   * Additional class names
   */
  className?: string
}

/**
 * Format relative time (e.g., "just now", "2 minutes ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)

  if (diffSeconds < 10) {
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
  return `${diffHours} hours ago`
}

/**
 * Auto-save status indicator component
 *
 * Displays visual feedback for auto-save operations:
 * - Idle: No indicator or subtle "saved" text
 * - Pending: "Unsaved changes" indicator
 * - Saving: Spinning loader with "Saving..."
 * - Saved: Green checkmark with "Saved" and relative time
 * - Error: Red error with retry option
 */
export function AutoSaveIndicator({
  status,
  lastSavedAt,
  error: _error, // Prefixed with underscore - available for future enhanced error display
  onRetry,
  onDismiss,
  className,
}: AutoSaveIndicatorProps) {
  // Tick state to force re-render for relative time updates
  const [tick, setTick] = useState(0)

  // Update relative time periodically
  useEffect(() => {
    if (!lastSavedAt) return

    // Update every 10 seconds
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 10000)

    return () => clearInterval(interval)
  }, [lastSavedAt])

  // Calculate relative time using useMemo with tick dependency
  const relativeTime = useMemo(() => {
    // Suppress unused tick warning - it triggers recalculation
    void tick
    if (!lastSavedAt) return ''
    return formatRelativeTime(lastSavedAt)
  }, [lastSavedAt, tick])

  // Base styles for the indicator container
  const baseStyles = cn(
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200',
    className
  )

  switch (status) {
    case 'idle':
      // Show last saved time if available, otherwise nothing
      if (lastSavedAt) {
        return (
          <div className={cn(baseStyles, 'text-muted-foreground bg-muted/50')}>
            <Cloud className="h-3 w-3" />
            <span>Saved {relativeTime}</span>
          </div>
        )
      }
      return null

    case 'pending':
      return (
        <div className={cn(baseStyles, 'text-amber-700 bg-amber-50 border border-amber-200')}>
          <CloudOff className="h-3 w-3" />
          <span>Unsaved changes</span>
        </div>
      )

    case 'saving':
      return (
        <div className={cn(baseStyles, 'text-blue-700 bg-blue-50 border border-blue-200')}>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </div>
      )

    case 'saved':
      return (
        <div className={cn(baseStyles, 'text-green-700 bg-green-50 border border-green-200')}>
          <Check className="h-3 w-3" />
          <span>Saved</span>
        </div>
      )

    case 'error':
      return (
        <div className={cn(baseStyles, 'text-red-700 bg-red-50 border border-red-200 gap-2')}>
          <AlertCircle className="h-3 w-3" />
          <span>Failed to save</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="underline hover:no-underline ml-1"
              type="button"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-500 hover:text-red-700 ml-1"
              type="button"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          )}
        </div>
      )

    default:
      return null
  }
}
