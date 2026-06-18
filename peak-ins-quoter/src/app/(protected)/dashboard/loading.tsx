import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function ExtractionCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-muted" />
      <CardContent className="p-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <Skeleton className="h-9 w-full mt-4 rounded-md" />
      </CardContent>
    </Card>
  )
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header Section */}
      <div className="border-b bg-background">
        <div className="container max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-32 sm:h-9 sm:w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-11 w-full sm:w-44" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Stats skeleton */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </CardHeader>
                <CardContent className="pt-0">
                  <Skeleton className="h-9 w-14" />
                  <Skeleton className="h-3 w-20 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Section header skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>

          {/* Cards grid skeleton */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <ExtractionCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
