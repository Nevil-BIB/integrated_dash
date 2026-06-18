import type { ExtractionField } from '@/types'
import type { HomeExtractionResult } from '@/types/home-extraction'
import type { CarrierOptionId } from './types'
import { readWorkflowMeta } from './workflow'

export type CarrierFieldsByOption = Partial<
  Record<CarrierOptionId, Record<string, ExtractionField>>
>

export type CarrierAwareHomeData = HomeExtractionResult & {
  carrierFields?: Record<string, ExtractionField>
  carrierFieldsByOption?: CarrierFieldsByOption
}

export function isMultiCarrierWorkflow(data: unknown): boolean {
  const workflow = readWorkflowMeta(data)
  return (workflow?.carrierOptionIds?.length ?? 0) > 1
}

export function getCarrierFieldsMap(
  data: CarrierAwareHomeData,
  carrierOptionId: CarrierOptionId,
): Record<string, ExtractionField> | undefined {
  const fromOption = data.carrierFieldsByOption?.[carrierOptionId]
  if (fromOption) return fromOption

  const workflow = readWorkflowMeta(data)
  if (
    workflow?.carrierOptionId === carrierOptionId &&
    data.carrierFields &&
    Object.keys(data.carrierFields).length > 0
  ) {
    return data.carrierFields
  }

  return undefined
}

export function setCarrierFieldInMap(
  data: CarrierAwareHomeData,
  carrierOptionId: CarrierOptionId,
  schemaKey: string,
  field: ExtractionField,
): CarrierAwareHomeData {
  const existingMap = getCarrierFieldsMap(data, carrierOptionId) ?? {}
  const carrierFieldsByOption: CarrierFieldsByOption = {
    ...(data.carrierFieldsByOption ?? {}),
    [carrierOptionId]: {
      ...existingMap,
      [schemaKey]: field,
    },
  }

  const workflow = readWorkflowMeta(data)
  const next: CarrierAwareHomeData = {
    ...data,
    carrierFieldsByOption,
  }

  if (workflow?.carrierOptionId === carrierOptionId || !workflow?.carrierOptionIds?.length) {
    next.carrierFields = carrierFieldsByOption[carrierOptionId]
  }

  return next
}
