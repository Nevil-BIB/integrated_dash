'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { EditableField } from './EditableField'
import { cn } from '@/lib/utils'
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import type { UIFieldValidation, ArrayFieldSchema } from '@/types/quote'

interface ArrayFieldEditorProps {
  items: Array<Record<string, UIFieldValidation>>
  schema: ArrayFieldSchema
  onAdd: () => void
  onRemove: (index: number) => void
  onFieldChange: (index: number, fieldKey: string, value: string) => void
  className?: string
}

interface ItemEditorProps {
  item: Record<string, UIFieldValidation>
  index: number
  schema: ArrayFieldSchema
  onRemove: (index: number) => void
  onFieldChange: (index: number, fieldKey: string, value: string) => void
  isLast: boolean
  canRemove: boolean
}

function ItemEditor({
  item,
  index,
  schema,
  onRemove,
  onFieldChange,
  isLast,
  canRemove,
}: ItemEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Calculate summary for collapsed state
  const getSummary = () => {
    const primaryFields = schema.fields.slice(0, 2)
    const values = primaryFields
      .map((field) => item[field.key]?.value)
      .filter(Boolean)
      .join(' ')
    return values || `${schema.label.replace(/s$/, '')} ${index + 1}`
  }

  // Check if any field has issues
  const hasIssues = Object.values(item).some(
    (field) => field.flagged || field.status === 'invalid' || field.status === 'missing'
  )

  const missingCount = Object.values(item).filter(
    (field) => field.required && field.status === 'missing'
  ).length

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden',
        hasIssues && 'border-amber-200 bg-amber-50/30',
        !isLast && 'mb-3'
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 flex-1 text-left">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium text-sm">{getSummary()}</span>
              {hasIssues && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700 text-xs ml-2"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {missingCount > 0 ? `${missingCount} missing` : 'Review needed'}
                </Badge>
              )}
            </button>
          </CollapsibleTrigger>
          {canRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${schema.label.replace(/s$/, '')} ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="p-4 pt-0 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              {schema.fields.map((fieldSchema) => {
                const field = item[fieldSchema.key]
                if (!field) return null

                return (
                  <EditableField
                    key={fieldSchema.key}
                    field={{
                      ...field,
                      inputType: fieldSchema.inputType,
                      required: fieldSchema.required,
                      options: fieldSchema.options,
                    }}
                    onChange={(value) => onFieldChange(index, fieldSchema.key, value)}
                    options={fieldSchema.options}
                  />
                )
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function ArrayFieldEditor({
  items,
  schema,
  onAdd,
  onRemove,
  onFieldChange,
  className,
}: ArrayFieldEditorProps) {
  const canAdd = !schema.maxItems || items.length < schema.maxItems
  const canRemove = !schema.minItems || items.length > schema.minItems

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-medium">{schema.label}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {items.length}
              {schema.maxItems && ` / ${schema.maxItems}`}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onAdd}
            disabled={!canAdd}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add {schema.label.replace(/s$/, '')}
          </Button>
        </div>
        {schema.minItems && schema.minItems > 0 && (
          <p className="text-xs text-muted-foreground">
            At least {schema.minItems} {schema.minItems === 1 ? 'item' : 'items'} required
          </p>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No {schema.label.toLowerCase()} added yet.</p>
            <Button
              variant="link"
              size="sm"
              onClick={onAdd}
              disabled={!canAdd}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add your first {schema.label.replace(/s$/, '').toLowerCase()}
            </Button>
          </div>
        ) : (
          <div>
            {items.map((item, index) => (
              <ItemEditor
                key={index}
                item={item}
                index={index}
                schema={schema}
                onRemove={onRemove}
                onFieldChange={onFieldChange}
                isLast={index === items.length - 1}
                canRemove={canRemove}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
