import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function UploadLoading() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header Section */}
      <div className="border-b bg-background">
        <div className="container max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-32 mb-2" />
              <Skeleton className="h-8 w-48 sm:h-9 sm:w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Upload Zone Skeleton */}
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6">
              <Skeleton className="h-16 w-16 rounded-xl mb-6" />
              <Skeleton className="h-6 w-64 mb-2" />
              <Skeleton className="h-4 w-48 mb-6" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>

          {/* Features / Help Section */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border-dashed">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20 mx-auto" />
                      <Skeleton className="h-3 w-32 mx-auto" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Help Text Skeleton */}
          <div className="text-center space-y-2 pt-4">
            <Skeleton className="h-4 w-full max-w-2xl mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
