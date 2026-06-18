import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function FormSectionSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ReviewLoading() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header Skeleton */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Left: Back button and file info */}
            <div className="flex items-center gap-4 min-w-0">
              <Skeleton className="h-10 w-10 rounded-md shrink-0" />
              <div className="flex items-center gap-3 min-w-0">
                <Skeleton className="hidden sm:block h-10 w-10 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>

            {/* Right: Status */}
            <Skeleton className="h-7 w-24 rounded-full shrink-0" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 lg:px-8 py-8 lg:py-10">
        <div className="space-y-8">
          {/* Quote Type Selector Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-card border rounded-xl shadow-sm">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-md" />
              <Skeleton className="h-10 w-24 rounded-md" />
              <Skeleton className="h-10 w-24 rounded-md" />
            </div>
          </div>

          {/* Form Sections Skeleton */}
          <div className="space-y-6">
            <FormSectionSkeleton />
            <FormSectionSkeleton />
            <FormSectionSkeleton />
          </div>
        </div>
      </main>
    </div>
  )
}
