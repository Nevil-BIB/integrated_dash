'use client'

import { getCarrierOption, type CarrierOptionId } from '@/lib/carriers'
import { cn } from '@/lib/utils'

interface CarrierWorkflowTabsProps {
  carrierOptionIds: CarrierOptionId[]
  activeCarrierOptionId: CarrierOptionId
  onChange: (carrierOptionId: CarrierOptionId) => void
  className?: string
}

export function CarrierWorkflowTabs({
  carrierOptionIds,
  activeCarrierOptionId,
  onChange,
  className,
}: CarrierWorkflowTabsProps) {
  if (carrierOptionIds.length <= 1) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {carrierOptionIds.map((id) => {
        const option = getCarrierOption(id)
        const isActive = id === activeCarrierOptionId
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
