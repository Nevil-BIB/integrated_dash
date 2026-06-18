'use client'

import { Button } from '@/components/ui/button'
import { FieldEditor } from './FieldEditor'
import {
  CHUBB_ATTACHED_STRUCTURE_FIELDS,
  CHUBB_CONSTRUCTION_TYPE_FIELDS,
  CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS,
  createEmptyChubbAttachedStructure,
  createEmptyChubbConstructionTypeEntry,
  type HomeChubbAttachedStructure,
  type HomeChubbConstructionTypeEntry,
  type HomeExtractionChubbHomeCoverageEstimator,
} from '@/types/home-extraction'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChubbHomeCoverageEstimatorEditorProps {
  data: HomeExtractionChubbHomeCoverageEstimator
  onChange: (data: HomeExtractionChubbHomeCoverageEstimator) => void
  className?: string
}

export function ChubbHomeCoverageEstimatorEditor({
  data,
  onChange,
  className,
}: ChubbHomeCoverageEstimatorEditorProps) {
  const showPercentRenovated = data.renovated?.value === 'Yes'
  const showPriorCarrierOther = data.priorCarrier?.value === 'Other'
  const showHurricaneOrWindHailDeductiblePercentage =
    data.hurricaneOrWindHailDeductibleType?.value === 'All Wind or Hail'

  const updateScalar = (
    field: keyof typeof CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS,
    value: string
  ) => {
    onChange({
      ...data,
      [field]: {
        ...data[field],
        value,
        confidence: 'high',
        flagged: false,
      },
    })
  }

  const updateCheckbox = (
    field: keyof typeof CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS,
    checked: boolean
  ) => {
    updateScalar(field, checked ? 'Yes' : '')
  }

  const updateAttachedStructure = (
    index: number,
    field: keyof HomeChubbAttachedStructure,
    value: string
  ) => {
    onChange({
      ...data,
      attachedStructures: data.attachedStructures.map((entry, i) =>
        i === index
          ? {
              ...entry,
              [field]: {
                ...entry[field],
                value,
                confidence: 'high' as const,
                flagged: false,
              },
            }
          : entry
      ),
    })
  }

  const updateConstructionType = (
    index: number,
    field: keyof HomeChubbConstructionTypeEntry,
    value: string
  ) => {
    onChange({
      ...data,
      constructionTypes: data.constructionTypes.map((entry, i) =>
        i === index
          ? {
              ...entry,
              [field]: {
                ...entry[field],
                value,
                confidence: 'high' as const,
                flagged: false,
              },
            }
          : entry
      ),
    })
  }

  const handleAddAttachedStructure = () => {
    onChange({
      ...data,
      attachedStructures: [...data.attachedStructures, createEmptyChubbAttachedStructure()],
    })
  }

  const handleRemoveAttachedStructure = (index: number) => {
    onChange({
      ...data,
      attachedStructures:
        data.attachedStructures.length <= 1
          ? [createEmptyChubbAttachedStructure()]
          : data.attachedStructures.filter((_, i) => i !== index),
    })
  }

  const handleAddConstructionType = () => {
    onChange({
      ...data,
      constructionTypes: [...data.constructionTypes, createEmptyChubbConstructionTypeEntry()],
    })
  }

  const handleRemoveConstructionType = (index: number) => {
    onChange({
      ...data,
      constructionTypes:
        data.constructionTypes.length <= 1
          ? [createEmptyChubbConstructionTypeEntry()]
          : data.constructionTypes.filter((_, i) => i !== index),
    })
  }

  return (
    <div className={cn('space-y-8', className)}>
      <p className="text-sm text-muted-foreground">
        Providing the following details will give an appropriate estimate of what the home is
        worth.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <FieldEditor
          field={data.buildingType}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.buildingType.label}
          fieldKey="chubb-buildingType"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.buildingType.options}
          onChange={(value) => updateScalar('buildingType', value)}
        />
        <FieldEditor
          field={data.livingAreaSqFt}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.livingAreaSqFt.label}
          fieldKey="chubb-livingAreaSqFt"
          type="number"
          placeholder={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.livingAreaSqFt.placeholder}
          onChange={(value) => updateScalar('livingAreaSqFt', value)}
        />
        <FieldEditor
          field={data.yearBuilt}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.yearBuilt.label}
          fieldKey="chubb-yearBuilt"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.yearBuilt.options}
          onChange={(value) => updateScalar('yearBuilt', value)}
        />
        <FieldEditor
          field={data.classification}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.classification.label}
          fieldKey="chubb-classification"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.classification.options}
          onChange={(value) => updateScalar('classification', value)}
        />
        <FieldEditor
          field={data.renovated}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.renovated.label}
          fieldKey="chubb-renovated"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.renovated.options}
          onChange={(value) => updateScalar('renovated', value)}
        />
        {showPercentRenovated ? (
          <FieldEditor
            field={data.percentRenovated}
            label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.percentRenovated.label}
            fieldKey="chubb-percentRenovated"
            type="text"
            placeholder={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.percentRenovated.placeholder}
            onChange={(value) => updateScalar('percentRenovated', value)}
          />
        ) : null}
        <FieldEditor
          field={data.residenceDeductible}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.residenceDeductible.label}
          fieldKey="chubb-residenceDeductible"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.residenceDeductible.options}
          onChange={(value) => updateScalar('residenceDeductible', value)}
        />
        <FieldEditor
          field={data.contentsAmount}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.contentsAmount.label}
          fieldKey="chubb-contentsAmount"
          type="text"
          placeholder={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.contentsAmount.placeholder}
          onChange={(value) => updateScalar('contentsAmount', value)}
        />
        <FieldEditor
          field={data.contentsPercentage}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.contentsPercentage.label}
          fieldKey="chubb-contentsPercentage"
          type="text"
          placeholder={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.contentsPercentage.placeholder}
          onChange={(value) => updateScalar('contentsPercentage', value)}
        />
        <FieldEditor
          field={data.typeOfContents}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.typeOfContents.label}
          fieldKey="chubb-typeOfContents"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.typeOfContents.options}
          onChange={(value) => updateScalar('typeOfContents', value)}
        />
        <FieldEditor
          field={data.otherPermanentStructuresAmount}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.otherPermanentStructuresAmount.label}
          fieldKey="chubb-otherPermanentStructuresAmount"
          type="text"
          placeholder={
            CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.otherPermanentStructuresAmount.placeholder
          }
          onChange={(value) => updateScalar('otherPermanentStructuresAmount', value)}
        />
        <FieldEditor
          field={data.otherPermanentStructuresPercentage}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.otherPermanentStructuresPercentage.label}
          fieldKey="chubb-otherPermanentStructuresPercentage"
          type="text"
          placeholder={
            CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.otherPermanentStructuresPercentage
              .placeholder
          }
          onChange={(value) => updateScalar('otherPermanentStructuresPercentage', value)}
        />
        <FieldEditor
          field={data.deductibleWaiverOption}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.deductibleWaiverOption.label}
          fieldKey="chubb-deductibleWaiverOption"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.deductibleWaiverOption.options}
          onChange={(value) => updateScalar('deductibleWaiverOption', value)}
        />
        <FieldEditor
          field={data.numberOfMortgages}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.numberOfMortgages.label}
          fieldKey="chubb-numberOfMortgages"
          type="number"
          placeholder={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.numberOfMortgages.placeholder}
          onChange={(value) => updateScalar('numberOfMortgages', value)}
        />
        <FieldEditor
          field={data.usage}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.usage.label}
          fieldKey="chubb-usage"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.usage.options}
          onChange={(value) => updateScalar('usage', value)}
        />
        <FieldEditor
          field={data.priorCarrier}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.priorCarrier.label}
          fieldKey="chubb-priorCarrier"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.priorCarrier.options}
          onChange={(value) => updateScalar('priorCarrier', value)}
        />
        {showPriorCarrierOther ? (
          <FieldEditor
            field={data.priorCarrierOther}
            label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.priorCarrierOther.label}
            fieldKey="chubb-priorCarrierOther"
            type="text"
            placeholder={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.priorCarrierOther.placeholder}
            onChange={(value) => updateScalar('priorCarrierOther', value)}
          />
        ) : null}
        <FieldEditor
          field={data.roofCoveringType}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.roofCoveringType.label}
          fieldKey="chubb-roofCoveringType"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.roofCoveringType.options}
          onChange={(value) => updateScalar('roofCoveringType', value)}
        />
        <FieldEditor
          field={data.windProtection}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.windProtection.label}
          fieldKey="chubb-windProtection"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.windProtection.options}
          onChange={(value) => updateScalar('windProtection', value)}
        />
        <FieldEditor
          field={data.hurricaneOrWindHailDeductibleType}
          label={
            CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.hurricaneOrWindHailDeductibleType.label
          }
          fieldKey="chubb-hurricaneOrWindHailDeductibleType"
          type="select"
          options={
            CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.hurricaneOrWindHailDeductibleType.options
          }
          onChange={(value) => updateScalar('hurricaneOrWindHailDeductibleType', value)}
        />
        {showHurricaneOrWindHailDeductiblePercentage ? (
          <FieldEditor
            field={data.hurricaneOrWindHailDeductiblePercentage}
            label={
              CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.hurricaneOrWindHailDeductiblePercentage
                .label
            }
            fieldKey="chubb-hurricaneOrWindHailDeductiblePercentage"
            type="select"
            options={
              CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.hurricaneOrWindHailDeductiblePercentage
                .options
            }
            onChange={(value) => updateScalar('hurricaneOrWindHailDeductiblePercentage', value)}
          />
        ) : null}
        <FieldEditor
          field={data.waterLeakProtection}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.waterLeakProtection.label}
          fieldKey="chubb-waterLeakProtection"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.waterLeakProtection.options}
          onChange={(value) => updateScalar('waterLeakProtection', value)}
        />
        <FieldEditor
          field={data.distanceFromFireStation}
          label={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.distanceFromFireStation.label}
          fieldKey="chubb-distanceFromFireStation"
          type="select"
          options={CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.distanceFromFireStation.options}
          onChange={(value) => updateScalar('distanceFromFireStation', value)}
        />
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Security</h4>
            {(
              [
                ['securityGatedCommunity', 'Gated Community'],
                ['security24HourGuardMonitoring', '24 Hour Guard / Security Monitoring'],
                ['securityGatedHouse', 'Gated House'],
                ['securityFullTimeCaretaker', 'Full-time Caretaker'],
              ] as const
            ).map(([fieldKey, label]) => (
              <label key={fieldKey} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={data[fieldKey]?.value === 'Yes'}
                  onChange={(event) => updateCheckbox(fieldKey, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Detectors / Monitors / Protectors</h4>
            {(
              [
                ['detectorGasLeakage', 'Gas Leakage Detector'],
                ['detectorLightningProtection', 'Lightning Protection'],
                ['detectorBackupGenerator', 'Back-up Generator'],
                ['detectorSeismicShutOffValve', 'Seismic Shut Off Valve'],
              ] as const
            ).map(([fieldKey, label]) => (
              <label key={fieldKey} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={data[fieldKey]?.value === 'Yes'}
                  onChange={(event) => updateCheckbox(fieldKey, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Sprinklers</h4>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={data.sprinklerResidentialSystem?.value === 'Yes'}
                onChange={(event) =>
                  updateCheckbox('sprinklerResidentialSystem', event.target.checked)
                }
              />
              <span>Residential Sprinkler System</span>
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Centrally Monitored Alarms</h4>
          <div className="grid gap-2 sm:grid-cols-2 md:max-w-sm">
            {(
              [
                ['alarmBurglar', 'Burglar'],
                ['alarmFire', 'Fire'],
              ] as const
            ).map(([fieldKey, label]) => (
              <label key={fieldKey} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={data[fieldKey]?.value === 'Yes'}
                  onChange={(event) => updateCheckbox(fieldKey, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h4 className="text-sm font-semibold">Attached Structures</h4>
        {data.attachedStructures.map((entry, index) => (
          <div key={`attached-${index}`} className="grid gap-4 sm:grid-cols-[1fr_140px_auto] items-end">
            <FieldEditor
              field={entry.attachedStructureType}
              label={CHUBB_ATTACHED_STRUCTURE_FIELDS.attachedStructureType.label}
              fieldKey={`chubb-attachedStructureType-${index}`}
              type="select"
              options={CHUBB_ATTACHED_STRUCTURE_FIELDS.attachedStructureType.options}
              onChange={(value) => updateAttachedStructure(index, 'attachedStructureType', value)}
            />
            <FieldEditor
              field={entry.squareFeet}
              label={CHUBB_ATTACHED_STRUCTURE_FIELDS.squareFeet.label}
              fieldKey={`chubb-attachedSquareFeet-${index}`}
              type="number"
              placeholder={CHUBB_ATTACHED_STRUCTURE_FIELDS.squareFeet.placeholder}
              onChange={(value) => updateAttachedStructure(index, 'squareFeet', value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => handleRemoveAttachedStructure(index)}
              aria-label="Remove attached structure"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="link" className="h-auto p-0" onClick={handleAddAttachedStructure}>
          <Plus className="mr-1 h-4 w-4" />
          Add attached structures
        </Button>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div>
          <h4 className="text-sm font-semibold">Construction Type</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            All percentages must add up to equal one hundred percent.
          </p>
        </div>

        {data.constructionTypes.map((entry, index) => (
          <div key={`construction-${index}`} className="grid gap-4 sm:grid-cols-[1fr_140px_auto] items-end">
            <FieldEditor
              field={entry.constructionType}
              label={CHUBB_CONSTRUCTION_TYPE_FIELDS.constructionType.label}
              fieldKey={`chubb-constructionType-${index}`}
              type="select"
              options={CHUBB_CONSTRUCTION_TYPE_FIELDS.constructionType.options}
              onChange={(value) => updateConstructionType(index, 'constructionType', value)}
            />
            <FieldEditor
              field={entry.percentage}
              label={CHUBB_CONSTRUCTION_TYPE_FIELDS.percentage.label}
              fieldKey={`chubb-constructionPercentage-${index}`}
              type="text"
              placeholder={CHUBB_CONSTRUCTION_TYPE_FIELDS.percentage.placeholder}
              onChange={(value) => updateConstructionType(index, 'percentage', value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => handleRemoveConstructionType(index)}
              aria-label="Remove construction type"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="link" className="h-auto p-0" onClick={handleAddConstructionType}>
          <Plus className="mr-1 h-4 w-4" />
          Add construction types
        </Button>
      </div>
    </div>
  )
}
