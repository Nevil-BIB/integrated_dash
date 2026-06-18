import { getCarrierSchema } from './load-schema'
import type { ExtractionWorkflowMeta } from './types'

/** Relative Playwright automation API paths (appended to NEXT_PUBLIC_NODE_BACKEND_URL). */
export const PLAYWRIGHT_AUTOMATION_ROUTES = {
  autoOwners: {
    key: 'autoOwners',
    label: 'Auto Owners',
    submitPath: '/api/generate-quote/playwright',
    statusPath: '/api/generate-quote/playwright/:jobId',
  },
  travelers: {
    key: 'travelers',
    label: 'Travelers',
    submitPath: '/api/generate-quote/playwright/travelers',
    statusPath: '/api/generate-quote/playwright/travelers/:jobId',
  },
  chubb: {
    key: 'chubb',
    label: 'Chubb',
    submitPath: '/api/generate-quote/playwright/chubb',
    statusPath: '/api/generate-quote/playwright/chubb/:jobId',
  },
  nationalGeneral: {
    key: 'nationalGeneral',
    label: 'National General',
    submitPath: '/api/generate-quote/playwright/national-general',
    statusPath: '/api/generate-quote/playwright/national-general/:jobId',
  },
  safeco: {
    key: 'safeco',
    label: 'Safeco',
    submitPath: '/api/generate-quote/playwright/safeco',
    statusPath: '/api/generate-quote/playwright/safeco/:jobId',
  },
} as const

export type PlaywrightAutomationRouteKey = keyof typeof PLAYWRIGHT_AUTOMATION_ROUTES

export interface PlaywrightApiPaths {
  routeKey: PlaywrightAutomationRouteKey
  submitPath: string
  statusPath: string
}

function routeFromAutomationSegment(
  segment: string,
): PlaywrightAutomationRouteKey | null {
  if (segment in PLAYWRIGHT_AUTOMATION_ROUTES) {
    return segment as PlaywrightAutomationRouteKey
  }
  return null
}

/**
 * Resolve which Playwright backend route to use from stored extraction workflow.
 * Falls back to Auto Owners when no carrier workflow is present.
 */
export function resolvePlaywrightAutomationRoute(
  workflow: ExtractionWorkflowMeta | null | undefined,
): PlaywrightAutomationRouteKey {
  if (!workflow?.carrierOptionId) {
    return 'autoOwners'
  }

  try {
    const schema = getCarrierSchema(workflow.carrierOptionId)
    const fromSchema = routeFromAutomationSegment(schema.automation.route)
    if (fromSchema) return fromSchema
  } catch {
    // Unknown carrier option — try carrierId below
  }

  const fromCarrierId = routeFromAutomationSegment(workflow.carrierId)
  if (fromCarrierId) return fromCarrierId

  return 'autoOwners'
}

export function getPlaywrightApiPaths(
  workflow: ExtractionWorkflowMeta | null | undefined,
): PlaywrightApiPaths {
  const routeKey = resolvePlaywrightAutomationRoute(workflow)
  const route = PLAYWRIGHT_AUTOMATION_ROUTES[routeKey]
  return {
    routeKey,
    submitPath: route.submitPath,
    statusPath: route.statusPath,
  }
}

function joinBaseUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '')
  return `${normalizedBase}${path}`
}

export function buildPlaywrightSubmitUrl(
  baseUrl: string,
  workflow: ExtractionWorkflowMeta | null | undefined,
): string {
  const { submitPath } = getPlaywrightApiPaths(workflow)
  return joinBaseUrl(baseUrl, submitPath)
}

export function buildPlaywrightStatusUrl(
  baseUrl: string,
  jobId: string,
  workflow: ExtractionWorkflowMeta | null | undefined,
): string {
  const { statusPath } = getPlaywrightApiPaths(workflow)
  return joinBaseUrl(baseUrl, statusPath.replace(':jobId', jobId))
}

/** Human-readable carrier label for automation status/error UI. */
export function getAutomationCarrierLabel(
  workflow: ExtractionWorkflowMeta | null | undefined,
): string {
  if (workflow?.carrierOptionId) {
    try {
      return getCarrierSchema(workflow.carrierOptionId).label
    } catch {
      // Fall through to route label
    }
  }

  const routeKey = resolvePlaywrightAutomationRoute(workflow)
  return PLAYWRIGHT_AUTOMATION_ROUTES[routeKey].label
}
