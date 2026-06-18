'use client'

import { useState, useCallback } from 'react'
import { getCarrierOption, type CarrierOptionId } from '@/lib/carriers'
import type { InsuranceType } from '@/types/extraction'

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

interface UploadState {
  status: UploadStatus
  progress: number
  error: string | null
  extractionId: string | null
}

export function useUpload() {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    extractionId: null,
  })

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      progress: 0,
      error: null,
      extractionId: null,
    })
  }, [])

  const upload = useCallback(async (
    file: File,
    carrierOptionIds: CarrierOptionId | CarrierOptionId[] = 'chubb-home',
  ) => {
    const ids = Array.isArray(carrierOptionIds) ? carrierOptionIds : [carrierOptionIds]
    const primaryCarrierOptionId = ids[0] ?? 'chubb-home'
    const carrierOption = getCarrierOption(primaryCarrierOptionId)
    const insuranceType = carrierOption.insuranceType as InsuranceType
    setState({ status: 'uploading', progress: 0, error: null, extractionId: null })

    try {
      // Validate file
      if (file.type !== 'application/pdf') {
        throw new Error('Please upload a PDF file')
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('File size must be less than 20MB')
      }

      setState(s => ({ ...s, progress: 10 }))

      // Upload file
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      setState(s => ({ ...s, progress: 50 }))

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const { extraction } = await response.json()

      setState(s => ({ ...s, progress: 70, status: 'processing' }))

      // Start extraction
      console.log(
        '[useUpload] Starting extraction for ID:',
        extraction.id,
        'Carrier:',
        primaryCarrierOptionId,
        'Type:',
        insuranceType,
        'All carriers:',
        ids.join(', '),
      )
      const extractResponse = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractionId: extraction.id,
          insuranceType,
          carrierOptionId: primaryCarrierOptionId,
          carrierOptionIds: ids,
        }),
      })

      setState(s => ({ ...s, progress: 90 }))

      if (!extractResponse.ok) {
        const data = await extractResponse.json()
        console.error('[useUpload] Extraction failed:', data)
        throw new Error(data.error || 'Extraction failed')
      }

      console.log('[useUpload] Extraction successful')

      setState({
        status: 'success',
        progress: 100,
        error: null,
        extractionId: extraction.id,
      })

      return extraction.id
    } catch (error) {
      setState({
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'An error occurred',
        extractionId: null,
      })
      throw error
    }
  }, [])

  return { ...state, upload, reset }
}
