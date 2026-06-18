import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, AlertCircle, Flag } from 'lucide-react'

interface ConfidenceBadgeProps {
  confidence: 'high' | 'medium' | 'low'
  flagged?: boolean
  className?: string
}

export function ConfidenceBadge({ confidence, flagged, className }: ConfidenceBadgeProps) {
  if (flagged) {
    return (
      <Badge variant="outline" className={cn('border-orange-500 text-orange-600', className)}>
        <Flag className="w-3 h-3 mr-1" />
        Review
      </Badge>
    )
  }

  switch (confidence) {
    case 'high':
      return (
        <Badge variant="outline" className={cn('border-green-500 text-green-600', className)}>
          <CheckCircle className="w-3 h-3 mr-1" />
          High
        </Badge>
      )
    case 'medium':
      return (
        <Badge variant="outline" className={cn('border-yellow-500 text-yellow-600', className)}>
          <AlertTriangle className="w-3 h-3 mr-1" />
          Medium
        </Badge>
      )
    case 'low':
      return (
        <Badge variant="outline" className={cn('border-red-500 text-red-600', className)}>
          <AlertCircle className="w-3 h-3 mr-1" />
          Low
        </Badge>
      )
  }
}
