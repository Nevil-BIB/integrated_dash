import { getAllSchemaFields, getCarrierSchema, getRequiredSchemaFields } from './load-schema'
import type { CarrierOptionId } from './types'
import type { CarrierSchemaField } from './schema-types'

function formatFieldSpec(field: CarrierSchemaField): string {
  const required = field.required ? ' [REQUIRED]' : ''
  const options =
    field.options && field.options.length > 0
      ? `\n    Allowed values: ${field.options.map((o) => JSON.stringify(o)).join(', ')}`
      : field.optionsSource === 'portal'
        ? '\n    Use the closest matching portal label if visible on the document'
        : ''
  const notes = field.notes ? `\n    Notes: ${field.notes}` : ''
  const format = field.format ? `\n    Format: ${field.format}` : ''

  if (field.type === 'array' && field.itemSchema) {
    const indexedExamples = Object.keys(field.itemSchema)
      .slice(0, 4)
      .map((key) => `"${field.key}[0].${key}"`)
      .join(', ')
    const itemKeys = Object.entries(field.itemSchema)
      .map(([key, config]) => {
        const itemOptions = config.options?.length
          ? ` - options: ${config.options.join(', ')}`
          : ''
        return `      "${key}": { ${config.type} field${itemOptions} }`
      })
      .join(',\n')

    return `  "${field.key}": [ array of objects, each with:\n${itemKeys}\n  ]${required}${notes}\n    Output array item values in \"fields\" using indexed keys such as: ${indexedExamples}`
  }

  const valueHint =
    field.type === 'checkbox'
      ? ' - use "Yes" or "No" as string value'
      : field.type === 'date'
        ? ' - prefer MM/DD/YYYY; ISO YYYY-MM-DD is acceptable'
        : ''

  return `  "${field.key}": { text/value field${valueHint} }${required}${format}${options}${notes}`
}

/**
 * Build a Claude Vision prompt scoped to a carrier product JSON schema.
 * AI must return only schema field keys and indexed array item keys.
 */
export function buildCarrierExtractionPrompt(carrierOptionId: CarrierOptionId): string {
  const schema = getCarrierSchema(carrierOptionId)
  const allFields = getAllSchemaFields(schema)
  const requiredFields = getRequiredSchemaFields(schema)
  const arrayFields = allFields.filter((field) => field.type === 'array' && !!field.itemSchema)

  const sectionBlocks = schema.sections
    .map((section) => {
      const fieldLines = section.fields.map(formatFieldSpec).join('\n')
      return `### ${section.title}\n${fieldLines}`
    })
    .join('\n\n')

  const requiredKeys = requiredFields.map((field) => `"${field.key}"`).join(', ')
  const hasArrayFields = arrayFields.length > 0
  const chubbArrayJsonBlock = schema.id === 'chubb-home'
    ? `,
  "attachedStructures": [
    { "attachedStructureType": { field object }, "squareFeet": { field object } }
  ],
  "constructionTypes": [
    { "constructionType": { field object }, "percentage": { field object } }
  ]`
    : ''

  const arrayFieldGuidance = hasArrayFields
    ? arrayFields
        .map((field) => {
          if (!field.itemSchema) {
            return `- ${field.key}: use indexed keys in \"fields\" (for example ${field.key}[0].value)`
          }
          const sampleKeys = Object.keys(field.itemSchema)
            .slice(0, 3)
            .map((key) => `"${field.key}[0].${key}"`)
            .join(', ')
          return `- ${field.key}: return item values using indexed keys in \"fields\" (for example ${sampleKeys})`
        })
        .join('\n')
    : ''

  const arrayNotes = hasArrayFields
    ? `
Array field rules:
${arrayFieldGuidance}
Do not put non-Chubb array payload under top-level keys; place indexed array item values under \"fields\".
For required arrays where no item is visible, include the primary indexed key(s) with { "value": null, "confidence": "low", "flagged": true }.`
    : ''

  return `You are analyzing scanned insurance fact finder document(s) for **${schema.label}** (${schema.description}).

Extract ONLY the fields listed below. These keys map directly to the ${schema.carrierId} quoting portal. Do not invent fields from generic insurance forms.

IMPORTANT: Return ONLY valid JSON with no markdown fences or commentary.

For each field object, use:
- "value": extracted string (or null if not found)
- "confidence": "high" | "medium" | "low"
- "flagged": true if illegible, ambiguous, missing when required, or uncertain
- "rawText": optional original text from the document

Required field keys (flag if missing): ${requiredKeys}

Return JSON in exactly this structure:
{
  "fields": {
    <use schema scalar keys and indexed array keys as properties>
  }${chubbArrayJsonBlock}
}
${arrayNotes}
Include every scalar schema key listed below under "fields". If a value is unknown, set "value": null and "flagged": true.
Do not output keys that are not in the schema or indexed children of schema array fields.
Do not nest keys under "personal" or "property" unless the key itself contains a dot (for example "personal.firstName").

${sectionBlocks}

Format rules:
${Object.entries(schema.formatRules)
  .map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
  .join('\n')}
`
}
