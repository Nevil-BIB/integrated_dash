'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldEditor } from './FieldEditor'
import {
  HomeExtractionClaim,
  HOME_CLAIM_FIELDS,
  createEmptyClaim,
} from '@/types/home-extraction'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClaimsEditorProps {
  claims: HomeExtractionClaim[]
  onChange: (claims: HomeExtractionClaim[]) => void
  className?: string
}

export function ClaimsEditor({ claims, onChange, className }: ClaimsEditorProps) {
  const [localClaims, setLocalClaims] = useState<HomeExtractionClaim[]>(claims)

  const handleAddClaim = () => {
    const newClaims = [...localClaims, createEmptyClaim()]
    setLocalClaims(newClaims)
    onChange(newClaims)
  }

  const handleRemoveClaim = (index: number) => {
    const newClaims = localClaims.filter((_, i) => i !== index)
    setLocalClaims(newClaims)
    onChange(newClaims)
  }

  const handleFieldChange = (
    claimIndex: number,
    fieldKey: keyof HomeExtractionClaim,
    value: string
  ) => {
    const newClaims = localClaims.map((claim, i) => {
      if (i !== claimIndex) return claim

      return {
        ...claim,
        [fieldKey]: {
          ...claim[fieldKey],
          value,
          confidence: 'high' as const,
          flagged: false,
        },
      }
    })

    setLocalClaims(newClaims)
    onChange(newClaims)
  }

  const claimFieldEntries = Object.entries(HOME_CLAIM_FIELDS) as [
    keyof HomeExtractionClaim,
    typeof HOME_CLAIM_FIELDS[keyof typeof HOME_CLAIM_FIELDS]
  ][]

  return (
    <div className={cn('space-y-4', className)}>
      {localClaims.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg bg-muted/30">
          <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">
            No claims recorded in the last 5 years
          </p>
          <Button onClick={handleAddClaim} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Claim
          </Button>
        </div>
      ) : (
        <>
          {localClaims.map((claim, claimIndex) => (
            <Card key={claimIndex} className="relative">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">
                    Claim #{claimIndex + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveClaim(claimIndex)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {claimFieldEntries.map(([fieldKey, config]) => (
                    <FieldEditor
                      key={`claim-${claimIndex}-${fieldKey}`}
                      field={claim[fieldKey]}
                      label={config.label}
                      fieldKey={`claim-${claimIndex}-${fieldKey}`}
                      type={config.inputType}
                      required={config.required}
                      options={config.options}
                      placeholder={config.placeholder}
                      onChange={(value) =>
                        handleFieldChange(claimIndex, fieldKey, value)
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <Button onClick={handleAddClaim} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Another Claim
          </Button>
        </>
      )}
    </div>
  )
}
