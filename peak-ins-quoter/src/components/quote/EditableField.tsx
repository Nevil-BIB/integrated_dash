'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Check, X, Edit2, AlertCircle } from 'lucide-react'
import type { UIFieldValidation } from '@/types/quote'

interface EditableFieldProps {
  field: UIFieldValidation
  onChange: (value: string) => void
  options?: string[]
  className?: string
  autoFocus?: boolean
}

type InputType = 'text' | 'select' | 'date' | 'tel' | 'email' | 'number'
const EMPTY_SELECT_VALUE = '__EMPTY__'

// Validation functions for different field types
const validators: Record<InputType, (value: string) => string | null> = {
  text: () => null,
  select: () => null,
  date: (value) => {
    if (!value) return null
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(value)) return 'Invalid date format'
    const date = new Date(value)
    if (isNaN(date.getTime())) return 'Invalid date'
    return null
  },
  tel: (value) => {
    if (!value) return null
    const phoneRegex = /^[\d\s\-\(\)\+]{7,20}$/
    if (!phoneRegex.test(value)) return 'Invalid phone number format'
    return null
  },
  email: (value) => {
    if (!value) return null
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) return 'Invalid email format'
    return null
  },
  number: (value) => {
    if (!value) return null
    if (isNaN(Number(value))) return 'Must be a valid number'
    return null
  },
}

// Wrapper that provides a key to reset internal state when field value changes
export function EditableField(props: EditableFieldProps) {
  // Use field key + value as component key to reset state when external value changes
  const resetKey = useMemo(
    () => `${props.field.key}-${props.field.value ?? 'null'}`,
    [props.field.key, props.field.value]
  )
  return <EditableFieldInner key={resetKey} {...props} />
}

function EditableFieldInner({
  field,
  onChange,
  options,
  className,
  autoFocus = false,
}: EditableFieldProps) {
  // Initialize editing state based on autoFocus prop
  const [isEditing, setIsEditing] = useState(autoFocus)
  const [error, setError] = useState<string | null>(null)
  const [localValue, setLocalValue] = useState(field.value || '')
  const inputRef = useRef<HTMLInputElement>(null)

  const inputType: InputType = field.inputType || 'text'
  const isSelect = inputType === 'select' || (options && options.length > 0)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const validate = useCallback(
    (value: string) => {
      if (field.required && !value.trim()) {
        return 'This field is required'
      }
      const validator = validators[inputType]
      return validator(value)
    },
    [field.required, inputType]
  )

  const handleStartEdit = () => {
    setIsEditing(true)
    setError(null)
  }

  const handleSave = () => {
    const validationError = validate(localValue)
    if (validationError) {
      setError(validationError)
      return
    }
    onChange(localValue)
    setIsEditing(false)
    setError(null)
  }

  const handleCancel = () => {
    setLocalValue(field.value || '')
    setIsEditing(false)
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleSelectChange = (value: string) => {
    const next = value === EMPTY_SELECT_VALUE ? '' : value
    setLocalValue(next)
    onChange(next)
    setIsEditing(false)
  }

  const handleBlur = () => {
    // Delay to allow button clicks to register
    setTimeout(() => {
      if (isEditing && !isSelect) {
        handleSave()
      }
    }, 150)
  }

  const getStatusStyles = () => {
    if (error || field.status === 'invalid') {
      return 'border-red-300 focus-visible:ring-red-500'
    }
    if (field.flagged || field.confidence === 'low') {
      return 'border-amber-300 focus-visible:ring-amber-500'
    }
    if (field.status === 'valid') {
      return 'border-green-300'
    }
    return ''
  }

  const displayError = error || field.errorMessage

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <Label
          htmlFor={field.key}
          className={cn(
            'text-sm font-medium',
            field.required && "after:content-['*'] after:ml-0.5 after:text-red-500",
            (field.flagged || field.confidence === 'low') && 'text-amber-600'
          )}
        >
          {field.label}
        </Label>
      </div>

      {isEditing ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isSelect && options ? (
              <Select
                value={localValue !== '' ? localValue : EMPTY_SELECT_VALUE}
                onValueChange={handleSelectChange}
              >
                <SelectTrigger
                  id={field.key}
                  className={cn('flex-1', getStatusStyles())}
                >
                  <SelectValue placeholder={`Select ${field.label}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>Select {field.label}</SelectItem>
                  {options
                    .filter((option) => option !== '' && option !== EMPTY_SELECT_VALUE)
                    .map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input
                  ref={inputRef}
                  id={field.key}
                  type={inputType === 'select' ? 'text' : inputType}
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  className={cn('flex-1', getStatusStyles())}
                  placeholder={field.label}
                  aria-invalid={!!displayError}
                  aria-describedby={displayError ? `${field.key}-error` : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={handleSave}
                  aria-label="Save"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-red-50"
                  onClick={handleCancel}
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          {displayError && (
            <div
              id={`${field.key}-error`}
              className="flex items-center gap-1 text-xs text-red-600"
              role="alert"
            >
              <AlertCircle className="h-3 w-3" />
              {displayError}
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center justify-between min-h-[36px] px-3 py-2 rounded-md border bg-background',
            'cursor-pointer hover:bg-muted/50 transition-colors',
            getStatusStyles(),
            !field.value && 'bg-muted/30'
          )}
          onClick={handleStartEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleStartEdit()
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Edit ${field.label}: ${field.value || 'Not provided'}`}
        >
          <span
            className={cn(
              'text-sm truncate',
              !field.value && 'text-muted-foreground italic'
            )}
          >
            {field.value || 'Click to edit'}
          </span>
          <Edit2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
        </div>
      )}

      {field.rawText && field.rawText !== field.value && !isEditing && (
        <p className="text-xs text-muted-foreground">
          Original: <span className="italic">{field.rawText}</span>
        </p>
      )}
    </div>
  )
}
