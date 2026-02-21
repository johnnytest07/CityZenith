'use client'

import { useSiteStore } from '@/stores/siteStore'
import { getCentroid } from '@/lib/geometry'

export function SiteHeader() {
  const { siteContext, clearSiteContext } = useSiteStore()

  if (!siteContext) return null

  let coordLabel = ''
  try {
    const [lng, lat] = getCentroid(siteContext.siteGeometry)
    coordLabel = `${lat.toFixed(5)}°N, ${Math.abs(lng).toFixed(5)}°${lng < 0 ? 'W' : 'E'}`
  } catch {
    coordLabel = 'Selected site'
  }

  return (
    <div className="flex items-start justify-between p-4 border-b border-gray-800">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">
          Site Context
        </p>
        <p className="text-white text-sm font-medium truncate">{coordLabel}</p>
        <p className="text-gray-600 text-xs mt-0.5 font-mono truncate">
          {siteContext.siteId.slice(0, 8)}
        </p>
      </div>
      <button
        onClick={clearSiteContext}
        className="ml-3 flex-shrink-0 text-gray-500 hover:text-white transition-colors p-1 rounded"
        aria-label="Close site panel"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
