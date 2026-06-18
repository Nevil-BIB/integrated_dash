'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUpload } from '@/hooks/use-upload'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  CloudUpload,
  Shield,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { CARRIER_OPTIONS, getCarrierOption, type CarrierOptionId } from '@/lib/carriers'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function PdfUploadZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedCarrierIds, setSelectedCarrierIds] = useState<CarrierOptionId[]>([])
  const [carrierSelectKey, setCarrierSelectKey] = useState(0)
  const { status, progress, error, extractionId, upload, reset } = useUpload()
  const router = useRouter()

  const addCarrier = useCallback((id: CarrierOptionId) => {
    setSelectedCarrierIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setCarrierSelectKey((k) => k + 1)
  }, [])

  const removeCarrier = useCallback((id: CarrierOptionId) => {
    setSelectedCarrierIds((prev) => prev.filter((item) => item !== id))
  }, [])

  const clearCarriers = useCallback(() => {
    setSelectedCarrierIds([])
    setCarrierSelectKey((k) => k + 1)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
    } else {
      toast.error('Please upload a PDF file')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) return

    if (selectedCarrierIds.length === 0) {
      toast.error('No carrier selected')
      return
    }

    try {
      const id = await upload(selectedFile, selectedCarrierIds)
      toast.success('Extraction complete!')
      router.push(`/review/${id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    }
  }

  const handleReset = () => {
    reset()
    setSelectedFile(null)
    clearCarriers()
  }

  if (status === 'success' && extractionId) {
    return (
      <Card className="border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
        <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-6">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Extraction Complete</h3>
          <p className="text-muted-foreground mb-8 max-w-sm">
            Your document has been processed successfully. Review the extracted data before generating quotes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={() => router.push(`/review/${extractionId}`)}>
              Review Results
            </Button>
            <Button size="lg" variant="outline" onClick={handleReset}>
              Upload Another
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card className="border-2 border-destructive bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Upload Failed</h3>
          <p className="text-muted-foreground mb-8 max-w-sm">{error}</p>
          <Button size="lg" onClick={handleReset}>Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  if (status === 'uploading' || status === 'processing') {
    return (
      <Card className="border-2">
        <CardContent className="flex flex-col items-center justify-center py-16 px-8">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            {status === 'uploading' ? 'Uploading Document' : 'Extracting Data'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm text-center">
            {status === 'uploading'
              ? 'Securely uploading your document to our servers'
              : 'AI is analyzing and extracting prospect information'}
          </p>
          <div className="w-full max-w-sm space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">{progress}% complete</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (selectedFile) {
    return (
      <Card className="overflow-hidden border shadow-sm">
        <div className="border-b bg-muted/40 px-6 py-4">
          <h3 className="text-base font-semibold tracking-tight">Prepare Quote Request</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Confirm your document and carrier before extraction begins.
          </p>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Step 1 — Document */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                1
              </span>
              Document
            </div>
            <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  PDF · {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={() => {
                  setSelectedFile(null)
                  clearCarriers()
                }}
              >
                Change
              </Button>
            </div>
          </section>

          {/* Step 2 — Carrier */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                2
              </span>
              Carrier &amp; Product
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="carrier-option" className="text-sm font-medium">
                  Quote destination
                </Label>
                <Select
                  key={carrierSelectKey}
                  onValueChange={(value) => addCarrier(value as CarrierOptionId)}
                >
                  <SelectTrigger id="carrier-option" className="h-11 w-full bg-background">
                    <div className="flex items-center gap-2.5">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select carrier and product" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIER_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.id}
                        value={option.id}
                        disabled={!option.enabled || selectedCarrierIds.includes(option.id)}
                        textValue={option.label}
                      >
                        <span className="font-medium">{option.label}</span>
                        <span className="sr-only">{option.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCarrierIds.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Selected ({selectedCarrierIds.length})
                  </p>
                  <ul className="space-y-2">
                    {selectedCarrierIds.map((id) => {
                      const option = getCarrierOption(id)
                      return (
                        <li
                          key={id}
                          className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{option.label}</p>
                            <p className="text-sm text-muted-foreground">{option.description}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => removeCarrier(id)}
                            aria-label={`Remove ${option.label}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choose one or more carriers from the dropdown above.
                </p>
              )}
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              AI extracts fields matched to each selected carrier&apos;s schema
            </p>
            <Button size="lg" onClick={handleUpload} className="gap-2 sm:min-w-[200px]">
              Upload &amp; Extract
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'border-2 border-dashed transition-all duration-200 cursor-pointer',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'hover:border-primary/50 hover:bg-muted/50'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center py-16 px-8">
        <>
          <div className={cn(
              "h-20 w-20 rounded-2xl flex items-center justify-center mb-6 transition-colors",
              isDragging
                ? "bg-primary/20"
                : "bg-muted"
            )}>
              <CloudUpload className={cn(
                "h-10 w-10 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {isDragging ? 'Drop your file here' : 'Drag and drop your PDF'}
            </h3>
            <p id="file-upload-description" className="text-muted-foreground mb-8 text-center max-w-sm">
              or click the button below to browse your files. We accept PDF documents up to 20MB.
              You can also drag and drop a file onto this area.
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={handleFileSelect}
                aria-describedby="file-upload-description"
              />
              <Button asChild size="lg" className="gap-2">
                <span>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Select PDF File
                </span>
              </Button>
            </label>
        </>
      </CardContent>
    </Card>
  )
}
