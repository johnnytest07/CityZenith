import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CityZenith — Site Planning Context',
  description: 'Parcel-level spatial planning evidence tool for UK development sites',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
