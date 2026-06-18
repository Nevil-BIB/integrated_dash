'use client'

import { useState, ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, AlertCircle, AlertTriangle, CheckCircle2, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormSectionStats {
  total: number
  completed: number
  lowConfidence: number
  flagged: number
}

interface FormSectionProps {
  title: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
  defaultOpen?: boolean
  stats?: FormSectionStats
  className?: string
}

export function FormSection({
  title,
  description,
  icon: Icon,
  children,
  defaultOpen = true,
  stats,
  className,
}: FormSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const getStatusIndicator = () => {
    if (!stats) return null

    const { total, completed, lowConfidence, flagged } = stats

    // If there are flagged fields, show error indicator
    if (flagged > 0) {
      return (
        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 font-medium">
          <AlertCircle className="w-3 h-3 mr-1.5" />
          {flagged} flagged
        </Badge>
      )
    }

    // If there are low confidence fields, show warning indicator
    if (lowConfidence > 0) {
      return (
        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 font-medium">
          <AlertTriangle className="w-3 h-3 mr-1.5" />
          {lowConfidence} to review
        </Badge>
      )
    }

    // If all fields are completed with good confidence
    if (completed === total && total > 0) {
      return (
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1.5" />
          Complete
        </Badge>
      )
    }

    // Show progress
    if (total > 0) {
      return (
        <Badge variant="outline" className="text-muted-foreground font-medium">
          {completed}/{total}
        </Badge>
      )
    }

    return null
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card className="overflow-hidden border shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none hover:bg-muted/40 transition-colors py-5 px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {/* Expand/Collapse Chevron */}
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
                  isOpen ? "bg-primary/10" : "bg-muted"
                )}>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Section Icon (if provided) */}
                {Icon && (
                  <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 border">
                    <Icon className="h-5 w-5 text-primary/80" />
                  </div>
                )}

                {/* Title and Description */}
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base font-semibold text-foreground">
                    {title}
                  </CardTitle>
                  {description && (
                    <CardDescription className="mt-1 text-sm line-clamp-1">
                      {description}
                    </CardDescription>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {getStatusIndicator()}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-6 pb-8 pt-2">
            {/* Divider line for visual separation */}
            <div className="mb-6 border-t" />
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

interface ExtractionFieldLike {
  value: string | null;
  confidence: 'high' | 'medium' | 'low';
  flagged: boolean;
}

/**
 * Helper function to calculate section stats from extraction fields
 */
export function calculateSectionStats(
  fields: Record<string, ExtractionFieldLike> | object
): FormSectionStats {
  // Cast to allow iteration over any object with extraction field-like properties
  const entries = Object.values(fields) as ExtractionFieldLike[]

  return {
    total: entries.length,
    completed: entries.filter((f) => f.value !== null && f.value !== '').length,
    lowConfidence: entries.filter((f) => f.confidence === 'low' && !f.flagged).length,
    flagged: entries.filter((f) => f.flagged).length,
  }
}
