'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ArrowLeft, Edit2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { UIFieldValidation } from '@/types/quote'

interface RequiredFieldsAlertProps {
  missingFields: UIFieldValidation[]
  extractionId: string
  onFieldClick?: (fieldKey: string) => void
  className?: string
}

/**
 * RequiredFieldsAlert - Displays a prominent warning when required fields are missing
 *
 * Features:
 * - Warning banner with amber styling
 * - Clear message about missing required fields
 * - Lists each missing field by its label
 * - Provides options to go back and edit or click individual fields
 * - Grouped by category for easier navigation
 */
export function RequiredFieldsAlert({
  missingFields,
  extractionId,
  onFieldClick,
  className,
}: RequiredFieldsAlertProps) {
  if (missingFields.length === 0) {
    return null
  }

  // Group missing fields by category
  const groupedByCategory = missingFields.reduce<Record<string, UIFieldValidation[]>>(
    (acc, field) => {
      const category = field.category || 'Other'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(field)
      return acc
    },
    {}
  )

  // Order categories by logical grouping (matches validation.ts category names)
  const categoryOrder = [
    'Personal Information',
    'Property Information',
    'Occupancy Information',
    'Safety Information',
    'Coverage Information',
    'Insurance Information',
    'Updates Information',
    'Claims Information',
    'Scheduled Items',
    'Vehicle Information',
    'Driver Information',
    'Deductible Information',
    'Lienholder Information',
    'Prior Insurance',
    'Accidents/Tickets',
    'Other',
  ]
  const sortedCategories = Object.keys(groupedByCategory).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a)
    const indexB = categoryOrder.indexOf(b)
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
  })

  return (
    <Alert
      className={cn(
        'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30',
        '[&>svg]:text-amber-600 dark:[&>svg]:text-amber-400',
        className
      )}
    >
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 font-semibold text-base mb-3">
        Please fill in the following required fields before continuing:
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <div className="space-y-4">
          {/* Grouped field list */}
          <div className="space-y-3">
            {sortedCategories.map((category) => (
              <div key={category}>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1.5">
                  {category}
                </p>
                <ul className="space-y-1 pl-1">
                  {groupedByCategory[category].map((field) => (
                    <li key={field.key} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      {onFieldClick ? (
                        <button
                          type="button"
                          onClick={() => onFieldClick(field.key)}
                          className="text-sm font-medium text-amber-800 dark:text-amber-200 hover:underline focus:outline-none focus:underline flex items-center gap-1.5 group"
                        >
                          {field.label}
                          <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          {field.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Action button */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-amber-200 dark:border-amber-800">
            <Link href={`/review/${extractionId}`} className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-2 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/50"
              >
                <ArrowLeft className="h-4 w-4" />
                Go back to edit
              </Button>
            </Link>
            <p className="text-xs text-amber-600 dark:text-amber-400 self-center">
              or click a field name above to edit it directly
            </p>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}
