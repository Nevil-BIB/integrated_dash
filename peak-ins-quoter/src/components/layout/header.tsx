import { createClient } from '@/lib/supabase/server'
import { UserNav } from './user-nav'

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-end px-4">
        <UserNav email={user?.email} />
      </div>
    </header>
  )
}
