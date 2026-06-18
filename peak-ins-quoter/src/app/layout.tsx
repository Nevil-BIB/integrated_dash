import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fact Finder Extraction',
  description: 'Extract and manage insurance prospect data from scanned documents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
