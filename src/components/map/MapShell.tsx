'use client'

import { MapCanvas } from './MapCanvas'
import { MapPrompt } from './MapPrompt'
import { SidePanel } from '@/components/panel/SidePanel'
import { useSiteStore } from '@/stores/siteStore'

/**
 * Top-level layout container: map (flex-1) + side panel (w-96, conditional).
 * The MapPrompt overlay is shown when no site is selected.
 */
export function MapShell() {
  const { siteContext } = useSiteStore()

  const hasSite = siteContext !== null

  return (
    <div className="flex h-screen w-screen bg-gray-950 overflow-hidden">
      {/* Map area */}
      <div className="relative flex-1 min-w-0">
        <MapCanvas />
        <MapPrompt visible={!hasSite} />
      </div>

      {/* Side panel — slides in when a site is selected */}
      {hasSite && (
        <div className="w-96 flex-shrink-0 border-l border-gray-800 overflow-y-auto bg-gray-950">
          <SidePanel />
        </div>
      )}
    </div>
  )
}
