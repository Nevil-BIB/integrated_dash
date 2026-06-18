import { PdfUploadZone } from '@/components/pdf/pdf-upload-zone'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Shield, Zap, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header Section */}
      <div className="border-b bg-background">
        <div className="container max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3 mb-2">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Upload Document
              </h1>
              <p className="text-muted-foreground">
                Upload a scanned fact finder PDF to extract prospect information automatically.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Upload Zone */}
          <PdfUploadZone />

          {/* Features / Help Section */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">PDF Format</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scanned documents up to 20MB
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">AI Extraction</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Personal, employment, and coverage data
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Secure Processing</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your data is encrypted and protected
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Help Text */}
          <div className="text-center text-sm text-muted-foreground space-y-1 pt-4">
            <p>
              The AI will extract personal, employment, coverage, beneficiary, health, and financial information from your fact finder documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
