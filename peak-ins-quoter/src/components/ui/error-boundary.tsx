'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card'

export interface ErrorBoundaryProps {
  /** Child components to wrap with error protection */
  children: ReactNode
  /** Custom fallback component to render on error */
  fallback?: ReactNode
  /** Callback fired when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Whether to show reset button (default: true) */
  showReset?: boolean
  /** Custom error title */
  title?: string
  /** Custom error description */
  description?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * ErrorBoundary Component
 *
 * A React error boundary that catches JavaScript errors anywhere in the child
 * component tree, logs those errors, and displays a fallback UI.
 *
 * @example Basic usage
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example With error callback
 * ```tsx
 * <ErrorBoundary onError={(error, info) => logError(error, info)}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // Store error info for display
    this.setState({ errorInfo })

    // Call optional error callback
    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state
    const {
      children,
      fallback,
      showReset = true,
      title = 'Something went wrong',
      description = 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    } = this.props

    if (hasError) {
      // Render custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Render default error UI
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg text-destructive">{title}</CardTitle>
                <CardDescription className="text-destructive/80">
                  {description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {process.env.NODE_ENV === 'development' && error && (
            <CardContent>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                  Error details (development only)
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="rounded-md bg-muted p-3">
                    <p className="font-mono text-xs text-destructive">
                      {error.message}
                    </p>
                  </div>
                  {errorInfo?.componentStack && (
                    <div className="rounded-md bg-muted p-3">
                      <p className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            </CardContent>
          )}

          {showReset && (
            <CardFooter>
              <Button
                variant="outline"
                onClick={this.handleReset}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </CardFooter>
          )}
        </Card>
      )
    }

    return children
  }
}

/**
 * Higher-order component to wrap a component with an ErrorBoundary
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   onError: logError,
 * })
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`

  return ComponentWithErrorBoundary
}

export default ErrorBoundary
