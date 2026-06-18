'use client'

import { ExtractionField } from '@/types/extraction'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfidenceBadge } from './ConfidenceBadge'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Info } from 'lucide-react'

export type FieldInputType = 'text' | 'date' | 'tel' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox'
const EMPTY_SELECT_VALUE = '__EMPTY__'

interface FieldEditorProps {
  field?: ExtractionField
  label: string
  fieldKey: string
  onChange: (value: string) => void
  type?: FieldInputType
  required?: boolean
  options?: string[]
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Show explicit Required / Optional badge beside the label */
  showRequirementLabel?: boolean
  /** Force red highlight (e.g. after failed Proceed to Quote validation) */
  forceHighlight?: boolean
}

export function FieldEditor({
  field,
  label,
  fieldKey,
  onChange,
  type = 'text',
  required = false,
  options = [],
  placeholder,
  className,
  disabled = false,
  showRequirementLabel = false,
  forceHighlight = false,
}: FieldEditorProps) {
  const safeField: ExtractionField = field ?? {
    value: null,
    confidence: 'high',
    flagged: false,
  }

  // Use the field value directly - component is controlled by parent
  const value = safeField.value || ''

  const isLowConfidence = safeField.confidence === 'low'
  const isMediumConfidence = safeField.confidence === 'medium'
  const isFlagged = safeField.flagged
  const isEmpty = safeField.value === null || safeField.value === ''

  const showRequiredError = required && (forceHighlight || isFlagged || isEmpty)
  const needsAttention =
    showRequiredError || (required && isLowConfidence)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const handleSelectChange = (newValue: string) => {
    onChange(newValue === EMPTY_SELECT_VALUE ? '' : newValue)
  }

  // Determine visual styling based on confidence and flagged status
  // Only apply warning styles to REQUIRED fields
  const getFieldStyles = () => {
    if (showRequiredError) {
      return 'border-red-500 focus-visible:ring-red-500 bg-red-50/80 ring-1 ring-red-200'
    }
    if (!required) {
      return ''
    }
    if (isLowConfidence) {
      return 'border-orange-300 focus-visible:ring-orange-500 bg-orange-50/50'
    }
    if (isMediumConfidence) {
      return 'border-yellow-300 focus-visible:ring-yellow-500'
    }
    return ''
  }

  const getLabelStyles = () => {
    if (showRequiredError) return 'text-red-600'
    if (!required) {
      return ''
    }
    if (isLowConfidence) return 'text-orange-600'
    if (isMediumConfidence) return 'text-yellow-700'
    return ''
  }

  const fieldStyles = getFieldStyles()
  const labelStyles = getLabelStyles()

  const renderInput = () => {
    if (type === 'select') {
      const selectValue =
        safeField.value != null && safeField.value !== '' ? safeField.value : EMPTY_SELECT_VALUE

      return (
        <Select value={selectValue} onValueChange={handleSelectChange} disabled={disabled}>
          <SelectTrigger
            id={fieldKey}
            className={cn(
              fieldStyles,
              safeField.value === null && 'bg-muted'
            )}
          >
            <SelectValue placeholder={placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_SELECT_VALUE}>{placeholder || 'Select...'}</SelectItem>
            {options
              .filter((option) => option !== '' && option !== EMPTY_SELECT_VALUE)
              .map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (type === 'textarea') {
      return (
        <textarea
          id={fieldKey}
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder={placeholder || (safeField.value === null ? 'Not found' : undefined)}
          rows={3}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            fieldStyles,
            safeField.value === null && 'bg-muted'
          )}
        />
      )
    }

    return (
      <Input
        id={fieldKey}
        type={type}
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        placeholder={placeholder || (safeField.value === null ? 'Not found' : undefined)}
        className={cn(
          fieldStyles,
          safeField.value === null && 'bg-muted'
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'space-y-2.5',
        forceHighlight && showRequiredError && 'rounded-lg p-2 -m-2 bg-red-50/40',
        className,
      )}
    >
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label
            htmlFor={fieldKey}
            className={cn(
              'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
              labelStyles
            )}
          >
            {label}
          </Label>
          {showRequirementLabel && (
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                required
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {required ? 'Required' : 'Optional'}
            </span>
          )}
          {safeField.rawText && safeField.rawText !== safeField.value && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-muted transition-colors"
                    aria-label="View original text"
                  >
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">
                    <span className="font-medium">Original text:</span> {safeField.rawText}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <ConfidenceBadge confidence={safeField.confidence} flagged={safeField.flagged} />
      </div>

      {/* Input field */}
      {renderInput()}

      {/* Help text for REQUIRED fields that need attention */}
      {needsAttention && (
        <p
          className={cn(
            'text-xs leading-relaxed',
            showRequiredError ? 'text-red-600 font-medium' : 'text-orange-600',
          )}
        >
          {showRequiredError && (isEmpty || forceHighlight)
            ? 'Required — please fill this field before proceeding to quote'
            : isFlagged
              ? 'This required field needs review - data may be illegible'
              : 'Low confidence - please verify this required value'}
        </p>
      )}
    </div>
  )
}
