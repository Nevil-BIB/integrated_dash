import type { CarrierSchemaField } from './schema-types'
import {
  CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS,
  HOME_HOMEOWNERS_INFORMATIONS_FIELDS,
  HOME_LOCATION_DETAIL_FIELDS,
  HOME_PERSONAL_FIELDS,
  HOME_PROPERTY_FIELDS,
} from '@/types/home-extraction'

/** Portal dropdown options aligned with legacy Chubb / Homeowners Informations UI */
const PORTAL_OPTIONS_BY_SCHEMA_KEY: Record<string, readonly string[]> = {
  'homeownersInformations.buildingConstructionType':
    HOME_HOMEOWNERS_INFORMATIONS_FIELDS.buildingConstructionType.options ?? [],
  'homeownersInformations.sidingType':
    HOME_HOMEOWNERS_INFORMATIONS_FIELDS.sidingType.options ?? [],
  'homeownersInformations.primaryFoundationType':
    HOME_HOMEOWNERS_INFORMATIONS_FIELDS.primaryFoundationType.options ?? [],
  'homeownersInformations.garageType':
    HOME_HOMEOWNERS_INFORMATIONS_FIELDS.garageType.options ?? [],
  'homeownersInformations.roofShape':
    HOME_HOMEOWNERS_INFORMATIONS_FIELDS.roofShape.options ?? [],
  'property.fireplaceCount': HOME_PROPERTY_FIELDS.fireplaceCount.options ?? [],
  'locationDetail.locationOccupancy':
    HOME_LOCATION_DETAIL_FIELDS.locationOccupancy.options ?? [],
  'chubbHomeCoverageEstimator.priorCarrier':
    CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.priorCarrier.options ?? [],
}

function optionsFromConfig(
  options: readonly string[] | undefined,
): string[] | undefined {
  if (!options?.length) return undefined
  return [...options]
}

/**
 * Resolve select options for carrier schema fields.
 * Fields with `optionsSource: "portal"` use legacy Home/Chubb UI option lists.
 */
export function resolveCarrierFieldOptions(
  field: CarrierSchemaField,
): string[] | undefined {
  if (field.options?.length) {
    return [...field.options]
  }

  const mapped = PORTAL_OPTIONS_BY_SCHEMA_KEY[field.key]
  if (mapped?.length) {
    return [...mapped]
  }

  if (field.optionsSource !== 'portal' && field.type !== 'dropdown') {
    return undefined
  }

  const leafKey = field.key.includes('.') ? field.key.split('.').pop()! : field.key

  switch (leafKey) {
    case 'buildingConstructionType':
      return optionsFromConfig(
        HOME_HOMEOWNERS_INFORMATIONS_FIELDS.buildingConstructionType.options,
      )
    case 'sidingType':
      return optionsFromConfig(HOME_HOMEOWNERS_INFORMATIONS_FIELDS.sidingType.options)
    case 'primaryFoundationType':
      return optionsFromConfig(
        HOME_HOMEOWNERS_INFORMATIONS_FIELDS.primaryFoundationType.options,
      )
    case 'garageType':
      return optionsFromConfig(HOME_HOMEOWNERS_INFORMATIONS_FIELDS.garageType.options)
    case 'roofShape':
      return optionsFromConfig(HOME_HOMEOWNERS_INFORMATIONS_FIELDS.roofShape.options)
    case 'fireplaceCount':
      return optionsFromConfig(HOME_PROPERTY_FIELDS.fireplaceCount.options)
    case 'locationOccupancy':
      return optionsFromConfig(HOME_LOCATION_DETAIL_FIELDS.locationOccupancy.options)
    case 'priorCarrier':
      return optionsFromConfig(
        CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS.priorCarrier.options,
      )
    case 'roofMaterial':
      return optionsFromConfig(HOME_PROPERTY_FIELDS.roofConstruction.options)
    case 'heatingType':
      return optionsFromConfig(HOME_PROPERTY_FIELDS.heatType.options)
    case 'numberOfStories':
      return optionsFromConfig(HOME_PROPERTY_FIELDS.numberOfStories.options)
    case 'agentProducerName':
      return optionsFromConfig([
        ...(HOME_PERSONAL_FIELDS.agentProducerName.options ?? []),
        'NOT LISTED',
      ])
    default:
      return undefined
  }
}

export function carrierFieldUsesSelect(field: CarrierSchemaField): boolean {
  if (field.type !== 'dropdown') return false
  return (resolveCarrierFieldOptions(field)?.length ?? 0) > 0
}
