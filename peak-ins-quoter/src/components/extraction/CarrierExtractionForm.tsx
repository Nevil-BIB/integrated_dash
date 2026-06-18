'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FieldEditor, type FieldInputType } from './FieldEditor'
import { FormSection } from './FormSection'
import { AutoSaveIndicator } from './AutoSaveIndicator'
import { useAutoSave } from '@/hooks/use-auto-save'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  getCarrierSchema,
  getFieldBySchemaKey,
  updateFieldBySchemaKey,
  countCarrierFieldStats,
  countCarrierRequiredFieldStats,
  isCarrierFieldComplete,
  isCarrierFieldVisible,
  resolveCarrierFieldOptions,
  carrierFieldUsesSelect,
  getCarrierFieldsMap,
  type CarrierOptionId,
} from '@/lib/carriers'
import type { CarrierSchemaField } from '@/lib/carriers/schema-types'
import type { ExtractionField } from '@/types/extraction'
import {
  CHUBB_ATTACHED_STRUCTURE_FIELDS,
  CHUBB_CONSTRUCTION_TYPE_FIELDS,
  createEmptyChubbAttachedStructure,
  createEmptyChubbConstructionTypeEntry,
  createEmptyHomeExtraction,
  mergeChubbHomeCoverageEstimator,
  mergeChubbWithLegacyHomeownersFields,
  type HomeExtractionChubbHomeCoverageEstimator,
  type HomeExtractionResult,
} from '@/types/home-extraction'
import { cn } from '@/lib/utils'
import { Building2, CheckCircle2, Loader2, Plus, Save, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export type CarrierFormData = HomeExtractionResult & {
  carrierFields?: Record<string, ExtractionField>
  carrierFieldsByOption?: Partial<
    Record<CarrierOptionId, Record<string, ExtractionField>>
  >
}

interface CarrierExtractionFormProps {
  extractionId: string
  carrierOptionId: CarrierOptionId
  initialData: CarrierFormData
  onSave?: (data: CarrierFormData) => Promise<void>
  onDataChange?: (data: CarrierFormData) => void
  className?: string
  /** Schema keys to highlight after failed Proceed to Quote validation */
  missingRequiredKeys?: string[]
}

function CarrierRequirementBadge({ required }: { required: boolean }) {
  return (
    <span
      className={cn(
        'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0',
        required
          ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {required ? 'Required' : 'Optional'}
    </span>
  )
}

function isFieldValueEmpty(
  field: CarrierSchemaField,
  data: CarrierFormData,
  carrierOptionId: CarrierOptionId,
): boolean {
  return !isCarrierFieldComplete(field, data, carrierOptionId)
}

function schemaTypeToInputType(field: CarrierSchemaField): FieldInputType {
  switch (field.type) {
    case 'date':
      return 'date'
    case 'number':
      return 'number'
    case 'dropdown':
      return carrierFieldUsesSelect(field) ? 'select' : 'text'
    case 'checkbox':
      return 'text'
    default:
      return 'text'
  }
}

function sectionStatsForFields(
  data: CarrierFormData,
  fields: CarrierSchemaField[],
  carrierOptionId: CarrierOptionId,
) {
  const visible = fields.filter(
    (f) => f.type !== 'array' && isCarrierFieldVisible(f, data, carrierOptionId),
  )
  let completed = 0
  let lowConfidence = 0
  let flagged = 0
  for (const field of visible) {
    const extracted = getFieldBySchemaKey(data, field.key, carrierOptionId)
    if (extracted.value != null && String(extracted.value).trim() !== '') completed++
    if (extracted.confidence === 'low') lowConfidence++
    if (extracted.flagged) flagged++
  }
  return { total: visible.length, completed, lowConfidence, flagged }
}

export function CarrierExtractionForm({
  extractionId: _extractionId,
  carrierOptionId,
  initialData,
  onSave,
  onDataChange,
  className,
  missingRequiredKeys = [],
}: CarrierExtractionFormProps) {
  const schema = useMemo(() => getCarrierSchema(carrierOptionId), [carrierOptionId])

  const [data, setData] = useState<CarrierFormData>(() => {
    const empty = createEmptyHomeExtraction()
    const merged: CarrierFormData = {
      ...empty,
      ...initialData,
      homeownersInformations: {
        ...empty.homeownersInformations,
        ...(initialData.homeownersInformations ?? {}),
      },
      chubbHomeCoverageEstimator: mergeChubbWithLegacyHomeownersFields(
        mergeChubbHomeCoverageEstimator(initialData.chubbHomeCoverageEstimator),
        initialData.homeownersInformations,
      ),
      carrierFields:
        getCarrierFieldsMap(initialData, carrierOptionId) ?? initialData.carrierFields,
      carrierFieldsByOption: initialData.carrierFieldsByOption,
    }
    return merged
  })

  const {
    status: autoSaveStatus,
    lastSavedAt,
    error: autoSaveError,
    saveNow,
    resetStatus,
  } = useAutoSave({
    data,
    onSave: onSave || (async () => {}),
    debounceMs: 1500,
    enabled: !!onSave,
    onSaveSuccess: () => toast.success('Changes saved', { duration: 2000 }),
    onSaveError: () => toast.error('Failed to save changes'),
  })

  const onDataChangeRef = useRef(onDataChange)
  useEffect(() => {
    onDataChangeRef.current = onDataChange
  })

  const skipInitialDataChangeRef = useRef(true)
  useEffect(() => {
    if (skipInitialDataChangeRef.current) {
      skipInitialDataChangeRef.current = false
      return
    }
    onDataChangeRef.current?.(data)
  }, [data])

  const isSaving = autoSaveStatus === 'saving'
  const hasChanges = autoSaveStatus === 'pending' || autoSaveStatus === 'error'

  const formStats = useMemo(() => {
    const stats = countCarrierFieldStats(data, schema, carrierOptionId)
    const requiredStats = countCarrierRequiredFieldStats(data, schema, carrierOptionId)
    return {
      ...stats,
      requiredTotal: requiredStats.total,
      requiredCompleted: requiredStats.completed,
      completionPercentage:
        stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      requiredCompletionPercentage:
        requiredStats.total > 0
          ? Math.round((requiredStats.completed / requiredStats.total) * 100)
          : 100,
    }
  }, [data, schema, carrierOptionId])

  const missingKeySet = useMemo(
    () => new Set(missingRequiredKeys),
    [missingRequiredKeys],
  )

  useEffect(() => {
    if (missingRequiredKeys.length === 0) return
    const firstKey = missingRequiredKeys[0]
    const el = document.getElementById(`carrier-${firstKey}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [missingRequiredKeys])

  const handleScalarChange = useCallback(
    (schemaKey: string, value: string) => {
      setData((prev) => updateFieldBySchemaKey(prev, schemaKey, value, carrierOptionId))
    },
    [carrierOptionId],
  )

  const handleCheckboxChange = useCallback((schemaKey: string, checked: boolean) => {
    handleScalarChange(schemaKey, checked ? 'Yes' : 'No')
  }, [handleScalarChange])

  const updateChubb = useCallback(
    (chubbHomeCoverageEstimator: HomeExtractionChubbHomeCoverageEstimator) => {
      setData((prev) => ({ ...prev, chubbHomeCoverageEstimator }))
    },
    [],
  )

  const renderArrayFields = (field: CarrierSchemaField) => {
    if (carrierOptionId !== 'chubb-home') {
      return null
    }

    if (field.key === 'attachedStructures') {
      const entries = data.chubbHomeCoverageEstimator.attachedStructures
      return (
        <div className="space-y-4 col-span-full">
          {entries.map((entry, index) => (
            <div
              key={`attached-${index}`}
              className="grid gap-4 sm:grid-cols-[1fr_140px_auto] items-end"
            >
              <FieldEditor
                field={entry.attachedStructureType}
                label={CHUBB_ATTACHED_STRUCTURE_FIELDS.attachedStructureType.label}
                fieldKey={`carrier-attached-type-${index}`}
                type="select"
                options={CHUBB_ATTACHED_STRUCTURE_FIELDS.attachedStructureType.options}
                onChange={(value) =>
                  updateChubb({
                    ...data.chubbHomeCoverageEstimator,
                    attachedStructures: entries.map((row, i) =>
                      i === index
                        ? {
                            ...row,
                            attachedStructureType: {
                              ...row.attachedStructureType,
                              value,
                              confidence: 'high',
                              flagged: false,
                            },
                          }
                        : row,
                    ),
                  })
                }
              />
              <FieldEditor
                field={entry.squareFeet}
                label={CHUBB_ATTACHED_STRUCTURE_FIELDS.squareFeet.label}
                fieldKey={`carrier-attached-sqft-${index}`}
                type="number"
                onChange={(value) =>
                  updateChubb({
                    ...data.chubbHomeCoverageEstimator,
                    attachedStructures: entries.map((row, i) =>
                      i === index
                        ? {
                            ...row,
                            squareFeet: {
                              ...row.squareFeet,
                              value,
                              confidence: 'high',
                              flagged: false,
                            },
                          }
                        : row,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  updateChubb({
                    ...data.chubbHomeCoverageEstimator,
                    attachedStructures:
                      entries.length <= 1
                        ? [createEmptyChubbAttachedStructure()]
                        : entries.filter((_, i) => i !== index),
                  })
                }
                aria-label="Remove attached structure"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() =>
              updateChubb({
                ...data.chubbHomeCoverageEstimator,
                attachedStructures: [
                  ...entries,
                  createEmptyChubbAttachedStructure(),
                ],
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Add attached structure
          </Button>
        </div>
      )
    }

    if (field.key === 'constructionTypes') {
      const entries = data.chubbHomeCoverageEstimator.constructionTypes
      const highlightConstructionTypes = missingKeySet.has('constructionTypes')
      return (
        <div
          id="carrier-constructionTypes"
          className={cn(
            'space-y-4 col-span-full',
            highlightConstructionTypes && 'rounded-lg p-3 ring-2 ring-red-500 bg-red-50/50',
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{field.label}</h4>
            <CarrierRequirementBadge required={Boolean(field.required)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter at least one construction type. Percentages must total 100%.
          </p>
          {entries.map((entry, index) => (
            <div
              key={`construction-${index}`}
              className="grid gap-4 sm:grid-cols-[1fr_140px_auto] items-end"
            >
              <FieldEditor
                field={entry.constructionType}
                label={CHUBB_CONSTRUCTION_TYPE_FIELDS.constructionType.label}
                fieldKey={`carrier-construction-type-${index}`}
                type="select"
                required={Boolean(field.required)}
                showRequirementLabel
                forceHighlight={highlightConstructionTypes}
                options={CHUBB_CONSTRUCTION_TYPE_FIELDS.constructionType.options}
                onChange={(value) =>
                  updateChubb({
                    ...data.chubbHomeCoverageEstimator,
                    constructionTypes: entries.map((row, i) =>
                      i === index
                        ? {
                            ...row,
                            constructionType: {
                              ...row.constructionType,
                              value,
                              confidence: 'high',
                              flagged: false,
                            },
                          }
                        : row,
                    ),
                  })
                }
              />
              <FieldEditor
                field={entry.percentage}
                label={CHUBB_CONSTRUCTION_TYPE_FIELDS.percentage.label}
                fieldKey={`carrier-construction-pct-${index}`}
                type="text"
                required={Boolean(field.required)}
                showRequirementLabel
                forceHighlight={highlightConstructionTypes}
                onChange={(value) =>
                  updateChubb({
                    ...data.chubbHomeCoverageEstimator,
                    constructionTypes: entries.map((row, i) =>
                      i === index
                        ? {
                            ...row,
                            percentage: {
                              ...row.percentage,
                              value,
                              confidence: 'high',
                              flagged: false,
                            },
                          }
                        : row,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  updateChubb({
                    ...data.chubbHomeCoverageEstimator,
                    constructionTypes:
                      entries.length <= 1
                        ? [createEmptyChubbConstructionTypeEntry()]
                        : entries.filter((_, i) => i !== index),
                  })
                }
                aria-label="Remove construction type"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() =>
              updateChubb({
                ...data.chubbHomeCoverageEstimator,
                constructionTypes: [
                  ...entries,
                  createEmptyChubbConstructionTypeEntry(),
                ],
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Add construction type
          </Button>
        </div>
      )
    }

    return null
  }

  const renderSchemaField = (field: CarrierSchemaField) => {
    if (field.type === 'array') {
      return renderArrayFields(field)
    }

    if (!isCarrierFieldVisible(field, data, carrierOptionId)) return null

    const highlightMissing =
      field.required &&
      missingKeySet.has(field.key) &&
      isFieldValueEmpty(field, data, carrierOptionId)

    if (field.type === 'checkbox') {
      const extracted = getFieldBySchemaKey(data, field.key, carrierOptionId)
      const checkboxEmpty = isFieldValueEmpty(field, data, carrierOptionId)
      const showCheckboxError = field.required && (highlightMissing || checkboxEmpty)
      return (
        <div
          key={field.key}
          className={cn(
            'col-span-full sm:col-span-1',
            showCheckboxError && 'rounded-lg p-2 ring-2 ring-red-500 bg-red-50/50',
          )}
        >
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={cn(
                'h-4 w-4 rounded border-input',
                showCheckboxError && 'border-red-500',
              )}
              checked={extracted.value === 'Yes'}
              onChange={(e) => handleCheckboxChange(field.key, e.target.checked)}
            />
            <span className={cn(showCheckboxError && 'text-red-600 font-medium')}>
              {field.label}
            </span>
            <CarrierRequirementBadge required={field.required} />
          </label>
          {showCheckboxError && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              Required — check for Yes or uncheck for No before proceeding to quote
            </p>
          )}
        </div>
      )
    }

    return (
      <FieldEditor
        key={field.key}
        field={getFieldBySchemaKey(data, field.key, carrierOptionId)}
        label={field.label}
        fieldKey={`carrier-${field.key}`}
        type={schemaTypeToInputType(field)}
        required={field.required}
        showRequirementLabel
        forceHighlight={highlightMissing}
        options={resolveCarrierFieldOptions(field)}
        onChange={(value) => handleScalarChange(field.key, value)}
      />
    )
  }

  return (
    <div className={cn('space-y-8', className)}>
      <div className="p-6 bg-card border rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{schema.label}</h2>
                  <p className="text-sm text-muted-foreground">{schema.description}</p>
                </div>
              </div>
              <AutoSaveIndicator
                status={autoSaveStatus}
                lastSavedAt={lastSavedAt}
                error={autoSaveError}
                onRetry={saveNow}
                onDismiss={resetStatus}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formStats.requiredCompleted} of {formStats.requiredTotal}
                    </span>{' '}
                    required fields completed
                  </span>
                  <span className="font-medium text-foreground">
                    {formStats.requiredCompletionPercentage}%
                  </span>
                </div>
                <Progress value={formStats.requiredCompletionPercentage} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground">
                Each field is labeled <span className="font-semibold text-red-700">Required</span> or{' '}
                <span className="font-semibold">Optional</span>. Required fields must be filled before
                proceeding to quote.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {formStats.flagged > 0 && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  <AlertTriangle className="w-3 h-3 mr-1.5" />
                  {formStats.flagged} flagged
                </Badge>
              )}
              {formStats.lowConfidence > 0 && (
                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                  <AlertTriangle className="w-3 h-3 mr-1.5" />
                  {formStats.lowConfidence} to review
                </Badge>
              )}
              {formStats.flagged === 0 && formStats.lowConfidence === 0 && formStats.completed > 0 && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  <CheckCircle2 className="w-3 h-3 mr-1.5" />
                  All fields verified
                </Badge>
              )}
            </div>
          </div>

          {hasChanges && (
            <Button onClick={() => saveNow()} disabled={isSaving} variant="outline" size="sm" className="shrink-0">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Now
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {schema.sections.map((section) => (
          <FormSection
            key={section.id}
            title={section.title}
            stats={sectionStatsForFields(data, section.fields, carrierOptionId)}
            defaultOpen
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {section.fields.map((field) => renderSchemaField(field))}
            </div>
          </FormSection>
        ))}
      </div>
    </div>
  )
}
