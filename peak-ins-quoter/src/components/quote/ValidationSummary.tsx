'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import type { UIValidationResult, QuoteType } from '@/types/quote'

interface ValidationSummaryProps {
  validationResult: UIValidationResult
  quoteType: QuoteType
  className?: string
}

const quoteTypeLabels: Record<QuoteType, string> = {
  home: 'Home Insurance',
  auto: 'Auto Insurance',
  both: 'Home + Auto Bundle',
}

export function ValidationSummary({
  validationResult,
  quoteType,
  className,
}: ValidationSummaryProps) {
  const {
    isValid,
    totalRequired,
    completedRequired,
    completionPercentage,
    flaggedFields,
  } = validationResult

  const flaggedCount = flaggedFields.length
  const missingCount = totalRequired - completedRequired

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            {quoteTypeLabels[quoteType]} Validation
          </CardTitle>
          {isValid ? (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Ready
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Incomplete
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Required Fields</span>
            <span className="font-medium">
              {completedRequired} of {totalRequired} complete
            </span>
          </div>
          <Progress
            value={completionPercentage}
            className={cn(
              'h-2',
              completionPercentage === 100 && '[&>div]:bg-green-500'
            )}
          />
        </div>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-3">
          {missingCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{missingCount} missing field{missingCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {flaggedCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{flaggedCount} field{flaggedCount !== 1 ? 's' : ''} need{flaggedCount === 1 ? 's' : ''} review</span>
            </div>
          )}

          {missingCount === 0 && flaggedCount === 0 && (
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>All required fields complete</span>
            </div>
          )}
        </div>

        {/* Detailed Counts */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-600">{completedRequired}</div>
            <div className="text-xs text-muted-foreground">Valid</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-red-600">{missingCount}</div>
            <div className="text-xs text-muted-foreground">Missing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-amber-600">{flaggedCount}</div>
            <div className="text-xs text-muted-foreground">Flagged</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
