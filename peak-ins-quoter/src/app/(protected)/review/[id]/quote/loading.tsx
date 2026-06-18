import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function FieldSectionSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg border space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function QuoteLoading() {
  return (
    <div className="flex flex-col h-full min-h-0 bg-muted/30">
      {/* Header Skeleton */}
      <div className="border-b bg-background shrink-0">
        <div className="px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <Skeleton className="h-10 w-10 rounded-md shrink-0" />
              <div className="flex items-center gap-3 min-w-0">
                <Skeleton className="hidden sm:block h-10 w-10 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </div>
            <Skeleton className="h-6 w-32 rounded-full shrink-0" />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 min-h-0 overflow-auto pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Page Header Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>

          {/* Validation Summary Skeleton */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </CardContent>
          </Card>

          {/* Field Sections Skeleton */}
          <div className="space-y-4">
            <FieldSectionSkeleton />
            <FieldSectionSkeleton />
            <FieldSectionSkeleton />
          </div>
        </div>
      </div>

      {/* Sticky Action Bar Skeleton */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-lg z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="hidden sm:block h-8 w-36 rounded-full" />
            <div className="flex items-center gap-3 ml-auto">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
