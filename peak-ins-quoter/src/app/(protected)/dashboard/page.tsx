import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  Upload,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  MoreVertical,
  Eye,
  Home,
  Car,
  FolderOpen,
  Plus,
  TrendingUp,
  Calendar,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { DeleteExtractionButton } from '@/components/dashboard/delete-extraction-button'
import type { InsuranceType, ExtractionStatus } from '@/types'

interface Extraction {
  id: string
  filename: string
  status: ExtractionStatus
  insurance_type?: InsuranceType
  created_at: string
  updated_at: string
}

// Stats card component with enhanced design
function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  iconBgClass,
  iconClass,
  valueClass,
  suffix,
}: {
  title: string
  value: number
  description?: string
  icon: React.ElementType
  iconBgClass: string
  iconClass: string
  valueClass?: string
  suffix?: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconBgClass}`}>
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`text-3xl font-bold tracking-tight ${valueClass || ''}`}>
          {value}{suffix}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// Status badge configuration with dark mode support
const statusConfig: Record<
  ExtractionStatus,
  {
    icon: React.ElementType
    label: string
    className: string
    barColor: string
    spin?: boolean
  }
> = {
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    barColor: 'bg-amber-500',
  },
  processing: {
    icon: Loader2,
    label: 'Processing',
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    barColor: 'bg-blue-500',
    spin: true,
  },
  completed: {
    icon: CheckCircle,
    label: 'Ready',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    barColor: 'bg-emerald-500',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
    barColor: 'bg-red-500',
  },
  quoted: {
    icon: CheckCircle,
    label: 'Quoted',
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
    barColor: 'bg-purple-500',
  },
}

// Insurance type badge configuration with dark mode support
const insuranceTypeConfig: Record<
  InsuranceType,
  { icon: React.ElementType; label: string; className: string }
> = {
  home: {
    icon: Home,
    label: 'Home',
    className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800',
  },
  auto: {
    icon: Car,
    label: 'Auto',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800',
  },
  both: {
    icon: FileText,
    label: 'Bundle',
    className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800',
  },
  life: {
    icon: FileText,
    label: 'Life',
    className: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-800',
  },
  health: {
    icon: FileText,
    label: 'Health',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800',
  },
  generic: {
    icon: FileText,
    label: 'Generic',
    className: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/40 dark:text-gray-400 dark:border-gray-800',
  },
}

// Truncate filename helper
function truncateFilename(filename: string, maxLength = 32): string {
  if (filename.length <= maxLength) return filename
  const extension = filename.split('.').pop() || ''
  const nameWithoutExt = filename.slice(0, filename.lastIndexOf('.'))
  const truncatedName = nameWithoutExt.slice(0, maxLength - extension.length - 4)
  return `${truncatedName}...${extension}`
}

// Format relative date
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      if (diffMinutes < 1) return 'Just now'
      return `${diffMinutes}m ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Format full date for tooltip
