'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Edit2,
  Minus,
} from 'lucide-react'
import type { UIFieldValidation } from '@/types/quote'

type SectionType = 'required' | 'optional' | 'flagged'

interface FieldValidationListProps {
  fields: UIFieldValidation[]
  section: SectionType
  onEdit: (fieldKey: string) => void
  className?: string
  defaultOpen?: boolean
}

interface FieldRowProps {
  field: UIFieldValidation
  onEdit: (fieldKey: string) => void
}

const sectionConfig: Record<
  SectionType,
  {
    title: string
    emptyMessage: string
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
    badgeClass: string
  }
> = {
  required: {
    title: 'Required Fields',
    emptyMessage: 'All required fields are complete',
    badgeVariant: 'outline',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
  },
  optional: {
    title: 'Optional Fields',
    emptyMessage: 'No optional fields available',
    badgeVariant: 'secondary',
    badgeClass: '',
  },
  flagged: {
    title: 'Fields Requiring Review',
    emptyMessage: 'No fields require additional review',
    badgeVariant: 'outline',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
  },
}

function FieldRow({ field, onEdit }: FieldRowProps) {
  const getStatusIcon = () => {
    if (field.flagged) {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />
    }
    switch (field.status) {
      case 'valid':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'missing':
        return <Minus className="h-4 w-4 text-muted-foreground" />
      default:
        return null
    }
  }

  const getConfidenceBadge = () => {
    if (!field.value) return null

    const confidenceStyles = {
      high: 'border-green-200 bg-green-50 text-green-700',
      medium: 'border-yellow-200 bg-yellow-50 text-yellow-700',
      low: 'border-red-200 bg-red-50 text-red-700',
    }

    return (
      <Badge
        variant="outline"
        className={cn('text-xs', confidenceStyles[field.confidence])}
      >
        {field.confidence}
      </Badge>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors',
        field.flagged && 'bg-amber-50/50',
        field.status === 'invalid' && 'bg-red-50/50',
        field.status === 'missing' && !field.flagged && 'bg-muted/30'
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{field.label}</span>
            {field.category && (
              <span className="text-xs text-muted-foreground">({field.category})</span>
            )}
          </div>
          {field.value ? (
            <span className="text-sm text-muted-foreground truncate block">
              {field.value}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground italic">
              {field.status === 'missing' ? 'Not provided' : 'Empty'}
            </span>
          )}
          {field.errorMessage && (
            <span className="text-xs text-red-600 block mt-0.5">
              {field.errorMessage}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-2 shrink-0">
        {getConfidenceBadge()}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(field.key)}
          aria-label={`Edit ${field.label}`}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function FieldValidationList({
  fields,
  section,
  onEdit,
  className,
  defaultOpen = true,
}: FieldValidationListProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const config = sectionConfig[section]

  const validCount = fields.filter((f) => f.status === 'valid' && !f.flagged).length
  const invalidCount = fields.filter((f) => f.status === 'invalid' || f.status === 'missing').length

  return (
    <Card className={cn('', className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">
                  {config.title}
                </CardTitle>
                <Badge variant={config.badgeVariant} className={cn('text-xs', config.badgeClass)}>
                  {fields.length}
                </Badge>
                {section === 'required' && invalidCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {invalidCount} missing
                  </Badge>
                )}
                {section === 'required' && validCount > 0 && invalidCount === 0 && (
                  <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700">
                    Complete
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">
                {config.emptyMessage}
              </p>
            ) : (
              <div className="space-y-1">
                {fields.map((field) => (
                  <FieldRow key={field.key} field={field} onEdit={onEdit} />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
