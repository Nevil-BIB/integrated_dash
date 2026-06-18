'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldEditor } from './FieldEditor'
import { FormSection, calculateSectionStats } from './FormSection'
import {
  HomeExtractionScheduledItems,
  HomeExtractionJewelryItem,
  HomeExtractionValuableItem,
  HOME_JEWELRY_FIELDS,
  HOME_VALUABLE_FIELDS,
  createEmptyJewelryItem,
  createEmptyValuableItem,
  HomeFieldConfig,
} from '@/types/home-extraction'
import { ExtractionField } from '@/types/extraction'
import { Plus, Trash2, Gem, Package, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScheduledItemsEditorProps {
  scheduledItems: HomeExtractionScheduledItems
  onChange: (scheduledItems: HomeExtractionScheduledItems) => void
  className?: string
}

/**
 * Scheduled Items Editor for Home Insurance
 * Manages jewelry and other valuables arrays with add/remove functionality
 */
export function ScheduledItemsEditor({
  scheduledItems,
  onChange,
  className,
}: ScheduledItemsEditorProps) {
  const [localItems, setLocalItems] = useState<HomeExtractionScheduledItems>(scheduledItems)

  // Calculate stats for the entire section
  const sectionStats = useMemo(() => {
    let total = 0
    let completed = 0
    let lowConfidence = 0
    let flagged = 0

    // Count jewelry items
    localItems.jewelry.forEach((item) => {
      const stats = calculateSectionStats(item)
      total += stats.total
      completed += stats.completed
      lowConfidence += stats.lowConfidence
      flagged += stats.flagged
    })

    // Count other valuables
    localItems.otherValuables.forEach((item) => {
      const stats = calculateSectionStats(item)
      total += stats.total
      completed += stats.completed
      lowConfidence += stats.lowConfidence
      flagged += stats.flagged
    })

    return { total, completed, lowConfidence, flagged }
  }, [localItems])

  // Calculate total scheduled value
  const totalScheduledValue = useMemo(() => {
    let total = 0

    localItems.jewelry.forEach((item) => {
      const value = parseFloat((item.value.value || '0').replace(/[$,]/g, ''))
      if (!isNaN(value)) total += value
    })

    localItems.otherValuables.forEach((item) => {
      const value = parseFloat((item.value.value || '0').replace(/[$,]/g, ''))
      if (!isNaN(value)) total += value
    })

    return total
  }, [localItems])

  // Jewelry handlers
  const handleAddJewelry = useCallback(() => {
    const newItems = {
      ...localItems,
      jewelry: [...localItems.jewelry, createEmptyJewelryItem()],
    }
    setLocalItems(newItems)
    onChange(newItems)
  }, [localItems, onChange])

  const handleRemoveJewelry = useCallback(
    (index: number) => {
      const newItems = {
        ...localItems,
        jewelry: localItems.jewelry.filter((_, i) => i !== index),
      }
      setLocalItems(newItems)
      onChange(newItems)
    },
    [localItems, onChange]
  )

  const handleJewelryFieldChange = useCallback(
    (itemIndex: number, fieldKey: keyof HomeExtractionJewelryItem, value: string) => {
      const newItems = {
        ...localItems,
        jewelry: localItems.jewelry.map((item, i) => {
          if (i !== itemIndex) return item
          return {
            ...item,
            [fieldKey]: {
              ...item[fieldKey],
              value,
              confidence: 'high' as const,
              flagged: false,
            },
          }
        }),
      }
      setLocalItems(newItems)
      onChange(newItems)
    },
    [localItems, onChange]
  )

  // Other Valuables handlers
  const handleAddValuable = useCallback(() => {
    const newItems = {
      ...localItems,
      otherValuables: [...localItems.otherValuables, createEmptyValuableItem()],
    }
    setLocalItems(newItems)
    onChange(newItems)
  }, [localItems, onChange])

  const handleRemoveValuable = useCallback(
    (index: number) => {
      const newItems = {
        ...localItems,
        otherValuables: localItems.otherValuables.filter((_, i) => i !== index),
      }
      setLocalItems(newItems)
      onChange(newItems)
    },
    [localItems, onChange]
  )

  const handleValuableFieldChange = useCallback(
    (itemIndex: number, fieldKey: keyof HomeExtractionValuableItem, value: string) => {
      const newItems = {
        ...localItems,
        otherValuables: localItems.otherValuables.map((item, i) => {
          if (i !== itemIndex) return item
          return {
            ...item,
            [fieldKey]: {
              ...item[fieldKey],
              value,
              confidence: 'high' as const,
              flagged: false,
            },
          }
        }),
      }
      setLocalItems(newItems)
      onChange(newItems)
    },
    [localItems, onChange]
  )

  const hasItems = localItems.jewelry.length > 0 || localItems.otherValuables.length > 0

  const jewelryFieldEntries = Object.entries(HOME_JEWELRY_FIELDS) as [
    keyof HomeExtractionJewelryItem,
    HomeFieldConfig
  ][]

  const valuableFieldEntries = Object.entries(HOME_VALUABLE_FIELDS) as [
    keyof HomeExtractionValuableItem,
    HomeFieldConfig
  ][]

  return (
    <FormSection
      title="Scheduled Items"
      description="Jewelry and other high-value personal property"
      defaultOpen={hasItems}
      stats={sectionStats}
      className={className}
    >
      <div className="space-y-6">
        {/* Total Value Display */}
        {totalScheduledValue > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Total Scheduled Value:</span>
            <span className="text-lg font-semibold">
              ${totalScheduledValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
          </div>
        )}

        {/* Jewelry Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Gem className="w-4 h-4 text-purple-600" />
            <h4 className="text-sm font-medium">Jewelry</h4>
            <span className="text-xs text-muted-foreground">
              ({localItems.jewelry.length} item{localItems.jewelry.length !== 1 ? 's' : ''})
            </span>
          </div>

          {localItems.jewelry.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed rounded-lg bg-muted/30">
              <AlertCircle className="w-6 h-6 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No jewelry items scheduled</p>
              <Button onClick={handleAddJewelry} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Jewelry Item
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {localItems.jewelry.map((item, index) => (
                <Card key={index} className="bg-purple-50/30 border-purple-200">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid gap-3 sm:grid-cols-2">
                        {jewelryFieldEntries.map(([fieldKey, config]) => (
                          <FieldEditor
                            key={`jewelry-${index}-${fieldKey}`}
                            field={item[fieldKey]}
                            label={config.label}
                            fieldKey={`jewelry-${index}-${fieldKey}`}
                            type={config.inputType}
                            required={config.required}
                            options={config.options}
                            placeholder={config.placeholder}
                            onChange={(value) =>
                              handleJewelryFieldChange(index, fieldKey, value)
                            }
                          />
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveJewelry(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
                        aria-label={`Remove jewelry item ${index + 1}${item.description.value ? `: ${item.description.value}` : ''}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button onClick={handleAddJewelry} variant="outline" className="w-full" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Another Jewelry Item
              </Button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t my-4" />

        {/* Other Valuables Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-medium">Other Valuables</h4>
            <span className="text-xs text-muted-foreground">
              ({localItems.otherValuables.length} item
              {localItems.otherValuables.length !== 1 ? 's' : ''})
            </span>
          </div>

          {localItems.otherValuables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed rounded-lg bg-muted/30">
              <AlertCircle className="w-6 h-6 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No other valuables scheduled</p>
              <Button onClick={handleAddValuable} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Valuable Item
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {localItems.otherValuables.map((item, index) => (
                <Card key={index} className="bg-amber-50/30 border-amber-200">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid gap-3 sm:grid-cols-2">
                        {valuableFieldEntries.map(([fieldKey, config]) => (
                          <FieldEditor
                            key={`valuable-${index}-${fieldKey}`}
                            field={item[fieldKey]}
                            label={config.label}
                            fieldKey={`valuable-${index}-${fieldKey}`}
                            type={config.inputType}
                            required={config.required}
                            options={config.options}
                            placeholder={config.placeholder}
                            onChange={(value) =>
                              handleValuableFieldChange(index, fieldKey, value)
                            }
                          />
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveValuable(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
                        aria-label={`Remove valuable item ${index + 1}${item.description.value ? `: ${item.description.value}` : ''}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button onClick={handleAddValuable} variant="outline" className="w-full" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Another Valuable Item
              </Button>
            </div>
          )}
        </div>

        {/* Help text */}
        <p className="text-xs text-muted-foreground">
          Schedule high-value items that exceed standard personal property coverage limits.
          Jewelry typically has a $1,500-$2,500 limit; other items vary by policy.
        </p>
      </div>
    </FormSection>
  )
}
