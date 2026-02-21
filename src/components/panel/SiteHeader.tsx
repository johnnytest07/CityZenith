'use client'

import { useSiteStore } from '@/stores/siteStore'
import { useDevStore } from '@/stores/devStore'
import { getCentroid } from '@/lib/geometry'

export function SiteHeader() {
  const { siteContext, clearSiteContext } = useSiteStore()
  const { buildMode, activateBuildNew, deactivateBuild } = useDevStore()

  if (!siteContext) return null

  let coordLabel = ''
  try {
    const [lng, lat] = getCentroid(siteContext.siteGeometry)
    coordLabel = `${lat.toFixed(5)}°N, ${Math.abs(lng).toFixed(5)}°${lng < 0 ? 'W' : 'E'}`
  } catch {
    coordLabel = 'Selected site'
  }

  // Extract council name from first planning precedent feature that has one
  const councilName =
    siteContext.planningPrecedentFeatures?.features.find(
      (f) => f.properties?.council_name,
    )?.properties?.council_name ?? null

  const handleClose = () => {
    deactivateBuild()
    clearSiteContext()
  }

  return (
    <div className="flex items-start justify-between p-4 border-b border-gray-800 bg-gray-900">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
          Site Context
        </p>
        {councilName && (
          <p className="text-white text-sm font-semibold truncate leading-tight">{councilName}</p>
        )}
        <p className={`text-gray-400 text-xs truncate ${councilName ? 'mt-0.5' : 'text-sm font-medium text-white'}`}>
          {coordLabel}
        </p>
        <p className="text-gray-700 text-xs mt-1 font-mono">
          {siteContext.siteId.slice(0, 8)}
        </p>

        {/* Build New toggle */}
        <button
          onClick={buildMode === 'off' ? activateBuildNew : deactivateBuild}
          className={`mt-2 text-xs px-2.5 py-1 rounded font-medium transition-colors ${
            buildMode === 'new'
              ? 'bg-violet-700 text-white hover:bg-violet-600'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
        >
          {buildMode === 'new' ? 'Exit Build Mode' : '⊕ Build New'}
        </button>
      </div>
      <button
        onClick={handleClose}
        className="ml-3 flex-shrink-0 text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
        aria-label="Close site panel"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
