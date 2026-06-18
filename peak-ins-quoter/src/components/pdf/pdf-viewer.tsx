'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PdfViewerProps {
  storagePath: string
  supabaseUrl: string
  className?: string
}

export function PdfViewer({ storagePath, supabaseUrl, className }: PdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages] = useState(1)
  const [scale, setScale] = useState(1)
  const [, setIsLoading] = useState(true)

  // Construct the PDF URL - this would need auth token in production
  const pdfUrl = useMemo(() => {
    return `${supabaseUrl}/storage/v1/object/authenticated/fact-finders/${storagePath}`
  }, [storagePath, supabaseUrl])

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3))
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5))
  const handlePrevPage = () => setCurrentPage(p => Math.max(p - 1, 1))
  const handleNextPage = () => setCurrentPage(p => Math.min(p + 1, totalPages))

  // For now, we'll use an iframe to display the PDF
  // A more robust solution would use pdf.js for rendering
  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-16 text-center" aria-live="polite">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handlePrevPage} disabled={currentPage <= 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm w-20 text-center" aria-live="polite">
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNextPage} disabled={currentPage >= totalPages} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/50 p-4">
        {pdfUrl ? (
          <iframe
            src={`${pdfUrl}#page=${currentPage}&zoom=${scale * 100}`}
            className="w-full h-full min-h-[600px] border-0 bg-white"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
            onLoad={() => setIsLoading(false)}
            title="PDF document viewer"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading PDF...
          </div>
        )}
      </div>
    </Card>
  )
}
