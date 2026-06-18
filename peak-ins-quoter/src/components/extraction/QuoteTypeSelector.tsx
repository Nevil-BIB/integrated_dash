'use client'

import { KeyboardEvent, useId } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Home, Car, Layers } from 'lucide-react'

/**
 * Quote type for insurance selections
 */
export type QuoteType = 'home' | 'auto' | 'both'

/**
 * QuoteTypeSelector Props
 *
 * Supports two API patterns for backward compatibility:
 * - Controlled: value + onChange (preferred)
 * - Alternative: selected + onSelect (legacy)
 *
 * Display variants:
 * - 'compact': Inline button-style selector (default)
 * - 'cards': Card-based grid selector with descriptions
 */
export interface QuoteTypeSelectorProps {
  /** Current selected value (controlled pattern) */
  value?: QuoteType
  /** Change handler (controlled pattern) */
  onChange?: (type: QuoteType) => void
  /** Current selected value (alternative pattern) */
  selected?: QuoteType
  /** Change handler (alternative pattern) */
  onSelect?: (type: QuoteType) => void
  /** Display variant */
  variant?: 'compact' | 'cards'
  /** Additional CSS classes */
  className?: string
}

interface QuoteTypeOption {
  type: QuoteType
  title: string
  description: string
  icon: React.ElementType
}

const quoteTypes: QuoteTypeOption[] = [
  {
    type: 'home',
    title: 'Home Quote',
    description: 'Homeowners, renters, or dwelling insurance coverage for your property.',
    icon: Home,
  },
  {
    type: 'auto',
    title: 'Auto Quote',
    description: 'Vehicle insurance coverage including liability, collision, and comprehensive.',
    icon: Car,
  },
  {
    type: 'both',
    title: 'Home + Auto Bundle',
    description: 'Bundle both home and auto policies for maximum savings and convenience.',
    icon: Layers,
  },
]

const QUOTE_TYPE_VALUES: QuoteType[] = ['home', 'auto', 'both']

/**
 * QuoteTypeSelector Component
 *
 * A flexible selector for choosing insurance quote types.
 * Supports both compact inline buttons and rich card-based layouts.
 *
 * @example Compact variant (default)
 * ```tsx
 * <QuoteTypeSelector value={quoteType} onChange={setQuoteType} />
 * ```
 *
 * @example Card variant
 * ```tsx
 * <QuoteTypeSelector
 *   value={quoteType}
 *   onChange={setQuoteType}
 *   variant="cards"
 * />
 * ```
 */
export function QuoteTypeSelector({
  value,
  onChange,
  selected,
  onSelect,
  variant = 'compact',
  className,
}: QuoteTypeSelectorProps) {
  // Support both API patterns - prefer value/onChange if provided
  const currentValue = value ?? selected
  const handleChange = onChange ?? onSelect
  const labelId = useId()

  const handleRadioGroupKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!currentValue || !handleChange) return
    const currentIndex = QUOTE_TYPE_VALUES.indexOf(currentValue)

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % QUOTE_TYPE_VALUES.length
      handleChange(QUOTE_TYPE_VALUES[nextIndex])
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = (currentIndex - 1 + QUOTE_TYPE_VALUES.length) % QUOTE_TYPE_VALUES.length
      handleChange(QUOTE_TYPE_VALUES[prevIndex])
    }
  }

  if (variant === 'cards') {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="text-center">
          <h2 id={labelId} className="text-2xl font-semibold tracking-tight">Select Quote Type</h2>
          <p className="text-muted-foreground mt-2">
            Choose the type of insurance quote you want to generate from the extracted data.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          onKeyDown={handleRadioGroupKeyDown}
        >
          {quoteTypes.map((option) => {
            const Icon = option.icon
            const isSelected = currentValue === option.type

            return (
              <Card
                key={option.type}
                className={cn(
                  'cursor-pointer transition-all duration-200 hover:shadow-md',
                  'hover:border-primary/50',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSelected && 'border-primary ring-2 ring-primary/20 bg-primary/5'
                )}
                onClick={() => handleChange?.(option.type)}
                role="radio"
                aria-checked={isSelected}
                aria-label={option.title}
                tabIndex={isSelected ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleChange?.(option.type)
                  }
                }}
              >
                <CardHeader className="text-center pb-2">
                  <div
                    className={cn(
                      'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    {option.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // Compact variant (default)
  const compactLabelId = `${labelId}-compact`

  return (
    <div className={className}>
      <span id={compactLabelId} className="sr-only">Quote type selector</span>
      <div
        role="radiogroup"
        aria-labelledby={compactLabelId}
        className="flex gap-2"
        onKeyDown={handleRadioGroupKeyDown}
      >
        {quoteTypes.map((option) => {
          const Icon = option.icon
          const isSelected = currentValue === option.type

          return (
            <button
              key={option.type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={option.description}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleChange?.(option.type)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <div className="text-left">
                <div className="text-sm font-medium">{option.title.replace(' Quote', '').replace(' Bundle', '')}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