function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Extraction card component with enhanced design
function ExtractionCard({ extraction }: { extraction: Extraction }) {
  const status = statusConfig[extraction.status] || statusConfig.pending
  const StatusIcon = status.icon
  const insuranceType = extraction.insurance_type
    ? insuranceTypeConfig[extraction.insurance_type]
    : null
  const InsuranceIcon = insuranceType?.icon

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30">
      {/* Top status indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${status.barColor}`} />

      <CardContent className="p-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* File icon and name */}
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/5 dark:bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  className="font-semibold text-sm truncate leading-tight"
                  title={extraction.filename}
                >
                  {truncateFilename(extraction.filename)}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Calendar className="h-3 w-3" />
                  <span title={formatFullDate(extraction.created_at)}>
                    {formatRelativeDate(extraction.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Status and type badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`${status.className} gap-1`}>
                <StatusIcon
                  className={`h-3 w-3 ${status.spin ? 'animate-spin' : ''}`}
                />
                {status.label}
              </Badge>
              {insuranceType && InsuranceIcon && (
                <Badge variant="outline" className={insuranceType.className}>
                  <InsuranceIcon className="h-3 w-3 mr-1" />
                  {insuranceType.label}
                </Badge>
              )}
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {extraction.status === 'completed' && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/review/${extraction.id}`}
                      className="flex items-center cursor-pointer"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Review & Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DeleteExtractionButton
                extractionId={extraction.id}
                filename={extraction.filename}
                asMenuItem
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Action button - conditional based on status */}
        <div className="mt-4">
          {extraction.status === 'completed' && (
            <Link href={`/review/${extraction.id}`} className="block">
              <Button variant="outline" size="sm" className="w-full group/btn gap-2">
                <Eye className="h-4 w-4" />
                Review Extraction
                <ArrowRight className="h-3 w-3 ml-auto opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
              </Button>
            </Link>
          )}
          {extraction.status === 'processing' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2 px-3 bg-muted/50 rounded-md">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span>Processing document...</span>
            </div>
          )}
          {extraction.status === 'pending' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2 px-3 bg-muted/50 rounded-md">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>Waiting to process...</span>
            </div>
          )}
          {extraction.status === 'failed' && (
            <Link href="/upload" className="block">
              <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30">
                <Upload className="h-4 w-4" />
                Try Again
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Loading skeleton for cards
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

// Loading skeleton grid
function DashboardSkeleton() {
  return (
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
  )
}

// Empty state component with enhanced design
function EmptyState() {
  return (
    <Card className="border-dashed border-2 bg-muted/20">
      <CardContent className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="h-20 w-20 rounded-2xl bg-primary/5 dark:bg-primary/10 flex items-center justify-center mb-6">
          <FolderOpen className="h-10 w-10 text-primary/60" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No extractions yet</h3>
        <p className="text-muted-foreground mb-8 max-w-md">
          Upload your first fact finder document to extract prospect information
          and prepare insurance quotes automatically.
        </p>
        <Link href="/upload">
          <Button size="lg" className="gap-2 shadow-sm">
            <Plus className="h-5 w-5" />
            Upload Your First Document
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// Main dashboard content
async function DashboardContent() {
  const supabase = await createClient()

  const { data: extractions } = await supabase
    .from('extractions')
    .select('*')
    .order('created_at', { ascending: false })

  const extractionsList = (extractions || []) as Extraction[]

  const stats = {
    total: extractionsList.length,
    completed: extractionsList.filter((e) => e.status === 'completed').length,
    pending: extractionsList.filter(
      (e) => e.status === 'pending' || e.status === 'processing'
    ).length,
    failed: extractionsList.filter((e) => e.status === 'failed').length,
  }

  // Calculate success rate
  const processedCount = stats.completed + stats.failed
  const successRate = processedCount > 0
    ? Math.round((stats.completed / processedCount) * 100)
    : 0

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Extractions"
          value={stats.total}
          description="All time"
          icon={FileText}
          iconBgClass="bg-primary/10"
          iconClass="text-primary"
        />
        <StatsCard
          title="Ready for Quote"
          value={stats.completed}
          description="Awaiting review"
          icon={CheckCircle}
          iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconClass="text-emerald-600"
          valueClass="text-emerald-600"
        />
        <StatsCard
          title="In Progress"
          value={stats.pending}
          description="Processing now"
          icon={Clock}
          iconBgClass="bg-blue-100 dark:bg-blue-900/30"
          iconClass="text-blue-600"
          valueClass="text-blue-600"
        />
        <StatsCard
          title="Success Rate"
          value={successRate}
          suffix="%"
          description={stats.failed > 0 ? `${stats.failed} failed` : 'No failures'}
          icon={TrendingUp}
          iconBgClass="bg-violet-100 dark:bg-violet-900/30"
          iconClass="text-violet-600"
          valueClass="text-violet-600"
        />
      </div>

      {/* Extractions Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Extractions</h2>
          {extractionsList.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {extractionsList.length} document{extractionsList.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {extractionsList.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {extractionsList.map((extraction) => (
              <ExtractionCard key={extraction.id} extraction={extraction} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header Section */}
      <div className="border-b bg-background">
        <div className="container max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Dashboard
              </h1>
              <p className="text-muted-foreground">
                Manage your fact finder extractions and prepare quotes
              </p>
            </div>
            <Link href="/upload">
              <Button size="lg" className="w-full sm:w-auto gap-2 shadow-sm">
                <Upload className="h-4 w-4" />
                Upload Document
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </div>
    </div>
  )
}
