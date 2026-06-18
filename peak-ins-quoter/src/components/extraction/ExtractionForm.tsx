'use client'

import { useState, useCallback } from 'react'
import { ExtractionResult, ExtractionField } from '@/types/extraction'
import { FieldEditor } from './FieldEditor'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ExtractionFormProps {
  extractionId: string
  initialData: ExtractionResult
  onSave?: (data: ExtractionResult) => Promise<void>
}

const fieldLabels: Record<string, Record<string, { label: string; type?: 'text' | 'date' | 'tel' | 'email' | 'number' }>> = {
  personal: {
    firstName: { label: 'First Name' },
    lastName: { label: 'Last Name' },
    dateOfBirth: { label: 'Date of Birth', type: 'date' },
    ssn: { label: 'Social Security Number' },
    address: { label: 'Street Address' },
    city: { label: 'City' },
    state: { label: 'State' },
    zipCode: { label: 'ZIP Code' },
    phone: { label: 'Phone', type: 'tel' },
    email: { label: 'Email', type: 'email' },
  },
  employment: {
    employer: { label: 'Employer' },
    occupation: { label: 'Occupation' },
    income: { label: 'Annual Income', type: 'number' },
    yearsEmployed: { label: 'Years Employed', type: 'number' },
  },
  coverage: {
    types: { label: 'Coverage Types' },
    amounts: { label: 'Coverage Amounts' },
  },
  beneficiary: {
    primaryName: { label: 'Primary Beneficiary' },
    primaryRelationship: { label: 'Relationship' },
    contingentName: { label: 'Contingent Beneficiary' },
    contingentRelationship: { label: 'Relationship' },
  },
  health: {
    conditions: { label: 'Medical Conditions' },
    medications: { label: 'Medications' },
    tobaccoUse: { label: 'Tobacco Use' },
  },
  policies: {
    existingPolicies: { label: 'Existing Policies' },
    replacementIntent: { label: 'Replacement Intent' },
  },
  financials: {
    assets: { label: 'Total Assets', type: 'number' },
    liabilities: { label: 'Total Liabilities', type: 'number' },
    netWorth: { label: 'Net Worth', type: 'number' },
  },
}

const categoryLabels: Record<string, { title: string; description: string }> = {
  personal: { title: 'Personal Information', description: 'Basic contact and identification details' },
  employment: { title: 'Employment', description: 'Work and income information' },
  coverage: { title: 'Coverage', description: 'Requested insurance coverage' },
  beneficiary: { title: 'Beneficiaries', description: 'Beneficiary designations' },
  health: { title: 'Health', description: 'Medical history and conditions' },
  policies: { title: 'Existing Policies', description: 'Current insurance information' },
  financials: { title: 'Financials', description: 'Assets and liabilities' },
}

export function ExtractionForm({ extractionId: _extractionId, initialData, onSave }: ExtractionFormProps) {
  const [data, setData] = useState<ExtractionResult>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleFieldChange = useCallback((
    category: keyof ExtractionResult,
    field: string,
    value: string
  ) => {
    setData(prev => {
      const categoryData = prev[category] as Record<string, ExtractionField>
      const existingField = categoryData[field]
      return {
        ...prev,
        [category]: {
          ...categoryData,
          [field]: {
            ...existingField,
            value,
            // Mark as edited with high confidence
            confidence: 'high' as const,
            flagged: false,
          },
        },
      }
    })
    setHasChanges(true)
  }, [])

  const handleSave = async () => {
    if (!onSave) return

    setIsSaving(true)
    try {
      await onSave(data)
      setHasChanges(false)
      toast.success('Changes saved successfully')
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const categories = Object.keys(categoryLabels) as (keyof ExtractionResult)[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Extracted Data</h2>
          <p className="text-sm text-muted-foreground">
            Review and edit the extracted information
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} className="text-xs">
              {categoryLabels[cat].title.split(' ')[0]}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map(category => (
          <TabsContent key={category} value={category}>
            <Card>
              <CardHeader>
                <CardTitle>{categoryLabels[category].title}</CardTitle>
                <CardDescription>{categoryLabels[category].description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {Object.entries(fieldLabels[category]).map(([fieldKey, config]) => {
                  const categoryData = data[category] as Record<string, ExtractionField>
                  return (
                    <FieldEditor
                      key={fieldKey}
                      field={categoryData[fieldKey]}
                      label={config.label}
                      fieldKey={`${category}-${fieldKey}`}
                      type={config.type}
                      onChange={(value) => handleFieldChange(category, fieldKey, value)}
                    />
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
