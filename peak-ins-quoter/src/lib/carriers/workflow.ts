import type { CarrierOptionId, ExtractionWorkflowMeta } from './types'
import { getCarrierSchema } from './load-schema'
import { getCarrierOption } from './types'

export function createWorkflowMeta(
  carrierOptionId: CarrierOptionId,
  carrierOptionIds?: CarrierOptionId[],
): ExtractionWorkflowMeta {
  const option = getCarrierOption(carrierOptionId)
  const schema = getCarrierSchema(carrierOptionId)
  const allIds = carrierOptionIds?.length ? carrierOptionIds : [carrierOptionId]
  return {
    carrierOptionId: option.id,
    carrierOptionIds: allIds,
    carrierId: option.carrierId,
    productType: option.productType,
    schemaVersion: schema.version,
  }
}

export function readWorkflowMeta(
  data: unknown,
): ExtractionWorkflowMeta | null {
  if (!data || typeof data !== 'object') return null
  const workflow = (data as { workflow?: ExtractionWorkflowMeta }).workflow
  if (!workflow?.carrierOptionId) return null
  return workflow
}

export function withWorkflowMeta<T extends Record<string, unknown>>(
  data: T,
  carrierOptionId: CarrierOptionId,
  carrierOptionIds?: CarrierOptionId[],
): T & { workflow: ExtractionWorkflowMeta } {
  return {
    ...data,
    workflow: createWorkflowMeta(carrierOptionId, carrierOptionIds),
  }
}
