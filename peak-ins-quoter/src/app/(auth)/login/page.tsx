import { LoginForm } from '@/components/auth/login-form'

// Prevent static generation - requires runtime environment variables
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Fact Finder</h1>
          <p className="text-muted-foreground">
            Extract and manage insurance prospect data
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
